import {contourColor} from './contour-raster.js?v=20261117-closed-piston';
import {gas, positive, requireValue} from './numerics.js';
import {normalShock} from './physics.js';
import {solvePistonShocks} from './piston-shocks.js?v=20261117-valve-closure';
import {solveValveClosure} from './valve-closure.js';
import {solveTube} from './tube-input.js?v=20261117-moving-tube';

export const finiteTubeMode = 'Finite tube · closed ends';
export const finiteTubeFields = [
 {key:'tubeDomain',label:'Tube model',value:'Before wall reflections',options:['Before wall reflections',finiteTubeMode]},
 {key:'finiteDriverLength',label:'Driver length · left of diaphragm',value:4,min:.1,max:20,step:.1,unit:'m'},
 {key:'finiteDrivenLength',label:'Driven length · right of diaphragm',value:6,min:.1,max:20,step:.1,unit:'m'},
 {key:'finiteDiameter',label:'Tube diameter',value:.3,min:.01,max:2,step:.01,unit:'m',help:'Sets area and total gas mass. The tube has constant area.'},
 {key:'finiteValveLength',label:'Initial valve tube length',value:6,min:.1,max:100000,sliderMax:30,step:.1,unit:'m'},
 {key:'finiteEndTime',label:'Simulation end time',value:30,min:1,max:100,step:1,unit:'ms'},
 {key:'finiteCells',label:'Computational cells',value:600,min:160,max:1200,step:20,unit:'cells',help:'Number of cells used to divide the gas along the tube. More cells resolve wave fronts more sharply and take longer to compute.'}
];

export const closedPistonMode='Finite tube · closed far end';
export const closedPistonFields=[
 {key:'pistonDomain',label:'Piston tube model',value:'Before shock catch-up',options:['Before shock catch-up',closedPistonMode]},
 {key:'pistonTubeLength',label:'Initial tube length',value:6,min:.1,max:100000,sliderMax:30,step:.1,unit:'m'}
];

export const sinusoidalExperiment='Sinusoidal piston';
export const sinusoidalFields=[
 {key:'pistonEpsilon',label:'Velocity amplitude / initial sound speed ε',value:.01,min:.0001,max:.3,step:.001,unit:'ε'},
 {key:'pistonFrequency',label:'Piston frequency',value:100,min:.1,max:10000,step:1,unit:'Hz'},
 {key:'pistonCycles',label:'Number of cycles',value:1,min:1,max:20,step:1,unit:'cycles'}
];

export function sinusoidalPosition(motion,t){
 const phase=motion.omega*Math.min(Math.max(0,t),motion.duration);
 return motion.amplitude/motion.omega*(1-Math.cos(phase));
}

export function sinusoidalVelocity(motion,t){
 return t>0&&t<motion.duration?motion.amplitude*Math.sin(motion.omega*t):0;
}

export function sinusoidalReference(r,x,t){
 const retarded=t-x/r.a1;
 const u=sinusoidalVelocity(r.motion,retarded);
 return {u,p:r.initialPressure+r.initialDensity*r.a1*u};
}

// C− characteristics are straight in the initial centered simple wave.
export function expansionRaySpeeds({head,tail}){
 return Array.from({length:6},(_,i)=>head+(tail-head)*(i+1)/7);
}

function wallReflection(incident,gamma,R){
 const a2=Math.sqrt(gamma*R*incident.T2);
 const q=(gamma+1)*incident.u/(4*a2);
 const mach=q+Math.hypot(1,q),jump=normalShock(mach,gamma);
 return {mach,speed:mach*a2-incident.u,p:incident.p*jump.p,T:incident.T2*jump.T,pressureRatio:jump.p};
}

