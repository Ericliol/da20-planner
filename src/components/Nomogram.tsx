import type { Curve } from '../lib/interp';
import { followGuides } from '../lib/interp';
import { baseDistance, PA_CURVES_FT, TAKEOFF_CHART, type TakeoffResult } from '../lib/takeoff';

/**
 * Redraws AFM Fig 5.4 from the extracted curves, with the path for the current
 * inputs overlaid, so the result can be checked against the paper chart.
 */
const PW = 150; // panel width
const GAP = 10;
const H = 300;
const PAD = { l: 40, t: 22, b: 34 };
const D = [200, 1000];
const sy = (m: number) => PAD.t + ((D[1] - m) / (D[1] - D[0])) * (H - PAD.t - PAD.b);

interface Panel {
  title: string;
  domain: [number, number]; // left, right
  ticks: number[];
  curves: Curve[];
  dashed?: Curve[];
  path: [number, number][];
}

function range(a: number, b: number, n = 24) {
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

export function Nomogram({ r }: { r: TakeoffResult }) {
  const u = r.used;
  const pa = u.pressureAltitudeFt;

  const panels: Panel[] = [
    {
      title: 'OAT °C',
      domain: [-20, 60],
      ticks: [-20, 0, 20, 40, 60],
      curves: TAKEOFF_CHART.pressureAltitude,
      path: range(-20, u.oatC).flatMap((t) => {
        try {
          return [[t, baseDistance(pa, t)] as [number, number]];
        } catch {
          return [];
        }
      }),
    },
    {
      title: 'Weight kg',
      domain: [800, 600],
      ticks: [800, 750, 700, 650, 600],
      curves: TAKEOFF_CHART.weight,
      path: range(800, u.massKg).map((w) => [w, followGuides(TAKEOFF_CHART.weight, 800, w, r.base)]),
    },
    {
      title: 'Wind kt',
      domain: [-5, 20],
      ticks: [-5, 0, 5, 10, 15, 20],
      curves: TAKEOFF_CHART.headwind,
      dashed: TAKEOFF_CHART.tailwind,
      path:
        u.windKt >= 0
          ? [[-5, r.afterWeight] as [number, number], ...range(0, u.windKt).map((w) => [w, followGuides(TAKEOFF_CHART.headwind, 0, w, r.afterWeight)] as [number, number]), [20, r.afterWind]]
          : [[-5, r.afterWeight] as [number, number], ...range(u.windKt, 0).map((w) => [w, followGuides(TAKEOFF_CHART.tailwind, u.windKt, w, r.afterWeight)] as [number, number]), [20, r.afterWind]],
    },
    {
      title: 'Obstacle m',
      domain: [0, 15],
      ticks: [0, 5, 10, 15],
      curves: TAKEOFF_CHART.obstacle,
      path: range(0, u.obstacleM).map((h) => [h, followGuides(TAKEOFF_CHART.obstacle, 0, h, r.afterWind)]),
    },
  ];
  const W = PAD.l + panels.length * PW + (panels.length - 1) * GAP + 8;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px]" role="img" aria-label="Take-off distance chart with calculation path">
      {[200, 400, 600, 800, 1000].map((m) => (
        <text key={m} x={PAD.l - 5} y={sy(m) + 4} textAnchor="end" fontSize="10" fill="#64748b">
          {m}
        </text>
      ))}
      <text transform={`translate(10 ${H / 2}) rotate(-90)`} textAnchor="middle" fontSize="10" fill="#475569">
        Distance (m)
      </text>
      {panels.map((p, i) => {
        const x0 = PAD.l + i * (PW + GAP);
        const sx = (v: number) => x0 + ((v - p.domain[0]) / (p.domain[1] - p.domain[0])) * PW;
        const line = (c: [number, number][]) => c.map(([v, d]) => `${sx(v).toFixed(1)},${sy(Math.min(1000, Math.max(200, d))).toFixed(1)}`).join(' ');
        return (
          <g key={p.title}>
            <rect x={x0} y={PAD.t} width={PW} height={H - PAD.t - PAD.b} fill="#fff" stroke="#94a3b8" />
            {[300, 400, 500, 600, 700, 800, 900].map((m) => (
              <line key={m} x1={x0} x2={x0 + PW} y1={sy(m)} y2={sy(m)} stroke="#f1f5f9" />
            ))}
            {p.ticks.map((t) => (
              <g key={t}>
                <line x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={H - PAD.b} stroke="#f1f5f9" />
                <text x={sx(t)} y={H - PAD.b + 12} textAnchor="middle" fontSize="9" fill="#64748b">
                  {t}
                </text>
              </g>
            ))}
            <text x={x0 + PW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#475569">
              {p.title}
            </text>
            {p.curves.map((c, j) => (
              <polyline key={j} points={line(c)} fill="none" stroke="#475569" strokeWidth="0.9" />
            ))}
            {p.dashed?.map((c, j) => (
              <polyline key={`d${j}`} points={line(c)} fill="none" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3 2" />
            ))}
            <polyline points={line(p.path)} fill="none" stroke="#e11d48" strokeWidth="2" />
          </g>
        );
      })}
      {/* pressure-altitude labels */}
      {TAKEOFF_CHART.pressureAltitude.map((c, i) => {
        const last = c[c.length - 1];
        const x = PAD.l + ((last[0] + 20) / 80) * PW;
        return (
          <text key={i} x={Math.min(x, PAD.l + PW - 2)} y={sy(Math.min(last[1], 990)) - 3} textAnchor="end" fontSize="8" fill="#64748b">
            {PA_CURVES_FT[i] === 0 ? 'SL' : `${PA_CURVES_FT[i] / 1000}k`}
          </text>
        );
      })}
      <text x={PAD.l} y={13} fontSize="10" fill="#e11d48">
        ━ this calculation
      </text>
    </svg>
  );
}
