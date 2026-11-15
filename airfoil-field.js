import {state,prandtlMeyer} from './physics.js';
import {airfoilRegionLabel,isFlatPlate} from './airfoil-region-labels.js?v=20261115-plate-regions';
const cache=new WeakMap();
export const airfoilFieldProperties={cp:{label:'Pressure coefficient Cp',units:'Cp',read:(z,s)=>(z.p-s.freestream.p)/s.q},pressure:{label:'Static pressure',units:'kPa',read:z=>z.p/1000},mach:{label:'Mach number',units:'M',read:z=>z.M},temperature:{label:'Static temperature',units:'K',read:z=>z.T},density:{label:'Density',units:'kg/m³',read:z=>z.rho},speed:{label:'Flow speed',units:'m/s',read:z=>z.u}};
const ordinate=(points,x)=>{let i=0;while(i<points.length-2&&points[i+1].x<x)i++;const a=points[i],b=points[i+1];return a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);};
export function airfoilFieldSampler(s){
 if(!s.models.includes('nonlinear')||s.nonlinear.status!=='ok')return null;
 if(cache.has(s))return cache.get(s);
 const schematic=s.airfoilFieldMode==='Schematic · independent waves';
 const g=s.gamma??1+2*(s.freestream.T0/s.freestream.T-1)/s.freestream.M**2,R=s.R??s.freestream.a**2/(g*s.freestream.T),k=(g-1)/2;
 const prepare=w=>{const sign=w.side==='Upper'?1:-1;let fan=null;if(w.kind==='Expansion fan')fan=Array.from({length:65},(_,i)=>{const M=w.before.M+(w.after.M-w.before.M)*i/64,turn=prandtlMeyer(M,g)-prandtlMeyer(w.before.M,g),theta=w.before.theta-sign*turn;return {M,angle:sign*theta+Math.asin(1/M)};});return {w,sign,fan};};
 const waves=[...s.nonlinear.waves,...(s.trailingEdge?.status==='ok'?s.trailingEdge.waves:[])],sides={Upper:waves.filter(w=>w.side==='Upper').map(prepare),Lower:waves.filter(w=>w.side==='Lower').map(prepare)};
 const sample=(x,y)=>{
  if(x<0)return {...s.freestream,region:s.geometry.diamond||isFlatPlate(s)?'1':'∞'};
  let side;
  if(x<=1){const up=ordinate(s.geometry.upper,x),lo=ordinate(s.geometry.lower,x);if(y<up-1e-10&&y>lo+1e-10)return null;side=y>=up?'Upper':'Lower';}
  else{if(s.trailingEdge?.status!=='ok')return null;side=y>=Math.tan(s.trailingEdge.phi)*(x-1)?'Upper':'Lower';}
  let z=s.freestream,region=s.geometry.diamond||isFlatPlate(s)?'1':'∞',ready=true,approximate=false,independentFan=null;
  for(const {w,sign,fan}of sides[side]){
   if(x<w.origin.x-1e-10||w.kind==='No wave')continue;
   const angle=sign*Math.atan2(y-w.origin.y,x-w.origin.x);
   const head=fan?fan[0].angle:sign*w.before.theta+w.beta;
   if(angle>head+1e-10){ready=false;continue;}
   // The schematic continues each precomputed wave independently; it does not solve their interaction.
   if(!ready){if(!schematic)return null;approximate=true;}
   const id=w.id.startsWith('TE-')?w.id+'+':w.id;
   if(!fan||angle<=fan.at(-1).angle){z=w.after;region=airfoilRegionLabel(s,id);continue;}
   let i=0;while(i<fan.length-2&&fan[i+1].angle>angle)i++;
   const a=fan[i],b=fan[i+1],t=(a.angle-angle)/(a.angle-b.angle),M=a.M+t*(b.M-a.M),tr=(1+k*w.before.M*w.before.M)/(1+k*M*M),theta=w.before.theta-sign*(prandtlMeyer(M,g)-prandtlMeyer(w.before.M,g));
   z={...state(M,w.before.T*tr,w.before.p*tr**(g/(g-1)),g,R),theta};region='Expansion fan';ready=false;
   independentFan={...z,region,fanProgress:(M-w.before.M)/(w.after.M-w.before.M)};
  }
  // Schematic overlap rule: the latest active expansion fan remains visible.
  if(schematic&&independentFan)return {...independentFan,approximate,schematic};
  return {...z,region,approximate,schematic};
 };
 const result={sample};cache.set(s,result);return result;
}
export function airfoilContour(s,quantity='pressure'){
 const sampler=airfoilFieldSampler(s);if(!sampler)return null;
 const key=quantity in airfoilFieldProperties?quantity:'pressure',property=airfoilFieldProperties[key],cells=[];let min=Infinity,max=-Infinity;
 for(let py=46;py<234;py+=4)for(let px=20;px<620;px+=4){const z=sampler.sample((px+2-84)/350,(150-py-2)/350);if(!z)continue;const value=property.read(z,s);if(!Number.isFinite(value))continue;min=Math.min(min,value);max=Math.max(max,value);cells.push({px,py,value,...(z.schematic&&Number.isFinite(z.fanProgress)?{fanColor:1-z.fanProgress}:{})});}
 return {key,property,cells,min,max};
}
export function probeAirfoilField(s,px,py){if(px<20||px>620||py<46||py>234)return null;return airfoilFieldSampler(s)?.sample((px-84)/350,(150-py)/350)??null;}
