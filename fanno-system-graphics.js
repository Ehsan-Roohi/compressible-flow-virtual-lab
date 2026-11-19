import {ductProperties,ductPalette,ductStationText} from './duct-contours.js?v=20261119-fanno-station-alignment';
const fmt=v=>Number(v.toPrecision(5)).toString();
function tint(t){const a=Math.max(0,Math.min(1,t))*(ductPalette.length-1),i=Math.min(ductPalette.length-2,Math.floor(a)),f=a-i,rgb=h=>h.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)),p=rgb(ductPalette[i]),q=rgb(ductPalette[i+1]);return '#'+p.map((v,k)=>Math.round(v+(q[k]-v)*f).toString(16).padStart(2,'0')).join('');}
export function fannoSystemDrawing(s,inputs,quantity='pressure'){
 const r=s.system,g=r.geometry,key=quantity in ductProperties?quantity:'pressure',prop=ductProperties[key],samples=r.fullProfile,values=samples.map(z=>prop.get(z.state)),min=Math.min(...values),max=Math.max(...values),X=x=>135+610*x/g.totalLength,cy=126,areaMax=Math.max(g.area,g.area*g.contraction/g.areaRatio),H=a=>64*Math.sqrt(a/areaMax),half=H(g.area),join=X(g.ductStart),throat=X(g.throat),end=X(g.totalLength);
 const text=(x,y,t,anchor='start',size=16)=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="#17383b">${t}</text>`;
 const shockX=r.shockX===null?null:X(r.shockX);
 const ductWidth=end-join,wide=ductWidth>=275,roomInside=wide&&half>=41;
 const inletInline=roomInside&&(shockX===null||shockX<=join||shockX>join+137);
 const outletInline=roomInside&&(shockX===null||shockX<end-137);
 const outsideY=cy+Math.max(half,wide?0:64)+21;
 const stations=[
  {name:'Duct inlet',id:'inlet',at:join,position:g.ductStart,state:r.s1,index:'₁',anchor:wide?'start':'end',inline:inletInline,y:inletInline?cy+16:outsideY},
  {name:'Duct exit',id:'outlet',at:end,position:g.totalLength,state:r.s2,index:'₂',anchor:'end',inline:outletInline,y:outletInline?cy+16:outsideY+(ductWidth<132?44:0)}
 ];
 for(const station of stations)station.labelY=station.inline?cy+half+20:station.y+34;
 const height=Math.max(200,...stations.map(station=>station.labelY))+27;
 const color=v=>tint(max-min<1e-12?.5:(v-min)/(max-min));
 const stops=samples.map((z,i)=>`<stop offset="${100*z.x}%" stop-color="${color(values[i])}"/>`).join('');
 const wall=samples.filter((z,i,a)=>!i||z.position!==a[i-1].position).map(z=>[X(z.position),H(z.area)]),top=wall.map(([x,h])=>`${x} ${cy-h}`).join('L'),bottom=[...wall].reverse().map(([x,h])=>`${x} ${cy+h}`).join('L');
 let body=`<defs><linearGradient id="fannoSystemContour" gradientUnits="userSpaceOnUse" x1="135" x2="745">${stops}</linearGradient></defs><rect width="800" height="${height}" fill="#f8fbf8"/><path d="M20 52H90L135 ${cy-H(samples[0].area)}V${cy+H(samples[0].area)}L90 200H20Z" fill="#e4edeb"/><path d="M135 ${cy-H(samples[0].area)}L90 52H20V200H90L135 ${cy+H(samples[0].area)}" fill="none" stroke="#41555b" stroke-width="3"/><path data-fanno-system="true" d="M${top}L${bottom}Z" fill="url(#fannoSystemContour)"/><path d="M${top}M${wall.map(([x,h])=>`${x} ${cy+h}`).join('L')}" fill="none" stroke="#41555b" stroke-width="3"/>`;
 body+=text(70,43,'Reservoir','middle',14)
  +text(70,119,'M = 0','middle')
  +text(70,143,`p₀ = ${fmt(r.reservoir.p/1000)} kPa`,'middle');
 body+=text(Math.max(198,(135+join)/2),48,'C–D nozzle','middle',14)
  +text(Math.max(600,(join+end)/2),48,'Fanno duct','middle',14)
  +text(435,21,r.regime,'middle',14);
 for(const {id,at,inline,y,labelY}of stations){
  const markEnd=inline?labelY-15:y+20;
  body+=`<path data-fanno-station-line="${id}" d="M${at} ${cy-half}V${cy+half}" stroke="#637b80" stroke-dasharray="4 4"/><path d="M${at} ${cy+half}V${markEnd}" stroke="#637b80" stroke-width="1"/>`;
 }
 if(shockX!==null){
  const at=samples.find(z=>Math.abs(z.position-r.shockX)<1e-8),h=H(at.area);
  body+=`<path data-system-shock="${r.shockPart}" d="M${shockX} ${cy-h}V${cy+h}" stroke="#111" stroke-width="3"/>`;
 }
 body+=`<path d="M${throat} ${cy-13}V${cy+13}" stroke="#4d827a" stroke-width="1" stroke-dasharray="3 3"/>`;
 if(r.massFlow>1e-12)for(const t of [.08,.3,.6,.87]){
  const xx=X(t*g.totalLength);
  body+=`<path d="M${xx-12} ${cy}h24l-6 -4m6 4l-6 4" fill="none" stroke="#40575d" stroke-width="1.5"/>`;
 }
 for(const {name,at,position,state,index,anchor,inline,y,labelY}of stations){
  body+=ductStationText({x:at+(anchor==='start'?7:-7),y,state,index,anchor,background:inline?color(prop.get(state)):null});
  body+=text(at,labelY,name,anchor,14)+text(at,labelY+17,`x = ${fmt(position)} m`,anchor);
 }
 const nozzleLabelY=cy+half+20;
 body+=text(135,nozzleLabelY,'Nozzle inlet','start',14)+text(135,nozzleLabelY+17,'x = 0 m');
 if(throat>=245&&throat<=join-50)body+=text(throat,nozzleLabelY,'Throat','middle',14);
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" data-fanno-contour="true" viewBox="0 0 800 ${height}" role="img" aria-label="Reservoir, converging-diverging nozzle and Fanno duct: ${r.regime}"><title>${r.regime}</title>${body}</svg>`,label:prop.label+' along nozzle and Fanno duct',meta:r.regime,field:{quantity:key,options:Object.keys(ductProperties),label:prop.label,units:prop.units,min,max,palette:ductPalette,note:'Isentropic nozzle · Fanno duct · normal-shock jumps'}};
}
