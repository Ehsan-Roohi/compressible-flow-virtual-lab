import {contourColor} from './contour-raster.js?v=20261117-closed-piston';
import {gas, positive, requireValue} from './numerics.js';
import {normalShock} from './physics.js';
import {solvePistonShocks} from './piston-shocks.js?v=20261117-valve-closure';
import {solveTube} from './tube-input.js?v=20261117-moving-tube';

export const finiteTubeMode = 'Finite tube · closed ends';
export const finiteTubeFields = [
 {key:'tubeDomain',label:'Tube model',value:'Before wall reflections',options:['Before wall reflections',finiteTubeMode]},
 {key:'finiteDriverLength',label:'Driver length · left of diaphragm',value:4,min:.1,max:20,step:.1,unit:'m'},
 {key:'finiteDrivenLength',label:'Driven length · right of diaphragm',value:6,min:.1,max:20,step:.1,unit:'m'},
 {key:'finiteDiameter',label:'Tube diameter',value:.3,min:.01,max:2,step:.01,unit:'m',help:'Sets area and total gas mass. The tube has constant area.'},
 {key:'finiteSampleX',label:'Sample position from diaphragm',value:3,min:0,max:20,step:.01,unit:'m',help:'Set to 0 to omit the sample.'},
 {key:'finiteEndTime',label:'Simulation end time',value:30,min:1,max:100,step:1,unit:'ms'},
 {key:'finiteCells',label:'Computational cells',value:600,min:160,max:1200,step:20,unit:'cells'}
];

