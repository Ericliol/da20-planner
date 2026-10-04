import { type ReactNode, useEffect, useState } from 'react';
import { FACTOR_SOURCE, SURFACES } from '../lib/factors';
import { fmtDist, fmtFt } from '../lib/format';
import type { PerformanceResult } from '../lib/performance';
import type { Aircraft, Loading, WBResult } from '../lib/wb';
import type { Units } from '../state';
import { Envelope } from './Envelope';
import { LoadingTable } from './LoadingTable';
import { Nomogram } from './Nomogram';

/**
 * The printed load sheet (only visible when printing). Two A4 pages:
 *   1. weight & balance: AFM Fig 6.7 table (compact) and the Fig 6.8 chart (large)
 *   2. performance: TODR / LDR table (compact) and the Fig 5.4 take-off chart (large)
 */
export function PrintSheet(props: { aircraft: Aircraft; loading: Loading; wb: WBResult; perf: PerformanceResult; units: Units }) {
  const { aircraft, loading, wb, perf, units } = props;
  const now = usePrintTime();
  const ok = wb.ok && perf.toOk && perf.ldOk;
  const points = [wb.zeroFuel, wb.ramp, wb.takeoff, wb.landing];

  return (
    <div className="hidden text-slate-900 print:block">
      {/* ---- page 1: weight & balance ---- */}
      <section className="print-page">
        <Header title={`Load sheet: ${aircraft.registration} (DA20-C1)`} now={now} ok={ok}>
          Empty weight {aircraft.emptyMassKg.toFixed(1)} kg @ {(aircraft.emptyArmM * 1000).toFixed(1)} mm · AFM DOC #
          DA202-C1 Fig 6.7 / 6.8 / 5.4
        </Header>
        <div className="mt-2 grid grid-cols-3 gap-6 text-[10px]">
          {['Pilot in command', 'Date / flight', 'Signature'].map((f) => (
            <div key={f} className="border-b border-slate-400 pb-3 text-slate-500">
              {f}
            </div>
          ))}
        </div>

        <h2 className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Calculation of loading condition (AFM Fig 6.7)
        </h2>
        <LoadingTable aircraft={aircraft} loading={loading} result={wb} units={units} compact />

        <h2 className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Weight &amp; moment (AFM Fig 6.8): {wb.ok ? 'within limits' : 'OUT OF LIMITS'}
        </h2>
        <Envelope points={points} units={units} />
        {wb.errors.length > 0 && <p className="mt-1 text-[10px] font-semibold text-red-700">{wb.errors.join(' ')}</p>}
      </section>

      {/* ---- page 2: performance ---- */}
      <section className="print-page print-break">
        <Header title={`Take-off & landing: ${aircraft.registration}`} now={now} ok={perf.toOk && perf.ldOk}>
          TODR / LDR = AFM distance × surface × slope ({SURFACE_NOTE}) × {FACTOR_SOURCE} factor
        </Header>
        <PerformanceTable perf={perf} />

        <h2 className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Take-off distance to 50 ft (AFM Fig 5.4)
        </h2>
        {perf.to50 ? (
          <Nomogram r={perf.to50} height={640} />
        ) : (
          <p className="text-[11px] font-semibold text-red-700">{perf.toError}</p>
        )}

        <p className="mt-3 text-[9px] text-slate-500">
          Training aid only. Calculated from the DA20-C1 AFM (DOC # DA202-C1) Fig 5.4, 6.7, 6.8 and Table 4, and the
          aircraft's load data sheet. Cross-check against the AFM. The pilot in command is responsible for the loading and
          performance of the aircraft.
        </p>
      </section>
    </div>
  );
}

const SURFACE_NOTE = 'CAA Safety Sense 09';

/** Print time, refreshed when the print dialog opens rather than on every render. */
function usePrintTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    window.addEventListener('beforeprint', update);
    return () => window.removeEventListener('beforeprint', update);
  }, []);
  return now;
}

