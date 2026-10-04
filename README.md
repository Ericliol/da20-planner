# DA20-C1 Planner

Weight & balance, take-off distance and landing distance for the Diamond DA20-C1,
from the AFM (DOC # DA202-C1). A static, offline-capable web app (PWA) with no backend.

> **Training aid only.** Not an approved flight-planning tool. Always cross-check against the AFM.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # golden tests against the AFM / VH-XTN load sheet
npm run build      # static site in dist/ (deploy anywhere: GitHub Pages, Netlify, ...)
```

## Where the numbers come from

| Data | Source |
|---|---|
| Arms: seats 0.143 m, baggage 0.824 m, extension 1.575 m, fuel 0.824 m | AFM Fig 6.7 |
| CG limits A–D (750 kg 202 mm, 800 kg 205 mm / 309 mm, 750 kg 317 mm) | AFM 2.8 |
| MTOW 800 kg, ramp 803 kg, baggage 20 kg combined | AFM 2.7 |
| Usable fuel 91 L (type 2) / 80.5 L (type 1), 0.72 kg/L | AFM 1.8, 7, Fig 6.6 |
| Take-off distance nomogram | AFM Fig 5.4, curves extracted from the PDF vectors (`tools/extract_takeoff.py` → `src/data/takeoff.json`) |
| Landing distance table, 1000 RPM idle factors | AFM 5.3.12 Table 4 |
| VH-XTN empty mass 556.0 kg @ 265.7 mm | Weighing report WB-6071, 30-Nov-15 |
| Propeller | MT 175 R 150-2Ca supplement E-1255: no change to T/O or landing performance |

To regenerate the take-off chart data:

```bash
pip install pymupdf
python tools/extract_takeoff.py "../DA20-C1 AFM & Supp.pdf" src/data/takeoff.json
```

## Interpretation notes

- **Take-off chart:** the stages are pressure altitude/OAT → weight → wind → obstacle. Tailwind is read by
  entering at the tailwind value and following the dashed lines up to the 0 kt line.
- The AFM worked example states **341 m**. Following the guide lines precisely gives about **352 m**, because the
  example's hand-drawn line jumps onto the "300 m" guide in the obstacle panel. The tests accept 341 m −1%/+5%.
- Inputs outside the chart are rejected. Values beyond the chart in the safe direction (weight < 600 kg,
  headwind > 20 kt, pressure altitude < 0) are clamped to the chart edge, which is conservative.
- The chart tops out at 15 m (49 ft); a 50 ft obstacle uses 15 m.
- **Landing:** the AFM gives only an altitude table (max weight, ISA, no wind). The app warns about hot days and
  tailwinds but applies no correction for them.
- The margin factor multiplies the required distances for your school's SOP.
