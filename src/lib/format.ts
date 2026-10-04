import { FT_PER_M, IN_PER_M, L_PER_USGAL, LB_PER_KG } from './afm';
import type { Units } from '../state';

export const massScale = (u: Units) => (u.mass === 'lb' ? LB_PER_KG : 1);
export const fuelScale = (u: Units) => (u.fuel === 'USG' ? 1 / L_PER_USGAL : 1);
export const armScale = (u: Units) => (u.mass === 'lb' ? IN_PER_M : 1000);
export const armUnit = (u: Units) => (u.mass === 'lb' ? 'in' : 'mm');

export const fmtMass = (kg: number, u: Units) => `${(kg * massScale(u)).toFixed(1)} ${u.mass}`;
export const fmtArm = (m: number, u: Units) => `${(m * armScale(u)).toFixed(u.mass === 'lb' ? 2 : 1)} ${armUnit(u)}`;
export const fmtMoment = (kgm: number, u: Units) =>
  u.mass === 'lb' ? `${Math.round(kgm * LB_PER_KG * IN_PER_M).toLocaleString()} in·lb` : `${Math.round(kgm * 1000).toLocaleString()} kg·mm`;
export const fmtFuel = (l: number, u: Units) => `${(l * fuelScale(u)).toFixed(1)} ${u.fuel}`;
export const fmtDist = (m: number) => `${Math.round(m).toLocaleString()} m`;
export const fmtFt = (m: number) => `${Math.round(m * FT_PER_M).toLocaleString()} ft`;
