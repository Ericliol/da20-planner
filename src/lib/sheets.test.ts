import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, VH_XTN } from '../state';
import { computePerformance } from './performance';
import { buildSheet, reopenSheet, type SavedSheet } from './sheets';
import { computeWB } from './wb';

const wb = computeWB(VH_XTN, DEFAULT_STATE.loading);
const perf = computePerformance(DEFAULT_STATE, VH_XTN, wb);
const row = buildSheet(DEFAULT_STATE, VH_XTN, wb, perf);
const saved: SavedSheet = { id: 'abc', created_at: '2026-10-13T00:00:00Z', ...row };

describe('saved load sheets', () => {
  it('summarises the key numbers', () => {
    expect(row.registration).toBe('VH-XTN');
    expect(row.summary.takeoffMassKg).toBeCloseTo(wb.takeoff.massKg);
    expect(row.summary.todr).toBeCloseTo(perf.todr);
    expect(row.within_limits).toBe(wb.ok && perf.toOk && perf.ldOk);
  });

  it('reopens a sheet with its inputs', () => {
    const changed = { ...DEFAULT_STATE, loading: { ...DEFAULT_STATE.loading, seatsKg: 75 } };
    const { next, aircraftChanged } = reopenSheet(changed, saved);
    expect(aircraftChanged).toBe(false);
    expect(next.loading.seatsKg).toBe(DEFAULT_STATE.loading.seatsKg);
    expect(next.selectedId).toBe('vh-xtn');
  });

  it('keeps the saved aircraft data if the fleet data changed since', () => {
    const fleetChanged = {
      ...DEFAULT_STATE,
      aircraft: DEFAULT_STATE.aircraft.map((a) => (a.id === 'vh-xtn' ? { ...a, emptyMassKg: 560 } : a)),
    };
    const { next, aircraftChanged } = reopenSheet(fleetChanged, saved);
    expect(aircraftChanged).toBe(true);
    const shown = next.aircraft.find((a) => a.id === next.selectedId)!;
    expect(shown.emptyMassKg).toBe(VH_XTN.emptyMassKg);
    expect(shown.registration).toBe('VH-XTN (as saved)');
    // Fleet data itself is untouched.
    expect(next.aircraft.find((a) => a.id === 'vh-xtn')!.emptyMassKg).toBe(560);
  });
});
