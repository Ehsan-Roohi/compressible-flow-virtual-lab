import {solveInletReflections} from './multi-ramp-reflection.js?v=20261117-full-wall-reflections';
import {state,normalShock,obliqueShock,expansion,shockLimit,rad,deg} from './physics.js';
import {requireValue} from './numerics.js';
import {clipPolygon} from './wave-interaction.js';
import {cornerContourColor,cornerPalette} from './corner-graphics.js';
import {regionLabelPosition} from './region-labels.js';
export const multiRampMode='Ramjet inlet · multiple ramps';
export const multiRampProblemPreset={wallShape:'Custom wall',customInteraction:multiRampMode,inletFlowSide:'Flow above wedge',inletLowerDefinition:'Mirror upper side',inletSolutionVersion:2,inletReference:1,inletHeightRatio:.3,inletCowlRatio:1,inletTerminal:'Normal shock',inletLowerSegments:[{angle:7,length:.5},{angle:15,length:.5}],inletUpperWallRatio:1,inletUpperStartRatio:0,M1:2.5,T1:216.65,p1:11.6,inletPressureType:'Static pressure',temperatureInput:'Static temperature',bookExample:'6–P1b'};
export const multiRampPreset={...multiRampProblemPreset,inletTerminal:'Wall reflections',inletReference:2,inletHeightRatio:.5,M1:2,inletLowerSegments:[{angle:8,length:1}],p1:101.325,T1:300,bookExample:'6–9'};
export function inletPanels(segments,L,start){
 requireValue(Array.isArray(segments)&&segments.length>0&&segments.length<=8,'Use 1–8 segments per inlet wall.');
 let a=start;
 return segments.map(s=>{requireValue(Number.isFinite(s.angle)&&Math.abs(s.angle)<75&&Number.isFinite(s.length)&&s.length>0&&s.length<=100,'Each wall segment requires a positive Lᵢ/Lref ≤ 100 and |θ| < 75°.');const theta=rad(s.angle),b=[a[0]+L*s.length*Math.cos(theta),a[1]+L*s.length*Math.sin(theta)],p={a,b,theta};a=b;return p;});
}
export function solveMultiRamp(x){
 if(x.inletFlowSide&&x.inletFlowSide!=='Flow above wedge')return solveInletSides(x);
 const L=x.inletReference,H=L*x.inletHeightRatio,terminal=x.inletTerminal==='Normal shock',reflect=x.inletTerminal==='Wall reflections'||!x.inletTerminal,cowl=L*(terminal?x.inletCowlRatio:1),g=x.gamma??1.4,R=x.R??287;
 requireValue([L,H,cowl,x.M1,x.T1,x.p1].every(Number.isFinite)&&L>0&&H>0&&cowl>0&&x.M1>1&&x.T1>0&&x.p1>0,'Require positive reference length, height, cowl position, pressure and temperature, and M > 1.');
 const lower=inletPanels(x.inletLowerSegments,L,[0,0]),tip=lower.at(-1).b,wedgeLength=x.inletLowerSegments.reduce((sum,p)=>sum+p.length*L,0),upperRatio=x.inletUpperWallRatio??1,startRatio=x.inletUpperStartRatio??0;
 requireValue(Number.isFinite(upperRatio)&&upperRatio>0&&upperRatio<=100&&Number.isFinite(startRatio)&&startRatio>=0&&startRatio<=100,'Upper-wall length must be positive; its start ratio must be between 0 and 100.');
 if(terminal)requireValue(cowl>=tip[0]-1e-9,'Place the inlet lip at or beyond the wedge end. Increase cowl x/Lref or shorten the wedge segments.');
 if(terminal)requireValue(H>Math.max(...lower.map(p=>p.b[1])),'The horizontal upper wall intersects the wedge. Increase channel height.');
 const upperWall={a:[startRatio*wedgeLength,H],b:[(startRatio+upperRatio)*wedgeLength,H]},upper=[{...upperWall,theta:0}],end=Math.max(upperWall.b[0],tip[0]+.15*wedgeLength),last=lower.at(-1),bottom=xx=>xx>=tip[0]?tip[1]:last.a[1]+Math.tan(last.theta)*(xx-last.a[0]);
 const ymax=H+.22*wedgeLength,start=-.18*wedgeLength,domain=[[start,0],[0,0],...lower.map(p=>p.b),[end,tip[1]],[end,H],[upperWall.a[0],H],[upperWall.a[0],ymax],[start,ymax]],geometry={L,H,cowl,lower,upper,upperWall,wedgeLength,tip,start,end,ymax,domain,shockFoot:null};
 if(reflect)return solveInletReflections({...x,gamma:g,R},geometry);
 const s1={...state(x.M1,x.T1,x.p1*1000,g,R),theta:0},regions={1:s1},waves=[];let before=s1;
 for(const [i,p] of lower.entries()){
  requireValue(before.M>1,'A ramp has a sonic/subsonic upstream state; supersonic wall marching cannot continue.');
  const turn=p.theta-before.theta,a=Math.abs(turn),kind=a<1e-10?'No wave':turn>0?'Oblique shock':'Expansion fan',n=kind==='No wave'?{M2:before.M,p:1,T:1}:kind==='Oblique shock'?obliqueShock(before.M,a,g):expansion(before.M,a,g),after={...state(n.M2,before.T*n.T,before.p*n.p,g,R),theta:p.theta};
  const rays=kind==='No wave'?[]:kind==='Oblique shock'?[before.theta+n.beta]:[before.theta+Math.asin(1/before.M),after.theta+Math.asin(1/after.M)];
  requireValue(rays.every(t=>Math.cos(t)>1e-8),'An emitted wave points upstream; this inlet model cannot march it.');
  waves.push({id:i+2,origin:p.a,before,after,kind,beta:n.beta,rays,turn});regions[i+2]=after;before=after;
 }
 const pre=before,terminalRegion=lower.length+2;
 requireValue(!terminal||pre.M>1,'The terminal normal shock needs a supersonic incoming stream.');
 const n=terminal?normalShock(pre.M,g):null,final=terminal?{...state(n.M2,pre.T*n.T,pre.p*n.p,g,R),theta:pre.theta}:pre;
 if(terminal)regions[terminalRegion]=final;
 // A normal shock is perpendicular to the final local stream. Its upper endpoint is the cowl lip.
 const m=Math.tan(pre.theta),shockFoot=[cowl+(H-tip[1])*m,tip[1]];
 if(terminal)requireValue(shockFoot[0]<end&&H>bottom(cowl),'No open inlet section remains at the cowl.');
 if(terminal)for(const w of waves)if(w.kind==='Oblique shock')for(const a of [[cowl,H],shockFoot])requireValue(a[1]<=w.origin[1]+Math.tan(w.rays[0])*(a[0]-w.origin[0])+1e-8,'The cowl entry is above an upstream shock: it does not receive the final ramp state uniformly. Lower the cowl height or move the cowl downstream.');
 let overlap=false;
 for(let i=0;i<waves.length;i++)for(let j=i+1;j<waves.length;j++)for(const ai of waves[i].rays)for(const aj of waves[j].rays){const a=waves[i],b=waves[j],mi=Math.tan(ai),mj=Math.tan(aj);if(Math.abs(mi-mj)>1e-12){const xx=(b.origin[1]-a.origin[1]+mi*a.origin[0]-mj*b.origin[0])/(mi-mj);if(xx>Math.max(a.origin[0],b.origin[0])+1e-8&&xx<cowl)overlap=true;}}

 return {multiRamp:true,regions,s1,waves,pre,final,normal:n,terminalRegion:terminal?terminalRegion:null,gamma:g,R,geometry:{...geometry,shockFoot},overlap,checks:{stagnationTemperature:Math.abs(final.T0/s1.T0-1)}};
}
export function multiRampPlot(r){
 if(r.inletSides){const charts=Object.entries(r.sides).map(([name,p])=>({name,p,chart:multiRampPlot(p.canonical)}));return {...charts[0].chart,series:charts.flatMap(({name,p,chart})=>chart.series.map(s=>({...s,name:name+' · '+s.name,points:s.points.map(([a,b])=>[p.sign*a,b])}))),markers:charts.flatMap(({p,chart})=>chart.markers.map(m=>({...m,name:p.prefix+m.name,x:p.sign*m.x})))};}
 const series=[],markers=[{name:'1',x:0,y:1}];
 for(const w of r.waves){if(w.kind==='No wave'){markers.push({name:String(w.id),x:deg(w.after.theta),y:w.after.p/r.s1.p});continue;}const sign=Math.sign(w.turn),max=w.kind==='Oblique shock'?shockLimit(w.before.M,r.gamma).theta:Math.abs(w.turn),points=Array.from({length:81},(_,i)=>{const a=max*i/80,n=w.kind==='Oblique shock'?obliqueShock(w.before.M,a,r.gamma):expansion(w.before.M,a,r.gamma);return [deg(w.before.theta+sign*a),w.before.p*n.p/r.s1.p];});series.push({name:`${w.id-1} → ${w.id} · ${w.kind}`,points});markers.push({name:String(w.id),x:deg(w.after.theta),y:w.after.p/r.s1.p});}
 if(r.normal)markers.push({name:String(r.terminalRegion),x:deg(r.final.theta),y:r.final.p/r.s1.p});
 series.push({name:'Selected region states',points:Object.values(r.regions).map(s=>[deg(s.theta),s.p/r.s1.p])});
 return {title:'Pressure–deflection diagram',xlabel:'Flow direction θ to horizontal (°)',ylabel:'p/p₁',zeroBaseline:false,series,markers};
}
export function multiRampDrawing(r,x,quantity='pressure',frame=null){
 if(r.inletSides)return inletSidesDrawing(r,x,quantity);
 const q={pressure:['Static pressure','kPa',s=>s.p/1000],mach:['Mach number','M',s=>s.M],temperature:['Static temperature','K',s=>s.T],density:['Density','kg/m³',s=>s.rho],speed:['Flow speed','m/s',s=>s.u]},key=q[quantity]?quantity:'pressure',[label,units,read]=q[key],vals=Object.values(r.regions).map(read),min=frame?.min??Math.min(...vals),max=frame?.max??Math.max(...vals),g=r.geometry,scale=frame?.scale??Math.min(730/(g.end-g.start),235/g.ymax),ox=frame?.ox??35-g.start*scale,oy=frame?.oy??280,V=p=>[ox+p[0]*scale,oy+(frame?.mirror?1:-1)*p[1]*scale],color=s=>cornerContourColor((read(s)-min)/(max-min||1));
 const poly=(p,fill)=>`<polygon points="${p.map(V).map(p=>p.join(',')).join(' ')}" fill="${fill}"/>`,line=(a,b,c='#101820',width=2)=>`<path d="M${V(a).join(',')} L${V(b).join(',')}" fill="none" stroke="${c}" stroke-width="${width}"/>`,text=(p,t)=>`<text x="${V(p)[0]}" y="${V(p)[1]}" fill="white" font-size="18" font-weight="600" text-anchor="middle">${t}</text>`;
 const half=(p,w,a)=>p[1]-w.origin[1]-Math.tan(a)*(p[0]-w.origin[0]);
 let content=poly(g.domain,r.wallReflections?'#edf0f2':color(r.s1)),cells=[{poly:g.domain,state:r.s1,region:1}];
 if(r.wallReflections){cells=[{poly:[[g.start,0],[0,0],[0,g.H],[g.start,g.H]],state:r.s1,region:'1'},...r.reflectionField.cells];for(const c of cells)content+=poly(c.poly,color(c.state));}
 if(!r.wallReflections){
 for(const w of r.waves){if(!w.rays.length)continue;const a=w.rays.at(-1);cells=cells.map(c=>({...c,poly:clipPolygon(c.poly,p=>half(p,w,a))}));const p=clipPolygon(g.domain,p=>-half(p,w,a));cells.push({poly:p,state:w.after,region:w.id});
 if(w.kind==='Expansion fan'){const N=80;for(let i=0;i<N;i++){const d=Math.abs(w.turn)*(i+.5)/N,n=expansion(w.before.M,d,r.gamma),s={...state(n.M2,w.before.T*n.T,w.before.p*n.p,r.gamma,r.R),theta:w.before.theta-d},a1=w.before.theta-Math.abs(w.turn)*i/N+Math.asin(1/(i?expansion(w.before.M,Math.abs(w.turn)*i/N,r.gamma).M2:w.before.M)),a2=w.before.theta-Math.abs(w.turn)*(i+1)/N+Math.asin(1/expansion(w.before.M,Math.abs(w.turn)*(i+1)/N,r.gamma).M2);content+=poly(clipPolygon(clipPolygon(g.domain,p=>-half(p,w,a1)),p=>half(p,w,a2)),color(s));}}
 content+=poly(p,color(w.after));}
 const normalSide=p=>(p[0]-g.cowl)*Math.cos(r.pre.theta)+(p[1]-g.H)*Math.sin(r.pre.theta);
 if(r.normal){for(const c of cells)c.poly=clipPolygon(c.poly,p=>-normalSide(p));const diffuser=[[g.cowl,g.H],[g.end,g.H],[g.end,g.tip[1]],g.shockFoot];const p=clipPolygon(diffuser,normalSide);cells.push({poly:p,state:r.final,region:r.terminalRegion});content+=poly(p,color(r.final));}
 }
 if(r.wallReflections)for(const w of r.reflectionField.traces)content+=line([w.origin.x,w.origin.y],[w.end.x,w.end.y],w.kind==='Oblique shock'?'black':'#8dc6dd',w.kind==='Oblique shock'?2:0.6);
 if(!r.wallReflections)for(const w of r.waves)for(const a of w.rays){const end=[g.end,w.origin[1]+Math.tan(a)*(g.end-w.origin[0])];content+=line(w.origin,end,w.kind==='Oblique shock'?'black':'#a5d4e8',w.kind==='Oblique shock'?2:1);}
 if(r.normal)content+=line([g.cowl,g.H],g.shockFoot,'black',3);
 for(const w of r.waves)if(w.beta){const xx=Math.min(g.cowl-.05*g.L,w.origin[0]+.23*g.L),yy=w.origin[1]+Math.tan(w.rays[0])*(xx-w.origin[0])+.045*g.L;content+=text([xx,yy],`β = ${deg(w.beta).toFixed(2)}°`);}
 for(const region of new Set(cells.map(c=>String(c.region)))){const p=regionLabelPosition(cells.filter(c=>String(c.region)===region).map(c=>c.poly.map(V)))?.point;if(p)content+=`<text x="${p[0]}" y="${p[1]}" fill="white" font-size="20" text-anchor="middle">${frame?.prefix??''}${region}</text>`;}
 const pad=.055*g.wedgeLength;
 // Horizontal walls are independent of the compression surface mounted on the lower wall.
 let walls=`<g data-solid="${frame?.mirror?'lower-horizontal-wall':'upper-horizontal-wall'}">${poly([g.upperWall.a,g.upperWall.b,[g.upperWall.b[0],g.H+pad],[g.upperWall.a[0],g.H+pad]],'#a8adb3')}${line(g.upperWall.a,g.upperWall.b,'#56616a',3)}</g>`;

 walls+=`<g data-solid="segmented-wedge">${poly(r.wallReflections?[[0,0],...g.lower.map(p=>p.b),[g.tip[0],0]]:[[0,0],...g.lower.map(p=>p.b),[g.end,g.tip[1]],[g.end,0]],'#d5b488')}`;
 for(const p of g.lower)walls+=line(p.a,p.b,'#4c5964',3);
 walls+=(r.wallReflections?line(g.tip,[g.tip[0],0],'#4c5964',1):line(g.tip,[g.end,g.tip[1]],'#4c5964',2))+`<text x="${V([g.tip[0]*.7,g.tip[1]*.3])[0]}" y="${V([g.tip[0]*.7,g.tip[1]*.3])[1]}" fill="#24313c" font-size="17" text-anchor="middle">Wedge</text></g>`;

 for(const [i,p] of g.lower.entries()){const q=[(p.a[0]+p.b[0])/2,(p.a[1]+p.b[1])/2+.04*g.wedgeLength];walls+=text(q,`θ${i+1} = ${((frame?.mirror?-1:1)*deg(p.theta)).toFixed(1)}°`);}

 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 330" role="img" aria-label="Custom multi-ramp ramjet inlet"><defs><clipPath id="${frame?.prefix??''}multiInletGas">${poly(g.domain,'white')}</clipPath></defs><g clip-path="url(#${frame?.prefix??''}multiInletGas)">${content}</g>${walls}${frame?'':`<text x="35" y="25" fill="#24313c" font-size="17">M₁ = ${x.M1} · Lupper/Lw = ${x.inletUpperWallRatio??1} · xupper/Lw = ${x.inletUpperStartRatio??0}</text><text x="35" y="320" fill="#24313c" font-size="15">${r.wallReflections?'Computed wall reflections · no terminal normal shock':r.normal?'Terminal normal shock · diffuser-entry state':'Compression only · no terminal normal shock'}</text>`}</svg>`;
 return {svg,label:r.wallReflections?'Computed inlet wall-wave field':'Multi-ramp inlet · sequential wave states',meta:r.wallReflections?'Computed regular reflections and supported wave interactions':'Independent wall waves; schematic spatial field',field:{quantity:key,label,min,max,units,options:Object.keys(q),palette:cornerPalette,note:r.wallReflections?r.note:'Sequential compression estimate; normal shock is optional. Reflections and subsonic diffuser evolution are not included in this mode.'}};
}

export const inletFlowSides=['Flow above wedge','Flow below wedge','Both sides'];
export const inletLowerDefinitions=['Mirror upper side','Independent lower side'];
function inletSideInput(x){
 if(x.inletLowerDefinition!=='Independent lower side')return {...x,inletFlowSide:inletFlowSides[0]};
 requireValue(Array.isArray(x.inletBottomSegments)&&x.inletBottomSegments.length>0,'Enter at least one lower wedge segment. Lower-face angles are signed relative to horizontal.');
 return {...x,inletFlowSide:inletFlowSides[0],inletLowerSegments:x.inletBottomSegments.map(p=>({...p,angle:-p.angle})),inletHeightRatio:x.inletLowerHeightRatio,inletUpperWallRatio:x.inletLowerWallLengthRatio,inletUpperStartRatio:x.inletLowerStartRatio,inletCowlRatio:x.inletLowerCowlRatio??1};
}
function physicalInletSide(r,sign,prefix){
 const states=new Map(),state=s=>{if(!states.has(s))states.set(s,{...s,theta:sign*s.theta});return states.get(s);};
 const id=n=>prefix+String(n);
 return {...r,regions:Object.fromEntries(Object.entries(r.regions).map(([n,s])=>[id(n),state(s)])),s1:state(r.s1),pre:state(r.pre),final:state(r.final),terminalRegion:r.terminalRegion?id(r.terminalRegion):null,
 waves:r.waves.map(w=>({...w,id:id(w.id),parentId:id(w.parentId??Number(w.id)-1),before:state(w.before),after:state(w.after),turn:sign*w.turn})),reflections:r.reflections?.map(e=>({...e,y:sign*e.y,region:id(e.region),before:state(e.before),after:state(e.after)}))};
}
function solveInletSides(x){
 requireValue(inletFlowSides.includes(x.inletFlowSide),'Choose flow above, below, or on both sides of the wedge.');
 const sides={};if(x.inletFlowSide==='Both sides'){const canonical=solveMultiRamp({...x,inletFlowSide:inletFlowSides[0]});sides.upper={canonical,physical:physicalInletSide(canonical,1,'U'),inputs:{...x,inletFlowSide:inletFlowSides[0]},sign:1,prefix:'U'};}
 const lowerInput=inletSideInput(x),canonical=solveMultiRamp(lowerInput);sides.lower={canonical,physical:physicalInletSide(canonical,-1,'L'),inputs:lowerInput,sign:-1,prefix:'L'};
 const parts=Object.values(sides),first=parts[0].physical;
 return {...first,inletSides:true,sides,regions:Object.assign({},...parts.map(p=>p.physical.regions)),waves:parts.flatMap(p=>p.physical.waves),checks:Object.assign({},...Object.entries(sides).flatMap(([name,p])=>Object.entries(p.physical.checks).map(([k,v])=>({[name+'-'+k]:v})))),note:parts.map(p=>`${p.prefix}: ${p.canonical.note??'Sequential compression estimate.'}`).join(' ')+' The two side fields are independent; interaction of the streams behind the trailing edge is not matched.'};
}
function inletSidesDrawing(r,x,quantity){
 const parts=Object.values(r.sides),both=parts.length===2,lo=Math.min(...parts.map(p=>p.canonical.geometry.start)),hi=Math.max(...parts.map(p=>p.canonical.geometry.end)),H=Math.max(...parts.map(p=>p.canonical.geometry.ymax)),scale=Math.min(730/(hi-lo),(both?165:220)/H),ox=35-lo*scale,oy=both?205:55;
 const read={pressure:s=>s.p/1000,mach:s=>s.M,temperature:s=>s.T,density:s=>s.rho,speed:s=>s.u},key=read[quantity]?quantity:'pressure',values=Object.values(r.regions).map(read[key]),min=Math.min(...values),max=Math.max(...values);
 const views=parts.map(p=>multiRampDrawing(p.canonical,p.inputs,key,{scale,ox,oy,mirror:p.sign<0,prefix:p.prefix,min,max}));
 const inner=views.map(v=>v.svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'' )).join(''),height=both?420:330;
 return {...views[0],svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${height}" role="img" aria-label="${both?'Both wedge sides':'Flow below wedge'} with reflecting walls">${inner}<text x="35" y="24" fill="#24313c" font-size="17">${both?'Upper (U) and lower (L) flow':'Lower flow (L)'} · M₁ = ${x.M1}</text><text x="35" y="${height-10}" fill="#24313c" font-size="14">${both?'Independent side solutions; trailing-edge stream interaction is not matched.':'Angles are signed relative to horizontal; lower side is mirrored for calculation.'}</text></svg>`,field:{...views[0].field,min,max,note:r.note}};
}
