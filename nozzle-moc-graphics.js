import {isentropic,deg} from './physics.js';
import {contourColor,contourRamp} from './contour-raster.js?v=20261117-closed-piston';

const properties={
 mach:{label:'Mach number',unit:'M',value:p=>p.M},
 'pressure-ratio':{label:'Static pressure ratio p/p₀',unit:'',value:(p,g)=>1/isentropic(p.M,g).p0p},
 'temperature-ratio':{label:'Static temperature ratio T/T₀',unit:'',value:(p,g)=>1/isentropic(p.M,g).T0T},
 'density-ratio':{label:'Density ratio ρ/ρ₀',unit:'',value:(p,g)=>1/isentropic(p.M,g).rho0rho},
 'flow-angle':{label:'Flow angle θ',unit:'°',value:(p,g,side)=>side*deg(p.theta)},
 'speed-ratio':{label:'Flow speed ratio u/a₀',unit:'',value:(p,g)=>p.M/Math.sqrt(isentropic(p.M,g).T0T)},
 'sound-speed-ratio':{label:'Sound speed ratio a/a₀',unit:'',value:(p,g)=>1/Math.sqrt(isentropic(p.M,g).T0T)},
};

function forEachTriangle(mesh,wall,visit,fan){
 const first=mesh[0],corner=wall[0];
 const inlet={x:0,y:0,M:corner.M,theta:0};
 visit(inlet,{...corner,theta:0},{...inlet,x:first[0].x},fan?.[0]);
 for(let j=0;j<first.length-1;j++){
  const a=first[j],b=first[j+1];
  // The ideal sharp corner is a singular point. Use the mean fan-cell state there for display.
  visit({...corner,M:(a.M+b.M)/2,theta:(a.theta+b.theta)/2},a,b,fan?.[j+1]);
 }
 for(let i=1;i<mesh.length;i++){
  const a=mesh[i-1],b=mesh[i];
  const regional=!!fan;
  visit(a[0],a[1],b[0],regional?a[0]:null);
  for(let j=0;j<b.length-1;j++){
   const state=regional?a[j+1]:null;
   visit(a[j+1],a[j+2],b[j],state);
   visit(a[j+2],b[j+1],b[j],state);
  }
 }
 const [axis,edge]=mesh.at(-1);
 visit(axis,edge,{...axis,x:edge.x},fan?axis:null);
}

function triangleInterpolator(a,b,c){
 const [ax,ay,va]=a,[bx,by,vb]=b,[cx,cy,vc]=c;
 const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
 if(Math.abs(det)<1e-12)return null;
 return (x,y)=>{
  const dx=x-cx,dy=y-cy;
  const u=((by-cy)*dx+(cx-bx)*dy)/det,v=((cy-ay)*dx+(ax-cx)*dy)/det,w=1-u-v;
  return Math.min(u,v,w)<-1e-8?NaN:Math.max(0,Math.min(1,u*va+v*vb+w*vc));
 };
}

function rasterField(triangles,W,H){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');
 const width=canvas.width=2*W,height=canvas.height=2*H;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 const image=ctx.createImageData(width,height),pixels=image.data;
 const values=new Float32Array(width*height).fill(NaN);
 const colors=Array.from({length:1024},(_,i)=>contourColor(i/1023));
 triangles((a,b,c)=>{
  const interpolate=triangleInterpolator(a,b,c);
  if(!interpolate)return;
  const [ax,ay]=a,[bx,by]=b,[cx,cy]=c;
  const xmin=Math.max(0,Math.floor(2*Math.min(ax,bx,cx))),xmax=Math.min(width-1,Math.ceil(2*Math.max(ax,bx,cx)));
  const ymin=Math.max(0,Math.floor(2*Math.min(ay,by,cy))),ymax=Math.min(height-1,Math.ceil(2*Math.max(ay,by,cy)));
  for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
   const t=interpolate((x+.5)/2,(y+.5)/2);
   if(!Number.isFinite(t))continue;
   const index=y*width+x,rgb=colors[Math.round(1023*t)],k=4*index;
   values[index]=t;
   pixels[k]=rgb[0];pixels[k+1]=rgb[1];pixels[k+2]=rgb[2];pixels[k+3]=255;
  }
 });
 ctx.putImageData(image,0,0);
 return {
  drawing:`<image width="${W}" height="${H}" href="${canvas.toDataURL('image/png')}"/>`,
  sample:(x,y)=>x>=0&&x<W&&y>=0&&y<H?values[Math.floor(2*y)*width+Math.floor(2*x)]:NaN
 };
}

