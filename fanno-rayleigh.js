import {fanno, fannoRatios, isentropic, state} from './physics.js';
import {gasInfo} from './gas-properties.js';
import {bisect, requireValue, positive} from './numerics.js';
import {ductData, ductStageDefaults, ductStageValue, fannoStageFriction, rayleighStageAtMach, rayleighStageFromData} from './duct-stage-data.js?v=20261124-duct-known-data';
import {temperatureEntropyPlot} from './duct-entropy.js?v=20261124-duct-entropy';
import {ductProfile, ductLongitudinalPlots} from './duct-contours.js?v=20261124-duct-stage-order';

export const fannoRayleighMode = 'Fanno + Rayleigh duct';
export const fannoRayleighOrder = 'Fanno → Rayleigh';
export const rayleighFannoOrder = 'Rayleigh → Fanno';
export const sonicRayleighOutlet = 'Sonic outlet';
// Keep the saved value used by the original known-heat and known-friction mode.
export const specifiedRayleighHeat = 'Specified heat transfer';
export const fannoRayleighExample = '5–P3';
export const rayleighFannoExample = 'rayleigh-fanno-known-friction';
export const fannoRayleighInfo = {
 description: 'Apply wall friction and heat transfer in separate sections of a constant-area duct. Choose the order of the sections.',
 model: 'Steady one-dimensional flow · separate friction and heat-transfer sections',
 limitations: 'Each section has constant area and fixed gas properties. The diagram and longitudinal plots show relative progress through each section.',
};

// Chapter 5, Problem 3, Fig. 5–20. The prescribed pressure and temperature are stagnation values.
export const fannoRayleighPreset = Object.freeze({
 ...ductStageDefaults,
 ductProblem: fannoRayleighMode, fluid: 'Air', gamma: 1.4, R: 287,
 M1: 3, T1: 333.3, p1: 1034.2, inletPressureType: 'Stagnation pressure', temperatureInput: 'Stagnation temperature',
 ductLength: 3.3, hydraulicDiameter: .305, frictionFactor: .005, frictionConvention: 'Fanning',
 ductStageOrder: fannoRayleighOrder, rayleighCoolingBranch: 'Subsonic', fannoRayleighOutlet: sonicRayleighOutlet, q: 50,
});

// Use the same inlet and duct geometry to isolate the effect of changing the stage order.
export const rayleighFannoPreset = Object.freeze({
 ...fannoRayleighPreset,
 ductStageOrder: rayleighFannoOrder, fannoRayleighOutlet: specifiedRayleighHeat, q: 35,
});

export function stagedDuctDefaults(order) {
 return order === rayleighFannoOrder
  ? {...rayleighFannoPreset, bookExample: rayleighFannoExample}
  : {...fannoRayleighPreset, bookExample: fannoRayleighExample};
}

export function changeDuctStageOrder(inputs, order) {
 const previous = inputs.ductStageOrder === rayleighFannoOrder ? rayleighFannoPreset : fannoRayleighPreset;
 const isDefault = Object.entries(previous).every(([key, value]) =>
  (key === 'q' && previous.fannoRayleighOutlet === sonicRayleighOutlet) || inputs[key] === value);
 return isDefault
  ? {...inputs, ...stagedDuctDefaults(order)}
  : {...inputs, ductStageOrder: order, bookExample: ''};
}

export function changeDuctStageData(inputs, key, known, result) {
 const rayleigh = key === 'rayleighStageData';
 const value = ductStageValue(result, rayleigh ? 'Rayleigh' : 'Fanno', known);
 const updated = {...inputs, [key]:known, bookExample:''};
 if (known === ductData.heat) {
  if (value !== undefined) updated.q = value;
 } else if (known !== ductData.geometry) {
  updated[rayleigh ? 'rayleighStageValue' : 'fannoStageValue'] = value ?? (known === ductData.friction ? .2164 : 1);
  if (rayleigh && known === ductData.temperature) {
   const previousMach = ductStageValue(result, 'Rayleigh', ductData.mach);
   updated.rayleighStaticTemperatureRoot = previousMach > 1 / Math.sqrt(inputs.gamma) ? 'Higher Mach' : 'Lower Mach';
  }
 }
 return updated;
}

