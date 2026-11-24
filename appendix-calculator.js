import {
  deg, rad, state, normalShock, rayleighRatios, fannoRatios, obliqueShock,
  shockLimit, turnAngle, prandtlMeyer, isentropicRelations, linspace,
} from './physics.js';

export const calculatorModes = {
  isentropic: 'Isentropic Flow',
  normal: 'Normal Shock',
  rayleigh: 'Rayleigh Flow',
  fanno: 'Fanno Flow',
  oblique: 'Oblique Shock (θ–β–M)',
  expansion: 'Prandtl–Meyer',
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
function stateRows(s){
  return [
    row('Mach number',s.M),row('Static pressure',s.p/1000,'kPa'),
    row('Static temperature',s.T,'K'),row('Density',s.rho,'kg/m³'),
    row('Flow speed',s.u,'m/s'),row('Speed of sound',s.a,'m/s'),
    row('Stagnation pressure',s.p0/1000,'kPa'),row('Stagnation temperature',s.T0,'K'),
  ];
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
  const mode=theta===undefined?calculatorModes.normal:calculatorModes.oblique;
  const sections=[section('Inlet state',stateRows(inlet))];
  const result={status:'ok',s1:inlet};
  let chart,scene={kind:'state',s1:inlet},notice=null;
  if(theta===undefined){
    chart=machChart('Normal-shock property ratios','Downstream / upstream',mode,inlet.M,[
      ['p₂/p₁',m=>normalShock(m,g).p],['T₂/T₁',m=>normalShock(m,g).T],
      ['ρ₂/ρ₁',m=>normalShock(m,g).rho],['p₀₂/p₀₁',m=>normalShock(m,g).p0],
    ]);
  }else{
    if(!Number.isFinite(theta)||theta<0||theta>90)throw Error('Deflection angle must be between 0° and 90°.');
    const limit=shockLimit(inlet.M,g);
    chart={title:'Oblique shock · θ–β–M relation',xlabel:'Flow deflection θ (°)',ylabel:'Shock angle β (°)',
      series:[['Weak',limit.mu,limit.beta],['Strong',limit.beta,Math.PI/2]].map(([name,first,last])=>({
        name,points:linspace(first,last,81).map(beta=>[deg(turnAngle(inlet.M,beta,g)),deg(beta)]),
      })),
    };
    sections.unshift(section('Attached-shock limit',[row('Maximum deflection θmax',deg(limit.theta),'°')]));
    if(rad(theta)>limit.theta+1e-12){
      result.status='detached';
      notice='The specified deflection exceeds the limit for an attached oblique shock.';
      return {result,sections,chart,scene,notice};
    }
  }
  const solutions=theta===undefined
    ?[['Downstream state',normalShock(inlet.M,g)]]
    :[['Weak shock',obliqueShock(inlet.M,rad(theta),g,'weak')],['Strong shock',obliqueShock(inlet.M,rad(theta),g,'strong')]];
  for(const [title,jump] of solutions){
    const downstream=state(jump.M2,inlet.T*jump.T,inlet.p*jump.p,g,R);
    sections.push(section(title,[
      ...(jump.beta===undefined?[]:[row('Shock angle β',deg(jump.beta),'°')]),
      ...stateRows(downstream),...shockRows(jump),
    ]));
    if(!result.s2){
      result.s2=downstream;
      scene=theta===undefined?{kind:'normal',s1:inlet,s2:downstream}
        :{kind:'oblique',...jump,M:inlet.M,alpha:0,bodyAngle:rad(theta),theta:rad(theta)};
    }
  }
  if(theta!==undefined){
    chart.markers=solutions.map(([name,jump])=>({name,x:theta,y:deg(jump.beta)}));
    notice='The schematic shows the weak-shock solution.';
  }
  return {result,sections,chart,scene,notice};
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
  const sections=[section('Ratios to the sonic reference',ratios),section('Inlet state',stateRows(inlet)),section('Sonic reference state',stateRows(sonic))];
  const chart=machChart(`${model} ratios to the sonic state`,'Ratio',mode,M,[
    ['T/T*',m=>ratiosAt(m,g).T],['p/p*',m=>ratiosAt(m,g).p],
    ['p₀/p₀*',m=>ratiosAt(m,g).p0],...(isRayleigh?[['T₀/T₀*',m=>ratiosAt(m,g).T0]]:[]),
  ]);
  const scene={kind:'state',s1:inlet,reference:{label:'SONIC REFERENCE',temperature:sonic.T,pressure:sonic.p}};
  return {result:{status:'ok',s1:inlet,sonic,ratios:r},sections,chart,scene};
}

function prandtlMeyerCalculator(inlet,g){
  const {M}=inlet,r=isentropicRelations(M,g);
  const sections=[
    section('Expansion angles',[row('Prandtl–Meyer angle ν',r.pmAngle,'°'),row('Mach angle μ',r.machAngle,'°')]),
    section('Ratios to stagnation conditions',[row('Static pressure ratio p/p₀',r.pP0),
      row('Static temperature ratio T/T₀',r.TT0),row('Density ratio ρ/ρ₀',r.rhoRho0)]),
    section('Inlet state',stateRows(inlet)),
  ];
  const chart=machChart('Prandtl–Meyer and Mach angles','Angle (°)',calculatorModes.expansion,M,[
    ['ν',m=>deg(prandtlMeyer(m,g))],['μ',m=>deg(Math.asin(1/m))],
  ]);
  return {result:{status:'ok',s1:inlet,relations:r},sections,chart,scene:{kind:'state',s1:inlet}};
}

export function calculateAppendix(x,gas){
  const mode=x.calculatorMode,range=calculatorMachRange(mode);
  const {gamma:g,R}=gas,{M,T1,p1}=x;
  if(!Number.isFinite(M)||M<range.min||M>range.max)
    throw Error(`Enter an inlet Mach number between ${range.min} and ${range.max} for ${mode}.`);
  const inlet=state(M,T1,p1*1000,g,R);
  const calculated=mode===calculatorModes.normal?shockCalculator(inlet,g,R):
    mode===calculatorModes.oblique?shockCalculator(inlet,g,R,x.calculatorTurn):
    mode===calculatorModes.expansion?prandtlMeyerCalculator(inlet,g):ductCalculator(mode,inlet,g,R);
  const {sections,...view}=calculated;
  const rows=sections.flatMap(({title,rows})=>rows.map(item=>({...item,label:`${title} · ${item.label}` })));
  const plots=[{key:'appendix-'+mode,label:view.chart.title,chart:view.chart}];
  return {...view,id:'foundations',inputs:x,gas,rows,checks:{},shockDetails:[],
    model:`${mode} · calorically perfect ideal gas`,result:{...view.result,calculatorSections:sections,calculatorPlots:plots}};
}
