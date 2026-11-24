import {rayleigh,fanno} from './physics.js';
export const rayleighDistributionNote='Assumes uniform heat transfer along the heated duct: equal heat added or removed per metre. Temperature need not be uniform.';
export const fannoDistributionNote='Assumes constant friction factor and hydraulic diameter along the duct. Values are uniform across each section (1D model).';
export function ductProfile(id,result,inputs){
 if(!result.s2)return null;
 if(result.ductSystem)return result.points;
 const a=result.s1,q=(result.heatAdded??0)*1000,n=120;
 return Array.from({length:n+1},(_,i)=>{const x=i/n;if(i===0)return {x,state:a};if(i===n)return {x,state:result.s2};
 const params={M1:a.M,T1:a.T,p1:a.p,gamma:inputs.gamma,R:inputs.R};
 const d=id==='rayleigh'?rayleigh({...params,q:q*x,branch:result.branch}):fanno({...params,lambda:inputs.lambda*x});
 if(!d.s2)throw Error('No accepted interior duct state before the outlet.');return {x,state:d.s2};});
}
export const ductProperties={pressure:{label:'Static pressure',symbol:'p',units:'kPa',get:s=>s.p/1000},mach:{label:'Mach number',symbol:'M',units:'',get:s=>s.M},temperature:{label:'Static temperature',symbol:'T',units:'K',get:s=>s.T},density:{label:'Density',symbol:'ρ',units:'kg/m³',get:s=>s.rho},speed:{label:'Flow speed',symbol:'u',units:'m/s',get:s=>s.u}};
const fmt=v=>Number(v.toPrecision(5)).toString();
export const ductPalette=['#2536c7','#0879f5','#00c8dc','#16bf59','#efe51b','#ff9718','#ee2727'];
function color(t){const a=Math.max(0,Math.min(1,t))*(ductPalette.length-1),i=Math.min(ductPalette.length-2,Math.floor(a)),f=a-i;const rgb=h=>h.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)),p=rgb(ductPalette[i]),q=rgb(ductPalette[i+1]);return '#'+p.map((v,k)=>Math.round(v+(q[k]-v)*f).toString(16).padStart(2,'0')).join('');}
export function ductStationText({x,y,state,index,anchor,background,station=index==='₁'?'inlet':'outlet'}){
 const luminance=background?.match(/[0-9a-f]{2}/gi).reduce((sum,hex,i)=>{
  const v=parseInt(hex,16)/255;
  return sum+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 },0);
 const dark=(luminance??1)<.179;
 const fill=dark?'#fff':'#111';
 const line=(baseline,value)=>`<text x="${x}" y="${baseline}" text-anchor="${anchor}" font-size="16" fill="${fill}">${value}</text>`;
 return `<g data-duct-station="${station}">${line(y,`M${index} = ${fmt(state.M)}`)}${line(y+17,`p${index} = ${fmt(state.p/1000)} kPa`)}</g>`;
}
export function ductContourDrawing(s,inputs,quantity='pressure'){
 if(!['rayleigh','fanno'].includes(s.process))return null;
 const r=s.system??s,points=r.longitudinal??s.longitudinal;if(!points?.length||!r.s2)return null;
 const key=quantity in ductProperties?quantity:'pressure',prop=ductProperties[key],values=points.map(z=>prop.get(z.state)),min=Math.min(...values),max=Math.max(...values);
 const combined=r.fannoRayleigh===true, isRayleigh=s.process==='rayleigh'&&!combined;
 const mode=inputs.ductProblem??'Single duct',rayNozzle=isRayleigh&&mode==='Heat + shock + converging nozzle';
 const cd=s.process==='fanno'&&mode.startsWith('CD nozzle'),entryNozzle=cd||mode==='Reservoir + nozzle + duct';
 const ref=r.stations?.[0]?.x<0?r.stations[0]:null,initial=!!r.initialReference;
 const rayReservoir=isRayleigh&&(mode==='Reservoir-fed duct'||initial);
 const hasSpillage=Number.isFinite(r.spillFraction)&&r.spillFraction>0;
 const hasEntry=entryNozzle||rayReservoir||!!ref;
 const left=hasEntry?270:65,right=735,shock=r.shockAt,a=r.s1,b=r.s2;
 // The Rayleigh solver's last segment is an isentropic exit nozzle, not heated duct.
 // Leave a straight, constant-state section after the schematic shock.
 const shockX=rayNozzle?500:null,nozzleStart=rayNozzle?540:null;
 const X=x=>rayNozzle?(x<=shock?left+(shockX-left)*x/shock:nozzleStart+(right-nozzleStart)*(x-shock)/(1-shock)):left+(right-left)*x;
 const tint=v=>color(max-min<1e-12?.5:(prop.get(v)-min)/(max-min));
 const stops=points.map((z,i)=>`<stop offset="${100*z.x}%" stop-color="${tint(z.state)}"/>`).join('');
 const text=(x,y,t,anchor='start',size=14)=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="#17383b">${t}</text>`;
 const arrow=(x,y=160)=>`<path d="M${x-14} ${y}h28l-7 -4m7 4l-7 4" fill="none" stroke="#40575d" stroke-width="1.5"/>`;
 const wall=d=>`<path d="${d}" fill="none" stroke="#41555b" stroke-width="3"/>`;
 let body=`<defs><linearGradient id="ductContour" gradientUnits="userSpaceOnUse" x1="${left}" x2="${rayNozzle?left+(shockX-left)/shock:right}">${rayNozzle?points.filter(z=>z.x<=shock).map(z=>`<stop offset="${100*z.x}%" stop-color="${tint(z.state)}"/>`).join(''):stops}</linearGradient></defs><rect width="800" height="390" fill="#f8fbf8"/>`;
 const ductEnd=rayNozzle?nozzleStart:right;
 const showEntryAreaRatio=r.entryAreaRatio&&!rayReservoir;
 const compactFanno=!combined&&!isRayleigh&&!hasEntry;
 const compactStations=isRayleigh||compactFanno||combined;
 const top=combined?35:isRayleigh?(showEntryAreaRatio||shock!=null?16:hasEntry?40:64):compactFanno?(shock==null?67:16):0;
 const height=compactStations?(rayNozzle?280:271)-top:390;
 body+=`<path d="M${left} 105H${ductEnd}V215H${left}Z" fill="url(#ductContour)" data-duct-contour="${key}"/>`+wall(`M${left} 105H${ductEnd}M${left} 215H${ductEnd}`);
 if(rayNozzle){
  const post=r.stations.find(z=>z.name==='After shock').state;
  body+=`<rect x="${shockX}" y="105" width="${nozzleStart-shockX}" height="110" fill="${tint(post)}"/>`;
  // Area varies continuously from the duct area to the sonic throat area.
  const g=inputs.gamma??1.4,areaMach=M=>1/M*(2/(g+1)*(1+(g-1)*M*M/2))**((g+1)/(2*(g-1)));
  const nozzlePoints=[{x:nozzleStart,h:55,state:post},...points.filter(z=>z.x>shock).map(z=>({x:X(z.x),h:55*areaMach(z.state.M)/areaMach(post.M),state:z.state}))];
  const exitStops=[{x:shock,state:post},...points.filter(z=>z.x>shock)].map(z=>`<stop offset="${100*(z.x-shock)/(1-shock)}%" stop-color="${tint(z.state)}"/>`).join('');
  body+=`<defs><linearGradient id="exitContour" gradientUnits="userSpaceOnUse" x1="${nozzleStart}" x2="${right}">${exitStops}</linearGradient></defs><path d="M${nozzlePoints.map(z=>`${z.x} ${160-z.h}`).join('L')}L${[...nozzlePoints].reverse().map(z=>`${z.x} ${160+z.h}`).join('L')}Z" fill="url(#exitContour)"/>`;
  body+=wall('M'+nozzlePoints.map(z=>`${z.x} ${160-z.h}`).join('L')+'M'+nozzlePoints.map(z=>`${z.x} ${160+z.h}`).join('L'));
  body+=text((nozzleStart+right)/2,85,'Converging nozzle','middle');
 }else if(combined){
  r.stageNames.forEach((name,i)=>{
   const label=name==='Fanno'?'Fanno · Wall friction':'Rayleigh · Heat transfer';
   body+=`<g data-duct-stage="${name}">${text(X((i+.5)/2),57,label,'middle')}</g>`;
  });
  body+=`<path d="M${X(.5)} 97V223" stroke="#40575d" stroke-dasharray="4 4"/>`;
 }else if(!isRayleigh)body+=text((left+right)/2,85,'Constant-area friction duct','middle');
 const temperatureChange=b.T0-a.T0;
 if((isRayleigh||combined)&&Math.abs(temperatureChange)>1e-9){
  const heating=temperatureChange>0,cx=combined?X((r.stageNames.indexOf('Rayleigh')+.5)/2):(left+(rayNozzle?shockX:right))/2;
  const gamma=inputs.gamma??1.4;
  const q=combined?r.heatAdded:gamma*(inputs.R??287)*temperatureChange/((gamma-1)*1000);
  const start=heating?72:116,end=heating?116:72,head=end+(heating?-8:8);
  const path=`M${cx} ${start}V${end}M${cx-6} ${head}L${cx} ${end}L${cx+6} ${head}`;
  body+=`<g data-heat-transfer="${heating?'into-duct':'out-of-duct'}"><title>${heating?'Heat added to the flow':'Heat removed from the flow'}</title><path d="${path}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="${heating?'#a73320':'#236aba'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${text(cx+15,94,`q = ${fmt(q)} kJ/kg`)}</g>`;
 }
 if(hasEntry){
  if(rayReservoir){
   const refY=hasSpillage?236:187,refX=hasSpillage?98:127;
   // The flux estimate controls only the bypass arrows, never the inlet walls.
   body+=`<g data-rayleigh-intake="open">`;
   if(ref){
    body+=`<g${initial?' data-initial-reference=""':''}>`
     +text(127,58,initial?'Initial reference':'Upstream reference','middle')
     +text(refX,refY,`Mref = ${fmt(ref.state.M)}`,'middle')
     +text(refX,refY+17,`pref = ${fmt(ref.state.p/1000)} kPa`,'middle')+'</g>';
   }else{
    body+=text(127,58,'Reservoir','middle')+text(refX,refY,'M = 0','middle')
     +text(refX,refY+17,`p₀ = ${fmt(a.p0/1000)} kPa`,'middle');
   }
   if(hasSpillage){
    body+=`<g data-inlet-spillage="schematic">
     <title>Possible inlet spillage at an open intake. Streamlines are schematic.</title>
     <path d="M35 160H241m-7 -4 7 4-7 4 M75 134C151 134 185 83 241 76m-8 -3 8 3-7 5 M75 186C151 186 185 237 241 244m-7 -5 7 5-8 3"
      fill="none" stroke="#40575d" stroke-width="1.5"/>
    </g>`+text(135,108,`Inlet spillage ≈ ${(100*r.spillFraction).toFixed(1)}% total`,'middle',12);
   }else body+=arrow(127);
   body+='</g>';
  }else if(entryNozzle){
   body+=`<path d="M25 90H120V230H25Z" fill="#e5edeb"/>`+wall('M120 105V90H25V230H120V215');
   const path='M120 105L185 135L270 105M120 215L185 185L270 215';
   // A reservoir-fed subsonic duct has a converging inlet, with the same duct exit height.
   const entry=cd?path:'M120 90L270 105M120 230L270 215';
   body+=`<path d="${cd?'M120 105L185 135L270 105V215L185 185L120 215Z':'M120 90L270 105V215L120 230Z'}" fill="#e5edeb"/>`+wall(entry)+text(68,58,'Reservoir','middle')+text(68,270,'M = 0','middle')+text(68,297,`p₀ = ${fmt(a.p0/1000)} kPa`,'middle');
   body+=text(195,58,cd?'C–D nozzle':'Entry nozzle','middle')+arrow(205);
  }else if(ref){
   const h=Math.max(25,Math.min(85,55/(r.entryAreaRatio??1)));
   body+=wall(`M25 ${160-h}L270 105M25 ${160+h}L270 215`)+text(100,58,'Upstream','middle')+arrow(100)+text(100,270,`Mref = ${fmt(ref.state.M)}`,'middle')+text(100,297,`pref = ${fmt(ref.state.p/1000)} kPa`,'middle');
  }
 }else body+=arrow(30);
 if(showEntryAreaRatio)body+=text(400,34,`Isentropic entry · Ain/Aref = ${fmt(r.entryAreaRatio)}`,'middle');
 body+=`<path ${!isRayleigh?'data-fanno-station-line="inlet" ':''}d="M${left} 97V223" stroke="#81999b" stroke-dasharray="4 4"/>`;
 if(!isRayleigh)body+=`<path data-fanno-station-line="outlet" d="M${right} 105V223" stroke="#637b80" stroke-dasharray="4 4"/>`;
 if(shock!==null&&shock!==undefined)body+=`<path data-shock="true" d="M${X(shock)} 105V215" stroke="#111" stroke-width="2.5"/>`+text(Math.max(210,Math.min(600,X(shock))),34,shock===0?'Normal shock · nozzle exit / duct inlet':shock===1?'Normal shock · duct exit':'Normal shock · in duct','middle');
 for(const x of [.12,.38,.62,.88])body+=arrow(X(x));
 const inletLabel=initial?'Adjusted inlet':isRayleigh?'Inlet':'Duct inlet';
 const outletLabel=initial?'Sonic outlet':rayNozzle?'Nozzle outlet':isRayleigh?'Outlet':'Duct exit';
 const inletX=left+7,outletX=right-7;
 body+=ductStationText({x:inletX,y:187,state:a,index:'₁',anchor:'start',background:tint(a)});
 if(combined)body+=ductStationText({x:X(.5)+8,y:187,state:r.junction,index:'₂',anchor:'start',background:tint(r.junction),station:'junction'});
 body+=ductStationText({x:outletX,y:rayNozzle?234:187,state:b,index:combined?'₃':'₂',anchor:'end',background:rayNozzle?null:tint(b)});
 body+=text(left,238,inletLabel)+text(right,rayNozzle?273:238,outletLabel,'end');
 if(combined)body+=text(X(.5),238,'Junction','middle');
 else if(!rayNozzle){
  const axisY=compactStations?246:322;
  body+=`<path d="M${left} ${axisY}H${right}" stroke="#91a3a1"/>`;
  for(const x of [0,.5,1])body+=`<path d="M${X(x)} ${axisY-4}V${axisY+4}" stroke="#91a3a1"/>`+text(X(x),compactStations?265:348,`x/L = ${x}`,x===0?'start':x===1?'end':'middle');
 }
 const diagramName=combined?'Fanno and Rayleigh sections':`${s.process} system`;
 const description=combined?`${r.stageNames[0]} flow from section 1 to 2, followed by ${r.stageNames[1]} flow from section 2 to 3.`:rayNozzle?'Heat transfer in the straight duct; isentropic exit nozzle.':isRayleigh?'Uniform heat transfer: equal heat added/removed per metre of heated duct.':'Constant friction factor and hydraulic diameter.';
 if(!compactStations)body+=text(400,377,description,'middle',12);
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" ${combined?'data-fanno-rayleigh="true" ':isRayleigh?'data-rayleigh-contour="true" ':compactFanno?'data-fanno-contour="true" ':''}viewBox="0 ${top} 800 ${height}" role="img" aria-label="${diagramName}: ${hasEntry?(initial?'initial reference and open intake, ':rayReservoir?'open intake, ':ref?'upstream, ':'reservoir and inlet nozzle, '):'upstream flow, '}constant-area duct${rayNozzle?', shock in duct and converging exit nozzle':''}"><desc>${description}</desc><title>${combined?diagramName:s.process} longitudinal ${prop.label.toLowerCase()} contour</title>${body}</svg>`,label:'One-dimensional longitudinal '+prop.label.toLowerCase(),meta:'',field:{quantity:key,options:Object.keys(ductProperties),label:prop.label,units:prop.units,min,max,palette:ductPalette,note:combined?'Schematic section lengths':s.process==='rayleigh'?'Uniform heat transfer per unit heated length · section-uniform 1D field':'Constant friction factor and hydraulic diameter · section-uniform 1D field'}};
}
export function ductLongitudinalPlots(id,r){const points=r.longitudinal;if(!points?.length)return [];
 const properties=[...Object.entries(ductProperties),['totalTemperature',{label:'Stagnation temperature',symbol:'T₀',units:'K',get:s=>s.T0}],['totalPressure',{label:'Stagnation pressure',symbol:'p₀',units:'kPa',get:s=>s.p0/1000}]];
 const combined=r.fannoRayleigh===true;
 const stations=combined?r.stations:[{name:'Inlet',state:r.s1,x:0},{name:'Outlet',state:r.s2,x:1}];
 return properties.map(([key,p])=>({key:id+'-axial-'+key,label:p.label+(combined?' by section':' vs x/L'),
  note:combined?`The first half represents the ${r.stageNames[0]} section and the second half represents the ${r.stageNames[1]} section.`:id==='rayleigh'?rayleighDistributionNote:fannoDistributionNote,
  chart:{title:p.label+' along the duct',xlabel:combined?'Schematic duct coordinate':'Relative position x/L',ylabel:p.symbol+(p.units?' ('+p.units+')':''),zeroBaseline:false,
   markers:stations.map(({name,state,x})=>({name:combined?name.split(' · ')[0]:name,x,y:p.get(state),...(x===1?{anchor:'end'}:{})})),
   series:[{name:p.label,points:points.map(z=>[z.x,p.get(z.state)])}]}}));
}
