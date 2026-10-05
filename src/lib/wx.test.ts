import { describe, expect, it } from 'vitest';
import { formatTaf, isIcao, type Metar, metarToAerodrome, trueToMagnetic } from './wx';

describe('weather helpers', () => {
  it('converts true to magnetic with east variation', () => {
    expect(trueToMagnetic(10, 11)).toBe(359);
    expect(trueToMagnetic(11, 11)).toBe(360);
    expect(trueToMagnetic(190, 11)).toBe(179);
  });

  it('maps a METAR onto the Performance inputs', () => {
    const m: Metar = { icaoId: 'YBBN', rawOb: '', obsTime: 0, temp: 22, altim: 1019, wdir: 10, wspd: 13 };
    expect(metarToAerodrome(m, 11, 10)).toEqual({ qnhHpa: 1019, oatC: 22, windKt: 13, windDirDeg: 359, variableWind: false });
  });

  it('treats variable wind as a tailwind (conservative)', () => {
    const m: Metar = { icaoId: 'YBAF', rawOb: '', obsTime: 0, wdir: 'VRB', wspd: 3 };
    const a = metarToAerodrome(m, 11, 100);
    expect(a.windDirDeg).toBe(280);
    expect(a.variableWind).toBe(true);
  });

  it('splits a TAF at change groups', () => {
    const lines = formatTaf(
      'TAF YBBN 050805Z 0509/0612 01014KT 9999 SCT015 FM051400 34008KT 9999 SCT012 INTER 0601/0610 VRB15G25KT 2000 SHRA PROB30 INTER 0520/0601 VRB25G40KT 2000 TSRA',
    );
    expect(lines).toEqual([
      'TAF YBBN 050805Z 0509/0612 01014KT 9999 SCT015',
      'FM051400 34008KT 9999 SCT012',
      'INTER 0601/0610 VRB15G25KT 2000 SHRA',
      'PROB30 INTER 0520/0601 VRB25G40KT 2000 TSRA',
    ]);
  });

  it('validates ICAO codes', () => {
    expect(isIcao('ybaf')).toBe(true);
    expect(isIcao('YBA')).toBe(false);
    expect(isIcao('YB AF')).toBe(false);
  });
});
