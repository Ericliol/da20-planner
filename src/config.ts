/**
 * PIN required to edit aircraft data (empty weight, arm, fuel system...).
 *
 * This only stops accidental changes. It is checked in the browser, so anyone
 * who reads the published code can see it. It is not real security.
 */
export const AIRCRAFT_EDIT_PIN = '1234';

/**
 * URL of the da20-wx Cloudflare Worker (worker/ in this repo) that relays
 * METAR / TAF. Set in .env.production (live) and .env.development (local wrangler dev).
 */
export const WX_PROXY_URL = import.meta.env.VITE_WX_PROXY_URL ?? '';
