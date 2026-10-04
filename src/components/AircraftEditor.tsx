import { USABLE_FUEL_L } from '../lib/afm';
import { armScale, armUnit, fmtMoment, massScale } from '../lib/format';
import type { Aircraft } from '../lib/wb';
import type { Units } from '../state';
import { Card, Checkbox, NumberField } from './ui';

export function AircraftEditor(props: {
  aircraft: Aircraft[];
  selectedId: string;
  units: Units;
  onChange: (list: Aircraft[], selectedId: string) => void;
}) {
  const { aircraft, selectedId, units, onChange } = props;
  const ac = aircraft.find((a) => a.id === selectedId) ?? aircraft[0];
  const update = (patch: Partial<Aircraft>) => onChange(aircraft.map((a) => (a.id === ac.id ? { ...a, ...patch } : a)), ac.id);

  const add = () => {
    const id = `ac-${Date.now()}`;
    onChange([...aircraft, { ...ac, id, registration: 'NEW', notes: '' }], id);
  };
  const remove = () => {
    if (aircraft.length <= 1) return;
    if (!confirm(`Delete ${ac.registration}?`)) return;
    const rest = aircraft.filter((a) => a.id !== ac.id);
    onChange(rest, rest[0].id);
  };

  return (
    <Card
      title="Aircraft profile"
      right={
        <div className="flex gap-2">
          <button type="button" onClick={add} className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-50">
            + Copy
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={aircraft.length <= 1}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Registration</span>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base uppercase outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            value={ac.registration}
            onChange={(e) => update({ registration: e.target.value.toUpperCase() })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Fuel system</span>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-sky-500"
            value={ac.fuelSystem}
            onChange={(e) => update({ fuelSystem: e.target.value as Aircraft['fuelSystem'] })}
          >
            <option value="type2">Type 2 ({USABLE_FUEL_L.type2} L usable)</option>
            <option value="type1">Type 1 ({USABLE_FUEL_L.type1} L usable)</option>
          </select>
        </label>
        <NumberField
          label="Empty mass"
          value={ac.emptyMassKg}
          onChange={(v) => update({ emptyMassKg: v })}
          unit={units.mass}
          scale={massScale(units)}
          hint="Incl. unusable fuel & full oil"
        />
        <NumberField
          label="Empty CG arm"
          value={ac.emptyArmM}
          onChange={(v) => update({ emptyArmM: v })}
          unit={armUnit(units)}
          scale={armScale(units)}
          decimals={units.mass === 'lb' ? 2 : 1}
          hint={`Moment ${fmtMoment(ac.emptyMassKg * ac.emptyArmM, units)}`}
        />
        <div className="col-span-2">
          <Checkbox
            label="Ground idle set to 1000 RPM (adds 5% to landing distance and 7% to ground roll)"
            checked={ac.idle1000Rpm}
            onChange={(v) => update({ idle1000Rpm: v })}
          />
        </div>
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Notes (weighing report, mods)</span>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
            rows={2}
            value={ac.notes ?? ''}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </label>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Use the empty mass and CG from the aircraft's current weighing report / load data sheet. Arms are measured aft of
        the datum (wing root rib leading edge).
      </p>
    </Card>
  );
}