export function stagedRayleighCoolingChoice(x) {
 const first = x.ductStageOrder === rayleighFannoOrder;
 const independent = x.fannoRayleighOutlet === specifiedRayleighHeat;
 if (!independent) return first && x.M1 === 1;
 if (![ductData.heat, ductData.stagnationTemperature].includes(x.rayleighStageData ?? ductData.heat)) return false;
 if (first) return x.M1 === 1;
 try {
  return Math.abs(fannoStageFriction(x, x.M1, x.gamma??1.4) - fannoRatios(x.M1, x.gamma??1.4).F) <= 1e-12;
 } catch {
  return false;
 }
}

const stationProperties = [
 ['Mach number', '', state => state.M],
 ['Static pressure', 'kPa', state => state.p / 1000],
 ['Static temperature', 'K', state => state.T],
 ['Stagnation pressure', 'kPa', state => state.p0 / 1000],
 ['Stagnation temperature', 'K', state => state.T0],
];

// In the reversed order the Rayleigh outlet must have just enough capacity
// for the prescribed downstream friction to bring it to Mach 1.
function machBeforeSonicFanno(lambda, gamma, branch) {
 const precision = {ftol: 0, xtol: 2e-15};
 if (branch === 'subsonic')
  return bisect(M => fannoRatios(M, gamma).F - lambda, 1e-10, 1, precision).value;
 const maximum = ((gamma + 1) / 2 * Math.log1p(2 / (gamma - 1)) - 1) / gamma;
 requireValue(lambda < maximum, 'No finite supersonic Rayleigh outlet can supply this Fanno friction length.', 'length-limit');
 const residual = inverseMach => (inverseMach === 0 ? maximum : fannoRatios(1 / inverseMach, gamma).F) - lambda;
 return 1 / bisect(residual, 0, 1, precision).value;
}

