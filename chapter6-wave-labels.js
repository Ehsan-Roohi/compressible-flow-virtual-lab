import {deg} from './physics.js';

export const showChapter6WaveLabels=inputs=>/^6[-–](?:[1-9]|1[0-5]|P1[ab])$/.test(inputs.bookExample??'');

const number=(value,precision=4)=>Number(value.toFixed(precision)).toString();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))
 *Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const labelWidth=(line,size)=>[...line].reduce((width,c)=>width+(/[ .,:il₁|]/.test(c)?.32:/[MWΘ∞→]/.test(c)?.9:.57)*size,0);
const distance=(point,box)=>Math.hypot(
 point[0]-clamp(point[0],box.x,box.x+box.w),
 point[1]-clamp(point[1],box.y,box.y+box.h)
);

function existingLabels(svg){
 return [...svg.matchAll(/<text\b([^>]*)>([^<]+)<\/text>/g)].flatMap(([,attributes,label])=>{
  const get=key=>attributes.match(new RegExp('(?:^|\\s)'+key+'="([^"]*)"'))?.[1];
  const x=Number(get('x')),y=Number(get('y'));
  if(!Number.isFinite(x)||!Number.isFinite(y))return [];
  const font= /\d/.test(label)?16:Number(get('font-size')??14),width=labelWidth(label,font);
  const anchor=get('text-anchor');
  return [{x:x-(anchor==='end'?width:anchor==='middle'?width/2:0),y:y-font,w:width,h:font+4}];
 });
}

function placeLabel(label,bounds,occupied,points){
 const {x,y,w,h}=bounds,{lines,point}=label;
 const cardWidth=Math.max(...lines.map(line=>labelWidth(line,16)))+20,cardHeight=lines.length*18+8;
 const positionsX=[...Array.from({length:15},(_,i)=>x+(w-cardWidth)*i/14),
  point[0]-cardWidth-18,point[0]+18,point[0]-cardWidth/2];
 const positionsY=[...Array.from({length:13},(_,i)=>y+(h-cardHeight)*i/12),
  point[1]-cardHeight-16,point[1]+16,point[1]-cardHeight/2];
 let best,lowest=Infinity;
 for(const cx of positionsX)for(const cy of positionsY){
  const card={x:clamp(cx,x,x+w-cardWidth),y:clamp(cy,y,y+h-cardHeight),w:cardWidth,h:cardHeight};
  const cost=occupied.reduce((sum,box)=>sum+overlap(card,box)*box.weight,0)
   +points.reduce((sum,p)=>sum+(distance(p,card)<8?2400:0),0)
   +Math.abs(card.y+card.h/2-point[1])*.1+distance(point,card);
  if(cost<lowest){best=card;lowest=cost;}
 }
 occupied.push({...best,x:best.x-4,y:best.y-4,w:best.w+8,h:best.h+8,weight:100});
 return best;
}

function problemLabel(scene,inputs,point){
 const inlet=scene.freestream??scene.s1;
 const M=inlet?.M??scene.M??inputs.M1,p=inlet?.p!=null?inlet.p/1000:inputs.p1,T=inlet?.T??inputs.T1;
 const airfoil=scene.kind==='airfoil';
 const state=[
  Number.isFinite(M)&&`M${airfoil?'∞':'₁'} = ${number(M)}`,
  Number.isFinite(p)&&`p${airfoil?'∞':'₁'} = ${number(p,3)} kPa`,
  Number.isFinite(T)&&`T${airfoil?'∞':'₁'} = ${number(T,2)} K`
 ].filter(Boolean);
 const geometry=[];
 if(airfoil&&Number.isFinite(inputs.alpha))geometry.push(`α = ${number(inputs.alpha,2)}°`);
 if(/^6[-–]1[13]$/.test(inputs.bookExample)&&Number.isFinite(inputs.bookAirfoilChord))geometry.push(`c = ${number(inputs.bookAirfoilChord)} m`);
 if(/^6[-–]11$/.test(inputs.bookExample)&&Number.isFinite(inputs.bookFlightHeight))geometry.push(`h = ${number(inputs.bookFlightHeight)} m`);
 return {id:'inlet',color:'#245849',point,lines:[airfoil?'Freestream':'Inlet state',state.slice(0,2).join(' · '),[state[2],...geometry].filter(Boolean).join(' · ')].filter(Boolean)};
}

export function addChapter6WaveLabels(svg,waves,scene,inputs){
 const viewBox=svg.match(/\bviewBox="([^"]+)"/)?.[1];
 if(!viewBox)return svg;
 const [x,y,width,height]=viewBox.split(/\s+/).map(Number);
 const frame={x:x+10,y:y+9,w:width-20,h:height-18};
 const inlet=problemLabel(scene,inputs,[x+52,y+height*(scene.kind==='airfoil'?.43:.36)]);
 const occupied=existingLabels(svg).map(box=>({...box,weight:3}));
 if(scene.kind==='airfoil')occupied.push({x:x+108,y:y+height*.41,w:width*.64,h:height*.18,weight:5});
 let shocks=0,fans=0;
 const labels=(waves??[]).filter(w=>w.point?.length===2&&[...w.point,w.before?.M,w.after?.M,w.before?.theta,w.after?.theta,
  ...(w.kind==='Oblique shock'?[w.beta]:[])].every(Number.isFinite)).map(wave=>{
  const shock=wave.kind==='Oblique shock',id=shock?'S'+(++shocks):'F'+(++fans);
  const angle=shock?`β = ${number(deg(wave.beta),2)}° · `:'';
  const turn=number(deg(Math.abs(wave.after.theta-wave.before.theta)),2);
  return {id,point:wave.point,color:shock?'#7b352a':'#195b85',
   lines:[`${id} · ${wave.label}`,`${angle}θ = ${turn}°`,`M = ${number(wave.before.M)} → ${number(wave.after.M)}`]};
 });
 labels.unshift(inlet);
 const points=labels.map(label=>label.point);
 let leaders='',readouts='';
 for(const label of labels){
  const card=placeLabel(label,frame,occupied,points);
  const {id,color,point:[px,py],lines}=label;
  const edgeX=clamp(px,card.x,card.x+card.w),edgeY=clamp(py,card.y,card.y+card.h);
  const path=`M${px} ${py}L${edgeX} ${edgeY}`;
  leaders+=`<g data-wave-leader="${id}"><path d="${path}" stroke="#fff" stroke-width="3.5" fill="none"/><path d="${path}" stroke="${color}" stroke-width="1.5" fill="none"/><circle cx="${px}" cy="${py}" r="3" fill="${color}" stroke="#fff" stroke-width="1.1"/></g>`;
  readouts+=`<g ${id==='inlet'?'data-chapter6-problem=""':`data-wave-readout="${id}"`}><rect x="${card.x}" y="${card.y}" width="${card.w}" height="${card.h}" rx="5" fill="#fff" fill-opacity=".96" stroke="${color}" stroke-width="1"/>`
   +lines.map((line,i)=>`<text x="${card.x+10}" y="${card.y+17+18*i}" fill="${i?'#17383b':color}" font-size="16">${escape(line)}</text>`).join('')+'</g>';
 }
 const overlay=`<g data-chapter6-wave-labels="" aria-label="Inlet conditions and wave properties" pointer-events="none">${leaders}${readouts}</g>`;
 return svg.replace('viewBox="','data-chapter6-waves="" viewBox="').replace(/<\/svg>$/,`${overlay}</svg>`);
}
