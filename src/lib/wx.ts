/**
 * METAR / TAF from aviationweather.gov (via the da20-wx relay Worker).
 * Wind directions in METAR / TAF are degrees TRUE; the planner's runway
 * headings are MAGNETIC, so convert with the aerodrome's magnetic variation.
 */
import { WX_PROXY_URL } from '../config';

export interface Metar {
  icaoId: string;
  name?: string;
  rawOb: string;
  /** Observation time, unix seconds. */
  obsTime: number;
  temp?: number;
  dewp?: number;
  /** Degrees true, or "VRB". */
  wdir?: number | 'VRB';
  wspd?: number;
  wgst?: number;
  /** QNH, hPa. */
  altim?: number;
  visib?: string | number;
  /** Station elevation, metres. */
  elev?: number;
  clouds?: { cover: string; base?: number }[];
  fltCat?: string;
}

export interface Taf {
  icaoId: string;
  name?: string;
  rawTAF: string;
  issueTime: string;
  validTimeFrom: number;
  validTimeTo: number;
}

const ICAO = /^[A-Z0-9]{4}$/;
export const isIcao = (s: string) => ICAO.test(s.trim().toUpperCase());

async function get<T>(type: 'metar' | 'taf', ids: string[]): Promise<T[]> {
  if (!WX_PROXY_URL) throw new Error('Weather relay not set up yet (WX_PROXY_URL in src/config.ts).');
  const list = [...new Set(ids.map((s) => s.trim().toUpperCase()).filter(isIcao))];
  if (!list.length) return [];
  const res = await fetch(`${WX_PROXY_URL}?type=${type}&ids=${list.join(',')}`);
  if (!res.ok) throw new Error(`Weather service error ${res.status}`);
  return (await res.json()) as T[];
}

export const fetchMetars = (ids: string[]) => get<Metar>('metar', ids);
export const fetchTafs = (ids: string[]) => get<Taf>('taf', ids);

/** True -> magnetic. Variation east is positive (magnetic = true - east variation). */
export function trueToMagnetic(trueDeg: number, varEastDeg: number): number {
  return Math.round((((trueDeg - varEastDeg) % 360) + 360) % 360) || 360;
}

/**
 * Values to put into the Performance inputs from a METAR. Variable wind is set
 * as a tailwind on the given runway (conservative); gusts are not used.
 */
export function metarToAerodrome(m: Metar, varEastDeg: number, runwayHeadingDeg: number) {
  const vrb = m.wdir === 'VRB' || m.wdir === undefined;
  return {
    qnhHpa: m.altim !== undefined ? Math.round(m.altim) : undefined,
    oatC: m.temp,
    windKt: m.wspd ?? 0,
    windDirDeg: vrb ? (runwayHeadingDeg + 180) % 360 : trueToMagnetic(m.wdir as number, varEastDeg),
    variableWind: vrb && (m.wspd ?? 0) > 0,
  };
}

/** Break a raw TAF into lines at each change group (FM, BECMG, TEMPO, INTER, PROB). */
export function formatTaf(raw: string): string[] {
  return raw
    .replace(/\s+(?=(FM\d{6}|BECMG|TEMPO|INTER|PROB\d{2})\b)/g, '\n')
    .replace(/\n(PROB\d{2})\n(TEMPO|INTER)/g, '\n$1 $2')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** "12 min ago" style age of an observation. */
export function ageText(obsTimeSec: number, nowMs = Date.now()): string {
  const min = Math.round((nowMs / 1000 - obsTimeSec) / 60);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} h ${min % 60} min ago`;
}
