import {coneGeometry} from './cone-probe.js?v=20261110-cone-conditions';
import {deg} from './physics.js';
// Geometry reserves an inlet lane and a white annotation lane to its right.
export function coneAnnotationLayout(s){
 const g=coneGeometry(s),right=g.x+g.length,shockY=g.y-g.length*Math.tan(s.beta),wallY=g.y-g.length*Math.tan(s.thetaCone),lowerY=g.y+g.length*Math.tan(s.thetaCone),betaY=Math.max(34,shockY+4),thetaY=Math.max(wallY+4,betaY+28),surfaceY=Math.min(220,Math.max(185,lowerY+24));
 return {...g,right,labelX:right+24,betaY,thetaY,surfaceY,shockY,wallY,lowerY};
}
function conePostShockArrow(s,z,{directedArrow,fmt}){
 const post=s.history[0];
 const delta=post.theta+Math.atan2(post.vt,post.vr);
 const dx=z.length*.55;
 const shockY=z.y-dx*Math.tan(s.beta);
 const wallY=z.y-dx*Math.tan(s.thetaCone);
 const y=shockY+.3*(wallY-shockY);
 const closingRate=Math.tan(s.thetaCone)*Math.cos(delta)-Math.sin(delta);
 const wallLimit=closingRate>0?.8*(wallY-y)/closingRate:Infinity;
 const length=Math.min(25,.4*z.length/Math.cos(delta),wallLimit);
 return `<g data-cone-annotation="flow-deflection"><title>Flow direction immediately after the shock: δ = ${fmt(deg(delta),4)}°</title>${directedArrow(z.x+dx,y,length,delta,'#17212b')}</g>`;
}
export function coneAnnotations(s,inputs,{txt,line,directedArrow,fmt}){
 const z=coneAnnotationLayout(s),T=inputs.T1??300,p=inputs.p1??101,M=inputs.M??s.freestream?.M;
 const callout=(name,text,y,anchorY)=>`<g data-cone-annotation="${name}" data-label-x="${z.labelX}" data-label-y="${y}">${line(z.right,anchorY,z.labelX-8,y-4,'#82909a',.8)}${txt(z.labelX,y,text,'#17212b',14)}</g>`;
 let out='<g data-cone-freestream="true">'+txt(18,42,'Freestream','#40576a',12)+txt(18,64,`M∞ = ${fmt(M,5)}`,undefined,14)+txt(18,86,`p∞ = ${fmt(p,5)} kPa`,undefined,14)+txt(18,108,`T∞ = ${fmt(T,5)} K`,undefined,14)+'</g>';
 out+=callout('shock-angle',`β = ${fmt(deg(s.beta),5)}°`,z.betaY,z.shockY)+callout('cone-angle',`θc = ${fmt(deg(s.thetaCone),5)}°`,z.thetaY,z.wallY);
 out+=callout('surface-Mach',`M꜀ = ${fmt(s.surface.M,5)}`,z.surfaceY,z.lowerY);
 out+=`<g data-cone-annotation="surface-pressure" data-label-x="${z.labelX}" data-label-y="${z.surfaceY+22}">${txt(z.labelX,z.surfaceY+22,`p꜀ = ${fmt(s.surface.p*p,5)} kPa`,'#17212b',14)}</g>`;
 out+=`<g data-cone-annotation="surface-temperature" data-label-x="${z.labelX}" data-label-y="${z.surfaceY+44}">${txt(z.labelX,z.surfaceY+44,`T꜀ = ${fmt(s.surface.T*T,5)} K`,'#17212b',14)}</g>`;
 return out+conePostShockArrow(s,z,{directedArrow,fmt});
}
