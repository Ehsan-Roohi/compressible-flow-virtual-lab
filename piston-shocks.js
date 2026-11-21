import {normalShock,state,conservation} from './physics.js';
import {gas,positive,requireValue} from './numerics.js';

import {valveExperiment} from './valve-closure.js';

export const singlePistonExperiment='Single-stage piston';
export const pistonExperiment='Two-stage piston';
export const pistonFields=[
 {key:'unsteadyExperiment',label:'Experiment',value:'Shock tube',options:['Shock tube',singlePistonExperiment,pistonExperiment,'Sinusoidal piston',valveExperiment]},
 {key:'pistonSpeed1',label:'First piston speed',value:25,min:.001,max:10000,step:1,unit:'m/s'},
 {key:'pistonSpeed2',label:'Second piston speed',value:50,min:.001,max:10000,step:1,unit:'m/s'},
 {key:'pistonDelay',label:'Time of second speed increase',value:1,min:.000001,max:10000,step:.1,unit:'s'}
];

// Speeds in the returned states are laboratory-frame velocities. Jump checks
// use a separate shock-fixed frame for each shock.
export function pistonShockJump(before,target,g,R){
  const delta=target-before.u,q=(g+1)*delta/(4*before.a),M=q+Math.hypot(1,q),n=normalShock(M,g),speed=before.u+M*before.a;
  const T=before.T*n.T,p=before.p*n.p,a=Math.sqrt(g*R*T),after=state(target/a,T,p,g,R);
  const checks=conservation(state(M,before.T,before.p,g,R),state(n.M2,T,p,g,R),g,R);
  const inducedResidual=Math.abs(speed-(speed-before.u)/n.rho-target)/Math.max(1,speed);
  return {speed,relativeMach:M,relativeSpeed:M*before.a,before,after,ratios:n,checks:{...checks,inducedVelocity:inducedResidual}};
}

