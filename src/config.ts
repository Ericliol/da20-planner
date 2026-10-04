/**
 * PIN required to edit aircraft data (empty weight, arm, fuel system...).
 * Empty for now: pressing "Unlock" with an empty PIN unlocks editing.
 *
 * This only stops accidental changes. It is checked in the browser, so anyone
 * who reads the published code can see it. It is not real security.
 */
export const AIRCRAFT_EDIT_PIN = '';
