import { MAX_TAKEOFF_KG } from '../lib/afm';
import { densityAltitudeFt, pressureAltitudeFt, windComponents } from '../lib/atmos';
import { FACTOR_SOURCE, type Surface, SURFACE_SOURCE, SURFACES } from '../lib/factors';
import { fmtDist, fmtFt, fmtMass } from '../lib/format';
import { computePerformance } from '../lib/performance';
import type { Aircraft, WBResult } from '../lib/wb';
import type { Aerodrome, AppState } from '../state';
import { Nomogram } from './Nomogram';
import { Big, Card, Checkbox, Messages, NumberField, StatusPill } from './ui';

function AerodromeFields<T extends Aerodrome>({ a, set, availableLabel }: { a: T; set: (a: T) => void; availableLabel: string }) {
  const f = (k: keyof Aerodrome) => (v: number) => set({ ...a, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <NumberField label="Elevation" value={a.elevationFt} onChange={f('elevationFt')} unit="ft" decimals={0} />
      <NumberField label="QNH" value={a.qnhHpa} onChange={f('qnhHpa')} unit="hPa" decimals={0} />
      <NumberField label="OAT" value={a.oatC} onChange={f('oatC')} unit="°C" decimals={0} />
      <NumberField label="Runway direction" value={a.runwayHeadingDeg} onChange={f('runwayHeadingDeg')} unit="°M" decimals={0} hint="e.g. RWY 09 → 090" />
      <NumberField label="Wind direction" value={a.windDirDeg} onChange={f('windDirDeg')} unit="°M" decimals={0} />
      <NumberField label="Wind speed" value={a.windKt} onChange={f('windKt')} unit="kt" decimals={0} />
      <NumberField label={availableLabel} value={a.availableM} onChange={f('availableM')} unit="m" decimals={0} />
      <SurfaceSelect value={a.surface} onChange={(surface) => set({ ...a, surface })} />
    </div>
  );
}

function SurfaceSelect({ value, onChange }: { value: Surface; onChange: (s: Surface) => void }) {
  return (
    <label className="col-span-2 block">
      <span className="mb-1 block text-xs font-medium text-slate-600">Runway surface</span>
      <select
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-sky-500"
        value={value}
        onChange={(e) => onChange(e.target.value as Surface)}
      >
        {(Object.keys(SURFACES) as Surface[]).map((k) => (
          <option key={k} value={k}>
            {SURFACES[k].label}
            {SURFACES[k].takeoff !== 1 || SURFACES[k].landing !== 1
              ? ` (T/O × ${SURFACES[k].takeoff.toFixed(2)}, LDG × ${SURFACES[k].landing.toFixed(2)})`
              : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function Atmos({ a }: { a: Aerodrome }) {
  const pa = pressureAltitudeFt(a.elevationFt, a.qnhHpa);
  const w = windComponents(a.runwayHeadingDeg, a.windDirDeg, a.windKt);
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
      <div>
        <dt className="text-xs text-slate-500">Pressure alt</dt>
        <dd className="tabular-nums">{Math.round(pa)} ft</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Density alt</dt>
        <dd className="tabular-nums">{Math.round(densityAltitudeFt(pa, a.oatC))} ft</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">{w.headwind >= 0 ? 'Headwind' : 'Tailwind'}</dt>
        <dd className={`tabular-nums ${w.headwind < -0.05 ? 'font-semibold text-amber-700' : ''}`}>{Math.abs(w.headwind).toFixed(1)} kt</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Crosswind</dt>
        <dd className="tabular-nums">
          {Math.abs(w.crosswind).toFixed(1)} kt {w.crosswind > 0.05 ? 'from R' : w.crosswind < -0.05 ? 'from L' : ''}
        </dd>
      </div>
    </dl>
  );
}

export function Performance(props: {
  state: AppState;
  setState: (fn: (s: AppState) => AppState) => void;
  aircraft: Aircraft;
  wb: WBResult;
}) {
  const { state, setState, aircraft, wb } = props;
  const perf = computePerformance(state, aircraft, wb);
  const { departure: dep, arrival: arr, extra, toFactor, ldFactor, to, to50, toError, ld, ldNotes } = perf;
  const toReq = perf.todr;
  const toOk = perf.toOk;
  const ldReq = perf.ldr;
  const ldOk = perf.ldOk;
  const otherObstacle = Math.abs(dep.obstacleFt - 50) > 0.5;
  const factorLabel = (f: number, surface: number) =>
    `${surface !== 1 ? `× ${surface.toFixed(2)} surface ` : ''}× ${f.toFixed(2)} ${FACTOR_SOURCE}${extra !== 1 ? ` × ${extra} extra` : ''}`;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="Departure" right={to ? <StatusPill ok={toOk}>{toOk ? 'Fits TODA' : 'Exceeds TODA'}</StatusPill> : <StatusPill ok={false}>Out of chart</StatusPill>}>
        <AerodromeFields a={dep} set={(d) => setState((s) => ({ ...s, departure: d }))} availableLabel="TODA" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField label="Obstacle height" value={dep.obstacleFt} onChange={(v) => setState((s) => ({ ...s, departure: { ...s.departure, obstacleFt: v } }))} unit="ft" decimals={0} hint="For info only: TODR always uses 50 ft. Chart max 49 ft (15 m)" />
        </div>
        <Atmos a={dep} />
        <p className="mt-2 text-xs text-slate-500">Take-off mass from W&amp;B: {fmtMass(wb.takeoff.massKg, state.units)}</p>
        {to && to50 && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Big label="Ground roll (lift-off)" value={fmtDist(to50.groundRoll)} sub={fmtFt(to50.groundRoll)} />
            <Big label="AFM distance to 50 ft" value={fmtDist(to50.total)} sub={fmtFt(to50.total)} />
            <Big label={`TODR ${factorLabel(toFactor, perf.toSurfaceFactor)}`} value={fmtDist(toReq)} sub={fmtFt(toReq)} tone={toOk ? 'ok' : 'bad'} />
            <Big label="TODA" value={fmtDist(dep.availableM)} sub={`margin ${fmtDist(dep.availableM - toReq)}`} tone={toOk ? 'ok' : 'bad'} />
            {otherObstacle && (
              <Big label={`AFM distance to ${Math.round(dep.obstacleFt)} ft obstacle`} value={fmtDist(to.total)} sub={`${fmtFt(to.total)} · unfactored`} />
            )}
          </div>
        )}
        <Messages errors={toError ? [toError] : []} notes={to?.notes} />
      </Card>

      <Card title="Arrival" right={<StatusPill ok={ldOk}>{ldOk ? 'Fits LDA' : 'Exceeds LDA'}</StatusPill>}>
        <div className="mb-3">
          <Checkbox
            label="Same aerodrome and conditions as departure"
            checked={state.arrival.sameAsDeparture}
            onChange={(v) => setState((s) => ({ ...s, arrival: { ...s.arrival, sameAsDeparture: v } }))}
          />
        </div>
        {state.arrival.sameAsDeparture ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumberField label="LDA" value={state.arrival.availableM} onChange={(v) => setState((s) => ({ ...s, arrival: { ...s.arrival, availableM: v } }))} unit="m" decimals={0} />
            <div className="col-span-2 self-end pb-2 text-xs text-slate-500">Surface: {SURFACES[dep.surface].label} (same as departure)</div>
          </div>
        ) : (
          <AerodromeFields a={state.arrival} set={(a) => setState((s) => ({ ...s, arrival: a }))} availableLabel="LDA" />
        )}
        <Atmos a={arr} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Big label="Ground roll" value={fmtDist(ld.groundRoll)} sub={fmtFt(ld.groundRoll)} />
          <Big label="AFM distance from 50 ft" value={fmtDist(ld.over50ft)} sub={fmtFt(ld.over50ft)} />
          <Big label={`LDR ${factorLabel(ldFactor, perf.ldSurfaceFactor)}`} value={fmtDist(ldReq)} sub={fmtFt(ldReq)} tone={ldOk ? 'ok' : 'bad'} />
          <Big label="LDA" value={fmtDist(arr.availableM)} sub={`margin ${fmtDist(arr.availableM - ldReq)}`} tone={ldOk ? 'ok' : 'bad'} />
        </div>
        <Messages notes={ldNotes} />
      </Card>

      <Card title="Distance factors">
        <p className="text-sm text-slate-700">
          Australian rule ({FACTOR_SOURCE}): multiply the AFM distance to 50 ft (take-off) or from 50 ft (landing) by the
          factor for the aeroplane's MTOW. The result must not exceed TODA / LDA.
        </p>
        <table className="mt-2 w-full text-sm tabular-nums">
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-1">Take-off (MTOW {MAX_TAKEOFF_KG} kg ≤ 2000 kg)</td>
              <td className="py-1 text-right font-semibold">× {toFactor.toFixed(2)}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-1">Landing (MTOW {MAX_TAKEOFF_KG} kg ≤ 2000 kg)</td>
              <td className="py-1 text-right font-semibold">× {ldFactor.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-sm text-slate-700">
          Runway surface factors ({SURFACE_SOURCE}, Aug 2024), applied to the AFM distance before the factor above. The
          DA20-C1 AFM gives none.
        </p>
        <table className="mt-2 w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1 font-medium">Surface</th>
              <th className="py-1 text-right font-medium">Take-off</th>
              <th className="py-1 text-right font-medium">Landing</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(SURFACES) as Surface[]).map((k) => (
              <tr key={k} className={`border-b border-slate-100 ${k === dep.surface || k === arr.surface ? 'font-semibold' : ''}`}>
                <td className="py-1">{SURFACES[k].label}</td>
                <td className="py-1 text-right">{SURFACES[k].takeoff === 1 ? '-' : `× ${SURFACES[k].takeoff.toFixed(2)}`}</td>
                <td className="py-1 text-right">{SURFACES[k].landing === 1 ? '-' : `× ${SURFACES[k].landing.toFixed(2)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-slate-500">Grass longer than 20 cm isn't covered: expect much more.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField
            label="Extra margin (on top)"
            value={extra}
            onChange={(v) => setState((s) => ({ ...s, marginFactor: v > 0 ? v : 1 }))}
            decimals={2}
            hint="School / personal SOP. 1 = none"
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          The AFM figures assume a level, dry, paved runway, a new aircraft and correct technique. Grass, wet surfaces,
          slope and high temperature all increase the distances (AFM 5.3.6 / 5.3.12 notes).
        </p>
      </Card>

      {to && (
        <Card title="Take-off chart check (AFM Fig 5.4)" className="lg:col-span-2">
          <div className="-mx-4 overflow-x-auto px-4">
            <Nomogram r={to} />
          </div>
          <table className="mt-3 w-full text-sm tabular-nums">
            <tbody>
              {[
                [`Pressure alt ${Math.round(to.used.pressureAltitudeFt)} ft, OAT ${to.used.oatC} °C`, to.base],
                [`Weight ${to.used.massKg.toFixed(0)} kg`, to.afterWeight],
                [`${to.used.windKt >= 0 ? 'Headwind' : 'Tailwind'} ${Math.abs(to.used.windKt).toFixed(1)} kt`, to.afterWind],
                [`Obstacle ${to.used.obstacleM.toFixed(1)} m`, to.total],
              ].map(([label, d]) => (
                <tr key={label as string} className="border-b border-slate-100">
                  <td className="py-1">{label}</td>
                  <td className="py-1 text-right">{fmtDist(d as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
