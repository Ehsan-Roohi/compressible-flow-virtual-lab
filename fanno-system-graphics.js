import {ductProperties,ductPalette} from './duct-contours.js?v=20261113-rainbow-physical';
const fmt=v=>Number(v.toPrecision(5)).toString();
function tint(t){const a=Math.max(0,Math.min(1,t))*(ductPalette.length-1),i=Math.min(ductPalette.length-2,Math.floor(a)),f=a-i,rgb=h=>h.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)),p=rgb(ductPalette[i]),q=rgb(ductPalette[i+1]);return '#'+p.map((v,k)=>Math.round(v+(q[k]-v)*f).toString(16).padStart(2,'0')).join('');}
export function fannoSystemDrawing(s,inputs,quantity='pressure'){
 const r=s.system,g=r.geometry,key=quantity in ductProperties?quantity:'pressure',prop=ductProperties[key],samples=r.fullProfile,values=samples.map(z=>prop.get(z.state)),min=Math.min(...values),max=Math.max(...values),X=x=>135+610*x/g.totalLength,cy=126,areaMax=Math.max(g.area,g.area*g.contraction/g.areaRatio),H=a=>64*Math.sqrt(a/areaMax),half=H(g.area),join=X(g.ductStart),throat=X(g.throat),end=X(g.totalLength);
 const text=(x,y,t,anchor='start',size=16)=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="#17383b">${t}</text>`;
 const outletX=end-66,inletX=Math.min(join+66,outletX-132);
 const shockX=r.shockX===null?null:X(r.shockX);
 const inline=half>=45&&end-join>=270
  &&(shockX===null||[inletX,outletX].every(x=>Math.abs(x-shockX)>65));
 const stationY=inline?cy+16:cy+half+22;
 const labelY=inline?210:Math.max(195,stationY+33);
 const height=labelY+29;
 const stops=samples.map((z,i)=>`<stop offset="${100*z.x}%" stop-color="${tint(max-min<1e-12?.5:(values[i]-min)/(max-min))}"/>`).join('');
 const wall=samples.filter((z,i,a)=>!i||z.position!==a[i-1].position).map(z=>[X(z.position),H(z.area)]),top=wall.map(([x,h])=>`${x} ${cy-h}`).join('L'),bottom=[...wall].reverse().map(([x,h])=>`${x} ${cy+h}`).join('L');
 let body=`<defs><linearGradient id="fannoSystemContour" gradientUnits="userSpaceOnUse" x1="135" x2="745">${stops}</linearGradient></defs><rect width="800" height="${height}" fill="#f8fbf8"/><path d="M20 52H90L135 ${cy-H(samples[0].area)}V${cy+H(samples[0].area)}L90 200H20Z" fill="#e4edeb"/><path d="M135 ${cy-H(samples[0].area)}L90 52H20V200H90L135 ${cy+H(samples[0].area)}" fill="none" stroke="#41555b" stroke-width="3"/><path data-fanno-system="true" d="M${top}L${bottom}Z" fill="url(#fannoSystemContour)"/><path d="M${top}M${wall.map(([x,h])=>`${x} ${cy+h}`).join('L')}" fill="none" stroke="#41555b" stroke-width="3"/>`;
 body+=text(70,43,'Reservoir','middle',14)
  +text(70,119,'M = 0','middle')
  +text(70,143,`p₀ = ${fmt(r.reservoir.p/1000)} kPa`,'middle');
 const data=(x,mach,pressure)=>`<rect x="${x-62}" y="${stationY-15}" width="124" height="39" rx="4" fill="#fff" fill-opacity=".94"/>`
  +text(x,stationY,mach,'middle')+text(x,stationY+17,pressure,'middle');
 body+=text(Math.max(198,(135+join)/2),48,'C–D nozzle','middle',14)
  +text(Math.max(600,(join+end)/2),48,'Fanno duct','middle',14)
  +text(435,21,r.regime,'middle',14);
 body+=`<path d="M${join} ${cy-half-6}V${cy+half+6}" stroke="#83999a" stroke-dasharray="4 4"/>`;
 if(shockX!==null){
  const at=samples.find(z=>Math.abs(z.position-r.shockX)<1e-8),h=H(at.area);
  body+=`<path data-system-shock="${r.shockPart}" d="M${shockX} ${cy-h}V${cy+h}" stroke="#111" stroke-width="3"/>`;
 }
 body+=`<path d="M${throat} ${cy-13}V${cy+13}" stroke="#4d827a" stroke-width="1" stroke-dasharray="3 3"/>`;
 if(r.massFlow>1e-12)for(const t of [.08,.3,.6,.87]){
  const xx=X(t*g.totalLength);
  body+=`<path d="M${xx-12} ${cy}h24l-6 -4m6 4l-6 4" fill="none" stroke="#40575d" stroke-width="1.5"/>`;
 }
 body+=data(inletX,`M = ${fmt(r.s1.M)}`,`p = ${fmt(r.s1.p/1000)} kPa`)
  +data(outletX,`M = ${fmt(r.s2.M)}`,`pᵦ = ${fmt(r.backPressure/1000)} kPa`);
 body+=text(inletX,labelY,'Duct inlet','middle',14)+text(outletX,labelY,'Duct exit','middle',14);
 body+=text(inletX,labelY+18,`x = ${fmt(g.ductStart)} m`,'middle')+text(outletX,labelY+18,`x = ${fmt(g.totalLength)} m`,'middle');
 body+=text(135,labelY,'Nozzle inlet','start',14)+text(135,labelY+18,'x = 0 m');
 if(throat>=220&&throat<=inletX-70)body+=text(throat,labelY,'Throat','middle',14);
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" data-fanno-contour="true" viewBox="0 0 800 ${height}" role="img" aria-label="Reservoir, converging-diverging nozzle and Fanno duct: ${r.regime}"><title>${r.regime}</title>${body}</svg>`,label:prop.label+' along nozzle and Fanno duct',meta:r.regime,field:{quantity:key,options:Object.keys(ductProperties),label:prop.label,units:prop.units,min,max,palette:ductPalette,note:'Isentropic nozzle · Fanno duct · normal-shock jumps'}};
}