// Conservative finite-volume update. The HLLC flux is evaluated in each
// face's frame. A piston moves the left wall and deforms the mesh uniformly.
function simulate(x,left,right,end,gamma,R,motion){
 const n=x.finiteCells, size=3*n, gm=gamma-1;
 let dx=(right-left)/n, pistonWork=0;
 const initialVelocity=x.tubeInitialVelocity??0;
 let U=new Float64Array(size), next=new Float64Array(size);
 const flux=new Float64Array(size+3), rho=new Float64Array(n), u=new Float64Array(n);
 const p=new Float64Array(n), a=new Float64Array(n);
 const rhoL=x.p4*1000/(R*x.T4),rhoR=x.p1*1000/(R*x.T1);
 const centers=Array.from({length:n},(_,i)=>left+(i+.5)*dx);
 for(let i=0;i<n;i++){
  const fraction=Math.min(1,Math.max(0,-(left+i*dx)/dx));
  U[3*i]=fraction*rhoL+(1-fraction)*rhoR;
  U[3*i+1]=U[3*i]*initialVelocity;
  U[3*i+2]=(fraction*x.p4+(1-fraction)*x.p1)*1000/gm+.5*U[3*i]*initialVelocity**2;
 }
 const totals=V=>{
  let mass=0,energy=0;
  for(let i=0;i<size;i+=3){mass+=V[i];energy+=V[i+2];}
  return {mass:mass*dx,energy:energy*dx};
 };
 const initial=totals(U), frames=[];
 let t=0,steps=0;
 const intervals=motion?.sinusoidal?240:end>10?300:120;
 for(let frame=0;frame<=intervals;frame++){
  const target=end*(frame/intervals);
  while(t<target){
   requireValue(++steps<=40000,'Simulation exceeds the step budget. Reduce the end time or grid resolution.');
   let wallSpeed=motion?.sinusoidal?sinusoidalVelocity(motion,t):motion?(t<motion.delay?motion.speed1:motion.speed2):0;
   const switchTime=motion?.sinusoidal?(t<motion.duration?motion.duration:Infinity):motion&&t<motion.delay?motion.delay:Infinity;
   const stepEnd=Math.min(target,switchTime);
   let maxSpeed=0;
   for(let i=0;i<n;i++){
    rho[i]=U[3*i];u[i]=U[3*i+1]/rho[i];p[i]=gm*(U[3*i+2]-.5*rho[i]*u[i]**2);
    a[i]=Math.sqrt(gamma*p[i]/rho[i]);
    maxSpeed=Math.max(maxSpeed,Math.abs(u[i]-wallSpeed*(1-i/n))+a[i]);
   }
   const plannedDt=motion?.sinusoidal?Math.min(.4*dx/(maxSpeed+2*motion.amplitude),stepEnd-t,Math.PI/(100*motion.omega)):null;
   if(motion?.sinusoidal)wallSpeed=(sinusoidalPosition(motion,t+plannedDt)-sinusoidalPosition(motion,t))/plannedDt;
   for(let j=0;j<=n;j++){
    const l=Math.max(0,j-1), r=Math.min(n-1,j), k=3*j;
    const w=wallSpeed*(1-j/n),dL=rho[l],dR=rho[r];
    const vL=j===0?w-u[l]:u[l]-w,vR=j===n?-u[r]:u[r]-w;
    const pL=p[l],pR=p[r];
    const eL=w===0?U[3*l+2]:pL/gm+.5*dL*vL**2;
    const eR=w===0?U[3*r+2]:pR/gm+.5*dR*vR**2;
    const sL=Math.min(vL-a[l],vR-a[r]),sR=Math.max(vL+a[l],vR+a[r]);
    const fL0=dL*vL,fL1=fL0*vL+pL,fL2=vL*(eL+pL);
    const fR0=dR*vR,fR1=fR0*vR+pR,fR2=vR*(eR+pR);
    if(sL>=0){flux[k]=fL0;flux[k+1]=fL1;flux[k+2]=fL2;continue;}
    if(sR<=0){flux[k]=fR0;flux[k+1]=fR1;flux[k+2]=fR2;continue;}
    const bL=dL*(sL-vL),bR=dR*(sR-vR);
    const star=(pR-pL+bL*vL-bR*vR)/(bL-bR), pStar=pL+bL*(star-vL);
    if(!(sL<star&&star<sR&&pStar>0)){
     const den=sR-sL;
     flux[k]=(sR*fL0-sL*fR0+sL*sR*(dR-dL))/den;
     flux[k+1]=(sR*fL1-sL*fR1+sL*sR*(fR0-fL0))/den;
     flux[k+2]=(sR*fL2-sL*fR2+sL*sR*(eR-eL))/den;
    }else{
     const L=star>=0, speed=L?sL:sR, v=L?vL:vR, density=L?dL:dR, energy=L?eL:eR;
     const pressure=L?pL:pR, dStar=density*(speed-v)/(speed-star);
     const eStar=((speed-v)*energy-pressure*v+pStar*star)/(speed-star);
     flux[k]=(L?fL0:fR0)+speed*(dStar-density);
     flux[k+1]=(L?fL1:fR1)+speed*(dStar*star-density*v);
     flux[k+2]=(L?fL2:fR2)+speed*(eStar-energy);
    }
   }
   flux[0]=flux[size]=0;
   flux[2]=wallSpeed*flux[1];flux[size+2]=0;
   if(wallSpeed!==0){
    for(let j=1;j<n;j++){
     const k=3*j,w=wallSpeed*(1-j/n);
     flux[k+2]+=w*flux[k+1]+.5*w*w*flux[k];
     flux[k+1]+=w*flux[k];
    }
   }
   let dt=plannedDt??Math.min(.45*dx/maxSpeed,stepEnd-t),valid=false,nextDx=dx;
   for(let attempt=0;attempt<12;attempt++){
    nextDx=dx-wallSpeed*dt/n;
    const scale=dt/dx,volumeRatio=dx/nextDx;
    for(let i=0;i<size;i++)next[i]=(U[i]-scale*(flux[i+3]-flux[i]))*volumeRatio;
    valid=true;
    for(let i=0;i<size;i+=3){
     if(!(next[i]>0&&next[i+2]>.5*next[i+1]**2/next[i]&&Number.isFinite(next[i+2]))){valid=false;break;}
    }
    if(valid)break;
    dt/=2;
   }
   requireValue(valid&&dt>0,'Numerical step could not preserve a physical gas state.');
   pistonWork+=dt*flux[2];dx=nextDx;
   t=dt===stepEnd-t?stepEnd:t+dt;
   [U,next]=[next,U];
  }
  const pressure=[],density=[],velocity=[];
  for(let i=0;i<size;i+=3){
   const d=U[i],v=U[i+1]/d;
   density.push(d);velocity.push(v);pressure.push(gm*(U[i+2]-.5*d*v*v));
  }
  frames.push({time:target,left:motion?Math.max(left,right-n*dx):left,pressure,density,velocity});
 }
 const final=totals(U);
 return {frames,centers,steps,pistonWork,massPerArea:initial.mass,checks:{mass:Math.abs(final.mass/initial.mass-1),energy:Math.abs(final.energy-initial.energy-pistonWork)/(initial.energy+pistonWork)}};
}

