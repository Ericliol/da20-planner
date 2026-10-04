import { type ReactNode, useEffect, useState } from 'react';
import { ARM, FUEL_KG_PER_L, IN_PER_M, USABLE_FUEL_L } from '../lib/afm';
import { fmtArm, fmtDist, fmtFt, fmtFuel, fmtMass, fmtMoment, fuelScale, massScale } from '../lib/format';
import { AIRCRAFT_DOCS } from '../docs';
import { FACTOR_SOURCE, SURFACES } from '../lib/factors';
import type { Aircraft, LoadPoint, Loading, Station, WBResult } from '../lib/wb';
import type { PerformanceResult } from '../lib/performance';
import type { Units } from '../state';
import { Envelope } from './Envelope';
import { Card, Messages, NumberField, StatusPill } from './ui';

interface Row {
  no: string;
  title: string;
  desc: string[];
  massKg: number;
  /** Lever arm for items; CG arm for totals. */
  armM: number;
  momentKgM: number;
  total?: boolean;
  point?: LoadPoint;
}

const station = (s: Station) => ({ massKg: s.massKg, armM: s.armM, momentKgM: s.momentKgM });
const total = (p: LoadPoint) => ({ massKg: p.massKg, armM: p.armM, momentKgM: p.momentKgM, total: true, point: p });