function Header({ title, now, ok, children }: { title: string; now: Date; ok: boolean; children: ReactNode }) {
  return (
    <div className="flex items-end justify-between border-b-2 border-slate-900 pb-1">
      <div>
        <div className="text-base font-bold">{title}</div>
        <div className="text-[10px] text-slate-600">{children}</div>
      </div>
      <div className="text-right text-[10px]">
        <div className="font-semibold">Printed {zulu(now)}</div>
        <div className="text-slate-600">
          Local {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className={`font-bold ${ok ? 'text-emerald-700' : 'text-red-700'}`}>{ok ? 'WITHIN LIMITS' : 'OUT OF LIMITS'}</div>
      </div>
    </div>
  );
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** UTC time in aviation style, e.g. "0712Z 04 OCT 2026". */
function zulu(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}${p(d.getUTCMinutes())}Z ${p(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** TODR / LDR against TODA / LDA, departure and arrival side by side. */
function PerformanceTable({ perf }: { perf: PerformanceResult }) {
  const { departure: dep, arrival: arr } = perf;
  const wind = (hw: number) => (Math.abs(hw) < 0.05 ? 'calm' : `${hw >= 0 ? 'HW' : 'TW'} ${Math.abs(hw).toFixed(1)} kt`);
  const dist = (m: number) => `${fmtDist(m)} (${fmtFt(m)})`;
  const factor = (f: number) => `× ${f.toFixed(2)}${perf.extra !== 1 ? ` × ${perf.extra}` : ''}`;
  const slope = (pct: number, f: number) => `${pct === 0 ? 'level' : `${Math.abs(pct)}% ${pct > 0 ? 'up' : 'down'}`} × ${f.toFixed(2)}`;
  const verdict = (ok: boolean, avail: number, req: number) => (
    <span className={`font-bold ${ok ? 'text-emerald-700' : 'text-red-700'}`}>
      {ok ? '✓' : '✗'} margin {fmtDist(avail - req)}
    </span>
  );
  const to = perf.to50;
  const rows: { k: string; d: ReactNode; a: ReactNode }[] = [
    { k: 'Elevation / PA', d: `${Math.round(dep.elevationFt)} ft / ${Math.round(perf.depPaFt)} ft`, a: `${Math.round(arr.elevationFt)} ft / ${Math.round(perf.arrPaFt)} ft` },
    { k: 'QNH / OAT', d: `${dep.qnhHpa} hPa / ${dep.oatC} °C`, a: `${arr.qnhHpa} hPa / ${arr.oatC} °C` },
    {
      k: 'Runway wind',
      d: perf.headwindIgnored ? `${wind(perf.depHeadwindKt)} (not credited)` : wind(perf.depHeadwindKt),
      a: wind(perf.arrHeadwindKt),
    },
    { k: 'Ground roll (AFM)', d: to ? dist(to.groundRoll) : '-', a: dist(perf.ld.groundRoll) },
    { k: 'AFM to / from 50 ft', d: to ? dist(to.total) : '-', a: dist(perf.ld.over50ft) },
    {
      k: 'Surface / slope',
      d: `${SURFACES[dep.surface].label} × ${perf.toSurfaceFactor.toFixed(2)}; ${slope(dep.slopePct, perf.toSlopeFactor)}`,
      a: `${SURFACES[arr.surface].label} × ${perf.ldSurfaceFactor.toFixed(2)}; ${slope(arr.slopePct, perf.ldSlopeFactor)}`,
    },
    { k: `Factor (${FACTOR_SOURCE})`, d: factor(perf.toFactor), a: factor(perf.ldFactor) },
    { k: 'TODR / LDR', d: to ? <b>{dist(perf.todr)}</b> : '-', a: <b>{dist(perf.ldr)}</b> },
    { k: 'TODA / LDA', d: fmtDist(dep.availableM), a: fmtDist(arr.availableM) },
    {
      k: 'Result',
      d: to ? verdict(perf.toOk, dep.availableM, perf.todr) : <span className="font-bold text-red-700">{perf.toError}</span>,
      a: verdict(perf.ldOk, arr.availableM, perf.ldr),
    },
  ];
  return (
    <table className="mt-2 w-full text-[9.5px] leading-tight tabular-nums">
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
          <th className="py-0.5 pr-2 font-medium" />
          <th className="py-0.5 pr-2 font-medium">Departure (take-off)</th>
          <th className="py-0.5 font-medium">Arrival (landing)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ k, d, a }) => (
          <tr key={k} className="border-b border-slate-100 align-top">
            <td className="whitespace-nowrap py-0.5 pr-2 text-slate-500">{k}</td>
            <td className="py-0.5 pr-2">{d}</td>
            <td className="py-0.5">{a}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
