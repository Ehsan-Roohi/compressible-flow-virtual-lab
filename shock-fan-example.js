import {regionLabelPosition,regionNumber} from './region-labels.js?v=20261120-region-numbers';
import {state,obliqueShock,expansion,rad,deg} from './physics.js';
import {centeredFanRays,clipPolygon,interactionPair} from './wave-interaction.js?v=20261120-shock-fan-contours';
import {cornerContourColor,cornerPalette} from './corner-graphics.js?v=20261120-compression-regions';
import {readableInk} from './scene-labels.js';
import {gasInfo} from './gas-properties.js';
import {requireValue} from './numerics.js';
export const shockFanMode='Shock–expansion interaction';
export const shockFanPreset={fluid:'Air',gamma:1.4,R:287,wallShape:shockFanMode,M1:1.95,p1:482.65,inletPressureType:'Stagnation pressure',T1:300,temperatureInput:'Static temperature',fanShockAngle:10,fanExpansionAngle:10,bookExample:'6–7'};
export function solveShockFan(x){
 const gas=gasInfo(x),g=gas.gamma,R=gas.R,M=x.M1,a=x.fanShockAngle??10,b=x.fanExpansionAngle??10;
 requireValue(a>0&&b>0&&a<=30&&b<=30,'Both wall angles must be greater than zero and at most 30°.');
 const s1={...state(M,x.T1,x.p1*1000,g,R),theta:0,gamma:g,R},n=obliqueShock(M,rad(a),g),f=expansion(M,rad(b),g);
 const after=(w,theta)=>({...state(w.M2,s1.T*w.T,s1.p*w.p,g,R),theta:rad(theta),gamma:g,R});
 const s2=after(n,a),s3=after(f,b);requireValue(s2.M>1&&s3.M>1,'Both post-wave streams must remain supersonic.');
 const context={lower:s2,upper:s3},value=theta=>{const q=interactionPair(context,theta);return {q,residual:Math.log(q.a.after.p/q.b.after.p)};};
 let previous,bracket;
 for(let i=0;i<=600;i++){const theta=rad(-40+i*100/600);try{const v=value(theta);if(previous&&previous.residual*v.residual<=0){bracket=[previous.theta,theta];break;}previous={theta,...v};}catch{previous=null;}}
 requireValue(bracket,'No regular pressure-matched supersonic solution exists for these wall angles.');
 let [lo,hi]=bracket;for(let i=0;i<65;i++){const mid=(lo+hi)/2;if(value(lo).residual*value(mid).residual<=0)hi=mid;else lo=mid;}
 const phi=(lo+hi)/2,{q,residual}=value(phi),regions={1:s1,2:s2,3:s3,4:q.a.after,5:q.b.after};
 const waves=[{kind:'Oblique shock',before:s1,after:s2,beta:n.beta,title:'Incident shock · 1 → 2'},{kind:'Expansion fan',before:s1,after:s3,title:'Incident expansion · 1 → 3'},{...q.a,title:'Outgoing wave · 2 → 4'},{...q.b,title:'Outgoing wave · 3 → 5'}];
 return {gas,result:{shockFan:true,status:'ok',s1,regions,waves,gamma:g,R,slipAngle:deg(phi),residual,shockAngle:deg(n.beta)},notice:'Shock–Expansion matches pressure and flow direction across the slip line. Solid black lines show shocks, fine rays show expansion fans, and the dashed line shows the slip line. The schematic combines the interaction into a single matching point.'};
}
function shockFanLayout(s,incidentFan,outgoing,schematic=false){
 const start=-.62,lowerCorner=[.45,0],upperCorner=[0,1];
 const lowerSlope=schematic ? .176 : Math.tan(s.regions[2].theta);
 const upperSlope=schematic ? .176 : Math.tan(s.regions[3].theta);
 const shockSlope=schematic ? .85 : Math.tan(rad(s.shockAngle));
 const slipSlope=schematic ? .365 : Math.tan(rad(s.slipAngle));
 const slopes=(rays,from,to)=>rays.map((ray,i)=>({
  m:schematic?from+(to-from)*i/Math.max(1,rays.length-1):Math.tan(ray.angle),state:ray.state
 })).sort((a,b)=>a.m-b.m);
 const fan=slopes(incidentFan,-.60,-.27);
 const bounds=(w,low,high,m)=>w.kind==='Expansion fan'?slopes(w.rays,low,high):slopes(w.rays,m,m);
 const lower=bounds(outgoing[0],-.55,-.19,-.38);
 const upper=bounds(outgoing[1],1.1,.67,.97);
 const bottom=x=>Math.max(0,x-lowerCorner[0])*lowerSlope,top=x=>1+Math.max(0,x)*upperSlope;
 const fanTail=fan.at(-1).m;
 const x=(1+lowerCorner[0]*shockSlope)/(shockSlope-fanTail),y=(x-lowerCorner[0])*shockSlope;
 if(![x,y,lowerSlope,upperSlope,shockSlope,slipSlope,...fan.map(r=>r.m),...lower.map(r=>r.m),...upper.map(r=>r.m)].every(Number.isFinite)
  ||x<=lowerCorner[0]+1e-6||y<=bottom(x)+1e-6||y>=top(x)-1e-6
  ||lower.at(-1).m>=slipSlope||upper[0].m<=slipSlope
  ||(!schematic&&[...incidentFan,...outgoing.flatMap(w=>w.rays)].some(ray=>Math.cos(ray.angle)<=0)))return null;
 const distances=[lower[0].m,upper.at(-1).m,slipSlope].flatMap(m=>[
  m<lowerSlope?(y-bottom(x))/(lowerSlope-m):Infinity,
  m>upperSlope?(top(x)-y)/(m-upperSlope):Infinity
 ]);
 const end=x+Math.min(1.8,.93*Math.min(...distances));
 return {start,end,x,y,lowerCorner,upperCorner,shockSlope,slipSlope,bottom,top,fan,lower,upper};
}