export function solvePistonShocks(x){
 const g=x.gamma??1.4,R=x.R??287,{cp}=gas(g,R);
 for(const [v,label] of [[x.T1,'Initial temperature'],[x.p1,'Initial pressure'],[x.pistonSpeed1,'First piston speed'],[x.pistonSpeed2,'Second piston speed'],[x.pistonDelay,'Delay']])positive(v,label);
 requireValue(x.pistonSpeed2>x.pistonSpeed1,'The second piston speed must exceed the first to generate a second compression shock.');
 const s1=state(0,x.T1,x.p1*1000,g,R);
 const first=pistonShockJump(s1,x.pistonSpeed1,g,R),second=pistonShockJump(first.after,x.pistonSpeed2,g,R),delay=x.pistonDelay,launchX=x.pistonSpeed1*delay;
 requireValue(second.speed>first.speed,'The shock speeds cannot be resolved for this speed increment. Increase the second piston speed.');
 const catchTime=(second.speed-x.pistonSpeed1)*delay/(second.speed-first.speed),catchX=first.speed*catchTime;
 requireValue(Number.isFinite(catchTime)&&Number.isFinite(catchX)&&catchTime>delay,'No finite catch-up point for these inputs.');
 const pistonAt=t=>t<=delay?x.pistonSpeed1*t:launchX+x.pistonSpeed2*(t-delay);
 const makeChart=(end,early=false)=>({
  title:early?'Wave trajectories · second-shock launch':'Wave trajectories · two shocks and piston',xlabel:'Position x (m)',ylabel:'Time t (s)',zeroBaseline:true,
  series:[
   {name:'Shock 1',color:'#000000',points:[[0,0],[first.speed*end,end]]},
   {name:'Shock 2',color:'#275eab',points:[[launchX,delay],[launchX+second.speed*(end-delay),end]]},
   {name:'Piston',color:'#b36536',points:[[0,0],[launchX,delay],[pistonAt(end),end]]}
  ],regionMarkers:true,markers:early?[{name:'Speed increase',x:launchX,y:delay}]:[{name:'Catch-up',x:catchX,y:catchTime}]
 });
 const chart=makeChart(catchTime),earlyChart=makeChart(Math.min(2*delay,catchTime),true);
 const regions=[s1,first.after,second.after];
 const referenceTable={title:'Gas states · laboratory frame',columns:['1 · Undisturbed','2 · Behind shock 1','3 · Behind shock 2'],rows:[
  ['Pressure (kPa)',s=>s.p/1000],['Temperature (K)',s=>s.T],['Density (kg/m³)',s=>s.rho],['Gas velocity (m/s)',s=>s.u],['Sound speed (m/s)',s=>s.a],['Gas Mach number',s=>s.M],['Stagnation temperature (K)',s=>s.T0],['Stagnation pressure (kPa)',s=>s.p0/1000]
 ].map(([label,get])=>({label,values:regions.map(get)})),note:'States apply before shock catch-up. Shock Mach numbers use the gas immediately ahead of each shock; gas Mach numbers above use the laboratory frame.'};
 const checks=Object.fromEntries(Object.keys(first.checks).map(k=>[k,Math.max(first.checks[k],second.checks[k])]));
 checks.catchPosition=Math.abs(first.speed*catchTime-(launchX+second.speed*(catchTime-delay)))/Math.max(1,catchX);
 return {status:'ok',twoStagePiston:true,gamma:g,R,cp,first,second,regions,delay,launchX,catchTime,catchX,pistonCatchX:pistonAt(catchTime),checks,chart,referenceTable,
  plots:[{key:'piston-trajectories',label:chart.title,chart,note:'Uniform x–t axes in metres and seconds. Shock 2 starts at the moving piston, not at the origin. Both trajectories end at their catch-up point; the post-interaction flow is not solved.'},{key:'piston-launch',label:earlyChart.title,chart:earlyChart,note:'Early-time view of the same trajectories, with uniform axes. The piston changes speed at the marked point; there is no break in the time or position scale.'}]};
}

export function pistonShocksDrawing(r){
 const f=v=>Number(v.toPrecision(6)).toString();
 const text=(x,y,t,size=14,fill='#17383b')=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="${fill}">${t}</text>`;
 let inner='<defs><marker id="pistonArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="#17383b"/></marker></defs>';
 inner+=text(320,27,'Two-stage piston · before catch-up',17);
 inner+='<rect x="85" y="88" width="180" height="100" fill="#e6a966"/><rect x="265" y="88" width="180" height="100" fill="#a8d3c5"/><rect x="445" y="88" width="170" height="100" fill="#d5e7f0"/>';
 inner+='<path d="M55 88 H615 M55 188 H615" stroke="#17383b" stroke-width="3"/><rect x="66" y="78" width="19" height="120" fill="#576773"/><path d="M265 79 V197 M445 79 V197" stroke="#000" stroke-width="2"/>';
 inner+=text(175,119,'3',18)+text(355,119,'2',18)+text(530,119,'1',18);
 inner+=text(175,149,`u₃ = ${f(r.second.after.u)} m/s`)+text(355,149,`u₂ = ${f(r.first.after.u)} m/s`)+text(530,149,'u₁ = 0');
 inner+=text(265,65,'Shock 2',13)+text(445,65,'Shock 1',13);
 for(const x of [300,480])inner+=`<path d="M${x} 48 h42" stroke="#17383b" stroke-width="1.5" marker-end="url(#pistonArrow)"/>`;
 inner+=text(95,222,'Piston',13)+text(320,252,`Speed changes at t = ${f(r.delay)} s`,13)+text(320,277,'Schematic · not to scale · no end-wall reflections',12);
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 300" role="img" aria-label="Two moving shocks ahead of a two-stage piston">${inner}</svg>`,label:'Two shocks and three uniform gas regions',meta:'Before catch-up · schematic'};
}
