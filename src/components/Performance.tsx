import { FT_PER_M } from '../lib/afm';
import { densityAltitudeFt, isaTempC, pressureAltitudeFt, windComponents } from '../lib/atmos';
import { fmtDist, fmtFt, fmtMass } from '../lib/format';
import { OutOfChartError } from '../lib/interp';
import { landingDistance } from '../lib/landing';
import { takeoffDistance, type TakeoffResult } from '../lib/takeoff';
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
    </div>
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
  const dep = state.departure;
  const arr = state.arrival.sameAsDeparture ? { ...dep, availableM: state.arrival.availableM } : state.arrival;
  const k = state.marginFactor;

  // ---- take-off ----
  const depPa = pressureAltitudeFt(dep.elevationFt, dep.qnhHpa);
  const depWind = windComponents(dep.runwayHeadingDeg, dep.windDirDeg, dep.windKt);
  let to: TakeoffResult | null = null;
  let toError = '';
  try {
    to = takeoffDistance({
      pressureAltitudeFt: depPa,
      oatC: dep.oatC,
      massKg: wb.takeoff.massKg,
      windKt: depWind.headwind,
      obstacleM: dep.obstacleFt / FT_PER_M,
    });
  } catch (e) {
    toError = e instanceof OutOfChartError ? e.message : String(e);
  }
  const toReq = to ? to.total * k : 0;
  const toOk = to ? toReq <= dep.availableM : false;

  // ---- landing ----
  const arrPa = pressureAltitudeFt(arr.elevationFt, arr.qnhHpa);
  const ld = landingDistance(arrPa, aircraft.idle1000Rpm);
  const ldReq = ld.over50ft * k;
  const ldOk = ldReq <= arr.availableM;
  const arrWind = windComponents(arr.runwayHeadingDeg, arr.windDirDeg, arr.windKt);
  const ldNotes = [...ld.notes];
  if (arr.oatC > isaTempC(arrPa) + 0.5) ldNotes.push(`OAT is ${Math.round(arr.oatC - isaTempC(arrPa))} °C above ISA. The AFM landing table is for standard temperature only, so expect a longer distance.`);
  if (arrWind.headwind < -0.5) ldNotes.push('Tailwind component: the AFM landing table has no wind correction, so expect a longer distance.');
  if (wb.landing.massKg < 799) ldNotes.push('AFM landing data is for max weight (800 kg), so it is conservative at lower weights.');

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="Departure" right={to ? <StatusPill ok={toOk}>{toOk ? 'Fits TODA' : 'Exceeds TODA'}</StatusPill> : <StatusPill ok={false}>Out of chart</StatusPill>}>
        <AerodromeFields a={dep} set={(d) => setState((s) => ({ ...s, departure: d }))} availableLabel="TODA" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField label="Obstacle height" value={dep.obstacleFt} onChange={(v) => setState((s) => ({ ...s, departure: { ...s.departure, obstacleFt: v } }))} unit="ft" decimals={0} hint="Chart max 49 ft (15 m)" />
        </div>
        <Atmos a={dep} />
        <p className="mt-2 text-xs text-slate-500">Take-off mass from W&amp;B: {fmtMass(wb.takeoff.massKg, state.units)}</p>
        {to && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Big label="Ground roll (lift-off)" value={fmtDist(to.groundRoll)} sub={fmtFt(to.groundRoll)} />
            <Big label={`Distance to ${Math.round(Math.min(dep.obstacleFt, to.used.obstacleM * FT_PER_M + 1))} ft obstacle`} value={fmtDist(to.total)} sub={fmtFt(to.total)} />
            {k !== 1 && <Big label={`Required × ${k}`} value={fmtDist(toReq)} sub={fmtFt(toReq)} tone={toOk ? 'ok' : 'bad'} />}
            <Big label="TODA" value={fmtDist(dep.availableM)} sub={`margin ${fmtDist(dep.availableM - toReq)}`} tone={toOk ? 'ok' : 'bad'} />
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
          </div>
        ) : (
          <AerodromeFields a={state.arrival} set={(a) => setState((s) => ({ ...s, arrival: a }))} availableLabel="LDA" />
        )}
        <Atmos a={arr} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Big label="Ground roll" value={fmtDist(ld.groundRoll)} sub={fmtFt(ld.groundRoll)} />
          <Big label="Landing distance over 50 ft" value={fmtDist(ld.over50ft)} sub={fmtFt(ld.over50ft)} />
          {k !== 1 && <Big label={`Required × ${k}`} value={fmtDist(ldReq)} sub={fmtFt(ldReq)} tone={ldOk ? 'ok' : 'bad'} />}
          <Big label="LDA" value={fmtDist(arr.availableM)} sub={`margin ${fmtDist(arr.availableM - ldReq)}`} tone={ldOk ? 'ok' : 'bad'} />
        </div>
        <Messages notes={ldNotes} />
      </Card>

      <Card title="Margin factor">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField label="Multiply required distances by" value={k} onChange={(v) => setState((s) => ({ ...s, marginFactor: v > 0 ? v : 1 }))} decimals={2} hint="Per your school / personal SOP (1 = AFM figures)" />
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
