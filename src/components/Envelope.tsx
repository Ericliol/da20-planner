import { useState } from 'react';
import { ENVELOPE, IN_PER_M, LB_PER_KG } from '../lib/afm';
import type { LoadPoint } from '../lib/wb';
import type { Units } from '../state';

const W = 520;
const H = 340;
const PAD = { l: 52, r: 16, t: 14, b: 40 };
const INLB_PER_KGM = LB_PER_KG * IN_PER_M;
/** Weight at which the fwd / aft limit lines are labelled. */
const LABEL_KG = 590;
// Same frame as AFM Fig 6.8: 9000-22000 in·lb, 1200-1800 lb.
const MOMENT = [9000 / INLB_PER_KGM, 22000 / INLB_PER_KGM];
const MASS = [1200 / LB_PER_KG, 1800 / LB_PER_KG];

const sx = (kgm: number) => PAD.l + ((kgm - MOMENT[0]) / (MOMENT[1] - MOMENT[0])) * (W - PAD.l - PAD.r);
const sy = (kg: number) => H - PAD.b - ((kg - MASS[0]) / (MASS[1] - MASS[0])) * (H - PAD.t - PAD.b);

const COLORS: Record<string, string> = {
  'Zero fuel': '#64748b',
  Ramp: '#a855f7',
  'Take-off': '#0284c7',
  Landing: '#16a34a',
};

