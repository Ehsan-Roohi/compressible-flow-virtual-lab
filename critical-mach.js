import {bisect, linspace, requireValue} from './numerics.js';

export const criticalMachMethods = ['Prandtl–Glauert', 'Kármán–Tsien', 'Laitone'];

function sonicPressureChange(mach, gamma) {
 return Math.expm1(gamma / (gamma - 1) *
  Math.log1p((gamma - 1) / (gamma + 1) * (mach - 1) * (mach + 1)));
}

// Return the correction denominator and the factor multiplying the numerator.
// Multiplying both by beta in Laitone's rule avoids division by zero at M = 1.
function correctionTerms(mach, cp0, gamma, method) {
 const betaSquared = (1 - mach) * (1 + mach);
 const beta = Math.sqrt(betaSquared);
 const machSquared = mach ** 2;
 if (method === 'Laitone') {
  return [betaSquared + machSquared * (1 + (gamma - 1) * machSquared / 2) * cp0 / 2, beta];
 }
 if (method === 'Kármán–Tsien') {
  return [beta + machSquared / (1 + beta) * cp0 / 2, 1];
 }
 return [beta, 1];
}

export function solveCriticalMach(cp0, gamma, method) {
 requireValue(Number.isFinite(cp0) && cp0 < 0, 'Enter a negative value for the minimum incompressible pressure coefficient.');
 requireValue(Number.isFinite(gamma) && gamma > 1, 'Enter a specific heat ratio greater than 1.');
 requireValue(criticalMachMethods.includes(method), 'Select a compressibility correction.');

 const terms = mach => correctionTerms(mach, cp0, gamma, method);
 const dynamicPressureRatio = mach => gamma * mach ** 2 / 2;
 const sonicCp = mach => sonicPressureChange(mach, gamma) / dynamicPressureRatio(mach);
 const correctedCp = mach => {
  const [denominator, factor] = terms(mach);
  return cp0 * factor / denominator;
 };
 const root = (fn, upper = 1) => bisect(fn, 0, upper, {ftol: 0}).value;
 // Only the branch connected to the incompressible limit has a positive denominator.
 const upper = method === criticalMachMethods[0] ? 1 : root(mach => terms(mach)[0]);
 const mach = root(mach => {
  const [denominator, factor] = terms(mach);
  return sonicPressureChange(mach, gamma) * denominator - dynamicPressureRatio(mach) * cp0 * factor;
 }, upper);
 const pressureCoefficient = sonicCp(mach);
 const plotFloor = 2.4 * pressureCoefficient;
 const sonicStart = root(mach => sonicPressureChange(mach, gamma) - dynamicPressureRatio(mach) * plotFloor);
 const correctedEnd = root(mach => {
  const [denominator, factor] = terms(mach);
  return denominator - cp0 / plotFloor * factor;
 }, upper);
 const intersection = [mach, pressureCoefficient];
 const chart = {
  title: 'Critical Mach number',
  xlabel: 'Freestream Mach number M∞',
  ylabel: 'Pressure coefficient Cp',
  yRange: [plotFloor, 0],
  invertYAxis: true,
  xReference: {x: mach, y: pressureCoefficient, label: `Mcr = ${Number(mach.toPrecision(5))}`},
  markers: [{x: mach, y: pressureCoefficient, name: 'Sonic onset'}],
  series: [
   {name: `Minimum Cp · ${method}`, points: [
    ...linspace(0, mach, 61).slice(0, -1).map(m => [m, correctedCp(m)]),
    intersection,
    ...linspace(mach, correctedEnd, 61).slice(1).map(m => [m, correctedCp(m)]),
   ]},
   {name: 'Sonic Cp · Eq. (9–115)', dash: '6 4', points: [
    ...linspace(sonicStart, mach, 61).slice(0, -1).map(m => [m, sonicCp(m)]),
    intersection,
    ...linspace(mach, 1, 61).slice(1).map(m => [m, sonicCp(m)]),
   ]},
  ],
 };
 return {status: 'ok', mach, pressureCoefficient, method, chart};
}
