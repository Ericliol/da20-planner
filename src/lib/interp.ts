export type Pt = [number, number]; // [x, y]
export type Curve = Pt[]; // sorted by x ascending

/** Linear interpolation of y at x along a polyline; undefined if x is outside its span. */
export function curveAt(curve: Curve, x: number, tol = 0.05): number | undefined {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (x < first[0] - tol || x > last[0] + tol) return undefined;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  let lo = 0;
  let hi = curve.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (curve[mid][0] <= x) lo = mid;
    else hi = mid;
  }
  const [x0, y0] = curve[lo];
  const [x1, y1] = curve[hi];
  return x1 === x0 ? y0 : y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}

/** Piecewise-linear table lookup; extrapolates using the end segments. */
export function tableLookup(xs: readonly number[], ys: readonly number[], x: number): number {
  let i = 0;
  while (i < xs.length - 2 && x > xs[i + 1]) i++;
  return ys[i] + ((x - xs[i]) * (ys[i + 1] - ys[i])) / (xs[i + 1] - xs[i]);
}

export class OutOfChartError extends Error {}

/**
 * Follow a family of nomogram guide curves.
 *
 * Every curve gives distance as a function of the panel variable. The input
 * distance is located between two neighbouring guide curves at the reference
 * value, and the same proportional position is carried across to the target value.
 */
export function followGuides(curves: Curve[], ref: number, target: number, distIn: number): number {
  const usable = curves
    .map((c) => ({ a: curveAt(c, ref), b: curveAt(c, target) }))
    .filter((g): g is { a: number; b: number } => g.a !== undefined && g.b !== undefined)
    .sort((g, h) => g.a - h.a);
  if (usable.length < 2) throw new OutOfChartError('Outside the chart range');

  let i = 0;
  while (i < usable.length - 2 && distIn > usable[i + 1].a) i++;
  const lo = usable[i];
  const hi = usable[i + 1];
  const f = (distIn - lo.a) / (hi.a - lo.a);
  // Allow a little extrapolation (a fraction of one guide spacing) but no more.
  if (f < -0.6 || f > 1.6) throw new OutOfChartError('Outside the chart range');
  return lo.b + f * (hi.b - lo.b);
}