export function solveFiniteTube(raw){
 const {inputs:x,result:incident}=solveTube(raw);
 const {gamma,R,cp}=gas(x.gamma??1.4,x.R??287);
 for(const [v,label] of [[x.finiteDriverLength,'Driver length'],[x.finiteDrivenLength,'Driven length'],[x.finiteDiameter,'Diameter'],[x.finiteEndTime,'End time']])positive(v,label);
 requireValue(x.finiteEndTime<=100,'Set the simulation end time to 100 ms or less.');
 requireValue(Number.isInteger(x.finiteCells)&&x.finiteCells>=160&&x.finiteCells<=1200,'Use an integer grid size from 160 to 1200 cells.');
 const left=-x.finiteDriverLength,right=x.finiteDrivenLength,end=x.finiteEndTime/1000;
 const stationary=incident.initialVelocity===0;
 const reflected=stationary?wallReflection(incident,gamma,R):null;
 const wallTime=stationary?right/incident.shockSpeed:null, driverWallTime=stationary?left/incident.head:null;
 const contactTime=stationary?(right+reflected.speed*wallTime)/(incident.u+reflected.speed):null;
 const domain=simulate(x,left,right,end,gamma,R);
 const trajectory=(name,t0,x0,speed,stop,color,dash)=>{
  const last=Math.min(end,stop);
  return {name,color,legendColor:color==='#fff'?'#627586':color,dash,hideLegend:last<t0,points:last>=t0?[[x0,t0*1000],[x0+(last-t0)*speed,last*1000]]:[]};
 };
 const referenceEnd=stationary?Math.min(contactTime,driverWallTime):0;
 // Example 13 places the sample 3 m downstream of the diaphragm.
 const sample=x.bookExample==='7–13'&&right>=3?3:null;
 const shockSample=sample===null?null:sample/incident.shockSpeed;
 const contactSample=sample===null?null:sample/incident.u;
 const sampleValid=sample!==null&&stationary&&contactSample<=referenceEnd;
 const chart={title:'Wave reflections · pressure in the x–t plane',xlabel:'Position from diaphragm x (m)',ylabel:'Time t (ms)',
  series:[
   {name:'Domain',hideLegend:true,points:[[left,0],[right,end*1000]],width:0},
   ...(stationary?[trajectory('Incident shock',0,0,incident.shockSpeed,Math.min(wallTime,driverWallTime),'#fff'),
   trajectory('Contact surface',0,0,incident.u,referenceEnd,'#fff','8 4'),
   trajectory('Reflected shock',wallTime,right,-reflected.speed,referenceEnd,'#fff'),
   trajectory('Expansion head',0,0,incident.head,referenceEnd,'#fff','1 4'),
   trajectory('Expansion tail',0,0,incident.tail,referenceEnd,'#fff','6 3 1 3')]:[]),
   ...(sample===null?[]:[trajectory('Sample · 3 m',0,sample,0,end,'#ffd06b','4 3')])
  ]};
 const rows=[
  ['Incident shock speed',incident.shockSpeed,'m/s'],['Incident pressure ratio',incident.p2p1,'p₂/p₁'],
  ['Incident temperature ratio',incident.T2/x.T1,'T₂/T₁'],
  ['Incident density ratio',incident.rho2/(x.p1*1000/(R*x.T1)),'ρ₂/ρ₁'],
  ['Contact surface speed',incident.u,'m/s'],['Mach behind incident shock · laboratory',incident.u/Math.sqrt(gamma*R*incident.T2)],
  ['Initial gas velocity · laboratory',incident.initialVelocity,'m/s'],
  ['Gas velocity behind incident shock',incident.u,'m/s'],['Temperature behind incident shock',incident.T2,'K'],
  ['Incident shock Mach · relative to upstream gas',incident.Ms],
  ...(stationary?[
   ['Reflected shock speed · upstream',reflected.speed,'m/s'],['Reflected shock Mach · relative to zone 2',reflected.mach],
   ['Reflected pressure ratio',reflected.pressureRatio,'p₅/p₂'],['Pressure behind reflected shock',reflected.p/1000,'kPa'],
   ['Temperature behind reflected shock',reflected.T,'K']
  ]:[]),
  ['Expansion pressure ratio',incident.p/(x.p4*1000),'p₃/p₄'],
  ['Expansion temperature ratio',incident.T3/x.T4,'T₃/T₄'],
  ['Expansion density ratio',incident.rho3/(x.p4*1000/(R*x.T4)),'ρ₃/ρ₄'],
  ...(stationary?[
   ['Incident shock reaches driven wall · estimate',wallTime*1000,'ms'],['Expansion head reaches driver wall',driverWallTime*1000,'ms'],
   ['Reflected shock meets contact · first-wave estimate',contactTime*1000,'ms']
  ]:[]),
  ...(sample===null?[]:[['Sample position from diaphragm',sample,'m']]),
  ...(sampleValid?[
   ['Incident shock reaches sample · analytical',shockSample*1000,'ms'],
   ['Contact surface reaches sample · analytical',contactSample*1000,'ms'],
   ['Time between shock and contact at sample',(contactSample-shockSample)*1000,'ms']
  ]:[]),
  ['Initial gas mass',domain.massPerArea*Math.PI*x.finiteDiameter**2/4,'kg'],
  ['Simulated time',end*1000,'ms'],['Numerical time steps',domain.steps]
 ];
 const h02=(cp*incident.T2+.5*incident.u**2)/1000;
 const h01=(cp*x.T1+.5*incident.initialVelocity**2)/1000;
 const h05=reflected?cp*reflected.T/1000:0;
 rows.push(
  ['Incident shock · h₀ ahead',h01,'kJ/kg'],['Incident shock · h₀ behind',h02,'kJ/kg'],
  ['Incident shock · Δh₀',h02-h01,'kJ/kg'],
  ...(stationary?[
   ['First reflected shock · h₀ ahead',h02,'kJ/kg'],['First reflected shock · h₀ behind',h05,'kJ/kg'],
   ['First reflected shock · Δh₀',h05-h02,'kJ/kg']
  ]:[])
 );
 return {inputs:x,result:{status:'ok',finiteTube:true,left,right,end,gamma,R,cp,incident,reflected,
  sample,wallTime,driverWallTime,contactTime,referenceEnd,chart,driverMassPerArea:-left*x.p4*1000/(R*x.T4),...domain},rows};
}

