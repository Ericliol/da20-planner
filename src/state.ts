import { useEffect, useState } from 'react';
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

const aerodrome: Aerodrome = {
  elevationFt: 0,
  qnhHpa: 1013,
  oatC: 15,
  runwayHeadingDeg: 0,
  windDirDeg: 0,
  windKt: 0,
  availableM: 1000,
};

export const DEFAULT_STATE: AppState = {
  version: 1,
  units: { mass: 'kg', fuel: 'L' },
  aircraft: [VH_XTN],
  selectedId: VH_XTN.id,
  loading: { seatsKg: 160, baggageKg: 0, baggageExtKg: 0, fuelL: 91, taxiFuelL: 5, tripFuelL: 30 },
  departure: { ...aerodrome, obstacleFt: 50 },
  arrival: { ...aerodrome, sameAsDeparture: true },
  marginFactor: 1,
};

const KEY = 'da20-planner:v1';

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const s = JSON.parse(raw) as AppState;
    if (s.version !== 1) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...s };
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
