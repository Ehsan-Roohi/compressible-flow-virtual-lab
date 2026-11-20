import {deg} from './physics.js';

export const showChapter6WaveLabels=inputs=>/^6[-–](?:[1-9]|1[0-5])$/.test(inputs.bookExample??'');

export function addChapter6WaveLabels(svg,waves){
 const entries=(waves??[]).filter(w=>[w.before?.M,w.after?.M,w.before?.theta,w.after?.theta,
  ...(w.kind==='Oblique shock'?[w.beta]:[])].every(Number.isFinite));
 if(!entries.length)return svg;
 const viewBox=svg.match(/\bviewBox="([^"]+)"/)?.[1];
 if(!viewBox)return svg;
 const [x,y,width,height]=viewBox.split(/\s+/).map(Number),top=y+height;
 const rowHeight=66,extra=30+Math.ceil(entries.length/2)*rowHeight;
 const number=(value,precision)=>Number(value.toFixed(precision)).toString();
 const ink='#17383b';
 const text=(x,y,value,options='')=>`<text x="${x}" y="${y}" fill="${ink}" font-size="16" ${options}>${value}</text>`;
 let shocks=0,fans=0,markers='',readouts='';
 for(const [i,wave] of entries.entries()){
  const shock=wave.kind==='Oblique shock',id=shock?'S'+(++shocks):'F'+(++fans);
  if(wave.point){
   const [px,py]=wave.point;
   markers+=`<g data-wave-marker="${id}"><rect x="${px-13}" y="${py-11}" width="26" height="22" rx="6" fill="#17383b" stroke="#fff" stroke-width="1.4"/><text x="${px}" y="${py+5}" text-anchor="middle" fill="#fff" font-size="16">${id}</text></g>`;
  }
  const dx=x+24+i%2*(width/2),dy=top+46+Math.floor(i/2)*rowHeight;
  const turn=number(deg(Math.abs(wave.after.theta-wave.before.theta)),2);
  const angle=shock?`β = ${number(deg(wave.beta),2)}° · `:'';
  const mach=`M ${number(wave.before.M,4)} → ${number(wave.after.M,4)}`;
  readouts+=`<g data-wave-readout="${id}">${text(dx,dy,`${id} · ${wave.label}`)}${text(dx,dy+19,`${angle}θ = ${turn}°`)}${text(dx,dy+38,mach)}</g>`;
 }
 const panel=`<g data-chapter6-wave-labels="" aria-label="Wave angles and Mach numbers" pointer-events="none">${markers}<rect x="${x}" y="${top}" width="${width}" height="${extra}" fill="#f7faf7"/><path d="M${x} ${top}h${width}" stroke="#d7e2dc"/>${text(x+24,top+22,'θ: flow deflection magnitude · Mach: before → after')}${readouts}</g>`;
 return svg.replace(`viewBox="${viewBox}"`,`data-chapter6-waves="" viewBox="${x} ${y} ${width} ${height+extra}"`).replace(/<\/svg>$/,`${panel}</svg>`);
}
