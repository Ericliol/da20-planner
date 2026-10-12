/**
 * Saved load sheets: what gets stored, and reopening a stored sheet.
 * A sheet keeps its inputs and the aircraft data used, so it can be reopened
 * exactly as it was even if the aircraft data changes later.
 */
import type { AppState } from '../state';
import type { PerformanceResult } from './performance';
import { supabase } from './supabase';
import type { Aircraft, WBResult } from './wb';

export interface SheetSnapshot {
  aircraft: Aircraft;
  units: AppState['units'];
  loading: AppState['loading'];
  departure: AppState['departure'];
  arrival: AppState['arrival'];
  marginFactor: number;
  ignoreHeadwind: boolean;
}

export interface SheetSummary {
  takeoffMassKg: number;
  takeoffArmM: number;
  wbOk: boolean;
  todr: number | null;
  toda: number;
  toOk: boolean;
  ldr: number;
  lda: number;
  ldOk: boolean;
  departureIcao: string;
  arrivalIcao: string;
}

export interface SavedSheet {
  id: string;
  created_at: string;
  registration: string;
  within_limits: boolean;
  summary: SheetSummary;
  snapshot: SheetSnapshot;
}

export function buildSheet(state: AppState, aircraft: Aircraft, wb: WBResult, perf: PerformanceResult) {
  const snapshot: SheetSnapshot = {
    aircraft,
    units: state.units,
    loading: state.loading,
    departure: state.departure,
    arrival: state.arrival,
    marginFactor: state.marginFactor,
    ignoreHeadwind: state.ignoreHeadwind,
  };
  const summary: SheetSummary = {
    takeoffMassKg: wb.takeoff.massKg,
    takeoffArmM: wb.takeoff.armM,
    wbOk: wb.ok,
    todr: perf.to50 ? perf.todr : null,
    toda: perf.departure.availableM,
    toOk: perf.toOk,
    ldr: perf.ldr,
    lda: perf.arrival.availableM,
    ldOk: perf.ldOk,
    departureIcao: state.departure.icao,
    arrivalIcao: state.arrival.sameAsDeparture ? state.departure.icao : state.arrival.icao,
  };
  return { registration: aircraft.registration, within_limits: wb.ok && perf.toOk && perf.ldOk, summary, snapshot };
}

/**
 * Inputs to load when reopening a sheet. The saved aircraft data is used for
 * this sheet even if the fleet data has changed since; `aircraftChanged` says so.
 */
export function reopenSheet(state: AppState, sheet: SavedSheet): { next: AppState; aircraftChanged: boolean } {
  const saved = sheet.snapshot.aircraft;
  const current = state.aircraft.find((a) => a.id === saved.id);
  const aircraftChanged =
    !current || Math.abs(current.emptyMassKg - saved.emptyMassKg) > 1e-6 || Math.abs(current.emptyArmM - saved.emptyArmM) > 1e-9 || current.fuelSystem !== saved.fuelSystem;
  // A changed (or since removed) aircraft is shown under a separate id so fleet data isn't overwritten.
  const viewAircraft = aircraftChanged ? { ...saved, id: `saved-${sheet.id}`, registration: `${saved.registration} (as saved)` } : saved;
  const aircraft = aircraftChanged ? [...state.aircraft.filter((a) => !a.id.startsWith('saved-')), viewAircraft] : state.aircraft;
  return {
    aircraftChanged,
    next: {
      ...state,
      aircraft,
      selectedId: viewAircraft.id,
      units: sheet.snapshot.units,
      loading: sheet.snapshot.loading,
      departure: { ...state.departure, ...sheet.snapshot.departure },
      arrival: { ...state.arrival, ...sheet.snapshot.arrival },
      marginFactor: sheet.snapshot.marginFactor,
      ignoreHeadwind: sheet.snapshot.ignoreHeadwind,
    },
  };
}

function client() {
  if (!supabase) throw new Error('Accounts are not set up yet.');
  return supabase;
}

export async function saveSheet(row: ReturnType<typeof buildSheet>): Promise<void> {
  const { error } = await client().from('load_sheets').insert(row);
  if (error) throw new Error(error.message);
}

export async function listSheets(): Promise<SavedSheet[]> {
  const { data, error } = await client()
    .from('load_sheets')
    .select('id, created_at, registration, within_limits, summary, snapshot')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data as SavedSheet[];
}

export async function deleteSheet(id: string): Promise<void> {
  const { error } = await client().from('load_sheets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
