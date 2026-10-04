import { useState } from 'react';
import { AIRCRAFT_EDIT_PIN } from '../config';
import { USABLE_FUEL_L } from '../lib/afm';
import { armScale, armUnit, fmtArm, fmtMass, fmtMoment, massScale } from '../lib/format';
import type { Aircraft } from '../lib/wb';
import type { Units } from '../state';
import { Card, Checkbox, NumberField } from './ui';

/**
 * Aircraft data is read-only for students. Editing needs the PIN
 * (AIRCRAFT_EDIT_PIN) and stays unlocked until "Lock" or leaving the tab.
 */
export function AircraftEditor(props: {
  aircraft: Aircraft[];
  selectedId: string;
  units: Units;
  onChange: (list: Aircraft[], selectedId: string) => void;
  onRestoreBuiltIn: () => void;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const { aircraft, selectedId, units } = props;
  const ac = aircraft.find((a) => a.id === selectedId) ?? aircraft[0];
  if (!unlocked) return <LockedView ac={ac} units={units} onUnlock={() => setUnlocked(true)} />;
  return <Editor {...props} onLock={() => setUnlocked(false)} />;
}

function LockedView({ ac, units, onUnlock }: { ac: Aircraft; units: Units; onUnlock: () => void }) {
  const [asking, setAsking] = useState(false);
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const rows: [string, string][] = [
    ['Registration', ac.registration],
    ['Empty weight', `${fmtMass(ac.emptyMassKg, units)} (incl. unusable fuel & full oil)`],
    ['Empty CG arm', fmtArm(ac.emptyArmM, units)],
    ['Empty moment', fmtMoment(ac.emptyMassKg * ac.emptyArmM, units)],
    ['Fuel system', `${ac.fuelSystem === 'type1' ? 'Type 1' : 'Type 2'} (${USABLE_FUEL_L[ac.fuelSystem]} L usable)`],
    ['Ground idle 1000 RPM', ac.idle1000Rpm ? 'Yes (+5% landing distance, +7% ground roll)' : 'No'],
  ];
  const tryUnlock = () => {
    if (pin === AIRCRAFT_EDIT_PIN) onUnlock();
    else {
      setWrong(true);
      setPin('');
    }
  };

  return (
    <Card title="Aircraft data" right={<span className="text-xs font-medium text-slate-500">🔒 Locked</span>}>
      <dl className="divide-y divide-slate-100 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-1.5">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-right tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {ac.notes && <p className="mt-2 text-xs text-slate-500">{ac.notes}</p>}

      {asking ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            tryUnlock();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">PIN</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              className={`w-36 rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 ${wrong ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-200'}`}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setWrong(false);
              }}
            />
          </label>
          <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Unlock
          </button>
          <button type="button" onClick={() => setAsking(false)} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          {wrong && <span className="w-full text-xs text-red-600">Wrong PIN.</span>}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Edit aircraft data…
        </button>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Aircraft data comes from each aircraft's load data sheet. Ask your instructor if something looks wrong.
      </p>
    </Card>
  );
}

function Editor(props: {
  aircraft: Aircraft[];
  selectedId: string;
  units: Units;
  onChange: (list: Aircraft[], selectedId: string) => void;
  onRestoreBuiltIn: () => void;
  onLock: () => void;
}) {
  const { aircraft, selectedId, units, onChange, onRestoreBuiltIn, onLock } = props;
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
      title="Aircraft data (editing)"
      right={
        <div className="flex gap-2">
          <button type="button" onClick={onLock} className="rounded-lg bg-slate-900 px-2.5 py-1 text-sm font-medium text-white hover:bg-slate-700">
            🔒 Lock
          </button>
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
        the datum (wing root rib leading edge). Changes save immediately.
      </p>
      <button
        type="button"
        className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        onClick={() => confirm('Restore VH-XTN and VH-HUU to their built-in data and remove other aircraft?') && onRestoreBuiltIn()}
      >
        Restore built-in aircraft data
      </button>
    </Card>
  );
}
