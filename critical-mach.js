import {bisect, linspace, requireValue} from './numerics.js';

export const criticalMachMethods = ['Prandtl–Glauert', 'Kármán–Tsien', 'Laitone'];
export const compareCriticalMach = 'Compare all three';
const comparisonColors = ['#167c70', '#285ca8', '#ae542c'];

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

const root = (fn, upper = 1) => bisect(fn, 0, upper, {ftol: 0}).value;

function solveCorrection(cp0, gamma, method, sonicDelta, dynamicPressureRatio) {
 const terms = mach => correctionTerms(mach, cp0, gamma, method);
 const correctedCp = mach => {
  const [denominator, factor] = terms(mach);
  return cp0 * factor / denominator;
 };
 // Only the branch connected to the incompressible limit has a positive denominator.
 const upper = method === criticalMachMethods[0] ? 1 : root(mach => terms(mach)[0]);
 const mach = root(mach => {
  const [denominator, factor] = terms(mach);
  return sonicDelta(mach) * denominator - dynamicPressureRatio(mach) * cp0 * factor;
 }, upper);
 const pressureCoefficient = sonicDelta(mach) / dynamicPressureRatio(mach);
 const endAt = plotFloor => root(mach => {
  const [denominator, factor] = terms(mach);
  return denominator - cp0 / plotFloor * factor;
 }, upper);
 return {method, mach, pressureCoefficient, correctedCp, endAt};
}

export function solveCriticalMach(cp0, gamma, method) {
 requireValue(Number.isFinite(cp0) && cp0 < 0, 'Enter a negative value for the minimum incompressible pressure coefficient.');
 requireValue(Number.isFinite(gamma) && gamma > 1, 'Enter a specific heat ratio greater than 1.');
 const compare = method === compareCriticalMach;
 requireValue(compare || criticalMachMethods.includes(method), 'Select a compressibility correction.');

 const sonicDelta = mach => sonicPressureChange(mach, gamma);
 const dynamicPressureRatio = mach => gamma * mach ** 2 / 2;
 const sonicCp = mach => sonicDelta(mach) / dynamicPressureRatio(mach);
 const solutions = (compare ? criticalMachMethods : [method])
  .map(name => solveCorrection(cp0, gamma, name, sonicDelta, dynamicPressureRatio));
 const corrections = solutions.map(({method, mach, pressureCoefficient}) => ({method, mach, pressureCoefficient}));
 const {mach, pressureCoefficient} = corrections[0];
 const plotFloor = 2.4 * Math.min(...corrections.map(result => result.pressureCoefficient));
 const sonicStart = root(mach => sonicDelta(mach) - dynamicPressureRatio(mach) * plotFloor);
 const intersections = corrections.map(result => [result.mach, result.pressureCoefficient]);
 const sonicStops = [sonicStart, ...intersections.map(([x]) => x).sort((a, b) => a - b), 1];
 const chart = {
  title: compare ? 'Critical Mach number comparison' : 'Critical Mach number',
  xlabel: 'Freestream Mach number M∞',
  ylabel: 'Pressure coefficient Cp',
  yRange: [plotFloor, 0],
  invertYAxis: true,
  ...(compare ? {} : {xReference: {x: mach, y: pressureCoefficient, label: `Mcr = ${Number(mach.toPrecision(5))}`}}),
  markers: intersections.map(([x, y], i) => compare
   ? {x, y, name: '', color: comparisonColors[i], title: corrections[i].method}
   : {x, y, name: 'Sonic onset'}),
  series: [
   ...solutions.map(({method, mach, correctedCp, endAt}, i) => ({
    name: compare ? method : `Minimum Cp · ${method}`,
    ...(compare ? {color: comparisonColors[i]} : {}),
    points: [
     ...linspace(0, mach, 61).slice(0, -1).map(m => [m, correctedCp(m)]),
     intersections[i],
     ...linspace(mach, endAt(plotFloor), 61).slice(1).map(m => [m, correctedCp(m)]),
    ],
   })),
   {name: 'Sonic Cp · Eq. (9–115)', dash: '6 4', ...(compare ? {color: '#414b58'} : {}),
    points: sonicStops.slice(1).flatMap((end, i) => linspace(sonicStops[i], end, 61).slice(0, -1).map(m => [m, sonicCp(m)]))
     .concat([[1, 0]])},
  ],
 };
 return {status: 'ok', method, chart, ...(compare ? {corrections} : {mach, pressureCoefficient})};
}
