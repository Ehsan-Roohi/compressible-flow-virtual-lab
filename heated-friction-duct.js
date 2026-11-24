import {gasInfo} from './gas-properties.js';
import {positive, requireValue} from './numerics.js';
import {isentropic, state} from './physics.js';
import {ductLongitudinalPlots} from './duct-contours.js?v=20261124-heated-friction-duct';

export const heatedFrictionMode = 'Heat transfer + wall friction';
export const heatedFrictionExample = 'shapiro-8-9';
export const ductHeatingModes = {wall:'Constant wall temperature', uniform:'Uniform heat flux'};
export const ductHeatInputs = {
 wallRatio:'Wall temperature ratio', wallTemperature:'Wall temperature',
 total:'Total heat per unit mass', perLength:'Heat per unit mass per length',
};
export const ductFrictionInputs = {geometry:'Length and friction factor', parameter:'Friction parameter'};

export const heatedFrictionInfo = {
 description:'Solve for heat transfer and wall friction acting together along a single constant-area duct.',
 model:'Steady 1D flow · constant-area duct · heat transfer and wall friction',
 limitations:'The wall-temperature model uses the Reynolds analogy and unit recovery factor. The fixed-inlet integration ends at the first sonic point or the specified outlet.',
};

// Shapiro §8.9. The diameter and inlet totals set the dimensional scales.
const referenceLength = -.1 * Math.log1p(-.05 / 3) / .01;
export const heatedFrictionDefaults = {
 heatedDuctModel:ductHeatingModes.wall, heatedWallInput:ductHeatInputs.wallRatio,
 heatedWallRatio:4, heatedWallTemperature:1200, heatedFluxInput:ductHeatInputs.total,
 heatedTotalHeat:15.0675, heatedHeatRate:15.0675 / referenceLength,
 heatedFrictionInput:ductFrictionInputs.geometry, heatedFrictionParameter:.02 * referenceLength / .1,
};
export const heatedFrictionPreset = Object.freeze({
 ...heatedFrictionDefaults, ductProblem:heatedFrictionMode, bookExample:heatedFrictionExample,
 fluid:'Air', gamma:1.4, R:287, M1:.5, p1:101.325, T1:300,
 inletPressureType:'Stagnation pressure', temperatureInput:'Stagnation temperature',
 ductLength:referenceLength, hydraulicDiameter:.1, frictionConvention:'Fanning', frictionFactor:.005,
});

export function changeHeatedDuctInput(inputs, key, value) {
 const updated = {...inputs,[key]:value,bookExample:''};
 const {ductLength:length, hydraulicDiameter:diameter} = inputs;
 if (key === 'heatedWallInput') {
  const T0 = inputs.temperatureInput === 'Stagnation temperature' ? inputs.T1 :
   inputs.T1*(1+(inputs.gamma-1)*inputs.M1**2/2);
  if (Number.isFinite(T0) && T0>0) {
   if (value === ductHeatInputs.wallRatio) updated.heatedWallRatio=inputs.heatedWallTemperature/T0;
   else updated.heatedWallTemperature=inputs.heatedWallRatio*T0;
  }
 }
 if (key === 'heatedFluxInput' && Number.isFinite(length) && length>0) {
  if (value === ductHeatInputs.total) updated.heatedTotalHeat=inputs.heatedHeatRate*length;
  else updated.heatedHeatRate=inputs.heatedTotalHeat/length;
 }
 if (key === 'heatedFrictionInput' && Number.isFinite(length) && length>0 && Number.isFinite(diameter) && diameter>0) {
  const scale = inputs.frictionConvention === 'Fanning' ? 4 : 1;
  if (value === ductFrictionInputs.parameter) updated.heatedFrictionParameter=scale*inputs.frictionFactor*length/diameter;
  else updated.frictionFactor=inputs.heatedFrictionParameter*diameter/(scale*length);
 }
 return updated;
}

function ductLengthAndFriction(x, perLength) {
 const geometry = x.heatedFrictionInput !== ductFrictionInputs.parameter;
 const length = geometry || perLength ? x.ductLength : null;
 if (length !== null) positive(length, 'Duct length');
 if (geometry) positive(x.hydraulicDiameter, 'Hydraulic diameter');
 const lambda = geometry
  ? (x.frictionConvention === 'Fanning' ? 4 : 1) * x.frictionFactor * length / x.hydraulicDiameter
  : x.heatedFrictionParameter;
 requireValue(Number.isFinite(lambda) && lambda >= 0, 'Require a finite, nonnegative friction parameter.');
 return {length, lambda, diameter:geometry ? x.hydraulicDiameter : null};
}

