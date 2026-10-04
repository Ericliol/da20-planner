"""Extract the DA20-C1 take-off distance nomogram (AFM Fig 5.4) from the vector PDF.

The chart is drawn rotated on the page: distance runs along page-x and the
panel variables (OAT, weight, wind, obstacle height) run along page-y.
Calibration constants below were read from the tick marks / labels in the PDF.

Usage:  python tools/extract_takeoff.py "../DA20-C1 AFM & Supp.pdf" src/data/takeoff.json
"""
import json
import sys

import pymupdf

SHEET1, SHEET2 = 142, 143  # 0-based page indexes (AFM pages 5-9 and 5-10)


def lin(p0, v0, p1, v1):
    return lambda p: v0 + (p - p0) * (v1 - v0) / (p1 - p0)


# Sheet 1: distance grid lines at x=108.6 (1000 m) ... 339.7 (200 m)
dist1 = lin(108.6, 1000, 339.7, 200)
# Sheet 2: panel border x=98.5 (1000 m) ... 329.6 (200 m). The printed ft/m ruler
# above the panel is offset ~2 pt; the panel grid makes the guides start on
# exact 100 m values, so it is the true axis.
dist2 = lin(98.5, 1000, 329.6, 200)

oat_c = lin(658.0, -20, 485.7, 60)  # panel 1 edges
weight_kg = lin(473.6, 800, 301.5, 600)  # panel 2 edges
wind_kt = lin(288.4, -5, 115.1, 20)  # panel 3 edges (0 kt at y=253.8)
obstacle_m = lin(403.0, 0, 232.1, 15)  # sheet 2 ticks

PANELS = {
    # name: (page, drawing indexes, var fn, dist fn, labels)
    "pressureAltitude": (SHEET1, [61, 62, 63, 65, 66, 67], oat_c, dist1),
    "weight": (SHEET1, [82, 83, 84, 85, 86, 87, 88, 89], weight_kg, dist1),
    "headwind": (SHEET1, [104, 105, 106, 107, 109, 110, 112, 113, 114], wind_kt, dist1),
    "tailwind": (SHEET1, [326, 327, 328, 329, 330, 331, 332, 333], wind_kt, dist1),
    "obstacle": (SHEET2, [69, 71, 72, 73, 74, 75, 76, 77], obstacle_m, dist2),
}


def bez(p0, p1, p2, p3, n=12):
    out = []
    for i in range(1, n + 1):
        t = i / n
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t**3
        out.append((a * p0.x + b * p1.x + c * p2.x + d * p3.x, a * p0.y + b * p1.y + c * p2.y + d * p3.y))
    return out


def flatten(drawing):
    pts = []
    for it in drawing["items"]:
        if it[0] == "l":
            pts += [(it[1].x, it[1].y), (it[2].x, it[2].y)]
        elif it[0] == "c":
            pts += [(it[1].x, it[1].y)] + bez(*it[1:5])
    # dedupe consecutive points
    clean = []
    for p in pts:
        if not clean or abs(p[0] - clean[-1][0]) > 1e-3 or abs(p[1] - clean[-1][1]) > 1e-3:
            clean.append(p)
    return clean


def interp(curve, x):
    """Linear interpolation of y at x on a curve sorted by x (clamped at the ends)."""
    if x <= curve[0][0]:
        return curve[0][1]
    if x >= curve[-1][0]:
        return curve[-1][1]
    for (x0, y0), (x1, y1) in zip(curve, curve[1:]):
        if x0 <= x <= x1:
            return y0 if x1 == x0 else y0 + (x - x0) * (y1 - y0) / (x1 - x0)
    return None


def centreline(pts, n=40):
    """
    The thick chart lines are drawn as outlines: out along one edge, round the
    cap and back along the other. Split at the far end, average the two edges
    at common x values, and extend to the full x range so the curve still
    reaches the panel edges. Single-edge paths (thin dashed lines) are just sorted.
    """
    start = pts[0]
    far = max(range(len(pts)), key=lambda i: (pts[i][0] - start[0]) ** 2 + (pts[i][1] - start[1]) ** 2)
    a, b = sorted(pts[: far + 1]), sorted(pts[far:])
    if len(b) < 3:
        return sorted(pts)
    lo, hi = max(a[0][0], b[0][0]), min(a[-1][0], b[-1][0])
    xs = [lo + (hi - lo) * i / n for i in range(n + 1)]
    mid = [(x, (interp(a, x) + interp(b, x)) / 2) for x in xs]
    # Extend linearly to the outermost x of either edge (caps are ~0.5 pt).
    x_min, x_max = min(a[0][0], b[0][0]), max(a[-1][0], b[-1][0])
    (x0, y0), (x1, y1) = mid[0], mid[1]
    if x_min < x0:
        mid.insert(0, (x_min, y0 + (x_min - x0) * (y1 - y0) / (x1 - x0)))
    (x0, y0), (x1, y1) = mid[-2], mid[-1]
    if x_max > x1:
        mid.append((x_max, y1 + (x_max - x1) * (y1 - y0) / (x1 - x0)))
    return mid


def main(pdf, out):
    doc = pymupdf.open(pdf)
    drawings = {SHEET1: doc[SHEET1].get_drawings(), SHEET2: doc[SHEET2].get_drawings()}
    result = {}
    for name, (page, idxs, var, dist) in PANELS.items():
        curves = []
        for i in idxs:
            pts = [(var(y), dist(x)) for x, y in flatten(drawings[page][i])]
            curves.append([(round(v, 3), round(d, 2)) for v, d in centreline(pts)])
        result[name] = curves
    with open(out, "w") as f:
        json.dump(result, f, indent=None, separators=(",", ":"))
    for k, v in result.items():
        print(k, [(c[0], c[-1]) for c in v])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
