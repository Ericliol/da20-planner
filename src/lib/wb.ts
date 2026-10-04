import {
  ARM,
  cgLimits,
  FUEL_KG_PER_L,
  type FuelSystem,
  MAX_BAGGAGE_KG,
  MAX_RAMP_KG,
  MAX_TAKEOFF_KG,
  USABLE_FUEL_L,
} from './afm';

export interface Aircraft {
  id: string;
  registration: string;
  /** Basic empty mass incl. unusable fuel and full oil (kg). */
  emptyMassKg: number;
  /** Empty CG arm aft of datum (m). */
  emptyArmM: number;
  fuelSystem: FuelSystem;
  /** Ground idle set to 1000 RPM (AFM 5.3.12 landing note). */
  idle1000Rpm: boolean;
  notes?: string;
}

export interface Loading {
  seatsKg: number; // pilot + passenger
  baggageKg: number;
  baggageExtKg: number;
  fuelL: number; // usable fuel at start-up
  taxiFuelL: number;
  tripFuelL: number;
}

export interface Station {
  label: string;
  massKg: number;
  armM: number;
  momentKgM: number;
}

export interface LoadPoint {
  label: string;
  massKg: number;
  momentKgM: number;
  armM: number;
  limits: { fwd: number; aft: number };
  maxMassKg: number;
  withinCg: boolean;
  withinMass: boolean;
}

export interface WBResult {
  stations: Station[];
  zeroFuel: LoadPoint;
  ramp: LoadPoint;
  takeoff: LoadPoint;
  landing: LoadPoint;
  errors: string[];
  ok: boolean;
}

const station = (label: string, massKg: number, armM: number): Station => ({
  label,
  massKg,
  armM,
  momentKgM: massKg * armM,
});

function point(label: string, massKg: number, momentKgM: number, maxMassKg: number): LoadPoint {
  const armM = massKg > 0 ? momentKgM / massKg : 0;
  const limits = cgLimits(massKg);
  const eps = 0.00005; // 0.05 mm: limits are published to the millimetre
  return {
    label,
    massKg,
    momentKgM,
    armM,
    limits,
    maxMassKg,
    withinCg: armM >= limits.fwd - eps && armM <= limits.aft + eps,
    withinMass: massKg <= maxMassKg + 0.05,
  };
}

export function computeWB(ac: Aircraft, load: Loading): WBResult {
  const stations = [
    station('Empty aircraft', ac.emptyMassKg, ac.emptyArmM),
    station('Pilot & passenger', load.seatsKg, ARM.seats),
    station('Baggage compartment', load.baggageKg, ARM.baggage),
    station('Baggage extension', load.baggageExtKg, ARM.baggageExt),
  ];
  const zfMass = stations.reduce((s, x) => s + x.massKg, 0);
  const zfMoment = stations.reduce((s, x) => s + x.momentKgM, 0);

  const fuelKg = (l: number) => Math.max(0, l) * FUEL_KG_PER_L;
  const rampFuel = fuelKg(load.fuelL);
  const toFuel = fuelKg(load.fuelL - load.taxiFuelL);
  const ldgFuel = fuelKg(load.fuelL - load.taxiFuelL - load.tripFuelL);
  stations.push(station('Usable fuel (start-up)', rampFuel, ARM.fuel));

  const at = (label: string, f: number, max: number) => point(label, zfMass + f, zfMoment + f * ARM.fuel, max);
  const zeroFuel = at('Zero fuel', 0, MAX_TAKEOFF_KG);
  const ramp = at('Ramp', rampFuel, MAX_RAMP_KG);
  const takeoff = at('Take-off', toFuel, MAX_TAKEOFF_KG);
  const landing = at('Landing', ldgFuel, MAX_TAKEOFF_KG);

  const errors: string[] = [];
  const bag = load.baggageKg + load.baggageExtKg;
  if (bag > MAX_BAGGAGE_KG + 0.05) errors.push(`Baggage ${bag.toFixed(1)} kg exceeds the 20 kg (44 lb) combined limit.`);
  const cap = USABLE_FUEL_L[ac.fuelSystem];
  if (load.fuelL > cap + 0.05) errors.push(`Fuel ${load.fuelL} L exceeds usable capacity (${cap} L).`);
  if (load.taxiFuelL + load.tripFuelL > load.fuelL) errors.push('Taxi + trip fuel exceeds fuel on board.');
  for (const p of [zeroFuel, ramp, takeoff, landing]) {
    if (!p.withinMass) errors.push(`${p.label} mass ${p.massKg.toFixed(1)} kg exceeds the ${p.maxMassKg} kg limit.`);
    if (!p.withinCg) errors.push(`${p.label} CG ${(p.armM * 1000).toFixed(1)} mm is outside limits (${(p.limits.fwd * 1000).toFixed(1)}–${(p.limits.aft * 1000).toFixed(1)} mm).`);
  }
  return { stations, zeroFuel, ramp, takeoff, landing, errors, ok: errors.length === 0 };
}