export function solveClosedPiston(x){
 const free=solvePistonShocks(x),{gamma,R,cp}=free;
 const length=x.pistonTubeLength;
 positive(length,'Initial piston tube length');positive(x.finiteEndTime,'End time');
 requireValue(x.finiteEndTime<=100000,'Set the piston simulation end time to 100000 ms or less.');
 requireValue(Number.isInteger(x.finiteCells)&&x.finiteCells>=160&&x.finiteCells<=1200,'Use an integer grid size from 160 to 1200 cells.');
 const motion={delay:x.pistonDelay,speed1:x.pistonSpeed1,speed2:x.pistonSpeed2};
 const pistonAt=t=>motion.speed1*Math.min(t,motion.delay)+motion.speed2*Math.max(0,t-motion.delay);
 // A nonzero gas gap is needed to avoid the singularity at full closure.
 const travel=.9*length;
 const gapLimit=travel<=free.launchX?travel/motion.speed1:motion.delay+(travel-free.launchX)/motion.speed2;
 const end=Math.min(x.finiteEndTime/1000,gapLimit);
 const domain=simulate({...x,p4:x.p1,T4:x.T1},0,length,end,gamma,R,motion);
 const firstHit=length/free.first.speed,secondHit=motion.delay+(length-free.launchX)/free.second.speed;
 const isolatedEnd=Math.min(end,firstHit,secondHit,free.catchTime);
 const series=[
  {name:'Domain',hideLegend:true,width:0,points:[[0,0],[length,end*1000]]},
  {name:'Moving piston',color:'#192737',points:[...new Set([0,Math.min(end,motion.delay),end])].map(t=>[pistonAt(t),1000*t])},
  {name:'Fixed wall',color:'#192737',points:[[length,0],[length,end*1000]]},
  {name:'First shock · analytical',color:'#fff',legendColor:'#627586',points:[[0,0],[free.first.speed*isolatedEnd,isolatedEnd*1000]]}
 ];
 if(isolatedEnd>motion.delay)series.push({name:'Second shock · analytical',color:'#fff',legendColor:'#627586',dash:'5 2',
  points:[[free.launchX,motion.delay*1000],[free.launchX+free.second.speed*(isolatedEnd-motion.delay),isolatedEnd*1000]]});
 const chart={title:'Piston and wave reflections in the x–t plane',xlabel:'Position from initial piston face x (m)',ylabel:'Time t (ms)',series};
 const last=domain.frames.at(-1);
 const rows=[
  ['First shock launch speed',free.first.speed,'m/s'],
  ['Second piston speed begins',motion.delay*1000,'ms'],
  ['Final piston position',pistonAt(end),'m'],['Final gas gap',length-pistonAt(end),'m'],
  ['Final pressure at piston',last.pressure[0]/1000,'kPa'],['Final pressure at fixed wall',last.pressure.at(-1)/1000,'kPa'],
  ['Piston work per tube area',domain.pistonWork/1000,'kJ/m²'],
  ['Simulated time',end*1000,'ms'],['Numerical time steps',domain.steps]
 ];
 if(free.catchTime<=Math.min(firstHit,secondHit))rows.splice(2,0,
  ['Launch shocks merge · analytical time',free.catchTime,'s'],
  ['Launch shocks merge · analytical position',free.catchX,'m'],
  ['Time from second speed increase to merger',free.catchTime-free.delay,'s']);
 if(isolatedEnd>motion.delay)rows.splice(1,0,['Second shock launch speed',free.second.speed,'m/s']);
 if(firstHit<=isolatedEnd)rows.splice(1,0,['First shock reaches fixed wall · analytical',firstHit*1000,'ms']);
 const h0=s=>(cp*s.T+.5*s.u*s.u)/1000;
 for(const [name,shock] of [['First launch shock',free.first],...(isolatedEnd>motion.delay?[['Second launch shock',free.second]]:[])]){
  rows.push([`${name} · h₀ ahead`,h0(shock.before),'kJ/kg'],[`${name} · h₀ behind`,h0(shock.after),'kJ/kg'],
   [`${name} · Δh₀`,h0(shock.after)-h0(shock.before),'kJ/kg']);
 }
 return {inputs:x,result:{status:'ok',finiteTube:true,movingPiston:true,left:0,right:length,end,gamma,R,cp,chart,
  motion,initialShocks:{firstSpeed:free.first.speed,secondSpeed:free.second.speed,
   launchX:free.launchX,end:isolatedEnd,mergeTime:free.catchTime<=isolatedEnd?free.catchTime:null},
  stoppedAtGap:end===gapLimit,...domain},rows};
}