const offset=([x,y],m)=>([a,b])=>b-y-m*(a-x);
function between(poly,origin,lo,hi){
 const upper=offset(origin,hi);
 return clipPolygon(clipPolygon(poly,offset(origin,lo)),p=>-upper(p));
}

export function shockFanDrawing(s,quantity='pressure',bookExample='6–7'){
 const r=s.regions,options=['pressure','mach','temperature','density','speed'];
 const key=options.includes(quantity)?quantity:'pressure';
 const properties={pressure:['Static pressure','kPa',z=>z.p/1000],mach:['Mach number','M',z=>z.M],
  temperature:['Static temperature','K',z=>z.T],density:['Density','kg/m³',z=>z.rho],speed:['Flow speed','m/s',z=>z.u]};
 const [label,units,get]=properties[key],values=Object.values(r).map(get),min=Math.min(...values),max=Math.max(...values);
 const color=value=>cornerContourColor(max>min?(value-min)/(max-min):.5);
 const outgoing=s.waves.slice(2),incidentFan=centeredFanRays(r[1],r[3].theta-r[1].theta,-1);
 const geometry=shockFanLayout(s,incidentFan,outgoing)??shockFanLayout(s,incidentFan,outgoing,true);
 const {start,end,x,y,lowerCorner,upperCorner,shockSlope,slipSlope,bottom,top,fan,lower,upper}=geometry;
 const meet=[x,y],upstream=[[0,0],lowerCorner,[x,bottom(x)],[x,top(x)],upperCorner];
 const downstream=[[x,bottom(x)],[end,bottom(end)],[end,top(end)],[x,top(x)]];
 const left=[[start,0],[0,0],upperCorner,[start,1]];
 const shock=offset(lowerCorner,shockSlope),head=offset(upperCorner,fan[0].m),tail=offset(upperCorner,fan.at(-1).m);
 const above=clipPolygon(upstream,shock);
 const outgoingLower=offset(meet,lower[0].m),outgoingUpper=offset(meet,upper.at(-1).m);
 const regions=[
  [left,clipPolygon(above,p=>-head(p))],
  [clipPolygon(upstream,p=>-shock(p)),clipPolygon(downstream,p=>-outgoingLower(p))],
  [clipPolygon(above,tail),clipPolygon(downstream,outgoingUpper)],
  [between(downstream,meet,lower.at(-1).m,slipSlope)],
  [between(downstream,meet,slipSlope,upper[0].m)]
 ];
 const X=a=>35+(a-start)*570/(end-start),Y=b=>256-b*226/top(end);
 const screen=([a,b])=>[X(a),Y(b)];
 const point=p=>screen(p).map(v=>v.toFixed(3)).join(',');
 const densityCells=[];
 function fill(poly,value,extra=''){
  if(poly.length<3)return '';
  if(key==='density')densityCells.push({points:poly.map(screen),rho:value});
  const shade=color(value);
  return `<polygon points="${poly.map(point).join(' ')}" fill="${shade}" ${extra}/>`;
 }
 function fanColors(poly,origin,rays){
  return rays.slice(1).map((ray,i)=>{
   const previous=rays[i],slope=(previous.m+ray.m)/2,valueA=get(previous.state),valueB=get(ray.state);
   return [[previous.m,slope,.25],[slope,ray.m,.75]].map(([a,b,t])=>{
    const value=valueA+(valueB-valueA)*t;
    return fill(between(poly,origin,a,b),value,`stroke="${color(value)}" stroke-width=".35"`);
   }).join('');
  }).join('');
 }
 const line=(p,q,stroke)=>`<polyline points="${point(p)} ${point(q)}" fill="none" ${stroke}/>`;
 const solid='stroke="#111" stroke-width="2"';
 const rays='stroke="#fff" stroke-width=".75" stroke-opacity=".68"';
 const at=(origin,m,station)=>[station,origin[1]+m*(station-origin[0])];
 function drawWave(pair,w,origin,group,endPoint){
  let lines='';
  if(w.kind==='Oblique shock')lines=line(origin,endPoint(group[0].m),solid);
  if(w.kind==='Expansion fan')lines=group.filter((_,i)=>i%4===0||i===group.length-1).map(ray=>line(origin,endPoint(ray.m),rays)).join('');
  return `<g data-shock-fan-wave="${pair}" data-wave-kind="${w.kind}"><title>${w.title}</title>${lines}</g>`;
 }
 const crossShock=m=>at(upperCorner,m,(1+lowerCorner[0]*shockSlope)/(shockSlope-m));
 const book=bookExample.endsWith('8')?8:7;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 300" role="img" aria-label="Shock and expansion interaction, Example ${book}"><title>Example ${book} · shock–expansion matching</title>`;
 const wallTop=[[start,1],upperCorner,[end,top(end)]],wallBottom=[[start,0],lowerCorner,[end,bottom(end)]];
 const wall=(points,edge)=>`<polygon points="35,${edge} ${points.map(point).join(' ')} 605,${edge}" fill="#b1b7bc"/>`;
 svg+=wall(wallTop,12)+wall(wallBottom,276);
 svg+=regions.map((polys,i)=>`<g data-shock-fan-region="${i+1}"><title>Region ${i+1} · ${label} ${get(r[i+1]).toPrecision(6)} ${units}</title>${polys.map(poly=>fill(poly,get(r[i+1]))).join('')}</g>`).join('');
 svg+=fanColors(above,upperCorner,fan);
 for(const [w,group]of [[outgoing[0],lower],[outgoing[1],upper]])if(w.kind==='Expansion fan')svg+=fanColors(downstream,meet,group);
 for(const points of [wallTop,wallBottom])svg+=`<polyline points="${points.map(point).join(' ')}" fill="none" ${solid}/>`;
 svg+=drawWave('1-2',s.waves[0],lowerCorner,[{m:shockSlope}],()=>meet);
 svg+=drawWave('1-3',s.waves[1],upperCorner,fan,crossShock);
 svg+=drawWave('2-4',outgoing[0],meet,lower,m=>at(meet,m,end));
 svg+=drawWave('3-5',outgoing[1],meet,upper,m=>at(meet,m,end));
 svg+=line(meet,at(meet,slipSlope,end),'stroke="#17212b" stroke-width="1.3" stroke-dasharray="5 4" data-shock-fan-slip="true"');
 svg+=regions.map((polys,i)=>{
  const position=regionLabelPosition(polys.filter(poly=>poly.length>=3).map(poly=>poly.map(screen)));
  return position?regionNumber(position.point,i+1,color(get(r[i+1]))):'';
 }).join('');
 const text=(x,y,content,fill='#17212b')=>`<text x="${x}" y="${y}" fill="${fill}" font-size="15">${content}</text>`;
 svg+=text(50,Y(1)+24,`M₁ = ${r[1].M.toFixed(3)}`,readableInk(color(get(r[1]))))+
  text(X(0)+12,Y(1)-10,`θᵤ = ${deg(r[3].theta).toFixed(1)}°`)+
  text(X(lowerCorner[0])+12,Y(0)+16,`θₗ = ${deg(r[2].theta).toFixed(1)}°`);
 svg+=text(35,294,`φ = ${s.slipAngle.toFixed(4)}° to horizontal · schematic`)+'</svg>';
 return {svg,densityCells,label:`Example ${book} · shock–expansion matching`,meta:'Solid: shock · fine rays: expansion fan · dashed: slip line',
  field:{quantity:key,options,label,min,max,units,palette:cornerPalette,note:'Uniform regions and isentropic fan states · schematic'}};
}