export function solveFannoRayleigh(id, x) {
 const gas = gasInfo(x), {gamma, R} = gas;
 positive(x.M1, 'Inlet Mach');
 const iso = isentropic(x.M1, gamma);
 const inletT = x.temperatureInput === 'Stagnation temperature' ? x.T1 / iso.T0T : x.T1;
 const inletP = x.p1 * 1000 / (x.inletPressureType === 'Stagnation pressure' ? iso.p0p : 1);
 const s1 = state(x.M1, inletT, inletP, gamma, R);
 const params = inlet => ({M1: inlet.M, T1: inlet.T, p1: inlet.p, gamma, R});
 const friction = (inlet, length) => {
  const flow = fanno({...params(inlet), lambda: length});
  requireValue(flow.s2, 'Frictional choking occurs before the end of the Fanno section.', flow.status);
  return flow;
 };
 const rayleighFirst = x.ductStageOrder === rayleighFannoOrder;
 const independent = x.fannoRayleighOutlet === specifiedRayleighHeat;
 const fannoKnown = independent || x.fannoStageData === ductData.friction ? x.fannoStageData : ductData.geometry;
 let lambda, profileLambda, fannoFlow, rayleighFlow;
 if (!rayleighFirst) {
  lambda = profileLambda = fannoStageFriction(x, s1.M, gamma, fannoKnown);
  fannoFlow = friction(s1, lambda);
  rayleighFlow = independent ? rayleighStageFromData(fannoFlow.s2, x, gas) : rayleighStageAtMach(fannoFlow.s2, 1, gas);
 } else if (independent) {
  rayleighFlow = rayleighStageFromData(s1, x, gas);
  lambda = profileLambda = fannoStageFriction(x, rayleighFlow.s2.M, gamma, fannoKnown);
  fannoFlow = friction(rayleighFlow.s2, lambda);
 } else {
  lambda = fannoStageFriction(x, s1.M, gamma, fannoKnown);
  const coolingBranch = x.rayleighCoolingBranch === 'Supersonic' ? 'supersonic' : 'subsonic';
  const branch = s1.M === 1 ? coolingBranch : s1.M < 1 ? 'subsonic' : 'supersonic';
  const mach = lambda === 0 ? 1 : machBeforeSonicFanno(lambda, gamma, branch);
  rayleighFlow = rayleighStageAtMach(s1, mach, gas);
  // Use the inverse root's computed sonic capacity so roundoff cannot leave a nonsonic outlet.
  profileLambda = fannoRatios(mach, gamma).F;
  fannoFlow = friction(rayleighFlow.s2, profileLambda);
 }
 const {q} = rayleighFlow;
 const fannoStage = {name: 'Fanno', color: '#166672', flow: fannoFlow, samples: ductProfile('fanno', fannoFlow, {gamma, R, lambda: profileLambda})};
 const rayleighStage = {name: 'Rayleigh', color: '#a64a2a', flow: rayleighFlow,
  samples: ductProfile('rayleigh', {...rayleighFlow, heatAdded: q / 1000}, {gamma, R})};
 const stages = rayleighFirst ? [rayleighStage, fannoStage] : [fannoStage, rayleighStage];
 const [first, second] = stages;
 const junction = first.flow.s2, s2 = second.flow.s2;

 const stations = [
  {name: 'Section 1 · Inlet', state: s1, x: 0},
  {name: 'Section 2 · Junction', state: junction, x: .5},
  {name: 'Section 3 · Outlet', state: s2, x: 1},
 ];
 const points = stages.flatMap(({samples}, i) =>
  (i === 0 ? samples : samples.slice(1)).map(({x, state}) => ({x: (i + x) / 2, state})));
 const temperatureEntropy = temperatureEntropyPlot({
  reference: s1, gas,
  segments: stages.map(({name, samples, color}, i) => ({
   name: `${name} · ${i + 1} → ${i + 2}`, color, states: samples.map(({state}) => state),
  })),
  stations: stations.map(({state}, i) => ({name: String(i + 1), state})),
  note: 'The two curves meet at section 2. Entropy is referenced to section 1.',
 });
 const result = {ductSystem: true, fannoRayleigh: true, status: second.flow.status, s1, junction, s2, stations,
  stageNames: stages.map(({name}) => name),
  points, longitudinal: points, shockAt: null, heatAdded: q / 1000, frictionLength: lambda,
  referenceTable: {title: 'Station properties', columns: stations.map(({name}) => name),
   rows: stationProperties.map(([label, unit, get]) => ({label: unit ? `${label} (${unit})` : label, values: stations.map(({state}) => get(state))}))},
 };
 result.plots = [temperatureEntropy, ...ductLongitudinalPlots('fanno-rayleigh', result)];
 const rows = [
  {label: 'Heat transfer in Rayleigh section', value: q / 1000, unit: 'kJ/kg'},
  {label: 'Fanno friction parameter', value: lambda, unit: 'fᴅL/D'},
  {label: 'Total-pressure ratio', value: s2.p0 / s1.p0, unit: 'p₀₃/p₀₁'},
  ...stationProperties.flatMap(([label, unit, get]) => stations.map(({name, state}) => ({label: `${name} · ${label}`, value: get(state), unit, panel: 'station'}))),
 ];
 return {id, inputs: x, gas, model: fannoRayleighInfo.model, result, rows, chart:temperatureEntropy.chart,
  scene: {kind: 'ductSystem', system: result, process: id},
  checks: {mass: Math.max(fannoFlow.checks.mass, rayleighFlow.checks.mass),
   energy: Math.max(fannoFlow.checks.energy, rayleighFlow.checks.energy), momentum: rayleighFlow.checks.momentum},
  notice: null, version: '0.2.0'};
}
