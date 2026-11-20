import {rad} from './physics.js';
import {wallGeometry} from './wave-wall.js';
import {ramjetMode,ramjetOrientations} from './ramjet-inlet.js';
import {shockFanMode} from './shock-fan-example.js';

export function hasWallMethodChoice(x){
 if(x.customInteraction)return false;
 if(x.wallShape==='Compression ramp')return x.branch!=='strong';
 if(['Expansion corner',shockFanMode,ramjetMode].includes(x.wallShape))return true;
 if(x.wallShape!=='Custom wall')return false;
 if(x.boundaryMode==='Channel')return true;
 const segments=x.wallSegments??[];
 const sign=x.wallSide==='Gas below wall'?-1:1;
 const turns=segments.map((s,i)=>sign*(s.angle-(segments[i-1]?.angle??0))).filter(d=>Math.abs(d)>1e-8);
 return turns.length<=1||turns.every(d=>d<0)||(sign===1&&turns.length===2&&turns.every(d=>d>0));
}

export function wallMethodDomain(x,reference){
 const segment=(angle,length)=>({angle,length});
 const forReach=(angle,reach)=>segment(angle,reach/Math.cos(rad(angle)));
 const channel=(height,lower,upper)=>({...x,wallShape:'Custom wall',boundaryMode:'Channel',
  channelHeight:height,wallSegments:lower,upperWallSegments:upper});
 if(x.wallShape===shockFanMode){
  const config=channel(1,[forReach(x.fanShockAngle??10,1.35)],[forReach(x.fanExpansionAngle??10,1.35)]);
  return {config,note:'The spatial field uses illustrative walls starting at the same x, a 1 m inlet height and a 1.35 m view. The book’s uniform-stream pressure and slip angle are shown as analytical reference values.'};
 }
 if(x.wallShape===ramjetMode){
  const {geometry:{end}}=reference;
  const mirrored=x.ramjetOrientation===ramjetOrientations[1];
  const lower=mirrored?x.theta:0,upper=mirrored?0:-x.theta;
  const config=channel(x.channelHeight,[forReach(lower,end)],[forReach(upper,end)]);
  return {config,note:'The field includes the incident shock and its regular reflection, up to the same downstream station as the analytical view.'};
 }
 const above=x.wallSide!=='Gas below wall';
 const geometry=reference.simpleCorner?reference.geometry:wallGeometry(x);
 const wall=geometry.panels.map(p=>segment(p.theta*180/Math.PI,p.length));
 const reach=geometry.end;
 const waveAngles=reference.simpleCorner?[reference.beta??Math.asin(1/x.M1)]:
  reference.waves.flatMap(w=>w.rays??[]).map(ray=>typeof ray==='number'?ray:ray.angle);
 // Keep the far boundary clear of the first waves. It closes the marching
 // mesh and supplies the same undisturbed inflow as the single-wall setting.
 const maxSlope=Math.max(0,...waveAngles.map(angle=>Math.abs(Math.tan(angle))));
 const displacement=Math.max(...geometry.points.map(p=>Math.abs(p.y)));
 const height=Math.max(1,1.15*(Math.max(1,maxSlope)*reach+displacement));
 const far=[segment(0,reach)];
 return {config:channel(height,above?wall:far,above?far:wall),
  note:'The far horizontal edge bounds the characteristic mesh outside the incident waves. The displayed wall angles and lengths are unchanged.'};
}
