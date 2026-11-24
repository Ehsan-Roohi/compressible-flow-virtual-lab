import {
  deg, rad, state, normalShock, rayleighRatios, fannoRatios, obliqueShock,
  shockLimit, prandtlMeyer, isentropicRelations, linspace,
} from './physics.js';

export const calculatorModes = {
  isentropic: 'Isentropic Flow',
  normal: 'Normal Shock',
  rayleigh: 'Rayleigh Flow',
  fanno: 'Fanno Flow',
  oblique: 'Oblique Shock (θ–β–M)',
  expansion: 'Prandtl–Meyer',
};

export const shockCalculatorLabs = {
  [calculatorModes.normal]: {href:'#normal',label:'Normal Shock'},
  [calculatorModes.oblique]: {href:'#wall?example=6-2',label:'Supersonic Wave Lab · Compression Ramp'},
};

const modesByMach = {
  [calculatorModes.isentropic]: {min:0,max:50},
  [calculatorModes.normal]: {min:1,max:50},
  [calculatorModes.rayleigh]: {min:.000001,max:50},
  [calculatorModes.fanno]: {min:.000001,max:50},
  [calculatorModes.oblique]: {min:1.000001,max:50},
  [calculatorModes.expansion]: {min:1,max:50},
};
export const calculatorMachRange = mode => modesByMach[mode] ?? modesByMach[calculatorModes.isentropic];

const row = (label, value, unit = '') => ({label,value,unit});
const section = (title, rows) => ({title,rows});
function stateComparison(inlet,outlet,outletLabel,title=''){
  const properties=[
    ['Mach number','M',''],['Static pressure','p','kPa',1000],
    ['Static temperature','T','K'],['Density','rho','kg/m³'],
    ['Flow speed','u','m/s'],['Speed of sound','a','m/s'],
    ['Stagnation pressure','p0','kPa',1000],['Stagnation temperature','T0','K'],
  ];
  const rows=properties.map(([label,key,unit,scale=1])=>({
    label,unit,inlet:inlet[key]/scale,outlet:outlet?outlet[key]/scale:null,
  }));
  return {title,outletLabel,rows};
}

function calculatorOutput(calculatorSections,calculatorComparisons){
  const rows=calculatorSections.flatMap(({title,rows})=>rows.map(r=>({...r,label:`${title} · ${r.label}`})));
  const stateRows=(table,key,title)=>table.rows.filter(r=>r[key]!==null)
    .map(r=>row(`${title} · ${r.label}`,r[key],r.unit));
  rows.push(...stateRows(calculatorComparisons[0],'inlet','Inlet state'));
  for(const table of calculatorComparisons)
    rows.push(...stateRows(table,'outlet',table.title||table.outletLabel));
  return {rows,calculatorSections,calculatorComparisons};
}

function stagnationComparison(inlet,g,R){
  return stateComparison(inlet,state(0,inlet.T0,inlet.p0,g,R),'Stagnation reference');
}

function stagnationRatios(r){
  return [row('Static pressure ratio p/p₀',r.pP0),row('Density ratio ρ/ρ₀',r.rhoRho0),row('Static temperature ratio T/T₀',r.TT0)];
}

function expansionAngles(r){
  return [row('Mach angle μ',r.machAngle,'°'),row('Prandtl–Meyer angle ν',r.pmAngle,'°')];
}

export function isentropicCalculatorOutput(inlet,g,R){
  const r=inlet.relations;
  const stagnation=[row('p/p₀',r.pP0),row('ρ/ρ₀',r.rhoRho0),row('T/T₀',r.TT0)];
  const sonic=[row('p/p*',r.pPstar),row('ρ/ρ*',r.rhoRhostar),row('T/T*',r.TTstar),
    {...row('A/A*',r.areaRatio),display:r.areaUnbounded?'∞':null}];
  const angles=expansionAngles(r);
  const sections=[
    section('Stagnation ratios',stagnation),section('Sonic ratios',sonic),section('Angles',angles),
  ];
  const comparison=stagnationComparison(inlet,g,R);
  const ratios=[row('Mach number M',r.M),...angles,...stagnation,...sonic];
  const rows=[
    row('Stagnation temperature',inlet.T0,'K'),row('Stagnation pressure',inlet.p0/1000,'kPa'),
    row('Speed of sound',inlet.a,'m/s'),row('Velocity',inlet.u,'m/s'),row('Density',inlet.rho,'kg/m³'),
    ...ratios.map(r=>({...r,panel:'isentropic'})),
    row('Static pressure',inlet.p/1000,'kPa'),row('Static temperature',inlet.T,'K'),
    ...comparison.rows.map(r=>row(`Stagnation reference · ${r.label}`,r.outlet,r.unit)),
  ];
  return {rows,calculatorSections:sections,calculatorComparisons:[comparison]};
}
function shockRows(s){
  return [
    row('Static pressure ratio p₂/p₁',s.p),row('Density ratio ρ₂/ρ₁',s.rho),
    row('Static temperature ratio T₂/T₁',s.T),row('Stagnation pressure ratio p₀₂/p₀₁',s.p0),
  ];
}

function machChart(title, ylabel, mode, m, series){
  const {min,max}=calculatorMachRange(mode);
  const lower=mode===calculatorModes.rayleigh||mode===calculatorModes.fanno ? .05 : min;
  const xs=Array.from(new Set([...linspace(Math.max(min,lower),
    Math.min(max,Math.max(4,m*1.15)),101),m,1])).filter(x=>x>=min&&x<=max).sort((a,b)=>a-b);
  return {title,xlabel:'Inlet Mach number',ylabel,series:series.map(([name,evaluate])=>({name,points:xs.map(x=>[x,evaluate(x)])}))};
}

