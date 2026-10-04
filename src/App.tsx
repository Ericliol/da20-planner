import { useState } from 'react';
import { AircraftEditor } from './components/AircraftEditor';
import { Performance } from './components/Performance';
import { StatusPill, Toggle } from './components/ui';
import { WeightBalance } from './components/WeightBalance';
import { computePerformance } from './lib/performance';
import { computeWB } from './lib/wb';
import { DEFAULT_STATE, usePersistentState } from './state';

const TABS = ['W&B', 'Performance', 'Aircraft'] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [state, setState] = usePersistentState();
  const [tab, setTab] = useState<Tab>('W&B');
  const aircraft = state.aircraft.find((a) => a.id === state.selectedId) ?? state.aircraft[0];
  const wb = computeWB(aircraft, state.loading);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 print:px-0 print:pb-0">
      <header className="no-print sticky top-0 z-10 -mx-4 mb-4 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="./favicon.svg" alt="" className="size-8" />
            <div>
              <h1 className="text-base font-semibold leading-tight">DA20-C1 Planner</h1>
              <p className="text-xs text-slate-500">W&amp;B · take-off · landing</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Aircraft"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold"
              value={aircraft.id}
              onChange={(e) => setState((s) => ({ ...s, selectedId: e.target.value }))}
            >
              {state.aircraft.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.registration}
                </option>
              ))}
            </select>
            <Toggle label="Mass units" value={state.units.mass} options={['kg', 'lb'] as const} onChange={(mass) => setState((s) => ({ ...s, units: { ...s.units, mass } }))} />
            <Toggle label="Fuel units" value={state.units.fuel} options={['L', 'USG'] as const} onChange={(fuel) => setState((s) => ({ ...s, units: { ...s.units, fuel } }))} />
          </div>
        </div>
        <nav className="no-print mt-3 flex gap-1" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${t === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
            >
              {t}
              {t === 'W&B' && (
                <span className="ml-1.5 align-middle">
                  <StatusPill ok={wb.ok}>{wb.ok ? 'OK' : '!'}</StatusPill>
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'W&B' && (
          <WeightBalance aircraft={aircraft} loading={state.loading} setLoading={(loading) => setState((s) => ({ ...s, loading }))} result={wb} units={state.units} perf={computePerformance(state, aircraft, wb)} />
        )}
        {tab === 'Performance' && <Performance state={state} setState={setState} aircraft={aircraft} wb={wb} />}
        {tab === 'Aircraft' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AircraftEditor
              aircraft={state.aircraft}
              selectedId={aircraft.id}
              units={state.units}
              onChange={(list, selectedId) => setState((s) => ({ ...s, aircraft: list, selectedId }))}
              onRestoreBuiltIn={() => setState((s) => ({ ...s, aircraft: DEFAULT_STATE.aircraft, selectedId: DEFAULT_STATE.selectedId }))}
            />
            <div className="text-sm text-slate-600">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-white"
                onClick={() =>
                  confirm('Reset your load, aerodrome and unit inputs to defaults? Aircraft data is not changed.') &&
                  setState((s) => ({ ...DEFAULT_STATE, aircraft: s.aircraft, selectedId: s.selectedId }))
                }
              >
                Reset my inputs to defaults
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="no-print mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        <strong>Training aid only.</strong> Not an approved flight planning tool. Results come from the DA20-C1 AFM (DOC #
        DA202-C1, Rev 28) charts and tables, digitised and interpolated, and may differ from a hand reading of the charts.
        Always cross-check against the AFM and the aircraft's current weight &amp; balance data. The pilot in command
        is responsible for the loading and performance of the aircraft.
      </footer>
    </div>
  );
}
