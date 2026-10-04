import { AIRCRAFT_DOCS } from '../docs';
import { ARM, IN_PER_M } from '../lib/afm';
import { fmtArm, fmtFuel, fmtMass, fmtMoment } from '../lib/format';
import type { Aircraft, LoadPoint, Loading, Station, WBResult } from '../lib/wb';
import type { Units } from '../state';

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

/** AFM Fig 6.7 "Calculation of loading condition", with its wording and printed lever arms. */
export function LoadingTable(props: { aircraft: Aircraft; loading: Loading; result: WBResult; units: Units; compact?: boolean }) {
  const { aircraft, loading, result: r, units, compact } = props;
  const [empty, seats, baggage, baggageExt] = r.stations;
  const toFuelKg = r.takeoff.massKg - r.zeroFuel.massKg;
  const lever = (m: number, inches: string) => `Lever arm: ${m} m (${inches} in)`;

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
    { no: '6.', title: 'Total weight and total moment with empty fuel tank', desc: ['Sum of 1. – 4.'], ...total(r.zeroFuel) },
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
    { no: '', title: 'Landing', desc: [`After ${fmtFuel(loading.tripFuelL, units)} trip fuel burn`], ...total(r.landing) },
  ];

  const cell = compact ? 'py-0.5' : 'py-2';
  return (
    <table className={`w-full tabular-nums ${compact ? 'text-[9.5px] leading-tight' : 'min-w-[560px] text-sm'}`}>
      <thead>
        <tr className={`border-b border-slate-200 text-left text-slate-500 ${compact ? '' : 'text-xs'}`}>
          <th className="w-6 py-1 pr-2 font-medium">#</th>
          <th className="py-1 pr-2 font-medium">Calculation of the load limits</th>
          <th className="py-1 pr-2 text-right font-medium">Weight</th>
          <th className="py-1 pr-2 text-right font-medium">Lever arm</th>
          <th className="py-1 text-right font-medium">Moment</th>
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
              <td className={`${cell} pr-2 text-slate-500`}>{row.no}</td>
              <td className={`${cell} pr-2 ${compact ? '' : 'min-w-[240px]'}`}>
                {compact ? (
                  <>
                    {row.title}
                    <span className="font-normal text-slate-500"> · {row.desc.join(' · ')}</span>
                  </>
                ) : (
                  <>
                    <div>{row.title}</div>
                    {row.desc.map((d) => (
                      <div key={d} className="text-xs font-normal text-slate-500">
                        {d}
                      </div>
                    ))}
                  </>
                )}
              </td>
              <td className={`whitespace-nowrap ${cell} pr-2 text-right`}>{fmtMass(row.massKg, units)}</td>
              <td className={`whitespace-nowrap ${cell} pr-2 text-right`}>{fmtArm(row.armM, units)}</td>
              <td className={`whitespace-nowrap ${cell} text-right`}>{fmtMoment(row.momentKgM, units)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