function shockCalculator(inlet, g, R, theta){
  const sections=[],comparisons=[];
  const result={status:'ok',s1:inlet};
  if(theta!==undefined){
    if(!Number.isFinite(theta)||theta<0||theta>90)throw Error('Deflection angle must be between 0° and 90°.');
    const limit=shockLimit(inlet.M,g);
    sections.push(section('Attached-shock limit',[row('Maximum deflection θmax',deg(limit.theta),'°')]));
    if(rad(theta)>limit.theta+1e-12){
      result.status='detached';
      return {result,sections,comparisons:[stateComparison(inlet,null,'Outlet')],
        notice:'The specified deflection exceeds the limit for an attached oblique shock.'};
    }
  }
  const solutions=theta===undefined
    ?[['',normalShock(inlet.M,g)]]
    :[['Weak shock',obliqueShock(inlet.M,rad(theta),g,'weak')],['Strong shock',obliqueShock(inlet.M,rad(theta),g,'strong')]];
  for(const [title,jump] of solutions){
    const downstream=state(jump.M2,inlet.T*jump.T,inlet.p*jump.p,g,R);
    sections.push(section(title||'Shock ratios',[
      ...(jump.beta===undefined?[]:[row('Shock angle β',deg(jump.beta),'°')]),
      ...shockRows(jump),
    ]));
    comparisons.push(stateComparison(inlet,downstream,'Outlet',title));
    result.s2??=downstream;
  }
  return {result,sections,comparisons};
}

function ductCalculator(mode,inlet,g,R){
  const isRayleigh=mode===calculatorModes.rayleigh;
  const ratiosAt=isRayleigh?rayleighRatios:fannoRatios;
  const {M,T,p}=inlet,r=ratiosAt(M,g),sonic=state(1,T/r.T,p/r.p,g,R);
  const model=isRayleigh?'Rayleigh':'Fanno';
  const ratios=[
    row('Static pressure ratio p/p*',r.p),row('Static temperature ratio T/T*',r.T),
    row('Stagnation pressure ratio p₀/p₀*',r.p0),
    ...(isRayleigh?[row('Stagnation temperature ratio T₀/T₀*',r.T0),row('Inverse density ratio ρ*/ρ',1/r.rho)]
      :[row('Density ratio ρ/ρ*',r.rho),row('Speed ratio u/u*',r.u),row('Friction parameter to sonic state fᴅL*/D',Math.max(0,r.F))]),
  ];
  const sections=[section('Ratios to the sonic reference',ratios)];
  const chart=machChart(`${model} ratios to the sonic state`,'Ratio',mode,M,[
    ['T/T*',m=>ratiosAt(m,g).T],['p/p*',m=>ratiosAt(m,g).p],
    ['p₀/p₀*',m=>ratiosAt(m,g).p0],...(isRayleigh?[['T₀/T₀*',m=>ratiosAt(m,g).T0]]:[]),
  ]);
  const scene={kind:'state',s1:inlet,reference:{label:'SONIC REFERENCE',temperature:sonic.T,pressure:sonic.p}};
  return {result:{status:'ok',s1:inlet,sonic,ratios:r},sections,
    comparisons:[stateComparison(inlet,sonic,'Sonic reference')],chart,scene};
}

function prandtlMeyerCalculator(inlet,g,R){
  const {M}=inlet,r=isentropicRelations(M,g);
  const sections=[
    section('Ratios to stagnation conditions',stagnationRatios(r)),
    section('Expansion angles',expansionAngles(r)),
  ];
  const chart=machChart('Prandtl–Meyer and Mach angles','Angle (°)',calculatorModes.expansion,M,[
    ['ν',m=>deg(prandtlMeyer(m,g))],['μ',m=>deg(Math.asin(1/m))],
  ]);
  return {result:{status:'ok',s1:inlet,relations:r},sections,
    comparisons:[stagnationComparison(inlet,g,R)],chart,scene:{kind:'state',s1:inlet}};
}

export function calculateAppendix(x,gas){
  const mode=x.calculatorMode,range=calculatorMachRange(mode);
  const {gamma:g,R}=gas,{M,T1,p1}=x;
  if(!Number.isFinite(M)||M<range.min||M>range.max)
    throw Error(`Enter an inlet Mach number between ${range.min} and ${range.max} for ${mode}.`);
  const inlet=state(M,T1,p1*1000,g,R);
  const calculated=mode===calculatorModes.normal?shockCalculator(inlet,g,R):
    mode===calculatorModes.oblique?shockCalculator(inlet,g,R,x.calculatorTurn):
    mode===calculatorModes.expansion?prandtlMeyerCalculator(inlet,g,R):ductCalculator(mode,inlet,g,R);
  const {sections,comparisons,...view}=calculated;
  const {rows,...output}=calculatorOutput(sections,comparisons);
  const plots=view.chart?[{key:'appendix-'+mode,label:view.chart.title,chart:view.chart}]:[];
  return {...view,id:'foundations',inputs:x,gas,rows,checks:{},shockDetails:[],
    model:`${mode} · calorically perfect ideal gas`,result:{...view.result,...output,calculatorPlots:plots}};
}
