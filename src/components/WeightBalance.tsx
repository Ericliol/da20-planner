import { useEffect, useState } from 'react';
import { ARM, FUEL_KG_PER_L, IN_PER_M, USABLE_FUEL_L } from '../lib/afm';
import { fmtArm, fmtFuel, fmtMass, fmtMoment, fuelScale, massScale } from '../lib/format';
import type { Aircraft, LoadPoint, Loading, Station, WBResult } from '../lib/wb';
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
}) {
  const { aircraft, loading, setLoading, result: r, units } = props;
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
        `${lever(Number(aircraft.emptyArmM.toFixed(4)), (aircraft.emptyArmM * IN_PER_M).toFixed(2))}, from the ${aircraft.registration} weighing report`,
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 print:gap-3">
      <PrintHeader aircraft={aircraft} ok={r.ok} />
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
        right={<StatusPill ok={r.ok}>{r.ok ? 'Within limits' : 'Out of limits'}</StatusPill>}
      >
        <Envelope points={points} units={units} />
        <Messages errors={r.errors} />
      </Card>

      <Card
        title="Calculation of loading condition (AFM Fig 6.7)"
        className="lg:col-span-2 print:order-1 print:p-3"
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
      <p className="hidden text-[9px] text-slate-500 print:order-3 print:block">
        Training aid only. Calculated from the DA20-C1 AFM (DOC # DA202-C1) Fig 6.7 / 6.8 and the aircraft's weighing
        report. Cross-check against the AFM. The pilot in command is responsible for the loading of the aircraft.
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
    <div className="hidden print:order-0 print:block">
      <div className="flex items-end justify-between border-b-2 border-slate-900 pb-1">
        <div>
          <div className="text-lg font-bold">Load sheet: {aircraft.registration} (DA20-C1)</div>
          <div className="text-xs text-slate-600">
            Empty weight {aircraft.emptyMassKg.toFixed(1)} kg @ {(aircraft.emptyArmM * 1000).toFixed(1)} mm · AFM DOC #
            DA202-C1 Fig 6.7 / 6.8
          </div>
        </div>
        <div className="text-right text-xs">
          <div>Printed {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
