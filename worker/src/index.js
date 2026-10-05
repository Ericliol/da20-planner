/**
 * da20-wx: a tiny relay for METAR / TAF from aviationweather.gov (NOAA), which
 * carries the Bureau of Meteorology reports for Australian aerodromes.
 * Browsers can't call aviationweather.gov directly (no CORS headers), so the
 * planner calls this Worker instead.
 *
 *   GET /?type=metar&ids=YBAF,YBBN
 *   GET /?type=taf&ids=YBBN
 *
 * Only METAR/TAF, only up to 6 four-character station IDs, only for the
 * planner's own origins. Responses are cached for 5 minutes.
 */
const ALLOWED_ORIGINS = ['https://ericliol.github.io', 'http://localhost:5173'];
const IDS = /^[A-Z0-9]{4}(,[A-Z0-9]{4}){0,5}$/;

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') ?? '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return json({ error: 'GET only' }, 405, cors);

    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const ids = (url.searchParams.get('ids') ?? '').toUpperCase().replace(/\s+/g, '');
    if (!['metar', 'taf'].includes(type) || !IDS.test(ids)) {
      return json({ error: 'Use ?type=metar|taf&ids=YBBN[,YBAF...] (up to 6 stations)' }, 400, cors);
    }

    const upstream = `https://aviationweather.gov/api/data/${type}?ids=${ids}&format=json`;
    const res = await fetch(upstream, {
      headers: { 'User-Agent': 'da20-planner weather relay (github.com/Ericliol/da20-planner)' },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    // aviationweather.gov answers 204 No Content when there is no report.
    const body = res.status === 204 ? '[]' : await res.text();
    return new Response(body, {
      status: res.status === 204 ? 200 : res.status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    });
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