export function solveClosedValve(x){
 const valve=solveValveClosure(x),{gamma,R,cp}=gas(x.gamma,x.R);
 const length=x.finiteValveLength;
 positive(length,'Initial valve tube length');positive(x.finiteEndTime,'End time');
 requireValue(x.finiteEndTime<=10000,'Set the valve simulation end time to 10000 ms or less.');
 requireValue(Number.isInteger(x.finiteCells)&&x.finiteCells>=160&&x.finiteCells<=1200,'Use an integer grid size from 160 to 1200 cells.');
 const speed=x.valveInletSpeed,motion={delay:0,speed1:speed,speed2:speed};
 const gapLimit=.9*length/speed,end=Math.min(x.finiteEndTime/1000,gapLimit);
 const domain=simulate({...x,p4:x.p1,T4:x.T1,tubeInitialVelocity:speed},0,length,end,gamma,R,motion);
 const encounter=length/(valve.speed+speed),last=Math.min(encounter,end);
 const chart={title:'Valve closure and wave reflections in the x–t plane',xlabel:'Position from initial piston face x (m)',ylabel:'Time t (ms)',series:[
  {name:'Domain',hideLegend:true,width:0,points:[[0,0],[length,end*1000]]},
  {name:'Moving piston',color:'#192737',points:[[0,0],[speed*end,end*1000]]},
  {name:'Closed valve',color:'#192737',points:[[length,0],[length,end*1000]]},
  {name:'Valve shock · analytical',color:'#fff',legendColor:'#627586',points:[[length,0],[length-valve.speed*last,last*1000]]}
 ]};
 const h0=state=>(cp*state.T+.5*state.u**2)/1000;
 const before=h0(valve.upstream),after=h0(valve.downstream);
 const rows=[
  ['Shock speed · upstream',valve.speed,'m/s'],['Pressure behind shock',valve.downstream.p/1000,'kPa'],
  ['Temperature behind shock',valve.downstream.T,'K'],['Static temperature ratio',valve.ratios.T,'T₂/T₁'],
  ['Gas speed behind shock',valve.downstream.u,'m/s'],['Upstream Mach · shock frame',valve.mach],
  ['Downstream Mach · shock frame',valve.ratios.M2],['Shock pressure ratio',valve.ratios.p,'p₂/p₁'],
  ['Valve shock · h₀ ahead',before,'kJ/kg'],['Valve shock · h₀ behind',after,'kJ/kg'],['Valve shock · Δh₀',after-before,'kJ/kg'],
  ['First shock reaches piston · estimate',encounter*1000,'ms'],
  ['Simulated time',end*1000,'ms'],['Final gas gap',length-speed*end,'m']
 ];
 return {inputs:x,result:{status:'ok',finiteTube:true,movingPiston:true,closedValve:true,left:0,right:length,end,gamma,R,cp,chart,
  valveSpeed:valve.speed,valveEncounter:encounter,motion,stoppedAtGap:end===gapLimit,...domain},rows};
}

