import {readableInk} from './scene-labels.js';
import {airfoilContour,airfoilFieldSampler,airfoilFieldProperties} from './airfoil-field.js?v=20261115-rainbow-fans';
import {airfoilRegionLabel,airfoilShockLabel,isFlatPlate} from './airfoil-region-labels.js?v=20261115-plate-regions';
const airfoilPalette=['#2536c7','#0879f5','#00c8dc','#16bf59','#efe51b','#ff9718','#ee2727'];
function surfaceColor(t){
 const v=Math.max(0,Math.min(1,t))*(airfoilPalette.length-1),i=Math.min(airfoilPalette.length-2,Math.floor(v)),f=v-i;
 const rgb=c=>c.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)),a=rgb(airfoilPalette[i]),b=rgb(airfoilPalette[i+1]);
 return '#'+a.map((v,k)=>Math.round(v+(b[k]-v)*f).toString(16).padStart(2,'0')).join('');
}

// Local analytical shock/expansion states; unresolved wave interactions remain unfilled.
export function airfoilDrawing(s,{txt,line,poly,fmt,incidenceGlyph,quantity='pressure'}){
 const available=s.models.includes('nonlinear')&&s.nonlinear.status==='ok';
 const model=available?'nonlinear':s.models.includes('linear')?'linear':null,z=model?s[model]:null;
 const trailing=available&&s.trailingEdge?.status==='ok'?s.trailingEdge:null;
 const L=350,leadingX=84,trailingX=leadingX+L,V=p=>[leadingX+p.x*L,150-p.y*L];
 const schematic=s.airfoilFieldMode==='Schematic · independent waves';
 const contour=available?airfoilContour(s,quantity):null,sampler=airfoilFieldSampler(s);
 const cps=z?.panels.map(p=>p.Cp)??[],min=cps.length?Math.min(...cps):0,max=cps.length?Math.max(...cps):0;
 const color=v=>surfaceColor(max-min<1e-12?.5:(v-min)/(max-min));
 const ray=(origin,angle,r)=>[origin[0]+r*Math.cos(angle),origin[1]-r*Math.sin(angle)];
 const shockLabels=[];
 let inner='<rect width="640" height="300" fill="#fcfdfc"/>';
 inner+='<defs><clipPath id="airfoil-wave-window"><rect x="20" y="46" width="600" height="188"/></clipPath></defs>';

 if(schematic&&contour)inner+=`<g data-airfoil-approximation="true">${txt(24,s.geometry.diamond?43:28,'Schematic · interactions neglected · fan colors use local rainbow scales','#263c4d',12)}</g>`;
 if(s.geometry.diamond){const q=s.geometry.diamond;inner+=txt(24,28,`θf = ${fmt(q.diamondFrontAngle,4)}° · θr = ${fmt(q.diamondRearAngle,4)}° · Lf/c = ${fmt(q.diamondFrontLength,4)} · Lr/c = ${fmt(q.diamondRearLength,4)}`,'#263c4d',12);}
 if(contour){const paths=new Map(),valid=[];let run=null;const finish=()=>{if(run)valid.push(`M${run.x},${run.y}h${run.end-run.x}v4H${run.x}Z`);};for(const c of contour.cells){const bucket=Math.round(255*(c.fanColor??(c.value-contour.min)/(contour.max-contour.min||1))),d=`M${c.px},${c.py}h4v4h-4Z`;paths.set(bucket,(paths.get(bucket)??'')+d);if(run&&run.y===c.py&&run.end===c.px)run.end+=4;else{finish();run={x:c.px,y:c.py,end:c.px+4};}}finish();inner+='<defs><clipPath id="airfoil-resolved"><path d="'+valid.join('')+'" shape-rendering="crispEdges"/></clipPath></defs><g data-airfoil-contour="'+contour.key+'" clip-path="url(#airfoil-wave-window)" shape-rendering="crispEdges">';for(const [bucket,d]of paths)inner+=`<path d="${d}" fill="${surfaceColor(bucket/255)}" stroke="none"/>`;inner+='</g>';}
 inner+='<g clip-path="url(#airfoil-wave-window)" stroke-linecap="round" stroke-linejoin="round">';
 // Finite rays deliberately stop locally: downstream wave interactions are not solved.
 if(available)for(const w of [...s.nonlinear.waves,...(trailing?.waves??[])]){
  if(w.kind==='No wave')continue;
  const origin=V(w.origin),sign=w.side==='Upper'?1:-1;
  if(w.kind==='Oblique shock'){
   const end=ray(origin,w.before.theta+sign*w.beta,contour?900:130);
   inner+=`<g ${contour?'clip-path="url(#airfoil-resolved)"':''} data-wave="shock" data-region="${w.id}">${line(...origin,...end,'#000000',1.35)}</g>`;
   const angle=w.before.theta+sign*w.beta,pos=ray(origin,angle,102),offset=sign>0?28:40,label=airfoilShockLabel(s,w);shockLabels.push(`<g data-shock-angle="${w.id}">${txt(pos[0]-sign*offset*Math.sin(angle),Math.max(68,Math.min(218,pos[1]-sign*offset*Math.cos(angle))),`${label} = ${fmt(w.beta*180/Math.PI,4)}°`,'#17212b',13,'middle')}</g>`);
  }else{
   const a=w.before.theta+sign*Math.asin(1/w.before.M),b=w.after.theta+sign*Math.asin(1/w.after.M);
   const count=Math.max(2,Math.min(9,Math.ceil(Math.abs(b-a)*180/Math.PI/2)+1)),radius=contour?900:119;
   const arc=Array.from({length:25},(_,i)=>ray(origin,a+(b-a)*i/24,radius));
   inner+=`<g ${contour?'clip-path="url(#airfoil-resolved)"':''} data-wave="expansion" data-region="${w.id}">`+(contour?'':poly([origin,...arc],'#edf4fa'));
   for(let i=0;i<count;i++){
    const end=ray(origin,a+(b-a)*i/(count-1),radius),edge=i===0||i===count-1;
    inner+=line(...origin,...end,edge?'#477caa':'#8baec9',edge?.95:.6);
   }
   inner+='</g>';
  }
 }
 const body=[...s.geometry.upper,...s.geometry.lower.slice().reverse()].map(V);
 inner+=poly(body,'#f2f4f5');
 // Each actual surface edge is black until its accepted Cp is available.
 for(const p of s.geometry.panels){
  const value=z?.panels.find(v=>v.id===p.id)?.Cp,accepted=Number.isFinite(value);
  inner+=`<g data-surface-region="${p.id}" data-surface-state="${accepted?'solved':'pending'}"><title>${p.id}${accepted?': Cp = '+fmt(value,6):''}</title>`+line(...V(p.a),...V(p.b),contour?'#17212b':accepted?color(value):'#000000',2.2)+'</g>';
 }
 for(const p of s.geometry.panels){
  const sign=p.side==='Upper'?1:-1,nx=-Math.sin(p.theta)*sign,ny=-Math.cos(p.theta)*sign;
  const [ax,ay]=V(p.a),[bx,by]=V(p.b),mx=(ax+bx)/2,my=(ay+by)/2;
  // Direction arrows sit outside the surface; short panels omit the arrow.
  if(p.length*L>48){
   let placement=null;const region=airfoilRegionLabel(s,p.id),same=(px,py)=>sampler?.sample((px-leadingX)/L,(150-py)/L)?.region===region;
   for(const fraction of [.72,.62,.82,.5]){for(const offset of [16,12,20,8,24,28]){
    const cx=ax+(bx-ax)*fraction+nx*offset,cy=ay+(by-ay)*fraction+ny*offset,local=sampler?.sample((cx-leadingX)/L,(150-cy)/L),theta=local?.theta??p.theta,dx=Math.cos(theta),dy=-Math.sin(theta);
    if(sampler&&(!same(cx,cy)||!same(cx-15*dx,cy-15*dy)||!same(cx+15*dx,cy+15*dy)||!same(cx+nx*5,cy+ny*5)||!same(cx-nx*5,cy-ny*5)))continue;
    placement={cx,cy,dx,dy,local};break;
   }if(placement)break;}
   if(placement){const {cx,cy,dx,dy,local}=placement,flowInk=contour&&local?readableInk(surfaceColor(schematic&&Number.isFinite(local.fanProgress)?1-local.fanProgress:(contour.property.read(local,s)-contour.min)/(contour.max-contour.min||1))):'#647681';
    inner+=`<g data-flow-region="${region}" data-flow-x="${cx}" data-flow-y="${cy}" data-flow-dx="${dx}" data-flow-dy="${dy}">`+line(cx-15*dx,cy-15*dy,cx+15*dx,cy+15*dy,flowInk,.9)+poly([[cx+15*dx,cy+15*dy],[cx+10*dx-2*dy,cy+10*dy+2*dx],[cx+10*dx+2*dy,cy+10*dy-2*dx]],flowInk)+'</g>';
   }
  }
  inner+=`<g data-airfoil-region="${airfoilRegionLabel(s,p.id)}">${txt(mx+nx*19,my+ny*19+4,airfoilRegionLabel(s,p.id),'#253945',17,'middle')}</g>`;
 }
 if(s.geometry.diamond||isFlatPlate(s))inner+=`<g data-airfoil-region="1">${txt(60,85,'1','#253945',17,'middle')}</g>`;
 if(trailing){
  const origin=V({x:1,y:0}),end=ray(origin,trailing.phi,173);
  inner+=`<g data-trailing-interface="${trailing.interfaceKind}">`+line(...origin,...end,'#344652',1,'5 4')+`<circle cx="${origin[0]}" cy="${origin[1]}" r="2.3" fill="#17212b"/>`+'</g>';
  // The arrow lies on the matched downstream streamline. Its horizontal
  // reference and angular arc use the same signed phi as both output states.
  const start=ray(origin,trailing.phi,38),tip=ray(start,trailing.phi,119),dx=Math.cos(trailing.phi),dy=-Math.sin(trailing.phi);
  const arc=Array.from({length:25},(_,i)=>ray(start,trailing.phi*i/24,37));
  inner+=`<g data-outlet-flow-angle="${trailing.slipAngle}">`+line(...start,start[0]+119,start[1],'#6c7e88',.85,'4 3')+line(...start,...tip,'#263c4d',1.8);
  inner+=poly([tip,[tip[0]-7*dx-3*dy,tip[1]-7*dy+3*dx],[tip[0]-7*dx+3*dy,tip[1]-7*dy-3*dx]],'#263c4d');
  inner+=`<polyline points="${arc.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#263c4d" stroke-width="1.1"/>`+txt(start[0]+46,start[1]+(trailing.phi>=0?16:-12),`φ = ${fmt(trailing.slipAngle,5)}°`,'#17212b',14,'middle')+'</g>';
  for(const [w,label]of [[trailing.upper,'TE-U+'],[trailing.lower,'TE-L+']]){
   const edge=w.rays.at(-1).angle,angle=(edge+trailing.phi)/2,pos=ray(origin,angle,152);
   if(!s.geometry.diamond){const display=airfoilRegionLabel(s,label);inner+=`<g data-airfoil-region="${display}">${txt(pos[0],pos[1]+4,display,'#253945',isFlatPlate(s)?17:12,'middle')}</g>`;}
  }
 }
 if(trailing&&s.geometry.diamond)inner+=`<g data-airfoil-region="6">${txt(608,165,'6','#253945',17,'middle')}</g>`;
 inner+=shockLabels.join('');
 inner+=incidenceGlyph(s.alpha,24,148,42,'#536977')+'</g>';
 inner+=line(leadingX,249,trailingX,249,'#a5b1b7',.8)+line(leadingX,245,leadingX,253,'#a5b1b7',.8)+line(trailingX,245,trailingX,253,'#a5b1b7',.8);
 inner+=txt(leadingX,269,'LE · x/c = 0','#53616b',12)+txt(trailingX,269,'TE · x/c = 1','#53616b',12,'end');
 inner+=line(100,289,122,289,'#000000',1.35)+txt(129,293,'Shock','#53616b',12)+line(217,289,239,289,'#477caa',.95)+txt(246,293,'Expansion fan','#53616b',12);
 if(trailing)inner+=line(415,289,437,289,'#344652',1,'5 4')+txt(444,293,trailing.interfaceKind,'#53616b',12);
 if(contour)inner=inner.replace(/<text\b([^>]*)>/g,(tag,a)=>{const px=Number(a.match(/\bx="([^"]+)"/)?.[1]),py=Number(a.match(/\by="([^"]+)"/)?.[1]);if(px<20||px>620||py<46||py>234)return tag;const z=sampler.sample((px-leadingX)/L,(150-py+6)/L);if(!z)return tag;const value=contour.property.read(z,s),ink=readableInk(surfaceColor(schematic&&Number.isFinite(z.fanProgress)?1-z.fanProgress:(value-contour.min)/(contour.max-contour.min||1)));return tag.replace(/fill="[^"]*"/,`fill="${ink}"`);});
 return {inner,label:schematic?'Schematic airfoil contours':'Analytical airfoil wave field',meta:schematic?'Approximate display; wave interactions are neglected.':'Local analytical states; unresolved wave interactions are unfilled',field:contour?{quantity:contour.key,options:Object.keys(airfoilFieldProperties),label:contour.property.label,min:contour.min,max:contour.max,units:contour.property.units,note:schematic?'Approximate display; wave interactions are neglected. Fan colors: local rainbow scale; read values with cursor. · β relative to local upstream flow':'Analytical local wave states · unfilled areas: unresolved interactions · β relative to local upstream flow',palette:airfoilPalette}:model?{quantity:'cp',options:['cp'],label:'Surface pressure coefficient Cp',min,max,units:'Cp',note:'Linearized surface values only; select Shock–Expansion for dimensional exterior contours',palette:airfoilPalette}:null};
}
