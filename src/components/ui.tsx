import { type ReactNode, useId, useState } from 'react';
import { evalExpr, isExpression } from '../lib/expr';

export function Card({ title, children, right, className = '' }: { title: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

const fmt = (v: number, decimals: number) => (Number.isFinite(v) ? String(Number(v.toFixed(decimals))) : '');

/**
 * Numeric input that edits a value stored in internal units.
 * `scale` converts internal -> displayed units (displayed = internal * scale).
 * Accepts arithmetic such as "55+75"; with `expression` the mobile keyboard
 * includes the operator keys.
 */
export function NumberField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  scale?: number;
  decimals?: number;
  hint?: string;
  expression?: boolean;
}) {
  const { label, value, onChange, unit, scale = 1, decimals = 1, hint, expression } = props;
  const id = useId();
  const external = fmt(value * scale, decimals);
  const [text, setText] = useState(external);
  const [prevExternal, setPrevExternal] = useState(external);
  const parsed = text.trim() === '' ? 0 : evalExpr(text);
  const invalid = parsed === undefined;

  // Re-sync when the value changes from outside (unit toggle, profile switch),
  // but leave in-progress typing such as "1." or "55+" alone.
  if (external !== prevExternal) {
    setPrevExternal(external);
    if (parsed === undefined || fmt(parsed, decimals) !== external) setText(external);
  }

  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <div
        className={`flex items-stretch overflow-hidden rounded-lg border bg-white focus-within:ring-2 ${invalid ? 'border-red-400 focus-within:ring-red-200' : 'border-slate-300 focus-within:border-sky-500 focus-within:ring-sky-200'}`}
      >
        <input
          id={id}
          type="text"
          inputMode={expression ? 'text' : 'decimal'}
          autoComplete="off"
          aria-invalid={invalid}
          className="w-full min-w-0 px-3 py-2 text-base tabular-nums outline-none"
          value={text}
          placeholder={expression ? 'e.g. 55+75' : undefined}
          onChange={(e) => {
            setText(e.target.value);
            const v = e.target.value.trim() === '' ? 0 : evalExpr(e.target.value);
            if (v !== undefined) onChange(v / scale);
          }}
        />
        {unit && <span className="flex items-center bg-slate-100 px-2.5 text-sm text-slate-500">{unit}</span>}
      </div>
      {invalid ? (
        <span className="mt-1 block text-xs text-red-600">Can't read that. Use numbers and + − × ÷ only.</span>
      ) : (
        isExpression(text) && (
          <span className="mt-1 block text-xs font-medium text-sky-700 tabular-nums">
            = {fmt(parsed, decimals)} {unit}
          </span>
        )
      )}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Toggle<T extends string>(props: { value: T; options: readonly T[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 text-sm" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => props.onChange(o)}
          className={`rounded-md px-2.5 py-1 font-medium ${o === props.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          aria-pressed={o === props.value}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="size-4 accent-sky-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function StatusPill({ ok, children }: { ok: boolean | null; children: ReactNode }) {
  const cls =
    ok === null ? 'bg-slate-100 text-slate-600' : ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800';
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function Messages({ errors = [], notes = [] }: { errors?: string[]; notes?: string[] }) {
  if (!errors.length && !notes.length) return null;
  return (
    <ul className="mt-3 space-y-1.5 text-sm">
      {errors.map((e) => (
        <li key={e} className="rounded-md bg-red-50 px-3 py-2 text-red-800">
          ⚠ {e}
        </li>
      ))}
      {notes.map((n) => (
        <li key={n} className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
          {n}
        </li>
      ))}
    </ul>
  );
}

export function Big({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'bad' }) {
  const color = tone === 'bad' ? 'text-red-700' : tone === 'ok' ? 'text-emerald-700' : 'text-slate-900';
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 tabular-nums">{sub}</div>}
    </div>
  );
}