/** AFM Fig 6.8: permissible flight weight vs moment. */
export function Envelope({ points, units }: { points: LoadPoint[]; units: Units }) {
  const [active, setActive] = useState<string | null>(null);
  const activePoint = points.find((p) => p.label === active);
  const imperial = units.mass === 'lb';
  // Ramp sits almost on top of take-off, so its support lines only show when hovered.
  const guided = points.filter((p) => p.label !== 'Ramp' || p.label === active);
  const colorOf = (p: LoadPoint) => (p.withinCg && p.withinMass ? COLORS[p.label] : '#dc2626');
  const momentText = (p: LoadPoint) =>
    imperial ? `${Math.round(p.momentKgM * INLB_PER_KGM).toLocaleString()}` : p.momentKgM.toFixed(1);
  const massText = (p: LoadPoint) => (imperial ? `${(p.massKg * LB_PER_KG).toFixed(0)} lb` : `${p.massKg.toFixed(1)} kg`);
  const momentTicks = imperial
    ? [9000, 11000, 13000, 15000, 17000, 19000, 21000].map((v) => v / INLB_PER_KGM)
    : [120, 140, 160, 180, 200, 220, 240];
  const massTicks = imperial
    ? [1200, 1300, 1400, 1500, 1600, 1700, 1764].map((lb) => lb / LB_PER_KG)
    : [550, 600, 650, 700, 750, 800];
  const path = ENVELOPE.map(([kgm, kg], i) => `${i ? 'L' : 'M'}${sx(kgm)},${sy(kg)}`).join('') + 'Z';
  const flight = points.filter((p) => p.label !== 'Ramp');

  // Fine grid like Fig 6.8: 200 in·lb x 20 lb (imperial) or 5 kg·m x 10 kg (metric).
  const steps = (from: number, to: number, step: number) =>
    Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
  const fineMoment = imperial
    ? steps(9000, 22000, 200).map((v) => v / INLB_PER_KGM)
    : steps(105, MOMENT[1], 5);
  const fineMass = imperial ? steps(1200, 1800, 20).map((lb) => lb / LB_PER_KG) : steps(550, MASS[1], 10);

  // Limit lines and their corner arms (AFM 2.8 points A-D).
  const fwd = ENVELOPE.slice(0, 3);
  const aft = ENVELOPE.slice(3);
  const pts = (line: [number, number][]) => line.map(([kgm, kg]) => `${sx(kgm)},${sy(kg)}`).join(' ');
  // Arm values as printed in AFM 2.8 (A, B, C, D).
  const label = (i: 0 | 1 | 2 | 3) => (imperial ? `${['7.95', '8.07', '12.16', '12.48'][i]} in` : `${[202, 205, 309, 317][i]} mm`);
  const corners: { p: [number, number]; text: string; dx: number; dy: number; anchor: 'start' | 'end' }[] = [
    { p: ENVELOPE[1], text: label(0), dx: -6, dy: 4, anchor: 'end' }, // A fwd @ 750 kg
    { p: ENVELOPE[2], text: label(1), dx: -6, dy: -5, anchor: 'end' }, // B fwd @ 800 kg
    { p: ENVELOPE[3], text: label(2), dx: 0, dy: -5, anchor: 'end' }, // C aft @ 800 kg
    { p: ENVELOPE[4], text: label(3), dx: 6, dy: 4, anchor: 'start' }, // D aft @ 750 kg
  ];

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="print-chart h-auto w-full" role="img" aria-label="AFM Fig 6.8 permissible flight weight and moment">
        <path d={path} fill="#e0f2fe" />
        <g stroke="#e2e8f0" strokeWidth="0.5">
          {fineMoment.map((t) => (
            <line key={`fm${t}`} x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={H - PAD.b} />
          ))}
          {fineMass.map((m) => (
            <line key={`fw${m}`} x1={PAD.l} x2={W - PAD.r} y1={sy(m)} y2={sy(m)} />
          ))}
        </g>
        {momentTicks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={H - PAD.b} stroke="#94a3b8" strokeWidth="0.8" />
            <text x={sx(t)} y={H - PAD.b + 16} textAnchor="middle" fontSize="11" fill="#64748b">
              {Math.round(imperial ? t * INLB_PER_KGM : t)}
            </text>
          </g>
        ))}
        {massTicks.map((m) => (
          <g key={m}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(m)} y2={sy(m)} stroke="#94a3b8" strokeWidth="0.8" />
            <text x={PAD.l - 6} y={sy(m) + 4} textAnchor="end" fontSize="11" fill="#64748b">
              {imperial ? Math.round(m * LB_PER_KG) : m}
            </text>
          </g>
        ))}
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="none" stroke="#64748b" />

        {/* CG limit lines */}
        <g fill="none" strokeWidth="2.2" strokeLinejoin="round">
          <polyline points={pts(fwd)} stroke="#0369a1" />
          <polyline points={pts(aft)} stroke="#0369a1" />
          <line x1={sx(fwd[2][0])} x2={sx(aft[0][0])} y1={sy(800)} y2={sy(800)} stroke="#0369a1" />
        </g>
        <g fontSize="10" fill="#0369a1" fontWeight="600">
          {corners.map(({ p, text, dx, dy, anchor }) => (
            <text key={`${p[0]}-${p[1]}`} x={sx(p[0]) + dx} y={sy(p[1]) + dy} textAnchor={anchor}>
              {text}
            </text>
          ))}
          <text x={sx(LABEL_KG * 0.202) + 8} y={sy(LABEL_KG) + 3}>
            Fwd limit {label(0)}
          </text>
          <text x={sx(LABEL_KG * 0.317) - 8} y={sy(LABEL_KG) + 3} textAnchor="end">
            Aft limit {label(3)}
          </text>
          <text x={(sx(fwd[2][0]) + sx(aft[0][0])) / 2} y={sy(800) - 5} textAnchor="middle">
            Max {imperial ? '1764 lb' : '800 kg'}
          </text>
        </g>
        <text x={(W + PAD.l) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#475569">
          Flight-weight moment ({imperial ? 'in·lb' : 'kg·m'})
        </text>
        <text transform={`translate(13 ${(H - PAD.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#475569">
          Flight weight ({imperial ? 'lb' : 'kg'})
        </text>

        {/* support lines: down to the moment axis, across to the weight axis */}
        {guided.map((p) => {
          const c = colorOf(p);
          return (
            <g key={`s-${p.label}`} stroke={c} strokeWidth="0.9" strokeDasharray="4 2.5" opacity="0.85">
              <line x1={sx(p.momentKgM)} x2={sx(p.momentKgM)} y1={sy(p.massKg)} y2={H - PAD.b} />
              <line x1={PAD.l} x2={sx(p.momentKgM)} y1={sy(p.massKg)} y2={sy(p.massKg)} />
            </g>
          );
        })}

        <polyline
          points={flight.map((p) => `${sx(p.momentKgM)},${sy(p.massKg)}`).join(' ')}
          fill="none"
          stroke="#94a3b8"
          strokeDasharray="4 3"
        />
        {points.map((p) => {
          const ok = p.withinCg && p.withinMass;
          const on = active === p.label;
          return (
            <g
              key={p.label}
              className="cursor-pointer"
              onMouseEnter={() => setActive(p.label)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive(on ? null : p.label)}
            >
              <circle cx={sx(p.momentKgM)} cy={sy(p.massKg)} r="12" fill="transparent" />
              <circle
                cx={sx(p.momentKgM)}
                cy={sy(p.massKg)}
                r={on ? 7.5 : 5.5}
                fill={ok ? COLORS[p.label] : '#dc2626'}
                stroke="white"
                strokeWidth="1.5"
              />
            </g>
          );
        })}
        {/* axis intercepts */}
        {guided.map((p) => (
          <g key={`t-${p.label}`} stroke={colorOf(p)} strokeWidth="1.6">
            <line x1={sx(p.momentKgM)} x2={sx(p.momentKgM)} y1={H - PAD.b - 4} y2={H - PAD.b + 4} />
            <line x1={PAD.l - 4} x2={PAD.l + 4} y1={sy(p.massKg)} y2={sy(p.massKg)} />
          </g>
        ))}
        {spread(guided.map((p) => ({ key: p.label, pos: sx(p.momentKgM), w: tagWidth(momentText(p)) })), PAD.l, W - PAD.r).map(
          ({ key, pos }) => {
            const p = guided.find((g) => g.label === key)!;
            return <AxisTag key={`xm-${key}`} cx={pos} cy={H - PAD.b - 9} text={momentText(p)} color={colorOf(p)} />;
          },
        )}
        {spread(guided.map((p) => ({ key: p.label, pos: sy(p.massKg), w: 13 })), PAD.t, H - PAD.b).map(({ key, pos }) => {
          const p = guided.find((g) => g.label === key)!;
          const text = massText(p);
          return <AxisTag key={`ym-${key}`} cx={PAD.l + 6 + tagWidth(text) / 2} cy={pos} text={text} color={colorOf(p)} />;
        })}
        {activePoint && <Tooltip p={activePoint} units={units} />}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {points.map((p) => (
          <button
            type="button"
            key={p.label}
            className={`inline-flex items-center gap-1.5 rounded px-1 ${active === p.label ? 'bg-slate-100' : ''}`}
            onMouseEnter={() => setActive(p.label)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(p.label)}
            onBlur={() => setActive(null)}
          >
            <span className="size-2.5 rounded-full" style={{ background: p.withinCg && p.withinMass ? COLORS[p.label] : '#dc2626' }} />
            {p.label}
          </button>
        ))}
      </div>
    </>
  );
}

const tagWidth = (text: string) => text.length * 5.2 + 8;

/** Small coloured value tag centred on (cx, cy). */
function AxisTag({ cx, cy, text, color }: { cx: number; cy: number; text: string; color: string }) {
  const w = tagWidth(text);
  return (
    <g pointerEvents="none">
      <rect x={cx - w / 2} y={cy - 6.5} width={w} height={13} rx="3" fill="white" stroke={color} strokeWidth="0.8" />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>
        {text}
      </text>
    </g>
  );
}

/**
 * Nudge tag positions along one axis so they don't overlap, keeping them
 * within [min, max]. Each item has a centre position and a size along the axis.
 */
function spread<T extends { pos: number; w: number }>(items: T[], min: number, max: number): T[] {
  const out = [...items].sort((a, b) => a.pos - b.pos).map((t) => ({ ...t }));
  for (let i = 0; i < out.length; i++) {
    const lo = i === 0 ? min + out[i].w / 2 : out[i - 1].pos + (out[i - 1].w + out[i].w) / 2 + 2;
    out[i].pos = Math.max(out[i].pos, lo);
  }
  for (let i = out.length - 1; i >= 0; i--) {
    const hi = i === out.length - 1 ? max - out[i].w / 2 : out[i + 1].pos - (out[i + 1].w + out[i].w) / 2 - 2;
    out[i].pos = Math.min(out[i].pos, hi);
  }
  return out;
}

/** Detail box for one load point, drawn inside the SVG next to the point. */
function Tooltip({ p, units }: { p: LoadPoint; units: Units }) {
  const imperial = units.mass === 'lb';
  const ok = p.withinCg && p.withinMass;
  const mass = imperial ? `${(p.massKg * LB_PER_KG).toFixed(1)} lb` : `${p.massKg.toFixed(1)} kg`;
  const moment = imperial
    ? `${Math.round(p.momentKgM * INLB_PER_KGM).toLocaleString()} in·lb`
    : `${p.momentKgM.toFixed(1)} kg·m`;
  const arm = (m: number) => (imperial ? `${(m * IN_PER_M).toFixed(2)} in` : `${(m * 1000).toFixed(1)} mm`);
  const maxMass = imperial ? `${Math.round(p.maxMassKg * LB_PER_KG)} lb` : `${p.maxMassKg} kg`;
  const lines: [string, string][] = [
    ['Weight', `${mass} (max ${maxMass})`],
    ['Moment', moment],
    ['CG', arm(p.armM)],
    ['Limits', `${arm(p.limits.fwd)} – ${arm(p.limits.aft)}`],
    ['Margin', `fwd ${arm(p.armM - p.limits.fwd)} · aft ${arm(p.limits.aft - p.armM)}`],
  ];
  const bw = 222;
  const bh = 22 + lines.length * 15;
  const px = sx(p.momentKgM);
  const py = sy(p.massKg);
  const x = px + 12 + bw > W - 4 ? px - 12 - bw : px + 12;
  const y = Math.min(Math.max(py - bh / 2, 4), H - bh - 4);
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={bw} height={bh} rx="6" fill="white" stroke="#cbd5e1" filter="drop-shadow(0 2px 4px rgb(0 0 0 / 0.12))" />
      <text x={x + 10} y={y + 16} fontSize="11.5" fontWeight="700" fill="#0f172a">
        {p.label}
        <tspan dx="6" fill={ok ? '#047857' : '#b91c1c'}>
          {ok ? '✓ within limits' : '✗ out of limits'}
        </tspan>
      </text>
      {lines.map(([k, v], i) => (
        <text key={k} x={x + 10} y={y + 33 + i * 15} fontSize="10.5" fill="#334155">
          <tspan fill="#64748b">{k}</tspan>
          <tspan x={x + 62}>{v}</tspan>
        </text>
      ))}
    </g>
  );
}
