import { useEffect, useState } from 'react';
import { AircraftDocuments } from './components/AircraftDocuments';
import { PrintSheet } from './components/PrintSheet';
import { Weather } from './components/Weather';
import { AircraftEditor } from './components/AircraftEditor';
import { MySheets } from './components/MySheets';
import { Performance } from './components/Performance';
import { StatusPill, Toggle } from './components/ui';
import { WeightBalance } from './components/WeightBalance';
import { computePerformance } from './lib/performance';
import { buildSheet, reopenSheet, saveSheet, type SavedSheet } from './lib/sheets';
import { supabase, useSession } from './lib/supabase';
import { computeWB } from './lib/wb';
import { DEFAULT_STATE, usePersistentState } from './state';

const TABS = ['W&B', 'Performance', 'NAIPS / Wx', 'Aircraft', 'My sheets'] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [state, setState] = usePersistentState();
  const [tab, setTab] = useState<Tab>('W&B');
  const aircraft = state.aircraft.find((a) => a.id === state.selectedId) ?? state.aircraft[0];
  const wb = computeWB(aircraft, state.loading);
  const perf = computePerformance(state, aircraft, wb);
  const auth = useSession();
  const [saving, setSaving] = useState(false);
  const [sheetsVersion, setSheetsVersion] = useState(0);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const save = async () => {
    if (!auth.session) {
      setTab('My sheets');
      setNotice({ ok: false, text: 'Sign in to save load sheets.' });
      return;
    }
    setSaving(true);
    try {
      await saveSheet(buildSheet(state, aircraft, wb, perf));
      setSheetsVersion((v) => v + 1);
      setNotice({ ok: true, text: `Load sheet for ${aircraft.registration} saved to My sheets.` });
    } catch (e) {
      setNotice({ ok: false, text: `Couldn't save: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setSaving(false);
    }
  };

  const open = (sheet: SavedSheet) => {
    const { next, aircraftChanged } = reopenSheet(state, sheet);
    setState(() => next);
    setTab('W&B');
    setNotice({
      ok: true,
      text: `Opened the ${sheet.registration} sheet saved ${new Date(sheet.created_at).toLocaleString()}.${aircraftChanged ? ' The aircraft data has changed since, so the data saved with the sheet is shown.' : ''}`,
    });
  };

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
            {supabase && (
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                title={auth.session ? 'Save this load sheet to My sheets' : 'Sign in to save load sheets'}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
              title="Print the load sheet: weight & balance and take-off / landing performance"
            >
              Print
            </button>
          </div>
        </div>
        <nav className="no-print -mx-4 mt-3 flex gap-1 overflow-x-auto px-4" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${t === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
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
        {notice && (
          <p
            role="status"
            className={`mt-2 rounded-md px-3 py-1.5 text-sm ${notice.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}
          >
            {notice.text}
          </p>
        )}
      </header>

      <main className="no-print">
        {tab === 'W&B' && (
          <WeightBalance aircraft={aircraft} loading={state.loading} setLoading={(loading) => setState((s) => ({ ...s, loading }))} result={wb} units={state.units} />
        )}
        {tab === 'Performance' && <Performance state={state} setState={setState} aircraft={aircraft} wb={wb} />}
        {tab === 'NAIPS / Wx' && <Weather state={state} setState={setState} />}
        {tab === 'My sheets' && <MySheets auth={auth} units={state.units} reloadKey={sheetsVersion} onOpen={open} />}
        {tab === 'Aircraft' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AircraftEditor
              aircraft={state.aircraft}
              selectedId={aircraft.id}
              units={state.units}
              onChange={(list, selectedId) => setState((s) => ({ ...s, aircraft: list, selectedId }))}
              onRestoreBuiltIn={() => setState((s) => ({ ...s, aircraft: DEFAULT_STATE.aircraft, selectedId: DEFAULT_STATE.selectedId }))}
            />
            <div className="space-y-4 text-sm text-slate-600">
              <AircraftDocuments aircraft={aircraft} />
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

      <PrintSheet aircraft={aircraft} loading={state.loading} wb={wb} perf={perf} units={state.units} />

      <footer className="no-print mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        <strong>Training aid only.</strong> Not an approved flight planning tool. Results come from the DA20-C1 AFM (DOC #
        DA202-C1, Rev 28) charts and tables, digitised and interpolated, and may differ from a hand reading of the charts.
        Always cross-check against the AFM and the aircraft's current weight &amp; balance data. The pilot in command
        is responsible for the loading and performance of the aircraft.
      </footer>
    </div>
  );
}
