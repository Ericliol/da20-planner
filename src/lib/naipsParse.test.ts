import { describe, expect, it } from 'vitest';
import { parseBriefing, parseMetar } from './naipsParse';

const NOW = new Date(Date.UTC(2026, 9, 11, 7, 0)); // 11 Oct 2026 0700Z

// Shaped like a NAIPS location briefing: headings, wrapped TAF lines, RMK lines.
const BRIEFING = `
LOCATION BRIEFING
ARCHERFIELD (YBAF)
TAF YBAF 110451Z 1106/1118
      05010KT 9999 FEW030
      FM111200 VRB03KT 9999 NSC
      RMK T 25 22 19 17 Q 1018 1019 1020 1021

METAR YBAF 110600Z AUTO 03010KT 9999 // NCD 25/17 Q1019
METAR YBAF 110630Z AUTO 04012G22KT 9999 // FEW035 24/M01 Q1018
      RMK RF00.0/000.0

BRISBANE (YBBN)
SPECI YBBN 110640Z 01016KT 4000 SHRA BKN012 23/21 Q1019=
`;

describe('NAIPS briefing paste', () => {
  const r = parseBriefing(BRIEFING, NOW);

  it('finds the latest METAR / SPECI per station', () => {
    const ybaf = r.metars.find((m) => m.icaoId === 'YBAF')!;
    expect(ybaf.rawOb).toBe('METAR YBAF 110630Z AUTO 04012G22KT 9999 // FEW035 24/M01 Q1018 RMK RF00.0/000.0');
    expect(ybaf).toMatchObject({ wdir: 40, wspd: 12, wgst: 22, temp: 24, dewp: -1, altim: 1018, visib: '6+', name: 'ARCHERFIELD' });
    expect(ybaf.clouds).toEqual([{ cover: 'FEW', base: 3500 }]);
    expect(ybaf.obsTime).toBe(Date.UTC(2026, 9, 11, 6, 30) / 1000);

    const ybbn = r.metars.find((m) => m.icaoId === 'YBBN')!;
    expect(ybbn).toMatchObject({ wdir: 10, wspd: 16, visib: '4000 m', temp: 23, altim: 1019 });
  });

  it('joins a wrapped TAF into one report', () => {
    expect(r.tafs).toHaveLength(1);
    expect(r.tafs[0].rawTAF).toBe(
      'TAF YBAF 110451Z 1106/1118 05010KT 9999 FEW030 FM111200 VRB03KT 9999 NSC RMK T 25 22 19 17 Q 1018 1019 1020 1021',
    );
  });

  it('decodes CAVOK, variable and calm wind', () => {
    expect(parseMetar('METAR YBAF 110630Z VRB03KT CAVOK 18/10 Q1022', 'YBAF', 0)).toMatchObject({ wdir: 'VRB', wspd: 3, visib: '6+', clouds: [] });
    expect(parseMetar('METAR YBAF 110630Z 00000KT 9999 SCT040 18/10 Q1022', 'YBAF', 0)).toMatchObject({ wdir: 0, wspd: 0 });
  });

  it('returns nothing for text with no reports', () => {
    expect(parseBriefing('hello', NOW)).toEqual({ metars: [], tafs: [] });
  });
});