export function solveSinusoidalPiston(x){
 const {gamma,R,cp}=gas(x.gamma,x.R);
 for(const [value,label] of [[x.p1,'Initial pressure'],[x.T1,'Initial temperature'],[x.pistonTubeLength,'Tube length'],
  [x.pistonFrequency,'Frequency'],[x.pistonEpsilon,'Velocity amplitude'],[x.finiteEndTime,'End time']])positive(value,label);
 requireValue(x.pistonEpsilon<=.3,'Use ε ≤ 0.3.');
 requireValue(Number.isInteger(x.pistonCycles)&&x.pistonCycles>=1&&x.pistonCycles<=20,'Use 1 to 20 complete cycles.');
 requireValue(Number.isInteger(x.finiteCells)&&x.finiteCells>=160&&x.finiteCells<=1200,'Use 160 to 1200 integer cells.');
 requireValue(x.finiteEndTime<=100000,'Use an end time up to 100000 ms.');
 const a1=Math.sqrt(gamma*R*x.T1),omega=2*Math.PI*x.pistonFrequency;
 const motion={sinusoidal:true,amplitude:x.pistonEpsilon*a1,omega,duration:x.pistonCycles/x.pistonFrequency};
 const length=x.pistonTubeLength,end=x.finiteEndTime/1000;
 requireValue(2*motion.amplitude/omega<.9*length,'Reduce the amplitude or increase the tube length to retain a gas gap.');
 const domain=simulate({...x,p4:x.p1,T4:x.T1,tubeInitialVelocity:0},0,length,end,gamma,R,motion);
 const initialPressure=x.p1*1000,initialDensity=initialPressure/(R*x.T1);
 const r={status:'ok',finiteTube:true,movingPiston:true,sinusoidal:true,left:0,right:length,end,gamma,R,cp,a1,
  initialPressure,initialDensity,motion,comparisonTime:Math.min(.75/x.pistonFrequency,.8*length/a1,end),...domain};
 // Compare only cells that cannot yet have received a wave reflected by the far wall.
 const frame=finiteTubeFrame(r,r.comparisonTime),dx=(length-frame.left)/x.finiteCells;
 let velocityError=0,pressureError=0,count=0;
 for(let i=0;i<x.finiteCells;i++){
  const position=frame.left+(i+.5)*dx;
  if(frame.time>=(2*length-position)/a1)continue;
  const exact=sinusoidalReference(r,position,frame.time);
  velocityError+=(frame.velocity[i]-exact.u)**2;
  pressureError+=(frame.pressure[i]-exact.p)**2;
  count++;
 }
 const rows=[
  ['Peak piston velocity',motion.amplitude,'m/s'],['Period',1000/x.pistonFrequency,'ms'],
  ['Piston stops after',motion.duration*1000,'ms'],['Maximum piston displacement',2*motion.amplitude/omega,'m'],
  ['Linear wavelength',a1/x.pistonFrequency,'m'],['Initial sound speed',a1,'m/s'],
  ['First acoustic arrival at fixed wall',length/a1*1000,'ms'],['Comparison time',frame.time*1000,'ms'],
  ['Velocity RMS error / peak piston velocity',Math.sqrt(velocityError/count)/motion.amplitude],
  ['Pressure RMS error / linear pressure amplitude',Math.sqrt(pressureError/count)/(initialDensity*a1*motion.amplitude)],
  ['Piston work per tube area',domain.pistonWork/1000,'kJ/m²'],['Simulated time',end*1000,'ms'],['Numerical time steps',domain.steps]
 ];
 r.chart={title:'Sinusoidal piston · wave reflections in the x–t plane',xlabel:'Position from initial piston face x (m)',ylabel:'Time t (ms)',
  series:[
   {name:'Domain',width:0,hideLegend:true,points:[[0,0],[length,end*1000]]},
   {name:'Moving piston',color:'#192737',points:r.frames.map(f=>[f.left,f.time*1000])},
   {name:'Fixed wall',color:'#192737',points:[[length,0],[length,end*1000]]}
  ]};
 return {inputs:x,result:r,rows};
}

export function finiteTubeFrame(r,time){
 return r.frames[Math.round(Math.max(0,Math.min(1,time/r.end))*(r.frames.length-1))];
}

const fieldScales=new WeakMap();
// The wall-adjacent cells provide the numerical gas state at each closed end.
export function finiteTubeWallStates(frame,R){
 return [0,frame.pressure.length-1].map(i=>({
  pressure:frame.pressure[i]/1000,
  temperature:frame.pressure[i]/(R*frame.density[i])
 }));
}

export function finiteTubeScale(frames,property){
 let scales=fieldScales.get(frames);
 if(!scales){scales={};fieldScales.set(frames,scales);}
 if(scales[property])return scales[property];
 let min=Infinity,max=0;
 for(const frame of frames)for(const value of frame[property]){min=Math.min(min,value);max=Math.max(max,value);}
 const span=Math.log(max/min)||1;
 const normalize=value=>Math.min(1,Math.max(0,Math.log(value/min)/span));
 return scales[property]={normalize,min,max};
}

export function resolvedShockFronts(r,frame){
 const n=frame.pressure.length,dx=(r.right-frame.left)/n,window=6;
 const candidates=[];
 // A resolved compression front has coincident pressure/density changes,
 // decreasing velocity and a localized pressure gradient.
 for(let i=window;i<n-window-1;i++){
  const p=frame.pressure,d=frame.density,u=frame.velocity;
  const gradient=Math.abs(p[i+1]-p[i])/Math.min(p[i],p[i+1]);
  if(gradient<.0025)continue;
  let peak=true;
  for(let j=i-3;j<=i+3;j++){
   if(Math.abs(p[j+1]-p[j])/Math.min(p[j],p[j+1])>gradient){peak=false;break;}
  }
  if(!peak)continue;
  const l=i-window,h=i+window;
  const dp=p[h]-p[l],densityJump=d[h]-d[l],du=u[l]-u[h];
  const sound=Math.sqrt(r.gamma*.5*(p[l]/d[l]+p[h]/d[h]));
  if(dp*densityJump<=0||du<.002*sound||Math.abs(dp)/Math.min(p[l],p[h])<.025)continue;
  // The mass jump gives the front speed in the laboratory frame.
  const speed=(d[h]*u[h]-d[l]*u[l])/densityJump;
  candidates.push({x:frame.left+(i+1)*dx,gradient,index:i,direction:Math.sign(speed)});
 }
 candidates.sort((a,b)=>b.gradient-a.gradient);
 const peaks=[];
 for(const c of candidates)if(peaks.every(p=>Math.abs(p.index-c.index)>2*window))peaks.push(c);
 return peaks.sort((a,b)=>a.x-b.x);
}

