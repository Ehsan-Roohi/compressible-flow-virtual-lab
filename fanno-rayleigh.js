import {fanno, isentropic, rayleigh} from './physics.js';
import {gasInfo} from './gas-properties.js';
import {requireValue, positive} from './numerics.js';
import {ductProfile, ductLongitudinalPlots} from './duct-contours.js?v=20261124-fanno-rayleigh';

export const fannoRayleighMode = 'Fanno + Rayleigh duct';
export const sonicRayleighOutlet = 'Sonic outlet';
export const specifiedRayleighHeat = 'Specified heat transfer';
export const fannoRayleighExample = '5–P3';
export const fannoRayleighInfo = {
 description: 'Apply wall friction in the first section and heat transfer in the second section of a constant-area duct.',
 model: 'Steady one-dimensional flow · Fanno section followed by a Rayleigh section',
 limitations: 'Each section has constant area and fixed gas properties. The diagram and longitudinal plots show relative progress through each section.',
};

// Chapter 5, Problem 3, Fig. 5–20. The prescribed pressure and temperature are stagnation values.
export const fannoRayleighPreset = Object.freeze({
 ductProblem: fannoRayleighMode, fluid: 'Air', gamma: 1.4, R: 287,
 M1: 3, T1: 333.3, p1: 1034.2, inletPressureType: 'Stagnation pressure', temperatureInput: 'Stagnation temperature',
 ductLength: 3.3, hydraulicDiameter: .305, frictionFactor: .005, frictionConvention: 'Fanning',
 fannoRayleighOutlet: sonicRayleighOutlet, q: 50,
});

const stationProperties = [
 ['Mach number', '', state => state.M],
 ['Static pressure', 'kPa', state => state.p / 1000],
 ['Static temperature', 'K', state => state.T],
 ['Stagnation pressure', 'kPa', state => state.p0 / 1000],
 ['Stagnation temperature', 'K', state => state.T0],
];

export function solveFannoRayleigh(id, x) {
 const gas = gasInfo(x), {gamma, R, cp} = gas;
 positive(x.M1, 'Inlet Mach');
 positive(x.hydraulicDiameter, 'Hydraulic diameter');
 requireValue(Number.isFinite(x.ductLength) && x.ductLength >= 0, 'Require a nonnegative Fanno section length.');
 requireValue(Number.isFinite(x.frictionFactor) && x.frictionFactor >= 0, 'Require a nonnegative friction factor.');
 const lambda = (x.frictionConvention === 'Fanning' ? 4 : 1) * x.frictionFactor * x.ductLength / x.hydraulicDiameter;
 const iso = isentropic(x.M1, gamma);
 const inletT = x.temperatureInput === 'Stagnation temperature' ? x.T1 / iso.T0T : x.T1;
 const inletP = x.p1 * 1000 / (x.inletPressureType === 'Stagnation pressure' ? iso.p0p : 1);
 const first = fanno({M1: x.M1, T1: inletT, p1: inletP, lambda, gamma, R});
 requireValue(first.s2, 'Frictional choking occurs before the end of the Fanno section.', first.status);

 const s1 = first.s1, junction = first.s2;
 const rayleighInputs = {M1: junction.M, T1: junction.T, p1: junction.p, gamma, R};
 const qmax = Math.max(0, rayleigh({...rayleighInputs, q: 0}).qmax);
 const q = x.fannoRayleighOutlet === specifiedRayleighHeat ? x.q * 1000 : qmax;
 const second = rayleigh({...rayleighInputs, q});
 requireValue(second.s2, 'Thermal choking occurs before the end of the Rayleigh section.', second.status);
 const s2 = second.s2;

 const stations = [
  {name: 'Section 1 · Inlet', state: s1, x: 0},
  {name: 'Section 2 · Junction', state: junction, x: .5},
  {name: 'Section 3 · Outlet', state: s2, x: 1},
 ];
 const fannoPoints = ductProfile('fanno', first, {gamma, R, lambda})
  .map(({x, state}) => ({x: x / 2, state}));
 const rayleighPoints = ductProfile('rayleigh', {...second, heatAdded: q / 1000}, {gamma, R})
  .map(({x, state}) => ({x: (1 + x) / 2, state}));
 const points = [...fannoPoints, ...rayleighPoints.slice(1)];
 const entropyChange = state => (cp * Math.log(state.T / s1.T) - R * Math.log(state.p / s1.p)) / 1000;
 const chart = {title: 'Temperature–entropy diagram', xlabel: 'Entropy change from inlet Δs (kJ/(kg·K))', ylabel: 'Static temperature T (K)',
  zeroBaseline: false,
  series: [
   {name: 'Fanno · 1 → 2', color: '#166672', points: fannoPoints.map(({state}) => [entropyChange(state), state.T])},
   {name: 'Rayleigh · 2 → 3', color: '#a64a2a', points: rayleighPoints.map(({state}) => [entropyChange(state), state.T])},
  ],
  markers: stations.map(({state}, i) => ({name: String(i + 1), x: entropyChange(state), y: state.T})),
 };
 const result = {ductSystem: true, fannoRayleigh: true, status: second.status, s1, junction, s2, stations,
  points, longitudinal: points, shockAt: null, heatAdded: q / 1000, frictionLength: lambda,
  referenceTable: {title: 'Station properties', columns: stations.map(({name}) => name),
   rows: stationProperties.map(([label, unit, get]) => ({label: unit ? `${label} (${unit})` : label, values: stations.map(({state}) => get(state))}))},
 };
 result.plots = [{key: 'fanno-rayleigh-entropy', label: chart.title, chart,
  note: 'The two curves meet at section 2. Entropy is referenced to section 1.'}, ...ductLongitudinalPlots('fanno-rayleigh', result)];
 const rows = [
  {label: 'Heat transfer in Rayleigh section', value: q / 1000, unit: 'kJ/kg'},
  {label: 'Fanno friction parameter', value: lambda, unit: 'fᴅL/D'},
  {label: 'Total-pressure ratio', value: s2.p0 / s1.p0, unit: 'p₀₃/p₀₁'},
  ...stationProperties.flatMap(([label, unit, get]) => stations.map(({name, state}) => ({label: `${name} · ${label}`, value: get(state), unit, panel: 'station'}))),
 ];
 return {id, inputs: x, gas, model: fannoRayleighInfo.model, result, rows, chart,
  scene: {kind: 'ductSystem', system: result, process: id},
  checks: {mass: Math.max(first.checks.mass, second.checks.mass), energy: Math.max(first.checks.energy, second.checks.energy), momentum: second.checks.momentum},
  notice: null, version: '0.2.0'};
}