function sampleTriangles(triangles,x,y){
 let value=NaN;
 triangles((a,b,c)=>{
  if(x<Math.min(a[0],b[0],c[0])||x>Math.max(a[0],b[0],c[0])||
     y<Math.min(a[1],b[1],c[1])||y>Math.max(a[1],b[1],c[1]))return;
  const t=triangleInterpolator(a,b,c)?.(x,y);
  if(Number.isFinite(t))value=t;
 });
 return value;
}

function contourField({mesh,wall,fan},gamma,quantity,project,W,H){
 const {label,unit,value}=properties[quantity];
 const inlet={...wall[0],theta:0},exit=wall.at(-1);
 const limit=deg(wall[0].theta);
 const range=quantity==='flow-angle'?[-limit,limit]:[value(inlet,gamma),value(exit,gamma)];
 const min=Math.min(...range),max=Math.max(...range);
 const normal=v=>max-min<1e-12?.5:(v-min)/(max-min);
 const triangles=visit=>forEachTriangle(mesh,wall,(a,b,c,state)=>{
  for(const side of [1,-1]){
   const constant=state?normal(value(state,gamma,side)):null;
   visit(...[a,b,c].map(p=>[...project(p,side),constant??normal(value(p,gamma,side))]));
  }
 },fan);
 const raster=rasterField(triangles,W,H);
 let drawing=raster?.drawing;
 if(!raster){
  const paths=new Map();
  triangles((a,b,c)=>{
   const t=Math.round(255*(a[2]+b[2]+c[2])/3);
   const color='#'+contourColor(t/255).map(v=>v.toString(16).padStart(2,'0')).join('');
   const path='M'+[a,b,c].map(p=>p.slice(0,2).map(v=>v.toFixed(2)).join(',')).join('L')+'Z';
   paths.set(color,(paths.get(color)??'')+path);
  });
  drawing=[...paths].map(([color,d])=>`<path d="${d}" fill="${color}"/>`).join('');
 }
 const sample=(x,y)=>{
  const t=raster?raster.sample(x,y):sampleTriangles(triangles,x,y);
  return Number.isFinite(t)?min+t*(max-min):null;
 };
 return {drawing,sample,field:{quantity,options:Object.keys(properties),label,min,max,units:unit,
  note:fan?'Piecewise-constant region states':'Interpolated characteristic field',palette:contourRamp}};
}