function heatProfile(x, inletT0, cp, lambda, length, perLength) {
 if (x.heatedDuctModel !== ductHeatingModes.uniform) {
  const Tw = x.heatedWallInput === ductHeatInputs.wallTemperature ? x.heatedWallTemperature : x.heatedWallRatio * inletT0;
  positive(Tw, 'Wall temperature');
  const difference = Tw - inletT0, rate = lambda / 2;
  return {Tw, end:1,
   temperature:z => inletT0 - difference * Math.expm1(-rate * z),
   slope:z => rate * difference * Math.exp(-rate * z),
   note:'Constant wall temperature. The Reynolds analogy couples the local heat input to wall friction.',
  };
 }
 const q = (perLength ? x.heatedHeatRate * length : x.heatedTotalHeat) * 1000;
 requireValue(Number.isFinite(q), 'Heat transfer must be finite.');
 const change = q / cp;
 const zero = change < 0 ? -inletT0 / change : Infinity;
 return {end:zero <= 1 ? zero * (1 - 1e-8) : 1,
  temperature:z => inletT0 + change * z,
  slope:() => change,
  note:'Uniform wall heat flux. Cumulative heat transfer per unit mass varies linearly with distance.',
 };
}

function rkStep(f, x, y, h) {
 const a = f(x, y), b = f(x+h/2, y+h*a/2), c = f(x+h/2, y+h*b/2), d = f(x+h, y+h*c);
 return y+h*(a+2*b+2*c+d)/6;
}

// Keep the original Mach branch and remove the sonic pole with
// w = [(1 − M²)/(1 + M²)]². The sound speed boundary is w = 0.
function integrateMach(inletMach, gamma, lambda, heating) {
 const M2 = inletMach ** 2, sign = Math.sign(1 - M2), b = (gamma - 1) / 2;
 const initial = ((1 - M2) / (1 + M2)) ** 2;
 const slope = (x, w) => {
  const r = sign * Math.sqrt(Math.max(0, Math.min(1, w)));
  const a = 1-r, d = 1+r;
  const logHeat = heating.slope(x) / heating.temperature(x);
  return -.5 * a * (d + b*a) * ((d + gamma*a) * logHeat + gamma*a*lambda);
 };
 const points = [{x:0, M:inletMach}];
 if (sign === 0) {
  requireValue(lambda === 0 && heating.slope(0) === 0,
   'Specify a subsonic or supersonic inlet Mach for the fixed-inlet heat-and-friction calculation.', 'sonic-inlet');
  points.push({x:1, M:inletMach});
  return {points, boundary:null};
 }
 const mach = w => {
  const r = sign * Math.sqrt(w);
  return Math.sqrt((1-r)/(1+r));
 };
 let x=0, w=initial, step=.005, count=0;
 // Sample each 0.005 L for plots, adapting the integration within each interval.
 for (let i=1; i<=200; i++) {
  const target = heating.end * i / 200;
  while (x < target) {
   requireValue(++count < 60000, 'Heat-and-friction integration did not converge.', 'nonconverged');
   const h = Math.min(step, target-x);
   const whole = rkStep(slope,x,w,h), midpoint = rkStep(slope,x,w,h/2);
   const halves = rkStep(slope,x+h/2,midpoint,h/2);
   const error = Math.abs(halves-whole) / 15;
   const crossed = [midpoint, halves].some(y => y <= 0 || y >= 1);
   if ((error > 2e-12 || crossed) && h > 1e-12) {
    step=h/2;
    continue;
   }
   if (crossed) {
    const first = midpoint <= 0 || midpoint >= 1;
    const stop = first ? midpoint : halves, bound = stop <= 0 ? 0 : 1;
    const dx = h*(first ? .5 : 1);
    if (bound === 0) points.push({x:x + dx*(w/(w-stop)), M:1});
    else if (x > points.at(-1).x) points.push({x, M:mach(w)});
    return {points, boundary:bound === 0 ? 'sonic' : 'cooling'};
   }
   w=halves;
   x+=h;
   if (error < 1e-13) step = Math.min(.005, 2*h);
  }
  if (target === heating.end && w < 1e-12 && slope(x,w) < 0) {
   points.push({x:target, M:1});
   return {points, boundary:'sonic'};
  }
  points.push({x:target, M:mach(w)});
 }
 return {points, boundary:heating.end < 1 ? 'cooling' : null};
}

const tableProperties = [
 ['Mach number','',s=>s.M],
 ['Static pressure','kPa',s=>s.p/1000],
 ['Static temperature','K',s=>s.T],
 ['Stagnation pressure','kPa',s=>s.p0/1000],
 ['Stagnation temperature','K',s=>s.T0],
];

