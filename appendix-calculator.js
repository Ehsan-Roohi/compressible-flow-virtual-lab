import {
  deg, rad, state, normalShock, rayleighRatios, fannoRatios, obliqueShock,
  shockLimit, turnAngle, isentropicRelations, linspace,
} from './physics.js';
import {cone,coneFromShock} from './cone.js';
import {coneAttachmentLimit} from './cone-limits.js';
import {bisect,requireValue} from './numerics.js';
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

export const obliqueInputs={
  weak:'Turn angle (weak shock)',strong:'Turn angle (strong shock)',
  wave:'Wave angle',normalMach:'Upstream normal Mach number M₁ₙ',
};
export const conicalInputs={cone:'Cone half-angle',wave:'Wave angle',surfaceMach:'Surface Mach number M꜀'};

const row = (label, value, unit = '') => ({label,value,unit});
const section = (title, rows) => ({title,rows});
const specifiedStateLabel = 'Specified flow state';
const firstStateLabels = {
  [calculatorModes.normal]: 'Before shock',
  [calculatorModes.oblique]: 'Before shock',
  [calculatorModes.conical]: 'Freestream',
};

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

function calculatorOutput(calculatorSections,calculatorComparisons,mode){
  const calculatorStateLabel=firstStateLabels[mode]??specifiedStateLabel;
  const rows=calculatorSections.flatMap(({title,rows})=>rows.map(r=>({...r,label:`${title} · ${r.label}`})));
  const stateRows=(table,key,title)=>table.rows.filter(r=>r[key]!==null)
    .map(r=>row(`${title} · ${r.label}`,r[key],r.unit));
  rows.push(...stateRows(calculatorComparisons[0],'inlet',calculatorStateLabel));
  for(const table of calculatorComparisons)
    rows.push(...stateRows(table,'outlet',table.title||table.outletLabel));
  return {rows,calculatorSections,calculatorComparisons,calculatorStateLabel};
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
  return {rows,calculatorSections:sections,calculatorComparisons:[comparison],calculatorStateLabel:specifiedStateLabel};
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

function obliqueJumpFromInput(M,g,x,limit){
  const known=x.calculatorObliqueGiven??obliqueInputs.weak;
  if(known===obliqueInputs.weak||known===obliqueInputs.strong){
    const theta=x.calculatorTurn??10;
    requireValue(Number.isFinite(theta)&&theta>=0&&theta<=90,'Deflection angle must be between 0° and 90°.');
    if(rad(theta)>limit.theta+1e-12)return {theta:rad(theta),jump:null};
    const branch=known===obliqueInputs.strong?'strong':'weak';
    return {theta:rad(theta),jump:obliqueShock(M,rad(theta),g,branch)};
  }
  let beta;
  if(known===obliqueInputs.normalMach){
    const n=x.calculatorObliqueNormalMach;
    requireValue(Number.isFinite(n)&&n>=1&&n<=M,'Upstream normal Mach number must be between 1 and the inlet Mach number.');
    beta=Math.asin(n/M);
  }else{
    const wave=x.calculatorObliqueBeta;
    requireValue(Number.isFinite(wave)&&wave>=deg(limit.mu)-1e-10&&wave<=90,
      'The wave angle must lie between the inlet Mach angle and 90°.');
    beta=Math.max(limit.mu,rad(wave));
  }
  const theta=Math.max(0,turnAngle(M,beta,g));
  const jump=normalShock(Math.max(1,M*Math.sin(beta)),g);
  return {theta,jump:{...jump,beta,theta,M2:jump.M2/Math.sin(beta-theta),branch:beta<=limit.beta?'weak':'strong'}};
}

function shockCalculator(inlet,g,R,oblique){
  const result={status:'ok',s1:inlet};
  const {M}=inlet;
  const sections=[];
  let plots,jump;
  if(oblique){
    const limit=shockLimit(M,g);
    plots=obliqueShockPlots(M,g,limit);
    const solved=obliqueJumpFromInput(M,g,oblique,limit);
    jump=solved.jump;
    sections.push(section('Flow deflection',[
      row('Flow deflection angle θ',deg(solved.theta),'°'),row('Maximum attached deflection θmax',deg(limit.theta),'°'),
    ]));
    if(!jump){
      result.status='detached';
      return {result,sections,comparisons:[stateComparison(inlet,null,'After shock')],plots,
        notice:'The specified deflection exceeds the limit for an attached oblique shock.'};
    }
  }else{
    jump=normalShock(M,g);
    plots=machPlots(calculatorModes.normal,M,m=>normalShock(m,g),shockPlotProperties);
  }
  const title=oblique?(jump.branch==='weak'?'Weak shock':'Strong shock'):'';
  const downstream=state(jump.M2,inlet.T*jump.T,inlet.p*jump.p,g,R);
  sections.push(section(title||'Shock ratios',[
    ...(oblique?[row('Shock angle β',deg(jump.beta),'°')]:[]),...shockRows(jump),
  ]));
  const comparison=stateComparison(inlet,downstream,'After shock',title);
  if(oblique){
    comparison.rows.splice(1,0,{
      label:'Mach number normal to shock',unit:'',
      inlet:Math.max(1,M*Math.sin(jump.beta)),outlet:downstream.M*Math.sin(jump.beta-jump.theta),
    });
  }
  return {result:{...result,s2:downstream},sections,comparisons:[comparison],plots};
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

function coneFromInput(M,g,x){
  const known=x.calculatorConeGiven??conicalInputs.cone;
  const integrate=beta=>coneFromShock(M,beta,g,{step:.001,tolerance:1e-11});
  const mu=Math.asin(1/M);
  if(known===conicalInputs.wave){
    const wave=x.calculatorConeBeta;
    requireValue(Number.isFinite(wave)&&wave>deg(mu)&&wave<90,
      'The conical wave angle must be greater than the inlet Mach angle and below 90°.');
    return integrate(rad(wave));
  }
  if(known===conicalInputs.surfaceMach){
    const target=x.calculatorConeSurfaceMach;
    requireValue(Number.isFinite(target)&&target>0&&target<M,
      'Surface Mach number must be positive and below the inlet Mach number.');
    const limit=coneAttachmentLimit(M,g),edge=integrate(limit.betaAtLimit);
    requireValue(target>=edge.surface.M-1e-9,
      `For the weak attached branch, surface Mach number must be at least ${Number(edge.surface.M.toPrecision(9))}.`,'cone-unresolved');
    const residual=beta=>beta===mu?M-target:integrate(beta).surface.M-target;
    return integrate(bisect(residual,mu,limit.betaAtLimit,{ftol:1e-9,xtol:1e-11}).value);
  }
  return cone({M,thetaCone:x.calculatorConeAngle??20,gamma:g});
}

function conicalProfilePlots(solution,inlet,relations){
  const {coneAngle,waveAngle,p02p01}=relations;
  const profile=solution.history.slice().reverse().map(s=>{
    const aRatio=Math.sqrt(s.T);
    return {...s,aRatio,uRatio:s.M/inlet.M*aRatio,p0:p02p01,T0:1,
      deflection:deg(s.theta+Math.atan2(s.vt,s.vr))};
  });
  const freestreamAngles=linspace(waveAngle,Math.min(90,waveAngle+(waveAngle-coneAngle)/4),21);
  const properties=[
    ['M','Mach number M','M',inlet.M],
    ['p','Static pressure ratio p/p₁','p/p₁',1],
    ['T','Static temperature ratio T/T₁','T/T₁',1],
    ['rho','Density ratio ρ/ρ₁','ρ/ρ₁',1],
    ['p0','Stagnation pressure ratio p₀/p₀₁','p₀/p₀₁',1],
    ['T0','Stagnation temperature ratio T₀/T₀₁','T₀/T₀₁',1],
    ['uRatio','Flow speed ratio u/u₁','u/u₁',1],
    ['aRatio','Speed of sound ratio a/a₁','a/a₁',1],
    ['deflection','Flow angle from axis δ','δ (°)',0],
  ];
  return properties.map(([key,label,ylabel,upstream])=>{
    const points=profile.map(s=>[deg(s.theta),s[key]]);
    return {
      key:'appendix-conical-'+key,label,
      note:`Read from left to right, starting in the freestream (dashed), crossing the shock at β, and following the flow profile (solid) to the cone surface (θ꜀ = ${coneAngle.toFixed(3)}°).`,
      chart:{title:label,xlabel:'Polar angle from cone axis θ (°)',ylabel,zeroBaseline:false,invertXAxis:true,
        ...(key==='T0'?{yRange:[.98,1.02]}:{}),
        xReference:{x:waveAngle,y:Math.max(upstream,points.at(-1)[1]),label:`Shock β = ${waveAngle.toFixed(3)}°`},
        series:[
          {name:'Behind shock',points},
          {name:'Freestream',dash:'5 4',points:freestreamAngles.map(angle=>[angle,upstream])},
        ]},
    };
  });
}

function conicalCalculator(inlet,g,R,x){
  let solved;
  try{
    solved=coneFromInput(inlet.M,g,x);
  }catch(error){
    if(!['cone-unresolved','cone-limit-unresolved','cone-singularity','nonconverged'].includes(error.code))throw error;
    return {result:{status:'unsupported',s1:inlet},
      sections:[],
      comparisons:[stateComparison(inlet,null,'Behind shock'),stateComparison(inlet,null,'Cone surface')],plots:[],
      notice:error.message};
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
  const plots=conicalProfilePlots(solved,inlet,r);
  return {result:{status:'ok',s1:inlet,s2:post,surface,relations:r},sections,comparisons,plots};
}

export function calculateAppendix(x,gas){
  const mode=x.calculatorMode,range=calculatorMachRange(mode);
  const {gamma:g,R}=gas,{M,T1,p1}=x;
  if(!Number.isFinite(M)||M<range.min||M>range.max)
    throw Error(`Enter an inlet Mach number between ${range.min} and ${range.max} for ${mode}.`);
  const inlet=state(M,T1,p1*1000,g,R);
  const calculated=mode===calculatorModes.normal?shockCalculator(inlet,g,R):
    mode===calculatorModes.oblique?shockCalculator(inlet,g,R,x):
    mode===calculatorModes.expansion?prandtlMeyerCalculator(inlet,g,R):
    mode===calculatorModes.conical?conicalCalculator(inlet,g,R,x):
    ductCalculator(mode,inlet,g,R);
  const {sections,comparisons,plots,result}=calculated;
  const {rows,...output}=calculatorOutput(sections,comparisons,mode);
  return {id:'foundations',inputs:x,gas,rows,checks:{},shockDetails:[],scene:null,
    notice:calculated.notice,chart:plots[0]?.chart,
    model:`${mode} · calorically perfect ideal gas`,result:{...result,...output,calculatorPlots:plots}};
}
