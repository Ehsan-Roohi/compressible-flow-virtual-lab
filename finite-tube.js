import {contourColor} from './contour-raster.js';
import {gas, positive, requireValue} from './numerics.js';
import {normalShock} from './physics.js';
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

function wallReflection(incident,gamma,R){
 const a2=Math.sqrt(gamma*R*incident.T2);
 const q=(gamma+1)*incident.u/(4*a2);
 const mach=q+Math.hypot(1,q),jump=normalShock(mach,gamma);
 return {mach,speed:mach*a2-incident.u,p:incident.p*jump.p,T:incident.T2*jump.T,pressureRatio:jump.p};
}

// Conservative Godunov update with an HLLC interface flux. A mirrored
// velocity in each wall ghost state enforces zero normal mass/energy flux.
function simulate(x,left,right,end,gamma,R){
 const n=x.finiteCells, dx=(right-left)/n, size=3*n, gm=gamma-1;
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
   let maxSpeed=0;
   for(let i=0;i<n;i++){
    rho[i]=U[3*i];u[i]=U[3*i+1]/rho[i];p[i]=gm*(U[3*i+2]-.5*rho[i]*u[i]**2);
    a[i]=Math.sqrt(gamma*p[i]/rho[i]);
    maxSpeed=Math.max(maxSpeed,Math.abs(u[i])+a[i]);
   }
   for(let j=0;j<=n;j++){
    const l=Math.max(0,j-1), r=Math.min(n-1,j), k=3*j;
    const dL=rho[l],dR=rho[r],vL=j===0?-u[l]:u[l],vR=j===n?-u[r]:u[r];
    const pL=p[l],pR=p[r],eL=U[3*l+2],eR=U[3*r+2];
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
    if(j===0||j===n){flux[k]=0;flux[k+2]=0;}
   }
   let dt=Math.min(.45*dx/maxSpeed,target-t),valid=false;
   for(let attempt=0;attempt<12;attempt++){
    const scale=dt/dx;
    for(let i=0;i<size;i++)next[i]=U[i]-scale*(flux[i+3]-flux[i]);
    valid=true;
    for(let i=0;i<size;i+=3){
     if(!(next[i]>0&&next[i+2]>.5*next[i+1]**2/next[i]&&Number.isFinite(next[i+2]))){valid=false;break;}
    }
    if(valid)break;
    dt/=2;
   }
   requireValue(valid&&dt>0,'Numerical step could not preserve a physical gas state.');
   t=dt===target-t?target:t+dt;
   [U,next]=[next,U];
  }
  const pressure=[],density=[],velocity=[];
  for(let i=0;i<size;i+=3){
   const d=U[i],v=U[i+1]/d;
   density.push(d);velocity.push(v);pressure.push(gm*(U[i+2]-.5*d*v*v));
  }
  frames.push({time:target,pressure,density,velocity});
 }
 const final=totals(U);
 return {frames,centers,steps,massPerArea:initial.mass,checks:{mass:Math.abs(final.mass/initial.mass-1),energy:Math.abs(final.energy/initial.energy-1)}};
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
   trajectory('Contact surface',0,0,incident.u,referenceEnd,'#fff','5 3'),
   trajectory('Reflected shock',wallTime,right,-reflected.speed,referenceEnd,'#fff'),
   trajectory('Expansion head',0,0,incident.head,referenceEnd,'#fff','2 4'),
   trajectory('Expansion tail',0,0,incident.tail,referenceEnd,'#fff','2 4'),
   ...(sample>0?[trajectory('Sample',0,sample,0,end,'#ffd06b','3 4')]:[])
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
 const cells=`<defs><linearGradient id="finitePressure">${stops}</linearGradient></defs><rect x="40" y="92" width="560" height="105" fill="url(#finitePressure)"/>`;
 return {label:'Numerical pressure field',meta:'Closed walls',svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 250" role="img" aria-label="Pressure distribution in the closed shock tube">
 <text x="320" y="35" text-anchor="middle">Pressure field · t = ${(frame.time*1000).toFixed(2)} ms</text>
 ${cells}<path d="M40 92H600V197H40Z" fill="none" stroke="#20394a" stroke-width="3"/>
 <path d="M${X(0)} 92V197" stroke="#fff" stroke-dasharray="5 4"/>
 ${r.sample>0?`<path d="M${X(r.sample)} 195V209" stroke="#b36536" stroke-width="3"/><text x="${X(r.sample)}" y="226" text-anchor="middle" fill="#7f4728">Sample</text>`:''}
 <text x="40" y="226">Driver wall</text><text x="600" y="226" text-anchor="end">Driven wall</text>
 </svg>`};
}
