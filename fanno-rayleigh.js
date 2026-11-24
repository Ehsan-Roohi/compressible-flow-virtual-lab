import {conservation, fanno, fannoRatios, isentropic, rayleigh, rayleighRatios, state} from './physics.js';
import {gasInfo} from './gas-properties.js';
import {bisect, requireValue, positive} from './numerics.js';
import {temperatureEntropyPlot} from './duct-entropy.js?v=20261124-duct-entropy';
import {ductProfile, ductLongitudinalPlots} from './duct-contours.js?v=20261124-duct-stage-order';

export const fannoRayleighMode = 'Fanno + Rayleigh duct';
export const fannoRayleighOrder = 'Fanno → Rayleigh';
export const rayleighFannoOrder = 'Rayleigh → Fanno';
export const sonicRayleighOutlet = 'Sonic outlet';
export const specifiedRayleighHeat = 'Specified heat transfer';
export const fannoRayleighExample = '5–P3';
export const fannoRayleighInfo = {
 description: 'Apply wall friction and heat transfer in separate sections of a constant-area duct. Choose the order of the sections.',
 model: 'Steady one-dimensional flow · separate friction and heat-transfer sections',
 limitations: 'Each section has constant area and fixed gas properties. The diagram and longitudinal plots show relative progress through each section.',
};

// Chapter 5, Problem 3, Fig. 5–20. The prescribed pressure and temperature are stagnation values.
export const fannoRayleighPreset = Object.freeze({
 ductProblem: fannoRayleighMode, fluid: 'Air', gamma: 1.4, R: 287,
 M1: 3, T1: 333.3, p1: 1034.2, inletPressureType: 'Stagnation pressure', temperatureInput: 'Stagnation temperature',
 ductLength: 3.3, hydraulicDiameter: .305, frictionFactor: .005, frictionConvention: 'Fanning',
 ductStageOrder: fannoRayleighOrder, rayleighCoolingBranch: 'Subsonic', fannoRayleighOutlet: sonicRayleighOutlet, q: 50,
});

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
 const gas = gasInfo(x), {gamma, R, cp} = gas;
 positive(x.M1, 'Inlet Mach');
 positive(x.hydraulicDiameter, 'Hydraulic diameter');
 requireValue(Number.isFinite(x.ductLength) && x.ductLength >= 0, 'Require a nonnegative Fanno section length.');
 requireValue(Number.isFinite(x.frictionFactor) && x.frictionFactor >= 0, 'Require a nonnegative friction factor.');
 const lambda = (x.frictionConvention === 'Fanning' ? 4 : 1) * x.frictionFactor * x.ductLength / x.hydraulicDiameter;
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
 const coolingBranch = x.rayleighCoolingBranch === 'Supersonic' ? 'supersonic' : 'subsonic';
 let fannoFlow = rayleighFirst ? null : friction(s1, lambda);
 const thermalInlet = fannoFlow?.s2 ?? s1;
 const branch = rayleighFirst && s1.M === 1 ? coolingBranch : 'auto';
 const initialRatios = rayleighRatios(thermalInlet.M, gamma);
 let rayleighFlow, q, profileLambda = lambda;
 if (rayleighFirst && lambda > 0 && x.fannoRayleighOutlet !== specifiedRayleighHeat) {
  const junctionBranch = s1.M === 1 ? coolingBranch : s1.M < 1 ? 'subsonic' : 'supersonic';
  const mach = machBeforeSonicFanno(lambda, gamma, junctionBranch);
  const ratios = rayleighRatios(mach, gamma);
  const outlet = state(mach, s1.T * ratios.T / initialRatios.T, s1.p * ratios.p / initialRatios.p, gamma, R);
  q = cp * (outlet.T0 - s1.T0);
  rayleighFlow = {s1, s2: outlet, branch, checks: conservation(s1, outlet, gamma, R, q)};
  // The inverse root makes these lengths equal to numerical precision. Use
  // its computed sonic capacity to land exactly at Mach 1 in the forward solve.
  profileLambda = fannoRatios(mach, gamma).F;
 } else {
  q = x.fannoRayleighOutlet === specifiedRayleighHeat
   ? x.q * 1000 : Math.max(0, cp * thermalInlet.T0 * (1 / initialRatios.T0 - 1));
  rayleighFlow = rayleigh({...params(thermalInlet), q, branch});
  requireValue(rayleighFlow.s2, 'Thermal choking occurs before the end of the Rayleigh section.', rayleighFlow.status);
 }
 if (rayleighFirst) fannoFlow = friction(rayleighFlow.s2, profileLambda);
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