export function nozzleMocDrawing(design,gamma=1.4,quantity='mach',showCharacteristics=true,viewport){
 const {mesh,wall,exitMach}=design;
 if(!Object.hasOwn(properties,quantity))quantity='mach';
 const W=640, H=300, last=wall.at(-1);
 const scale=viewport?.scale??Math.min(526/last.x,104/last.y);
 const x0=viewport?.x0??(W-last.x*scale)/2, cy=150;
 const clipId=viewport?.clipId??'nozzle-moc-domain';
 const project=({x,y},side=1)=>[x0+x*scale,cy-side*y*scale];
 const point=(p,side=1)=>project(p,side).map(v=>v.toFixed(2)).join(',');
 const outline=side=>wall.map(p=>point(p,side)).join(' ');
 const path=(points,side)=>'M'+points.map(p=>point(p,side)).join('L');
 const stride=Math.ceil(mesh.length/22);
 const {drawing,field,sample}=contourField(design,gamma,quantity,project,W,H);
 let minus='',plus='';
 for(const side of [1,-1]){
  let reflected='',incident='';
  // Draw full characteristic lines at a readable density on refined grids.
  for(let i=0;i<mesh.length;i++)if(i%stride===0||i===mesh.length-1)
   reflected+=path(mesh[i],side);
  for(let j=0;j<mesh.length;j++)if(j%stride===0||j===mesh.length-1){
   const ray=[wall[0]];
   for(let i=0;i<=j;i++)ray.push(mesh[i][j-i]);
   incident+=path(ray,side);
  }
  minus+=side===1?incident:reflected;
  plus+=side===1?reflected:incident;
 }
 const x1=x0+last.x*scale, close=x1-x0<178;
 const probe=(sx,sy)=>{
  const x=(sx-x0)/scale,y=(cy-sy)/scale;
  if(x<0||x>last.x)return null;
  let lo=0,hi=wall.length-1;
  while(hi-lo>1){
   const mid=(lo+hi)>>1;
   if(wall[mid].x<=x)lo=mid;else hi=mid;
  }
  const a=wall[lo],b=wall[hi],height=a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);
  if(Math.abs(y)>height)return null;
  const value=sample(sx,sy);
  if(value===null)return null;
  return {x:x*design.halfHeight,y:y*design.halfHeight,value,method:design.method};
 };
 const inletLabel=design.inletMach>1?'Inlet · M = '+Number(design.inletMach.toPrecision(6)):'Sonic throat';
 const frame=(x,h)=>`<line x1="${x}" y1="${cy-h*scale}" x2="${x}" y2="${cy+h*scale}" stroke="#607773" stroke-dasharray="4 3"/>`;
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Computed minimum-length nozzle contour and characteristic net">
  <title>Minimum-length nozzle and characteristic net</title>
  <rect width="${W}" height="${H}" fill="#fcfefd"/>
  <defs><clipPath id="${clipId}"><polygon points="${outline(1)} ${wall.slice().reverse().map(p=>point(p,-1)).join(' ')}"/></clipPath></defs>
  <g data-nozzle-moc-field="${quantity}" clip-path="url(#${clipId})">${drawing}</g>
  ${showCharacteristics?`<g data-nozzle-moc-characteristics="true" fill="none" stroke-width=".85">
   <path d="${minus}" stroke="#ffffff" stroke-opacity=".8"/>
   <path d="${plus}" stroke="#17383b" stroke-opacity=".7"/>
  </g>`:''}
  ${frame(x0,1)}${frame(x1,last.y)}
  <line x1="${x0-12}" y1="${cy}" x2="${x1+12}" y2="${cy}" stroke="#637a73" stroke-dasharray="5 4"/>
  <g fill="none" stroke="#17383b" stroke-width="2.5" stroke-linejoin="round">
   <polyline points="${outline(1)}"/><polyline points="${outline(-1)}"/>
  </g>
  ${viewport?`<text x="320" y="20" font-size="17" text-anchor="middle" fill="#17383b" font-weight="bold">${design.method}</text>`:''}
  <g font-size="15" fill="#17383b" text-anchor="middle">
   <text x="${x0-(close?8:0)}" y="${cy-scale-13}" text-anchor="${close?'end':'middle'}">${inletLabel}</text>
   <text x="${x1+(close?8:0)}" y="${cy-last.y*scale-13}" text-anchor="${close?'start':'middle'}">Exit · M = ${exitMach}</text>
  </g>
  ${showCharacteristics?`<g font-size="13" fill="#17383b">
   <rect x="170" y="265" width="39" height="17" rx="3" fill="#607773"/>
   <path d="M175 273h29" stroke="#ffffff"/><text x="212" y="277">C− characteristics</text>
   <path d="M341 273h29" stroke="#17383b"/><text x="378" y="277">C+ characteristics</text>
  </g>`:''}
 </svg>`,label:field.label,field,probe,meta:'Planar flow · equal axial and transverse scale'};
}

export function compareNozzleMocDrawing({designs},gamma,quantity,showCharacteristics){
 const exits=designs.map(design=>design.wall.at(-1));
 const maxX=Math.max(...exits.map(exit=>exit.x)),maxY=Math.max(...exits.map(exit=>exit.y));
 const scale=Math.min(526/maxX,104/maxY),x0=(640-maxX*scale)/2;
 const views=designs.map((design,i)=>nozzleMocDrawing(design,gamma,quantity,showCharacteristics,
  {scale,x0,clipId:`nozzle-moc-domain-${i}`}));
 const panels=views.map(({svg},i)=>`<g transform="translate(0 ${300*i})" data-nozzle-moc-method="${designs[i].method}">
  ${svg.replace(/^<svg[^>]*>|<\/svg>$/g,'')}
 </g>`).join('');
 const first=views[0];
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 600" role="img" aria-label="Comparison of the two nozzle characteristic nets">
  <title>Nozzle characteristic nets on a common scale</title>
  ${panels}
  <path d="M18 300H622" stroke="#cedcd8"/>
 </svg>`,label:first.label,meta:'Shared geometry and color scale',
 probe:(x,y)=>y<300?views[0].probe(x,y):views[1].probe(x,y-300),
 field:{...first.field,note:'Common color scale for both methods'}};
}