export const closedPistonMode='Finite tube · closed far end';
export const closedPistonFields=[
 {key:'pistonDomain',label:'Piston tube model',value:'Before shock catch-up',options:['Before shock catch-up',closedPistonMode]},
 {key:'pistonTubeLength',label:'Initial tube length',value:6,min:.1,max:100000,sliderMax:30,step:.1,unit:'m'}
];

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
 let U=new Float64Array(size), next=new Float64Array(size);
 const flux=new Float64Array(size+3), rho=new Float64Array(n), u=new Float64Array(n);
 const p=new Float64Array(n), a=new Float64Array(n);
 const rhoL=x.p4*1000/(R*x.T4),rhoR=x.p1*1000/(R*x.T1);
 const centers=Array.from({length:n},(_,i)=>left+(i+.5)*dx);
 for(let i=0;i<n;i++){
  const fraction=Math.min(1,Math.max(0,-(left+i*dx)/dx));
  U[3*i]=fraction*rhoL+(1-fraction)*rhoR;
  U[3*i+2]=(fraction*x.p4+(1-fraction)*x.p1)*1000/gm;
 }
 const totals=V=>{
  let mass=0,energy=0;
  for(let i=0;i<size;i+=3){mass+=V[i];energy+=V[i+2];}
  return {mass:mass*dx,energy:energy*dx};
 };
 const initial=totals(U), frames=[];
 let t=0,steps=0;
 for(let frame=0;frame<=120;frame++){
  const target=end*(frame/120);
  while(t<target){
   requireValue(++steps<=40000,'Simulation exceeds the step budget. Reduce the end time or grid resolution.');
   const wallSpeed=motion?(t<motion.delay?motion.speed1:motion.speed2):0;
   const switchTime=motion&&t<motion.delay?motion.delay:Infinity;
   const stepEnd=Math.min(target,switchTime);
   let maxSpeed=0;
   for(let i=0;i<n;i++){
    rho[i]=U[3*i];u[i]=U[3*i+1]/rho[i];p[i]=gm*(U[3*i+2]-.5*rho[i]*u[i]**2);
    a[i]=Math.sqrt(gamma*p[i]/rho[i]);
    maxSpeed=Math.max(maxSpeed,Math.abs(u[i]-wallSpeed*(1-i/n))+a[i]);
   }
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
   let dt=Math.min(.45*dx/maxSpeed,stepEnd-t),valid=false,nextDx=dx;
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
 const {inputs:x,result:incident}=solveTube({...raw,tubeInitialVelocity:0});
 const {gamma,R,cp}=gas(x.gamma??1.4,x.R??287);
 for(const [v,label] of [[x.finiteDriverLength,'Driver length'],[x.finiteDrivenLength,'Driven length'],[x.finiteDiameter,'Diameter'],[x.finiteEndTime,'End time']])positive(v,label);
 requireValue(x.finiteEndTime<=100,'Set the simulation end time to 100 ms or less.');
 requireValue(Number.isInteger(x.finiteCells)&&x.finiteCells>=160&&x.finiteCells<=1200,'Use an integer grid size from 160 to 1200 cells.');
 const left=-x.finiteDriverLength,right=x.finiteDrivenLength,end=x.finiteEndTime/1000,sample=x.finiteSampleX;
 requireValue(Number.isFinite(sample)&&sample>=0&&sample<=right,'Put the sample between the diaphragm and the driven wall.');
 const reflected=wallReflection(incident,gamma,R);
 const wallTime=right/incident.shockSpeed, driverWallTime=left/incident.head;
 const contactTime=(right+reflected.speed*wallTime)/(incident.u+reflected.speed);
 const shockSample=sample/incident.shockSpeed,contactSample=sample/incident.u;
 const sampleValid=contactSample<=contactTime&&contactSample<=driverWallTime;
 const domain=simulate(x,left,right,end,gamma,R);
 const trajectory=(name,t0,x0,speed,stop,color,dash)=>{
  const last=Math.min(end,stop);
  return {name,color,legendColor:color==='#fff'?'#627586':color,dash,hideLegend:last<t0,points:last>=t0?[[x0,t0*1000],[x0+(last-t0)*speed,last*1000]]:[]};
 };
 const referenceEnd=Math.min(contactTime,driverWallTime);
 const chart={title:'Wave reflections · pressure in the x–t plane',xlabel:'Position from diaphragm x (m)',ylabel:'Time t (ms)',
  series:[
   {name:'Domain',hideLegend:true,points:[[left,0],[right,end*1000]],width:0},
   trajectory('Incident shock',0,0,incident.shockSpeed,Math.min(wallTime,driverWallTime),'#fff'),
   trajectory('Contact surface',0,0,incident.u,referenceEnd,'#fff','8 4'),
   trajectory('Reflected shock',wallTime,right,-reflected.speed,referenceEnd,'#fff'),
   trajectory('Expansion head',0,0,incident.head,referenceEnd,'#fff','1 4'),
   trajectory('Expansion tail',0,0,incident.tail,referenceEnd,'#fff','6 3 1 3'),
   ...(sample>0?[trajectory('Sample position',0,sample,0,end,'#ffd06b','4 3')]:[])
  ]};
 const rows=[
  ['Incident shock speed',incident.shockSpeed,'m/s'],['Incident pressure ratio',incident.p2p1,'p₂/p₁'],
  ['Incident temperature ratio',incident.T2/x.T1,'T₂/T₁'],
  ['Incident density ratio',incident.rho2/(x.p1*1000/(R*x.T1)),'ρ₂/ρ₁'],
  ['Contact surface speed',incident.u,'m/s'],['Mach behind incident shock · laboratory',incident.u/Math.sqrt(gamma*R*incident.T2)],
  ['Reflected shock speed · upstream',reflected.speed,'m/s'],['Reflected shock Mach · relative to zone 2',reflected.mach],
  ['Reflected pressure ratio',reflected.pressureRatio,'p₅/p₂'],['Pressure behind reflected shock',reflected.p/1000,'kPa'],
  ['Temperature behind reflected shock',reflected.T,'K'],['Expansion pressure ratio',incident.p/(x.p4*1000),'p₃/p₄'],
  ['Expansion temperature ratio',incident.T3/x.T4,'T₃/T₄'],
  ['Expansion density ratio',incident.rho3/(x.p4*1000/(R*x.T4)),'ρ₃/ρ₄'],
  ['Incident shock reaches driven wall · estimate',wallTime*1000,'ms'],['Expansion head reaches driver wall',driverWallTime*1000,'ms'],
  ['Reflected shock meets contact · first-wave estimate',contactTime*1000,'ms'],
  ...(sampleValid&&sample>0?[
   ['Incident shock reaches sample',shockSample*1000,'ms'],['Contact reaches sample',contactSample*1000,'ms'],
   ['Time between shock and contact at sample',(contactSample-shockSample)*1000,'ms']
  ]:[]),
  ['Initial gas mass',domain.massPerArea*Math.PI*x.finiteDiameter**2/4,'kg'],
  ['Simulated time',end*1000,'ms'],['Numerical time steps',domain.steps]
 ];
 const h02=(cp*incident.T2+.5*incident.u**2)/1000;
 const h01=cp*x.T1/1000,h05=cp*reflected.T/1000;
 rows.push(
  ['Incident shock · h₀ ahead',h01,'kJ/kg'],['Incident shock · h₀ behind',h02,'kJ/kg'],
  ['Incident shock · Δh₀',h02-h01,'kJ/kg'],
  ['First reflected shock · h₀ ahead',h02,'kJ/kg'],['First reflected shock · h₀ behind',h05,'kJ/kg'],
  ['First reflected shock · Δh₀',h05-h02,'kJ/kg']
 );
 return {inputs:x,result:{status:'ok',finiteTube:true,left,right,end,gamma,R,cp,incident,reflected,
  sample,sampleValid,wallTime,driverWallTime,contactTime,chart,...domain},rows};
}

export function solveClosedPiston(x){
 const free=solvePistonShocks(x),{gamma,R,cp}=free;
 const length=x.pistonTubeLength;
 positive(length,'Initial piston tube length');positive(x.finiteEndTime,'End time');
 requireValue(x.finiteEndTime<=10000,'Set the piston simulation end time to 10000 ms or less.');
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
 if(firstHit<=isolatedEnd)rows.splice(1,0,['First shock reaches fixed wall · analytical',firstHit*1000,'ms']);
 const h0=s=>(cp*s.T+.5*s.u*s.u)/1000;
 for(const [name,shock] of [['First launch shock',free.first],...(isolatedEnd>motion.delay?[['Second launch shock',free.second]]:[])]){
  rows.push([`${name} · h₀ ahead`,h0(shock.before),'kJ/kg'],[`${name} · h₀ behind`,h0(shock.after),'kJ/kg'],
   [`${name} · Δh₀`,h0(shock.after)-h0(shock.before),'kJ/kg']);
 }
 return {inputs:x,result:{status:'ok',finiteTube:true,movingPiston:true,left:0,right:length,end,gamma,R,cp,chart,
  motion,stoppedAtGap:end===gapLimit,...domain},rows};
}

export function finiteTubeFrame(r,time){
 return r.frames[Math.round(Math.max(0,Math.min(1,time/r.end))*(r.frames.length-1))];
}

const fieldScales=new WeakMap();
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

export function finiteTubeDrawing(r,time){
 const frame=finiteTubeFrame(r,time),{normalize}=finiteTubeScale(r.frames,'pressure');
 const X=x=>40+(x-r.left)/(r.right-r.left)*560;
 const stops=frame.pressure.map((p,i)=>`<stop offset="${(i+.5)/frame.pressure.length}" stop-color="rgb(${contourColor(normalize(p)).join(',')})"/>`).join('');
 const gasX=r.movingPiston?X(frame.left):40;
 const cells=`<defs><linearGradient id="finitePressure">${stops}</linearGradient></defs><rect x="${gasX}" y="92" width="${600-gasX}" height="105" fill="url(#finitePressure)"/>`;
 return {label:'Numerical pressure field',meta:'Closed walls',svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 250" role="img" aria-label="Pressure distribution in the closed shock tube">
 <text x="320" y="35" text-anchor="middle">Pressure field · t = ${(frame.time*1000).toFixed(2)} ms</text>
 ${cells}<path d="M40 92H600V197H40Z" fill="none" stroke="#20394a" stroke-width="3"/>
 ${r.movingPiston?`<path d="M${gasX} 88V202" stroke="#20394a" stroke-width="5"/>`:`<path d="M${X(0)} 92V197" stroke="#fff" stroke-dasharray="5 4"/>`}
 ${r.sample>0?`<path d="M${X(r.sample)} 195V209" stroke="#b36536" stroke-width="3"/><text x="${X(r.sample)}" y="226" text-anchor="middle" fill="#7f4728">Sample</text>`:''}
 <text x="${gasX}" y="226" text-anchor="${gasX>420?'end':'start'}">${r.movingPiston?'Piston':'Driver wall'}</text><text x="600" y="226" text-anchor="end">${r.movingPiston?'Fixed wall':'Driven wall'}</text>
 </svg>`};
}
