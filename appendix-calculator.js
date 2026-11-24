import {
  deg, rad, state, normalShock, rayleighRatios, fannoRatios, obliqueShock,
  shockLimit, turnAngle, isentropicRelations, linspace,
} from './physics.js';
import {cone} from './cone.js';
import {conicalRelations} from './reference-relations.js?v=20261119-cone-limit-help';

export const calculatorModes = {
  isentropic: 'Isentropic Flow',
  normal: 'Normal Shock',
  rayleigh: 'Rayleigh Flow',
  fanno: 'Fanno Flow',
  oblique: 'Oblique Shock (θ–β–M)',
  expansion: 'Prandtl–Meyer',
  conical: 'Conical Flow',
};

export const shockCalculatorLabs = {
  [calculatorModes.normal]: {href:'#normal',label:'Normal Shock'},
  [calculatorModes.oblique]: {href:'#wall?example=6-2',label:'Supersonic Wave Lab · Compression Ramp'},
  [calculatorModes.conical]: {href:'#cone',label:'Wedge & Cone Lab'},
};

const modesByMach = {
  [calculatorModes.isentropic]: {min:0,max:50},
  [calculatorModes.normal]: {min:1,max:50},
  [calculatorModes.rayleigh]: {min:.000001,max:50},
  [calculatorModes.fanno]: {min:.000001,max:50},
  [calculatorModes.oblique]: {min:1.000001,max:50},
  [calculatorModes.expansion]: {min:1,max:50},
  [calculatorModes.conical]: {min:1.01,max:10},
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

const shockPlotProperties=[
  ['p','Static pressure ratio p₂/p₁','p₂/p₁'],
  ['rho','Density ratio ρ₂/ρ₁','ρ₂/ρ₁'],
  ['T','Static temperature ratio T₂/T₁','T₂/T₁'],
  ['p0','Stagnation pressure ratio p₀₂/p₀₁','p₀₂/p₀₁'],
  ['M2','Downstream Mach number M₂','M₂'],
];

function machPlots(mode,m,evaluate,properties){
  const {min,max}=calculatorMachRange(mode);
  const lower=mode===calculatorModes.rayleigh||mode===calculatorModes.fanno ? .05 : min;
  const xs=Array.from(new Set([...linspace(Math.max(min,lower),
    Math.min(max,Math.max(4,m*1.15)),101),m,1])).filter(x=>x>=min&&x<=max).sort((a,b)=>a-b);
  const samples=xs.map(x=>[x,evaluate(x)]);
  return properties.map(([key,label,ylabel])=>({
    key:`appendix-${mode}-${key}`,label,chart:{title:label,xlabel:'Inlet Mach number M',ylabel,
      series:[{name:label,points:samples.map(([x,values])=>[x,values[key]])}]},
  }));
}

function obliqueShockPlots(M,g,limit){
  const samples=[['Weak shock',limit.mu],['Strong shock',Math.PI/2]].map(([name,from])=>{
    const angles=linspace(from,limit.beta,101);
    angles[angles.length-1]=limit.beta;
    return {name,states:angles.map((beta,index)=>{
      const theta=index===0?0:index===angles.length-1?limit.theta:turnAngle(M,beta,g);
      const M1n=Math.max(1,M*Math.sin(beta));
      const jump=normalShock(M1n,g);
      return {theta:deg(theta),beta:deg(beta),...jump,M1n,M2n:jump.M2,M2:jump.M2/Math.sin(beta-theta)};
    })};
  });
  return [
    ['beta','Oblique shock angle vs flow deflection','Shock angle β (°)'],...shockPlotProperties,
    ['M1n','Upstream normal Mach number M₁ₙ','M₁ₙ'],['M2n','Downstream normal Mach number M₂ₙ','M₂ₙ'],
  ]
    .map(([key,label,ylabel])=>({
      key:'appendix-oblique-'+key,label,chart:{title:label,xlabel:'Deflection angle θ (°)',ylabel,
        series:samples.map(({name,states})=>({name,points:states.map(s=>[s.theta,s[key]])}))},
    }));
}

function shockCalculator(inlet, g, R, theta){
  const sections=[],comparisons=[];
  const result={status:'ok',s1:inlet};
  const {M}=inlet;
  let plots;
  if(theta!==undefined){
    if(!Number.isFinite(theta)||theta<0||theta>90)throw Error('Deflection angle must be between 0° and 90°.');
    const limit=shockLimit(M,g);
    plots=obliqueShockPlots(M,g,limit);
    sections.push(section('Flow deflection',[
      row('Flow deflection angle θ',theta,'°'),row('Maximum attached deflection θmax',deg(limit.theta),'°'),
    ]));
    if(rad(theta)>limit.theta+1e-12){
      result.status='detached';
      return {result,sections,comparisons:[stateComparison(inlet,null,'Outlet')],plots,
        notice:'The specified deflection exceeds the limit for an attached oblique shock.'};
    }
  }else{
    plots=machPlots(calculatorModes.normal,M,m=>normalShock(m,g),shockPlotProperties);
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
    const comparison=stateComparison(inlet,downstream,'Outlet',title);
    if(jump.beta!==undefined){
      comparison.rows.splice(1,0,{
        label:'Mach number normal to shock (M₁ₙ / M₂ₙ)',unit:'',
        inlet:M*Math.sin(jump.beta),outlet:downstream.M*Math.sin(jump.beta-jump.theta),
      });
    }
    comparisons.push(comparison);
    result.s2??=downstream;
  }
  return {result,sections,comparisons,plots};
}

function ductCalculator(mode,inlet,g,R){
  const isRayleigh=mode===calculatorModes.rayleigh;
  const ratiosAt=isRayleigh?rayleighRatios:fannoRatios;
  const {M,T,p}=inlet,r=ratiosAt(M,g),sonic=state(1,T/r.T,p/r.p,g,R);
  const ratios=[
    row('Static pressure ratio p/p*',r.p),row('Static temperature ratio T/T*',r.T),
    row('Stagnation pressure ratio p₀/p₀*',r.p0),
    ...(isRayleigh?[row('Stagnation temperature ratio T₀/T₀*',r.T0),row('Inverse density ratio ρ*/ρ',1/r.rho),row('Speed ratio u/u*',r.u)]
      :[row('Density ratio ρ/ρ*',r.rho),row('Speed ratio u/u*',r.u),row('Friction parameter to sonic state fᴅL*/D',Math.max(0,r.F))]),
  ];
  const sections=[section('Ratios to the sonic reference',ratios)];
  const plots=machPlots(mode,M,m=>{
    const ratios=ratiosAt(m,g);
    return {...ratios,inverseDensity:1/ratios.rho,F:Math.max(0,ratios.F??0)};
  },[
    ['p','Static pressure ratio p/p*','p/p*'],['T','Static temperature ratio T/T*','T/T*'],
    ['p0','Stagnation pressure ratio p₀/p₀*','p₀/p₀*'],
    ...(isRayleigh?[
      ['T0','Stagnation temperature ratio T₀/T₀*','T₀/T₀*'],
      ['inverseDensity','Inverse density ratio ρ*/ρ','ρ*/ρ'],
      ['u','Speed ratio u/u*','u/u*'],
    ]:[
      ['rho','Density ratio ρ/ρ*','ρ/ρ*'],['u','Speed ratio u/u*','u/u*'],
      ['F','Friction parameter to sonic state fᴅL*/D','fᴅL*/D'],
    ]),
  ]);
  return {result:{status:'ok',s1:inlet,sonic,ratios:r},sections,
    comparisons:[stateComparison(inlet,sonic,'Sonic reference')],plots};
}

function prandtlMeyerCalculator(inlet,g,R){
  const {M}=inlet,r=isentropicRelations(M,g);
  const sections=[
    section('Ratios to stagnation conditions',stagnationRatios(r)),
    section('Expansion angles',expansionAngles(r)),
  ];
  const plots=machPlots(calculatorModes.expansion,M,m=>isentropicRelations(m,g),[
    ['pmAngle','Prandtl–Meyer angle ν','ν (°)'],['machAngle','Mach angle μ','μ (°)'],
    ['pP0','Static pressure ratio p/p₀','p/p₀'],['rhoRho0','Density ratio ρ/ρ₀','ρ/ρ₀'],
    ['TT0','Static temperature ratio T/T₀','T/T₀'],
  ]);
  return {result:{status:'ok',s1:inlet,relations:r},sections,
    comparisons:[stagnationComparison(inlet,g,R)],plots};
}

function conicalCalculator(inlet,g,R,halfAngle){
  let solved;
  try{
    solved=cone({M:inlet.M,thetaCone:halfAngle,gamma:g});
  }catch(error){
    if(error.code!=='cone-unresolved')throw error;
    return {result:{status:'unsupported',s1:inlet},
      sections:[section('Cone geometry',[row('Cone half-angle θ꜀',halfAngle,'°')])],
      comparisons:[stateComparison(inlet,null,'Behind shock'),stateComparison(inlet,null,'Cone surface')],plots:[],
      notice:'No attached weak conical shock was found for this Mach number and cone half-angle.'};
  }
  const r=conicalRelations(solved,inlet.M,g);
  const sections=[
    section('Cone and shock angles',[row('Cone half-angle θ꜀',r.coneAngle,'°'),
      row('Shock angle β',r.waveAngle,'°'),row('Flow deflection across shock δ',r.shockTurn,'°')]),
    section('Immediately behind shock',[
      ...shockRows({p:r.p2p1,rho:r.rho2rho1,T:r.T2T1,p0:r.p02p01}),
      row('Mach number M₂',r.postShockMach),
    ]),
    section('Cone surface',[
      row('Static pressure ratio p꜀/p₁',r.pcp1),row('Density ratio ρ꜀/ρ₁',r.rhocRho1),
      row('Static temperature ratio T꜀/T₁',r.TcT1),row('Stagnation pressure ratio p₀꜀/p₀₁',r.p0cp01),
      row('Surface Mach number M꜀',r.surfaceMach),
    ]),
  ];
  const post=state(r.postShockMach,inlet.T*r.T2T1,inlet.p*r.p2p1,g,R);
  const surface=state(r.surfaceMach,inlet.T*r.TcT1,inlet.p*r.pcp1,g,R);
  const comparisons=[
    stateComparison(inlet,post,'Behind shock','Immediately behind shock'),
    stateComparison(inlet,surface,'Cone surface','Cone surface'),
  ];
  const profile=solved.history.slice().reverse();
  const plots=[
    ['M','Mach number M','M'],['p','Static pressure ratio p/p₁','p/p₁'],
    ['T','Static temperature ratio T/T₁','T/T₁'],['rho','Density ratio ρ/ρ₁','ρ/ρ₁'],
  ].map(([key,label,ylabel])=>({
    key:'appendix-conical-'+key,label,
    note:'The polar angle is measured from the cone axis, from the surface to the shock.',
    chart:{title:label,xlabel:'Polar angle from cone axis (°)',ylabel,zeroBaseline:false,
      series:[{name:label,points:profile.map(s=>[deg(s.theta),s[key]])}]},
  }));
  return {result:{status:'ok',s1:inlet,s2:post,surface,relations:r},sections,comparisons,plots};
}

export function calculateAppendix(x,gas){
  const mode=x.calculatorMode,range=calculatorMachRange(mode);
  const {gamma:g,R}=gas,{M,T1,p1}=x;
  if(!Number.isFinite(M)||M<range.min||M>range.max)
    throw Error(`Enter an inlet Mach number between ${range.min} and ${range.max} for ${mode}.`);
  const inlet=state(M,T1,p1*1000,g,R);
  const calculated=mode===calculatorModes.normal?shockCalculator(inlet,g,R):
    mode===calculatorModes.oblique?shockCalculator(inlet,g,R,x.calculatorTurn):
    mode===calculatorModes.expansion?prandtlMeyerCalculator(inlet,g,R):
    mode===calculatorModes.conical?conicalCalculator(inlet,g,R,x.calculatorConeAngle??20):
    ductCalculator(mode,inlet,g,R);
  const {sections,comparisons,plots,result}=calculated;
  const {rows,...output}=calculatorOutput(sections,comparisons);
  return {id:'foundations',inputs:x,gas,rows,checks:{},shockDetails:[],scene:null,
    notice:calculated.notice,chart:plots[0]?.chart,
    model:`${mode} · calorically perfect ideal gas`,result:{...result,...output,calculatorPlots:plots}};
}
