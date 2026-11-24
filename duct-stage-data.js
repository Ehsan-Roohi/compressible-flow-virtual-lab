import {conservation, fannoRatios, rayleigh, rayleighRatios, state} from './physics.js';
import {positive, requireValue} from './numerics.js';

export const ductData = {
 geometry:'Length and friction factor',
 friction:'Friction parameter',
 heat:'Heat transfer',
 mach:'Outlet Mach',
 pressure:'Static pressure ratio',
 temperature:'Static temperature ratio',
 stagnationTemperature:'Stagnation temperature ratio',
};

export const ductStageDefaults = {
 fannoStageData:ductData.geometry,
 rayleighStageData:ductData.heat,
 fannoStageValue:1,
 rayleighStageValue:1,
 rayleighStaticTemperatureRoot:'Lower Mach',
};

const nonnegative = (value, label) => requireValue(Number.isFinite(value) && value >= 0, `Require a nonnegative ${label}.`);
const onRayleighBranch = (inlet, outlet) => (inlet - 1) * (outlet - 1) >= 0;

export function fannoStageFriction(x, M1, gamma, known = x.fannoStageData ?? ductData.geometry) {
 if (known === ductData.geometry) {
  positive(x.hydraulicDiameter, 'Hydraulic diameter');
  nonnegative(x.ductLength, 'Fanno section length');
  nonnegative(x.frictionFactor, 'friction factor');
  return (x.frictionConvention === 'Fanning' ? 4 : 1) * x.frictionFactor * x.ductLength / x.hydraulicDiameter;
 }
 const value = x.fannoStageValue;
 if (known === ductData.friction) {
  nonnegative(value, 'Fanno friction parameter');
  return value;
 }
 positive(value, 'Fanno outlet Mach or ratio');
 const b = (gamma - 1) / 2;
 let M2 = value;
 if (known === ductData.temperature)
  M2 = Math.sqrt(((1 + b * M1 ** 2) / value - 1) / b);
 if (known === ductData.pressure) {
  const k = (M1 / value) ** 2 * (1 + b * M1 ** 2);
  M2 = Math.sqrt(2 * k / (1 + Math.sqrt(1 + 4 * b * k)));
 }
 positive(M2, 'Fanno outlet Mach inferred from the supplied data');
 const lo = Math.min(M1, 1), hi = Math.max(M1, 1), tolerance = 1e-11 * hi;
 requireValue(M2 >= lo - tolerance && M2 <= hi + tolerance,
  'The specified Fanno outlet must lie between the section inlet Mach and Mach 1.', 'fanno-outlet');
 return Math.max(0, fannoRatios(M1, gamma).F - fannoRatios(Math.max(lo, Math.min(hi, M2)), gamma).F);
}

export function rayleighStageAtMach(inlet, M2, {gamma, R, cp}) {
 positive(M2, 'Rayleigh outlet Mach inferred from the supplied data');
 requireValue(onRayleighBranch(inlet.M, M2), 'The specified Rayleigh outlet crosses Mach 1 from the section inlet.', 'rayleigh-outlet');
 const a = rayleighRatios(inlet.M, gamma), b = rayleighRatios(M2, gamma);
 const outlet = state(M2, inlet.T * b.T / a.T, inlet.p * b.p / a.p, gamma, R);
 const q = cp * (outlet.T0 - inlet.T0);
 const branch = M2 < 1 ? 'subsonic' : M2 > 1 ? 'supersonic' : 'auto';
 return {s1:inlet, s2:outlet, status:M2 === 1 ? 'sonic-limit' : 'ok', q, branch,
  checks:conservation(inlet, outlet, gamma, R, q)};
}

export function rayleighStageFromHeat(inlet, q, {gamma, R}, branch = 'auto') {
 const flow = rayleigh({M1:inlet.M, T1:inlet.T, p1:inlet.p, q, gamma, R, branch});
 requireValue(flow.s2, 'Thermal choking occurs before the end of the Rayleigh section.', flow.status);
 return {...flow, q};
}

export function rayleighStageFromData(inlet, x, gas) {
 const known = x.rayleighStageData ?? ductData.heat;
 const {gamma, cp} = gas, M1 = inlet.M, value = x.rayleighStageValue;
 const branch = M1 === 1 ? (x.rayleighCoolingBranch === 'Supersonic' ? 'supersonic' : 'subsonic') : 'auto';
 if (known === ductData.heat) return rayleighStageFromHeat(inlet, x.q * 1000, gas, branch);
 positive(value, 'Rayleigh outlet Mach or ratio');
 if (known === ductData.stagnationTemperature)
  return rayleighStageFromHeat(inlet, cp * inlet.T0 * (value - 1), gas, branch);
 if (known === ductData.pressure) {
  const squared = ((1 + gamma * M1 ** 2) / value - 1) / gamma;
  return rayleighStageAtMach(inlet, Math.sqrt(Math.abs(squared - 1) < 1e-12 ? 1 : squared), gas);
 }
 if (known === ductData.temperature) {
  const u = Math.sqrt(value) * M1 / (1 + gamma * M1 ** 2);
  const discriminant = 1 - 4 * gamma * u ** 2;
  requireValue(discriminant >= -1e-12, 'The specified static temperature exceeds the maximum on the Rayleigh line.', 'rayleigh-temperature');
  const a = 1 + Math.sqrt(Math.max(0, discriminant));
  const candidates = [2 * u / a, a / (2 * gamma * u)].map(m => Math.abs(m - 1) < 1e-12 ? 1 : m)
   .filter(m => Number.isFinite(m) && m > 0 && onRayleighBranch(M1, m));
  requireValue(candidates.length, 'No Rayleigh outlet on the inlet Mach branch has the specified static temperature.', 'rayleigh-temperature');
  const M2 = x.rayleighStaticTemperatureRoot === 'Higher Mach' ? candidates.at(-1) : candidates[0];
  return rayleighStageAtMach(inlet, M2, gas);
 }
 return rayleighStageAtMach(inlet, value, gas);
}

export function ductStageValue(result, section, known) {
 const index = result?.stageNames?.indexOf(section) ?? -1;
 if (index < 0) return;
 const inlet = result.stations[index].state, outlet = result.stations[index + 1].state;
 switch (known) {
  case ductData.heat: return result.heatAdded;
  case ductData.friction: return result.frictionLength;
  case ductData.mach: return outlet.M;
  case ductData.pressure: return outlet.p / inlet.p;
  case ductData.temperature: return outlet.T / inlet.T;
  case ductData.stagnationTemperature: return outlet.T0 / inlet.T0;
 }
}