function waveDirectionArrows(arrows){
 // Use a single lane above the tube. Hide both markers if their tips or shafts would overlap.
 return arrows.filter(({x,direction},i)=>direction&&arrows.every((other,j)=>
  i===j||!other.direction||Math.abs(other.x-x)>=22
 )).map(({x,direction})=>{
  const start=x-8*direction,tip=x+8*direction,back=tip-4*direction;
  return `<path data-wave-direction="${direction}" d="M${start} 82H${tip} M${back} 79L${tip} 82L${back} 85" fill="none" stroke="#20394a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
 }).join('');
}

function resolvedShockMarks(r,frame,X,arrows){
 return resolvedShockFronts(r,frame).map((front,i)=>{
  const x=X(front.x);
  arrows.push({x,direction:front.direction});
  return `<path data-numerical-shock="${i+1}" d="M${x} 92V197" stroke="#111" stroke-width="1.7"/>`;
 }).join('');
}

function pistonShockMarks(r,t,X,arrows){
 if(r.sinusoidal){
  const velocity=sinusoidalVelocity(r.motion,t),position=sinusoidalPosition(r.motion,t);
  return `<text x="320" y="245" text-anchor="middle" font-size="11">Piston · u = ${velocity.toFixed(2)} m/s · x = ${position.toFixed(4)} m</text>`;
 }
 if(r.closedValve){
  if(t>=r.valveEncounter)return '';
  const x=X(r.right-r.valveSpeed*t);
  arrows.push({x,direction:Math.sign(-r.valveSpeed)});
  return `<path data-valve-shock="" d="M${x} 92V197" stroke="#20394a" stroke-width="1.25"/>`;
 }
 const shocks=r.initialShocks;
 if(t===0||t>=shocks.end)return '';
 const marker=(position,speed,number)=>{
  const x=X(position);
  arrows.push({x,direction:Math.sign(speed)});
  return `<path data-launch-shock="${number}" d="M${x} 92V197" stroke="#20394a" stroke-width="1.25"/>`;
 };
 const first=marker(shocks.firstSpeed*t,shocks.firstSpeed,1);
 return t<r.motion.delay?first:first+marker(shocks.launchX+shocks.secondSpeed*(t-r.motion.delay),shocks.secondSpeed,2);
}

export function tubeSampleMark(x,top,bottom){
 return `<g data-tube-sample=""><path d="M${x} ${top}V${bottom+10}" stroke="#ffd06b" stroke-width="2" stroke-dasharray="4 3"/>
 <text x="${x}" y="${bottom+24}" text-anchor="middle" font-size="11" fill="#7a4921">Sample</text></g>`;
}

function initialTubePressure(r,t,X,color){
 const {incident,gamma}=r;
 const head=incident.head*t,tail=incident.tail*t,shock=incident.shockSpeed*t;
 const initial=r.frames[0].pressure;
 const driverPressure=initial[0],drivenPressure=initial.at(-1);
 const band=(left,right,pressure,fan=false)=>`<polygon ${fan?'data-expansion-band ':''}points="${X(left)},92 ${X(right)},92 ${X(right)},197 ${X(left)},197" fill="${color(pressure)}"/>`;
 const expansion=Array.from({length:50},(_,i)=>{
  const a=head+(tail-head)*i/50,b=head+(tail-head)*(i+1)/50;
  const xi=(a+b)/(2*t);
  const sound=(2*incident.a4-(gamma-1)*xi)/(gamma+1);
  return band(a,b,driverPressure*(sound/incident.a4)**(2*gamma/(gamma-1)),true);
 });
 return band(r.left,head,driverPressure)+expansion.join('')+band(tail,shock,incident.p)+band(shock,r.right,drivenPressure);
}

function expansionBoundaryMarks(boundaries){
 return boundaries.map(([left,right])=>{
  const path=`M${left} 94V195 M${right} 94V195`;
  return `<g data-expansion-boundaries="" fill="none" stroke-dasharray="0 5" stroke-linecap="round">
   <path d="${path}" stroke="#20394a" stroke-width="3.2" opacity=".65"/>
   <path d="${path}" stroke="#fff" stroke-width="2"/>
  </g>`;
 }).join('');
}

function numericalExpansionFans(r,frame,X,color,arrows,boundaries){
 if(frame.time<=0)return '';
 const {pressure,density,velocity}=frame,n=pressure.length,dx=(r.right-frame.left)/n;
 const families=[[],[]];
 for(let i=1;i<n;i++){
  const dp=pressure[i]-pressure[i-1],du=velocity[i]-velocity[i-1];
  const rho=(density[i]+density[i-1])/2,a=Math.sqrt(r.gamma*(pressure[i]+pressure[i-1])/(2*rho));
  const u=(velocity[i]+velocity[i-1])/2;
  // Project onto each acoustic family, so overlapping fans can be marked independently.
  for(const [index,sign] of [[0,-1],[1,1]]){
   const strength=(sign*dp+rho*a*du)/pressure[i];
   if(strength<(r.sinusoidal?.000025:.0003))continue;
   const direction=Math.sign(u+sign*a);
   if(!direction)continue;
   const bands=families[index],previous=bands.at(-1);
   if(previous?.end===i-1&&previous.direction===direction){previous.end=i;previous.strength+=strength;}
   else bands.push({start:i-1,end:i,direction,strength});
  }
 }
 return families.flat().filter(({start,end,strength})=>end-start>=5&&strength>=(r.sinusoidal?.001:.004))
  .sort((a,b)=>a.start-b.start)
  .map(({start,end,direction})=>{
   const left=frame.left+(start+.5)*dx,right=frame.left+(end+.5)*dx;
   arrows.push({x:X((left+right)/2),direction});
   boundaries.push([X(left),X(right)]);
   const stripes=Array.from({length:50},(_,i)=>{
    const a=X(left+(right-left)*i/50),b=X(left+(right-left)*(i+1)/50);
    const position=start+(end-start)*(i+.5)/50,j=Math.floor(position);
    const p=pressure[j]+(position-j)*(pressure[j+1]-pressure[j]);
    return `<polygon points="${a},92 ${b},92 ${b},197 ${a},197" fill="${color(p)}"/>`;
   }).join('');
   const reflected=!r.movingPiston&&r.driverWallTime!=null&&frame.time>r.driverWallTime&&direction>0&&left<0;
   return `<g data-${reflected?'reflected':'numerical'}-expansion="">${stripes}</g>`;
  }).join('');
}

function contactPosition(r,frame,analytical){
 if(analytical)return r.incident.contact*frame.time;
 // Closed ends conserve the gas mass on the driver side of the material interface.
 const dx=(r.right-frame.left)/frame.density.length;
 let remaining=r.driverMassPerArea;
 for(let i=0;i<frame.density.length;i++){
  const mass=frame.density[i]*dx;
  if(remaining<=mass)return frame.left+i*dx+remaining/frame.density[i];
  remaining-=mass;
 }
 return r.right;
}

export function finiteTubeDrawing(r,time){
 const frame=finiteTubeFrame(r,time),{normalize}=finiteTubeScale(r.frames,'pressure');
 const X=x=>40+(x-r.left)/(r.right-r.left)*560;
 const color=p=>`rgb(${contourColor(normalize(p)).join(',')})`;
 const analytical=!r.movingPiston&&frame.time>0&&frame.time<Math.min(r.wallTime,r.driverWallTime);
 const stops=analytical?'':frame.pressure.map((p,i)=>`<stop offset="${(i+.5)/frame.pressure.length}" stop-color="${color(p)}"/>`).join('');
 const gasX=r.movingPiston?X(frame.left):40;
 const contactX=r.movingPiston?null:X(contactPosition(r,frame,analytical));
 const initial=r.movingPiston&&!r.sinusoidal&&(r.closedValve?frame.time<r.valveEncounter:frame.time<r.initialShocks.end);
 const shockX=analytical?X(r.incident.shockSpeed*frame.time):null;
 const arrows=[],boundaries=[];
 if(analytical){
  const {shockSpeed,head,tail}=r.incident;
  arrows.push({x:shockX,direction:Math.sign(shockSpeed)});
  if(head!==tail){
   const left=X(head*frame.time),right=X(tail*frame.time);
   arrows.push({x:(left+right)/2,direction:Math.sign(head+tail)});
   boundaries.push([left,right]);
  }
 }
 const overlay=analytical?`<g data-incident-shock=""><path d="M${shockX} 92V197" stroke="#111" stroke-width="1.7"/></g>`
  :initial?pistonShockMarks(r,frame.time,X,arrows):resolvedShockMarks(r,frame,X,arrows);
 const expansion=analytical?'':numericalExpansionFans(r,frame,X,color,arrows,boundaries);
 const motionCaption=r.sinusoidal?pistonShockMarks(r,frame.time,X,arrows):'';
 const cells=analytical?initialTubePressure(r,frame.time,X,color):`<defs><linearGradient id="finitePressure">${stops}</linearGradient></defs><rect x="${gasX}" y="92" width="${600-gasX}" height="105" fill="url(#finitePressure)"/>`;
 return {label:'Numerical pressure field',meta:'Closed walls',svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 250" role="img" aria-label="Pressure distribution in the closed shock tube">
 <text x="320" y="35" text-anchor="middle">Pressure field · t = ${(frame.time*1000).toFixed(2)} ms</text>
 ${cells}${expansion}${expansionBoundaryMarks(boundaries)}${motionCaption}${overlay}${waveDirectionArrows(arrows)}${r.sample==null?'':tubeSampleMark(X(r.sample),92,197)}<path d="M40 92H600V197H40Z" fill="none" stroke="#20394a" stroke-width="3"/>
 ${r.movingPiston?`<path d="M${gasX} 88V202" stroke="#20394a" stroke-width="5"/>`:`<path data-contact-surface="" d="M${contactX} 92V197" stroke="#fff" stroke-width="1.5" stroke-dasharray="8 5"/>`}
 <text x="${gasX}" y="226" text-anchor="${gasX>420?'end':'start'}">${r.movingPiston?'Piston':'Driver wall'}</text><text x="600" y="226" text-anchor="end">${r.closedValve?'Closed valve':r.movingPiston?'Fixed wall':'Driven wall'}</text>
 </svg>`};
}
