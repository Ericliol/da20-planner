/**
 * Read METAR / SPECI / TAF reports out of text a pilot copied from their own
 * NAIPS briefing (or any briefing text). Nothing is fetched: the pilot logs in
 * to NAIPS and pastes the text themselves.
 */
import type { Metar, Taf } from './wx';

export interface ParsedBriefing {
  metars: Metar[]; // latest METAR / SPECI per station
  tafs: Taf[]; // latest TAF per station
}

// Start of a report: "METAR YBAF", "SPECI YBAF", "TAF YBAF", "TAF AMD YBAF", "METAR COR YBAF"...
const START = /\b(METAR|SPECI|TAF)(?:\s+(?:AMD|COR))*\s+([A-Z]{4})\b/g;
const TIME = /\b(\d{2})(\d{2})(\d{2})Z\b/;

export function parseBriefing(text: string, now = new Date()): ParsedBriefing {
  const src = text.replace(/\r/g, '').toUpperCase();
  const names = stationNames(src);
  const starts = [...src.matchAll(START)];
  const metars = new Map<string, Metar>();
  const tafs = new Map<string, Taf>();

  starts.forEach((m, i) => {
    const from = m.index!;
    const to = i + 1 < starts.length ? starts[i + 1].index! : src.length;
    // A report ends at the next report, a blank line or its "=" terminator.
    const raw = src
      .slice(from, to)
      .split(/\n\s*\n/)[0]
      .split('=')[0]
      .replace(/\s+/g, ' ')
      .trim();
    const [, kind, id] = m;
    const t = TIME.exec(raw);
    const time = t ? utcFromDayTime(+t[1], +t[2], +t[3], now) : 0;
    if (kind === 'TAF') {
      const prev = tafs.get(id);
      if (!prev || time >= Date.parse(prev.issueTime) / 1000) {
        tafs.set(id, { icaoId: id, name: names[id], rawTAF: raw, issueTime: new Date(time * 1000).toISOString(), validTimeFrom: 0, validTimeTo: 0 });
      }
    } else {
      const parsed = parseMetar(raw, id, time);
      parsed.name = names[id];
      const prev = metars.get(id);
      if (!prev || parsed.obsTime >= prev.obsTime) metars.set(id, parsed);
    }
  });
  return { metars: [...metars.values()], tafs: [...tafs.values()] };
}

/** Decode the parts of a METAR / SPECI the planner uses. */
export function parseMetar(raw: string, icaoId: string, obsTime: number): Metar {
  const body = raw.split(/\sRMK\s/)[0];
  const m: Metar = { icaoId, rawOb: raw, obsTime };

  const wind = /\s(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?KT\b/.exec(body);
  if (wind) {
    m.wdir = wind[1] === 'VRB' ? 'VRB' : +wind[1];
    m.wspd = +wind[2];
    if (wind[3]) m.wgst = +wind[3];
  }
  if (/\sCAVOK\b/.test(body)) {
    m.visib = '6+';
    m.clouds = [];
  } else {
    const vis = /\s(\d{4})(?:NDV)?\s/.exec(body.slice(wind ? wind.index + wind[0].length - 1 : 0));
    if (vis) m.visib = vis[1] === '9999' ? '6+' : `${+vis[1]} m`;
    m.clouds = [...body.matchAll(/\b(FEW|SCT|BKN|OVC)(\d{3})/g)].map((c) => ({ cover: c[1], base: +c[2] * 100 }));
  }
  const td = /\s(M?\d{2})\/(M?\d{2}|\/\/)?(?=\s|$)/.exec(body);
  if (td) {
    m.temp = signed(td[1]);
    if (td[2] && td[2] !== '//') m.dewp = signed(td[2]);
  }
  const q = /\sQ(\d{4})\b/.exec(body);
  if (q) m.altim = +q[1];
  return m;
}

const signed = (s: string) => (s.startsWith('M') ? -Number(s.slice(1)) : Number(s));

/** A DDHHMMZ group to unix seconds: this month, or last month if the day is in the future. */
export function utcFromDayTime(day: number, hour: number, minute: number, now = new Date()): number {
  let y = now.getUTCFullYear();
  let mo = now.getUTCMonth();
  if (day > now.getUTCDate() + 1) mo -= 1; // allow a day of clock skew
  if (mo < 0) {
    mo = 11;
    y -= 1;
  }
  return Date.UTC(y, mo, day, hour, minute) / 1000;
}

/** "ARCHERFIELD (YBAF)" style headings, used to name stations. */
function stationNames(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/^\s*([A-Z][A-Z .'/-]{2,40}?)\s*\(([A-Z]{4})\)/gm)) out[m[2]] = m[1].trim();
  return out;
}
