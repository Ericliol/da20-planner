import { useState } from 'react';
import { WX_PROXY_URL } from '../config';
import { ageText, fetchMetars, fetchTafs, formatTaf, isIcao, type Metar, metarToAerodrome, type Taf } from '../lib/wx';
import type { Aerodrome, AppState } from '../state';
import { Card, NumberField } from './ui';

const NAIPS_URL = 'https://www.airservicesaustralia.com/naips/';

type Which = 'departure' | 'arrival';

/** NAIPS / weather tab: METAR + TAF for the departure and arrival aerodromes, and links to NAIPS. */
export function Weather({ state, setState }: { state: AppState; setState: (fn: (s: AppState) => AppState) => void }) {
  const same = state.arrival.sameAsDeparture;
  const [metars, setMetars] = useState<Metar[]>([]);
  const [tafs, setTafs] = useState<Taf[]>([]);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState('');

  const setAd = (which: Which, patch: Partial<Aerodrome>) =>
    setState((s) => ({ ...s, [which]: { ...s[which], ...patch } }));

  const ids = [state.departure.icao, same ? '' : state.arrival.icao].map((s) => s.trim().toUpperCase()).filter(isIcao);

  const load = async () => {
    setBusy(true);
    setError('');
    setApplied('');
    try {
      const [m, t] = await Promise.all([fetchMetars(ids), fetchTafs(ids)]);
      setMetars(m);
      setTafs(t);
      setFetchedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = (which: Which, m: Metar) => {
    const ad = state[which];
    const v = metarToAerodrome(m, ad.magVarE, ad.runwayHeadingDeg);
    setState((s) => {
      const next = { ...s[which], windKt: v.windKt, windDirDeg: v.windDirDeg };
      if (v.qnhHpa !== undefined) next.qnhHpa = v.qnhHpa;
      if (v.oatC !== undefined) next.oatC = v.oatC;
      return { ...s, [which]: next };
    });
    setApplied(
      `${m.icaoId} applied to ${which}${same && which === 'departure' ? ' (and arrival)' : ''}: QNH ${v.qnhHpa ?? '-'}, OAT ${v.oatC ?? '-'} °C, wind ${String(v.windDirDeg).padStart(3, '0')}°M / ${v.windKt} kt` +
        (v.variableWind ? ' (variable wind set as a tailwind, conservative)' : '') +
        (m.wgst ? `. Gusting ${m.wgst} kt: gusts are not used.` : '.'),
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="Aerodromes">
        <div className="grid grid-cols-2 gap-3">
          <IcaoField label="Departure ICAO" value={state.departure.icao} onChange={(icao) => setAd('departure', { icao })} />
          <NumberField
            label="Mag variation (departure)"
            value={state.departure.magVarE}
            onChange={(magVarE) => setAd('departure', { magVarE })}
            unit="°E"
            decimals={0}
          />
          {same ? (
            <p className="col-span-2 text-xs text-slate-500">Arrival is the same aerodrome (set on the Performance tab).</p>
          ) : (
            <>
              <IcaoField label="Arrival ICAO" value={state.arrival.icao} onChange={(icao) => setAd('arrival', { icao })} />
              <NumberField
                label="Mag variation (arrival)"
                value={state.arrival.magVarE}
                onChange={(magVarE) => setAd('arrival', { magVarE })}
                unit="°E"
                decimals={0}
              />
            </>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={busy || !ids.length || !WX_PROXY_URL}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {busy ? 'Fetching…' : 'Get METAR / TAF'}
          </button>
          <a
            href={NAIPS_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open NAIPS (NOTAM &amp; briefing) ↗
          </a>
        </div>
        {!WX_PROXY_URL && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            The weather relay isn't set up yet, so METAR / TAF can't be fetched. NAIPS still works.
          </p>
        )}
        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">⚠ {error}</p>}
        {applied && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">✓ {applied}</p>}
        <p className="mt-3 text-xs text-slate-500">
          METAR / TAF come from the Bureau of Meteorology via the international feed (aviationweather.gov). Many smaller
          aerodromes (e.g. YBAF, YRED, YMMB, YSBK) aren't in that feed: use NAIPS. NOTAMs are only in NAIPS (login
          required). This is not an official briefing: always check NAIPS before flight.
        </p>
      </Card>

      {fetchedAt &&
        ids.map((id, i) => {
          const which: Which = i === 0 ? 'departure' : 'arrival';
          const m = metars.find((x) => x.icaoId === id);
          const t = tafs.find((x) => x.icaoId === id);
          return (
            <Card key={id} title={`${id}${m?.name ? `: ${m.name}` : ''}`} right={<span className="text-xs text-slate-500">{which}</span>}>
              {!m && !t ? (
                <p className="text-sm text-slate-700">
                  No METAR or TAF for {id} in the international feed. Check{' '}
                  <a href={NAIPS_URL} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                    NAIPS
                  </a>{' '}
                  (or the AWIS), or use a nearby major aerodrome for area QNH.
                </p>
              ) : (
                <>
                  {m ? <MetarView m={m} onApply={() => apply(which, m)} which={which} /> : <p className="text-sm text-slate-500">No METAR.</p>}
                  <h3 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">TAF</h3>
                  {t ? (
                    <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-xs leading-relaxed">
                      {formatTaf(t.rawTAF).join('\n')}
                    </pre>
                  ) : (
                    <p className="text-sm text-slate-500">No TAF.</p>
                  )}
                </>
              )}
            </Card>
          );
        })}
    </div>
  );
}

function IcaoField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const bad = value.trim() !== '' && !isIcao(value);
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        className={`w-full rounded-lg border px-3 py-2 text-base uppercase outline-none focus:ring-2 ${bad ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-200'}`}
        value={value}
        maxLength={4}
        placeholder="e.g. YBAF"
        autoCapitalize="characters"
        onChange={(e) => onChange(e.target.value.toUpperCase())}
      />
    </label>
  );
}

function MetarView({ m, onApply, which }: { m: Metar; onApply: () => void; which: Which }) {
  const wind =
    m.wdir === 'VRB' ? `VRB / ${m.wspd ?? 0} kt` : `${String(m.wdir ?? 0).padStart(3, '0')}°T / ${m.wspd ?? 0} kt${m.wgst ? ` G${m.wgst}` : ''}`;
  const cloud = m.clouds?.length ? m.clouds.map((c) => `${c.cover}${c.base !== undefined ? ` ${c.base} ft` : ''}`).join(', ') : 'nil';
  const rows: [string, string][] = [
    ['Wind', wind],
    ['Visibility', m.visib === '6+' ? '10 km or more' : `${m.visib ?? '-'}`],
    ['Cloud', cloud],
    ['Temp / dew point', `${m.temp ?? '-'} / ${m.dewp ?? '-'} °C`],
    ['QNH', m.altim !== undefined ? `${Math.round(m.altim)} hPa` : '-'],
  ];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">METAR</h3>
        <span className="text-xs text-slate-500">{ageText(m.obsTime)}</span>
      </div>
      <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-xs">{m.rawOb}</pre>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={onApply}
        className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Apply QNH, OAT &amp; wind to {which}
      </button>
    </div>
  );
}
