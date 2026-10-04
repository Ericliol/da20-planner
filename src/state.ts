import { useEffect, useState } from 'react';
import type { Surface } from './lib/factors';
import type { Aircraft, Loading } from './lib/wb';

export interface Units {
  mass: 'kg' | 'lb';
  fuel: 'L' | 'USG';
}

export interface Aerodrome {
  elevationFt: number;
  qnhHpa: number;
  oatC: number;
  runwayHeadingDeg: number;
  windDirDeg: number;
  windKt: number;
  /** Runway length available (m): TODA for departure, LDA for arrival. */
  availableM: number;
  surface: Surface;
  /** Runway slope in the direction of travel, %: + uphill, - downhill. */
  slopePct: number;
}

export interface AppState {
  version: 1;
  units: Units;
  aircraft: Aircraft[];
  selectedId: string;
  loading: Loading;
  departure: Aerodrome & { obstacleFt: number };
  arrival: Aerodrome & { sameAsDeparture: boolean };
  /** Multiplier applied to required distances (school / personal SOP). */
  marginFactor: number;
  /** Take-off: give no credit for a headwind (tailwind is always applied). */
  ignoreHeadwind: boolean;
}

// VH-XTN weighing report WB-6071, D. MacArthur & Associates, 30-Nov-15 (in AFM pack).
export const VH_XTN: Aircraft = {
  id: 'vh-xtn',
  registration: 'VH-XTN',
  emptyMassKg: 556.0,
  emptyArmM: 0.2657,
  fuelSystem: 'type2',
  idle1000Rpm: false,
  notes: 'S/N 00054. Weighing WB-6071, 30-Nov-15: 556.0 kg @ 265.7 mm (147753 kg·mm). MT propeller.',
};

// VH-HUU load data sheet, Issue One, 14-7-02 (P.A. Denholm, Weight Control Auth. AS2):
// 548.5 kg, arm 238 mm, 130578 kg·mm. The printed arm is rounded, so the arm is
// taken from the moment (130578 / 548.5 = 238.06 mm) to reproduce it exactly.
export const VH_HUU: Aircraft = {
  id: 'vh-huu',
  registration: 'VH-HUU',
  emptyMassKg: 548.5,
  emptyArmM: 130.578 / 548.5,
  fuelSystem: 'type2',
  idle1000Rpm: false,
  notes:
    'S/N C0093, ex N157AA. Load data sheet 14-7-02: 548.5 kg @ 238 mm (130578 kg·mm), incl. unusable fuel & full engine oil. Fuel system type not on the sheet: check.',
};

const BUILT_IN_AIRCRAFT = [VH_XTN, VH_HUU];

const aerodrome: Aerodrome = {
  elevationFt: 0,
  qnhHpa: 1013,
  oatC: 15,
  runwayHeadingDeg: 0,
  windDirDeg: 0,
  windKt: 0,
  availableM: 1000,
  surface: 'paved-dry',
  slopePct: 0,
};

export const DEFAULT_STATE: AppState = {
  version: 1,
  units: { mass: 'kg', fuel: 'L' },
  aircraft: BUILT_IN_AIRCRAFT,
  selectedId: VH_XTN.id,
  loading: { seatsKg: 160, baggageKg: 0, baggageExtKg: 0, fuelL: 91, taxiFuelL: 5, tripFuelL: 30 },
  departure: { ...aerodrome, obstacleFt: 50 },
  arrival: { ...aerodrome, sameAsDeparture: true },
  marginFactor: 1,
  ignoreHeadwind: true,
};

const KEY = 'da20-planner:v1';

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const s = JSON.parse(raw) as AppState;
    if (s.version !== 1) return DEFAULT_STATE;
    // Merge nested objects too, so fields added in later versions get their defaults.
    return {
      ...DEFAULT_STATE,
      ...s,
      units: { ...DEFAULT_STATE.units, ...s.units },
      loading: { ...DEFAULT_STATE.loading, ...s.loading },
      departure: { ...DEFAULT_STATE.departure, ...s.departure },
      arrival: { ...DEFAULT_STATE.arrival, ...s.arrival },
      // Add built-in aircraft that were introduced after this state was saved.
      aircraft: [...s.aircraft, ...BUILT_IN_AIRCRAFT.filter((a) => !s.aircraft.some((x) => x.id === a.id))],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function usePersistentState() {
  const [state, setState] = useState<AppState>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }, [state]);
  return [state, setState] as const;
}
