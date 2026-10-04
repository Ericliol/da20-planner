import { ARM, FUEL_KG_PER_L, USABLE_FUEL_L } from '../lib/afm';
import { fmtArm, fmtFuel, fmtMass, fuelScale, massScale } from '../lib/format';
import type { Aircraft, Loading, WBResult } from '../lib/wb';
import type { Units } from '../state';
import { Envelope } from './Envelope';
import { LoadingTable } from './LoadingTable';
import { Card, Messages, NumberField, StatusPill } from './ui';

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
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="Load">
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

      <Card title="Weight & moment (AFM Fig 6.8)" right={<StatusPill ok={r.ok}>{r.ok ? 'Within limits' : 'Out of limits'}</StatusPill>}>
        <Envelope points={points} units={units} />
        <Messages errors={r.errors} />
      </Card>

      <Card title="Calculation of loading condition (AFM Fig 6.7)" className="lg:col-span-2">
        <div className="-mx-4 overflow-x-auto px-4">
          <LoadingTable aircraft={aircraft} loading={loading} result={r} units={units} />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Line 5 (combined baggage, lever arm 1.20 m / 47.22 in) is a hand-calculation shortcut. It isn't needed here
          because lines 3 and 4 are calculated separately, which is exact. Totals show the CG arm (moment ÷ weight). CG
          limits at take-off weight: {fmtArm(r.takeoff.limits.fwd, units)} – {fmtArm(r.takeoff.limits.aft, units)}.
        </p>
      </Card>
    </div>
  );
}
