import {expansion,deg} from './physics.js';
import {clipPolygon} from './wave-interaction.js';
import {regionLabelPosition} from './region-labels.js';
export const wedgeGeometry=w=>({x:165,y:150,length:640-165});
export function wedgeDrawing(s,{txt,line,poly,fmt,quantity='pressure',inputs={},color,range,arrow,incidence}){
 const w=s.wedge,options=['mach','pressure','temperature','density'],key=options.includes(quantity)?quantity:'pressure',value=z=>key==='mach'?z.M:key==='temperature'?z.T:key==='density'?z.rho:z.p,inlet={M:w.M,p:1,T:1,rho:1},values=[value(inlet),...w.faces.filter(f=>f.surface).map(f=>value(f.surface))],min=range?.min??Math.min(...values),max=range?.max??Math.max(...values),fill=z=>color((value(z)-min)/(max-min||1)),x=165,y=150,L=wedgeGeometry(w).length,at=a=>[x+L,y-L*Math.tan(a)];
 let inner='<defs><clipPath id="wedge-field"><rect x="0" y="32" width="640" height="234"/></clipPath></defs><g clip-path="url(#wedge-field)">'+poly([[0,32],[640,32],[640,266],[0,266]],fill(inlet));
 for(const f of w.faces){
  const mach=f.sign>0?'M₂':'M₃';
  if(!f.surface){
   const edge=f.sign>0?32:266;
   inner+=poly([[x,y],[640,y],[640,edge],[x,edge]],'#edf0f2');
   inner+=txt(390,f.sign>0?68:250,`${mach} = —`,undefined,14,'middle');
   continue;
  }
  const wall=at(f.wall);let waveAngle=w.alpha+f.sign*(f.beta??Math.asin(1/w.M));
  if(f.kind==='Expansion fan'){
   const N=32;for(let j=0;j<N;j++){const t=j/N,u=(j+1)/N,z=expansion(w.M,Math.abs(f.turn)*t,w.gamma),q=expansion(w.M,Math.abs(f.turn)*u,w.gamma),a=w.alpha+f.turn*t+f.sign*Math.asin(1/z.M2),b=w.alpha+f.turn*u+f.sign*Math.asin(1/q.M2);inner+=poly([[x,y],at(a),at(b)],fill({M:z.M2,p:z.p,T:z.T,rho:z.rho}));if(j%5===0)inner+=line(x,y,...at(a),'#345c7c',.55);waveAngle=b;}
  }
  const region=[[x,y],wall,at(waveAngle)];
  inner+=poly(region,fill(f.surface));
  if(f.kind==='Oblique shock')inner+=line(x,y,...at(waveAngle),'#000',2);
  inner+=arrow(x+L*.55,y-f.sign*(L*.55*Math.tan(w.theta)+18),45,f.wall);
  const visibleRegion=clipPolygon(clipPolygon(region,([,py])=>py-32),([,py])=>266-py);
  const [labelX,labelY]=regionLabelPosition([visibleRegion])?.point??[560,f.sign>0?65:239];
  inner+=txt(labelX,labelY+5,`${mach} = ${fmt(f.surface.M,4)}`,undefined,14,'middle');
 }
 inner+=poly([[x,y],at(w.theta),at(-w.theta)],'#d7d9d5','#283943',1.7)+txt(340,147,`θ = ${fmt(deg(w.theta))}°`,undefined,14);
 const inletX=32;
 inner+='<g data-wedge-freestream="true">'+txt(inletX,68,`M∞ = ${fmt(w.M,5)}`,undefined,14)
  +txt(inletX,87,`p∞ = ${fmt(inputs.p1??101,5)} kPa`,undefined,14)
  +txt(inletX,106,`T∞ = ${fmt(inputs.T1??300,5)} K`,undefined,14)
  +incidence(inletX,153,w.alpha,76)+'</g></g>';
 return {inner,label:'Wedge · upper and lower surface states',meta:'α is signed inlet-flow direction relative to the horizontal body axis · black: shocks',field:{quantity:key,options,min,max,label:{mach:'Mach number M',pressure:'Static pressure',temperature:'Static temperature',density:'Density'}[key],units:{mach:'M',pressure:'p/p∞',temperature:'T/T∞',density:'ρ/ρ∞'}[key],note:'Ratios reference the common freestream'}};
}