export function solveHeatedFrictionDuct(id, x) {
 const gas = gasInfo(x), {gamma, R, cp} = gas;
 positive(x.M1, 'Inlet Mach');
 const iso = isentropic(x.M1,gamma);
 const T1 = x.temperatureInput === 'Stagnation temperature' ? x.T1/iso.T0T : x.T1;
 const p1 = x.p1*1000/(x.inletPressureType === 'Stagnation pressure' ? iso.p0p : 1);
 const inlet = state(x.M1,T1,p1,gamma,R);
 const perLength = x.heatedDuctModel === ductHeatingModes.uniform && x.heatedFluxInput === ductHeatInputs.perLength;
 const {length,lambda,diameter} = ductLengthAndFriction(x,perLength);
 const heating = heatProfile(x,inlet.T0,cp,lambda,length,perLength);
 const {points,boundary} = integrateMach(inlet.M,gamma,lambda,heating);
 const massFlux = inlet.rho*inlet.u;
 const profile = points.map(({x,M},i) => {
  if (i === 0) return {x,state:inlet};
  const T = heating.temperature(x)/isentropic(M,gamma).T0T;
  const u = M*Math.sqrt(gamma*R*T);
  return {x,state:state(M,T,massFlux*R*T/u,gamma,R)};
 });
 const {x:endFraction,state:profileEnd} = profile.at(-1);
 const reachedExit = boundary !== 'cooling' && endFraction >= 1-1e-10;
 const sonic = boundary === 'sonic';
 const status = sonic ? (reachedExit ? 'sonic-limit' : 'length-limit') : boundary === 'cooling' ? 'cooling-limit' : 'ok';
 const exitName = reachedExit ? (sonic ? 'Sonic outlet' : 'Outlet') : sonic ? 'Choking station' : 'Last computed station';
 const notice = sonic && !reachedExit
  ? 'The flow reaches Mach 1 inside the duct. The fixed-inlet solution ends at the choking station.'
  : boundary === 'cooling' ? 'The prescribed cooling reaches the limit of the continuous inlet branch before an outlet state is available.' : null;
 const stations = [{name:'Inlet',x:0,state:inlet},{name:exitName,x:endFraction,state:profileEnd}];
 const heatAdded = cp*(profileEnd.T0-inlet.T0)/1000;
 const profileNote = heating.note + (notice ? ' ' + notice : '');
 const result = {
  heatedFriction:true, ductSystem:true, status, endFraction, profileEnd,
  s1:inlet, s2:reachedExit?profileEnd:null, stations, longitudinal:profile, points:profile, shockAt:null,
  frictionLength:lambda, heatAdded, profileNote,
  referenceTable:{title:'Duct station properties',columns:stations.map(s=>s.name),
   rows:tableProperties.map(([label,unit,get])=>({label:unit?`${label} (${unit})`:label,values:stations.map(s=>get(s.state))}))},
 };
 const plots = ductLongitudinalPlots('heated-friction',result);
 result.plots = plots;
 const rows = [
  {label:'Duct friction parameter',value:lambda,unit:'fᴅL/Dₕ'},
  {label:reachedExit?'Net heat transfer':'Net heat transfer to last computed station',value:heatAdded,unit:'kJ/kg'},
  {label:'Stagnation-pressure ratio',value:profileEnd.p0/inlet.p0,unit:'p₀₂/p₀₁'},
 ];
 if (heating.Tw !== undefined) rows.push({label:'Wall temperature',value:heating.Tw,unit:'K'});
 if (diameter !== null) rows.push({label:'Duct length / diameter',value:length/diameter,unit:'L/Dₕ'});
 if (sonic) {
  rows.push({label:'Choking location',value:endFraction,unit:'x/L'});
  if (length !== null) rows.push({label:'Distance to choking',value:endFraction*length,unit:'m'});
  if (diameter !== null) rows.push({label:'Choking location / diameter',value:endFraction*length/diameter,unit:'x/Dₕ'});
 }
 return {id,inputs:x,gas,model:heatedFrictionInfo.model,result,rows,chart:plots[0].chart,
  scene:{kind:'ductSystem',system:result,process:id},notice,
  checks:{
   mass:Math.max(...profile.map(({state:s})=>Math.abs(s.rho*s.u/massFlux-1))),
   energy:Math.max(...profile.map(({x,state:s})=>Math.abs(s.T0/heating.temperature(x)-1))),
  },version:'0.3.0'};
}
