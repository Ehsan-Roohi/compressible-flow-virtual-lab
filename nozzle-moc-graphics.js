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

function forEachTriangle(mesh,wall,visit){
 const inlet={x:0,y:0,M:1,theta:0};
 const first=mesh[0],throat=wall[0];
 const sonicCorner={...throat,M:1,theta:0};
 visit(inlet,sonicCorner,{...first[0],M:1,theta:0});
 for(let j=0;j<first.length-1;j++){
  const a=first[j],b=first[j+1];
  // The ideal sharp corner is a singular point. Use the mean fan-cell state there for display.
  visit({...throat,M:(a.M+b.M)/2,theta:(a.theta+b.theta)/2},a,b);
 }
 for(let i=1;i<mesh.length;i++){
  const a=mesh[i-1],b=mesh[i];
  visit(a[0],a[1],b[0]);
  for(let j=0;j<b.length-1;j++){
   visit(a[j+1],a[j+2],b[j]);
   visit(a[j+2],b[j+1],b[j]);
  }
 }
 const [axis,edge]=mesh.at(-1);
 visit(axis,edge,{...axis,x:edge.x});
}

function rasterField(triangles,W,H){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');
 const width=canvas.width=2*W,height=canvas.height=2*H;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 const image=ctx.createImageData(width,height),pixels=image.data;
 const colors=Array.from({length:1024},(_,i)=>contourColor(i/1023));
 triangles((a,b,c)=>{
  const [ax,ay]=a,[bx,by]=b,[cx,cy]=c;
  const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
  if(Math.abs(det)<1e-12)return;
  const xmin=Math.max(0,Math.floor(2*Math.min(ax,bx,cx))),xmax=Math.min(width-1,Math.ceil(2*Math.max(ax,bx,cx)));
  const ymin=Math.max(0,Math.floor(2*Math.min(ay,by,cy))),ymax=Math.min(height-1,Math.ceil(2*Math.max(ay,by,cy)));
  for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
   const dx=(x+.5)/2-cx,dy=(y+.5)/2-cy;
   const u=((by-cy)*dx+(cx-bx)*dy)/det,v=((cy-ay)*dx+(ax-cx)*dy)/det,w=1-u-v;
   if(Math.min(u,v,w)<-1e-8)continue;
   const t=Math.max(0,Math.min(1,u*a[2]+v*b[2]+w*c[2]));
   const rgb=colors[Math.round(1023*t)],k=4*(y*width+x);
   pixels[k]=rgb[0];pixels[k+1]=rgb[1];pixels[k+2]=rgb[2];pixels[k+3]=255;
  }
 });
 ctx.putImageData(image,0,0);
 return `<image width="${W}" height="${H}" href="${canvas.toDataURL('image/png')}"/>`;
}

function contourField(mesh,wall,gamma,quantity,project,W,H){
 const {label,unit,value}=properties[quantity];
 let min=Infinity,max=-Infinity;
 const each=visit=>forEachTriangle(mesh,wall,(...vertices)=>{
  for(const side of [1,-1])visit(vertices,side);
 });
 each((vertices,side)=>{for(const p of vertices){
  const v=value(p,gamma,side);
  min=Math.min(min,v);max=Math.max(max,v);
 }});
 const normal=v=>max-min<1e-12?.5:(v-min)/(max-min);
 const triangles=visit=>each((vertices,side)=>visit(...vertices.map(p=>[...project(p,side),normal(value(p,gamma,side))])));
 let drawing=rasterField(triangles,W,H);
 if(!drawing){
  const paths=new Map();
  triangles((a,b,c)=>{
   const t=Math.round(255*(a[2]+b[2]+c[2])/3);
   const color='#'+contourColor(t/255).map(v=>v.toString(16).padStart(2,'0')).join('');
   const path='M'+[a,b,c].map(p=>p.slice(0,2).map(v=>v.toFixed(2)).join(',')).join('L')+'Z';
   paths.set(color,(paths.get(color)??'')+path);
  });
  drawing=[...paths].map(([color,d])=>`<path d="${d}" fill="${color}"/>`).join('');
 }
 return {drawing,field:{quantity,options:Object.keys(properties),label,min,max,units:unit,
  note:'Interpolated characteristic field',palette:contourRamp}};
}

export function nozzleMocDrawing({mesh,wall,exitMach},gamma=1.4,quantity='mach',showCharacteristics=true){
 if(!Object.hasOwn(properties,quantity))quantity='mach';
 const W=640, H=300, last=wall.at(-1);
 const scale=Math.min(526/last.x,104/last.y);
 const x0=(W-last.x*scale)/2, cy=150;
 const project=({x,y},side=1)=>[x0+x*scale,cy-side*y*scale];
 const point=(p,side=1)=>project(p,side).map(v=>v.toFixed(2)).join(',');
 const outline=side=>wall.map(p=>point(p,side)).join(' ');
 const path=(points,side)=>'M'+points.map(p=>point(p,side)).join('L');
 const stride=Math.ceil(mesh.length/22);
 const {drawing,field}=contourField(mesh,wall,gamma,quantity,project,W,H);
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
 const frame=(x,h)=>`<line x1="${x}" y1="${cy-h*scale}" x2="${x}" y2="${cy+h*scale}" stroke="#607773" stroke-dasharray="4 3"/>`;
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Computed minimum-length nozzle contour and characteristic net">
  <title>Minimum-length nozzle and characteristic net</title>
  <rect width="${W}" height="${H}" fill="#fcfefd"/>
  <defs><clipPath id="nozzle-moc-domain"><polygon points="${outline(1)} ${wall.slice().reverse().map(p=>point(p,-1)).join(' ')}"/></clipPath></defs>
  <g data-nozzle-moc-field="${quantity}" clip-path="url(#nozzle-moc-domain)">${drawing}</g>
  ${showCharacteristics?`<g data-nozzle-moc-characteristics="true" fill="none" stroke-width=".85">
   <path d="${minus}" stroke="#ffffff" stroke-opacity=".8"/>
   <path d="${plus}" stroke="#17383b" stroke-opacity=".7"/>
  </g>`:''}
  ${frame(x0,1)}${frame(x1,last.y)}
  <line x1="${x0-12}" y1="${cy}" x2="${x1+12}" y2="${cy}" stroke="#637a73" stroke-dasharray="5 4"/>
  <g fill="none" stroke="#17383b" stroke-width="2.5" stroke-linejoin="round">
   <polyline points="${outline(1)}"/><polyline points="${outline(-1)}"/>
  </g>
  <g font-size="15" fill="#17383b" text-anchor="middle">
   <text x="${x0-(close?8:0)}" y="${cy-scale-13}" text-anchor="${close?'end':'middle'}">Sonic throat</text>
   <text x="${x1+(close?8:0)}" y="${cy-last.y*scale-13}" text-anchor="${close?'start':'middle'}">Exit · M = ${exitMach}</text>
  </g>
  ${showCharacteristics?`<g font-size="13" fill="#17383b">
   <rect x="170" y="265" width="39" height="17" rx="3" fill="#607773"/>
   <path d="M175 273h29" stroke="#ffffff"/><text x="212" y="277">C− characteristics</text>
   <path d="M341 273h29" stroke="#17383b"/><text x="378" y="277">C+ characteristics</text>
  </g>`:''}
 </svg>`,label:field.label,field,meta:'Planar flow · equal axial and transverse scale'};
}