export function WeightBalance(props: {
  aircraft: Aircraft;
  loading: Loading;
  setLoading: (l: Loading) => void;
  result: WBResult;
  units: Units;
  /** Take-off / landing results, shown on the printed load sheet. */
  perf: PerformanceResult;
}) {
  const { aircraft, loading, setLoading, result: r, units, perf } = props;
  const ms = massScale(units);
  const fs = fuelScale(units);
  const set = (k: keyof Loading) => (v: number) => setLoading({ ...loading, [k]: v });
  const cap = USABLE_FUEL_L[aircraft.fuelSystem];
  const points = [r.zeroFuel, r.ramp, r.takeoff, r.landing];
  const [empty, seats, baggage, baggageExt] = r.stations;
  const toFuelKg = r.takeoff.massKg - r.zeroFuel.massKg;
  const lever = (m: number, inches: string) => `Lever arm: ${m} m (${inches} in)`;

  // Rows follow AFM Fig 6.7, with its wording and printed lever arms.
  const rows: Row[] = [
    {
      no: '1.',
      title: 'Empty weight',
      desc: [
        'Use the data for your airplane recorded in the equipment list, including unusable fuel and lubricant.',
        `${lever(Number(aircraft.emptyArmM.toFixed(4)), (aircraft.emptyArmM * IN_PER_M).toFixed(2))}, from the ${aircraft.registration} ${AIRCRAFT_DOCS[aircraft.id]?.length ? 'load data sheet' : 'aircraft data'}`,
      ],
      ...station(empty),
    },
    { no: '2.', title: 'Pilot and passenger', desc: [lever(ARM.seats, '5.63')], ...station(seats) },
    { no: '3.', title: 'Baggage', desc: ['Max. wt. 44 lb (20 kg)', lever(ARM.baggage, '32.44')], ...station(baggage) },
    {
      no: '4.',
      title: 'Baggage compartment extension',
      desc: ['Max. wt. 44 lb (20 kg), combined with line 3', lever(ARM.baggageExt, '62.0')],
      ...station(baggageExt),
    },
    {
      no: '6.',
      title: 'Total weight and total moment with empty fuel tank',
      desc: ['Sum of 1. – 4.'],
      ...total(r.zeroFuel),
    },
    {
      no: '7.',
      title: 'Usable fuel load',
      desc: [
        '6.01 lb per US gal / 0.72 kg per litre',
        lever(ARM.fuel, '32.44'),
        `${fmtFuel(loading.fuelL, units)} at start-up − ${fmtFuel(loading.taxiFuelL, units)} taxi = ${fmtFuel(loading.fuelL - loading.taxiFuelL, units)}`,
      ],
      massKg: toFuelKg,
      armM: ARM.fuel,
      momentKgM: toFuelKg * ARM.fuel,
    },
    {
      no: '8.',
      title: 'Total weight and total moment, taking fuel into account (take-off)',
      desc: ['Sum of 6. and 7.'],
      ...total(r.takeoff),
    },
    {
      no: '',
      title: 'Ramp (before taxi)',
      desc: [`With ${fmtFuel(loading.fuelL, units)} start-up fuel. Max ramp weight 1770 lb (803 kg).`],
      ...total(r.ramp),
    },
    {
      no: '',
      title: 'Landing',
      desc: [`After ${fmtFuel(loading.tripFuelL, units)} trip fuel burn`],
      ...total(r.landing),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 print:grid-cols-2 print:gap-3">
      <PrintHeader aircraft={aircraft} ok={r.ok && perf.toOk && perf.ldOk} />
      <Card title="Load" className="no-print">
        <div className="grid grid-cols-2 gap-3">
          <NumberField expression label="Pilot + passenger" value={loading.seatsKg} onChange={set('seatsKg')} unit={units.mass} scale={ms} hint={`Lever arm ${fmtArm(ARM.seats, units)}`} />
          <div className="text-xs text-slate-500">
            <span className="mb-1 block font-medium text-slate-600">Empty weight ({aircraft.registration})</span>
            <span className="block text-sm text-slate-900 tabular-nums">{fmtMass(aircraft.emptyMassKg, units)}</span>
            Lever arm {fmtArm(aircraft.emptyArmM, units)} · incl. unusable fuel &amp; lubricant
          </div>
          <NumberField expression label="Baggage compartment" value={loading.baggageKg} onChange={set('baggageKg')} unit={units.mass} scale={ms} hint={`Lever arm ${fmtArm(ARM.baggage, units)}`} />
          <NumberField expression label="Baggage extension" value={loading.baggageExtKg} onChange={set('baggageExtKg')} unit={units.mass} scale={ms} hint={`Lever arm ${fmtArm(ARM.baggageExt, units)} · max 20 kg / 44 lb combined`} />
          <NumberField
            expression
            label="Fuel at start-up"
            value={loading.fuelL}
            onChange={set('fuelL')}
            unit={units.fuel}
            scale={fs}
            hint={`Lever arm ${fmtArm(ARM.fuel, units)} · usable max ${fmtFuel(cap, units)} · ${fmtMass(loading.fuelL * FUEL_KG_PER_L, units)}`}
          />
          <NumberField expression label="Taxi fuel" value={loading.taxiFuelL} onChange={set('taxiFuelL')} unit={units.fuel} scale={fs} />
          <NumberField expression label="Trip fuel burn" value={loading.tripFuelL} onChange={set('tripFuelL')} unit={units.fuel} scale={fs} hint="For the landing CG" />
          <div className="flex items-end">
            <button
              type="button"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setLoading({ ...loading, fuelL: cap })}
            >
              Full tank ({fmtFuel(cap, units)})
            </button>
          </div>
        </div>
      </Card>

      <Card
        title="Weight & moment (AFM Fig 6.8)"
        className="print:order-2 print:p-3"
        right={<span className="no-print"><StatusPill ok={r.ok}>{r.ok ? 'Within limits' : 'Out of limits'}</StatusPill></span>}
      >
        <Envelope points={points} units={units} />
        <Messages errors={r.errors} />
      </Card>

      <Card
        title="Calculation of loading condition (AFM Fig 6.7)"
        className="lg:col-span-2 print:order-1 print:col-span-2 print:p-3"
        right={
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Print load sheet
          </button>
        }
      >
        <div className="-mx-4 overflow-x-auto px-4 print:mx-0 print:overflow-visible print:px-0">
          <table className="w-full min-w-[560px] text-sm tabular-nums print:min-w-0 print:text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="w-8 py-1.5 pr-2 font-medium">#</th>
                <th className="py-1.5 pr-2 font-medium">Calculation of the load limits</th>
                <th className="py-1.5 pr-2 text-right font-medium">Weight</th>
                <th className="py-1.5 pr-2 text-right font-medium">Lever arm</th>
                <th className="py-1.5 text-right font-medium">Moment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const bad = row.point && !(row.point.withinCg && row.point.withinMass);
                return (
                  <tr
                    key={row.title}
                    className={`border-b align-top ${row.total ? 'border-slate-300 bg-slate-50 font-semibold' : 'border-slate-100'} ${bad ? 'text-red-700' : ''}`}
                  >
                    <td className="py-2 pr-2 text-slate-500">{row.no}</td>
                    <td className="min-w-[240px] py-2 pr-2">
                      <div>{row.title}</div>
                      {row.desc.map((d) => (
                        <div key={d} className="text-xs font-normal text-slate-500">
                          {d}
                        </div>
                      ))}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-2 text-right">{fmtMass(row.massKg, units)}</td>
                    <td className="whitespace-nowrap py-2 pr-2 text-right">{fmtArm(row.armM, units)}</td>
                    <td className="whitespace-nowrap py-2 text-right">{fmtMoment(row.momentKgM, units)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="no-print mt-3 text-xs text-slate-500">
          Line 5 (combined baggage, lever arm 1.20 m / 47.22 in) is a hand-calculation shortcut. It isn't needed here
          because lines 3 and 4 are calculated separately, which is exact. Totals show the CG arm (moment ÷ weight). CG
          limits at take-off weight: {fmtArm(r.takeoff.limits.fwd, units)} – {fmtArm(r.takeoff.limits.aft, units)}.
        </p>
      </Card>
      <PrintPerformance perf={perf} />
      <p className="hidden text-[9px] text-slate-500 print:order-3 print:col-span-2 print:block">
        Training aid only. Calculated from the DA20-C1 AFM (DOC # DA202-C1) Fig 6.7 / 6.8 and the aircraft's weighing
        report. TODR / LDR = AFM × surface × slope (CAA Safety Sense 09) × CAO 20.7.4 factor. Cross-check against the AFM. The pilot in command is responsible for the loading and performance of the aircraft.
      </p>
    </div>
  );
}

/** Shown only when printing: identifies the load sheet and leaves room to sign. */
function PrintHeader({ aircraft, ok }: { aircraft: Aircraft; ok: boolean }) {
  // Timestamp taken when the print dialog opens, not on every render.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    window.addEventListener('beforeprint', update);
    return () => window.removeEventListener('beforeprint', update);
  }, []);
  return (
    <div className="hidden print:order-0 print:col-span-2 print:block">
      <div className="flex items-end justify-between border-b-2 border-slate-900 pb-1">
        <div>
          <div className="text-lg font-bold">Load sheet: {aircraft.registration} (DA20-C1)</div>
          <div className="text-xs text-slate-600">
            Empty weight {aircraft.emptyMassKg.toFixed(1)} kg @ {(aircraft.emptyArmM * 1000).toFixed(1)} mm · AFM DOC #
            DA202-C1 Fig 6.7 / 6.8
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="font-semibold">Printed {zulu(now)}</div>
          <div className="text-slate-600">
            Local {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className={`font-bold ${ok ? 'text-emerald-700' : 'text-red-700'}`}>{ok ? 'WITHIN LIMITS' : 'OUT OF LIMITS'}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-6 text-xs">
        {['Pilot in command', 'Date / flight', 'Signature'].map((f) => (
          <div key={f} className="border-b border-slate-400 pb-4 text-slate-500">
            {f}
          </div>
        ))}
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

/** Shown only when printing: TODR / LDR against TODA / LDA. */
function PrintPerformance({ perf }: { perf: PerformanceResult }) {
  const { departure: dep, arrival: arr } = perf;
  const wind = (hw: number) => (Math.abs(hw) < 0.05 ? 'calm' : `${hw >= 0 ? 'HW' : 'TW'} ${Math.abs(hw).toFixed(1)} kt`);
  const dist = (m: number) => `${fmtDist(m)} (${fmtFt(m)})`;
  const factor = (f: number) => `× ${f.toFixed(2)}${perf.extra !== 1 ? ` × ${perf.extra}` : ''}`;
  const verdict = (ok: boolean, avail: number, req: number) => (
    <span className={`font-bold ${ok ? 'text-emerald-700' : 'text-red-700'}`}>
      {ok ? '✓' : '✗'} margin {fmtDist(avail - req)}
    </span>
  );
  const to = perf.to50;
  const slope = (pct: number, f: number) => `${pct === 0 ? 'level' : `${Math.abs(pct)}% ${pct > 0 ? 'up' : 'down'}`} × ${f.toFixed(2)}`;
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
    <section className="hidden rounded-xl border border-slate-200 p-3 print:order-2 print:block">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Take-off &amp; landing</h2>
      <table className="w-full text-[10px] leading-tight tabular-nums">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-1 pr-2 font-medium" />
            <th className="py-1 pr-2 font-medium">Departure</th>
            <th className="py-1 font-medium">Arrival</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ k, d, a }) => (
            <tr key={k} className="border-b border-slate-100 align-top">
              <td className="whitespace-nowrap py-1 pr-2 text-slate-500">{k}</td>
              <td className="py-1 pr-2">{d}</td>
              <td className="py-1">{a}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
