// Sample the solved scalar field on a regular display grid. A cell is never
// inferred from its RGB colour. Empty samples represent unsolved space.
export function densitySchlierenMarkup(svg,cells){
 const box=svg.match(/\bviewBox="([^"]+)"/)?.[1].trim().split(/\s+/).map(Number);
 if(!box||box.length!==4||!cells.length)return '';
 const [left,top,width,height]=box;
 const step=Math.max(1,width/800,height/620);
 const nx=Math.ceil(width/step),ny=Math.ceil(height/step),area=nx*ny;
 const density=new Float64Array(area).fill(NaN),masks=new Map();
 function paint(points,write){
  if(points.length<3)return;
  const p=points.map(([x,y])=>[(x-left)/step,(y-top)/step]);
  const ys=p.map(q=>q[1]);
  const start=Math.max(0,Math.ceil(Math.min(...ys)-.5));
  const end=Math.min(ny,Math.ceil(Math.max(...ys)-.5));
  for(let j=start;j<end;j++){
   const y=j+.5,cross=[];
   for(let k=0;k<p.length;k++){
    const [x1,y1]=p[k],[x2,y2]=p[(k+1)%p.length];
    if((y1>y)!==(y2>y))cross.push(x1+(x2-x1)*(y-y1)/(y2-y1));
   }
   cross.sort((a,b)=>a-b);
   for(let k=0;k+1<cross.length;k+=2){
    const a=Math.max(0,Math.ceil(cross[k]-.5)),b=Math.min(nx,Math.ceil(cross[k+1]-.5));
    for(let x=a;x<b;x++)write(j*nx+x);
   }
  }
 }
 for(const {points,rho,mask} of cells){
  if(!Number.isFinite(rho))continue;
  if(mask&&!masks.has(mask)){
   const covered=new Uint8Array(area);
   paint(mask,i=>{covered[i]=1;});
   masks.set(mask,covered);
  }
  const covered=masks.get(mask);
  paint(points,i=>{if(!covered||covered[i])density[i]=rho;});
 }
 // Difference across four sample intervals. Average adjacent columns to
 // reduce aliasing of inclined fronts. Skip any stencil crossing the mask.
 const gradient=new Float64Array(area);
 let peak=0;
 for(let y=2;y<ny-2;y++)for(let x=1;x<nx-1;x++){
  const i=y*nx+x;
  if(!Number.isFinite(density[i]))continue;
  let sum=0,weight=0;
  for(let dx=-1;dx<=1;dx++){
   const a=i+dx-2*nx,b=i+dx+2*nx;
   let valid=true;
   for(let p=a;p<=b;p+=nx)if(!Number.isFinite(density[p])){valid=false;break;}
   if(!valid)continue;
   const w=dx===0?2:1;
   sum+=w*(density[a]-density[b]);weight+=w;
  }
  if(weight){gradient[i]=sum/weight;peak=Math.max(peak,Math.abs(gradient[i]));}
 }
 const paths=new Map();
 for(let y=0;y<ny;y++){
  let start=0,previous=-1;
  for(let x=0;x<=nx;x++){
   const i=y*nx+x,v=gradient[i];
   const strength=peak>0?Math.sign(v)*Math.sqrt(Math.abs(v)/peak):0;
   const tone=x===nx||!Number.isFinite(density[i])?-1:Math.round((144-(strength>=0?118:88)*strength)/4)*4;
   if(tone===previous)continue;
   if(previous>=0)paths.set(previous,(paths.get(previous)??'')+'M'+start+' '+y+'h'+(x-start)+'v1H'+start+'Z');
   start=x;previous=tone;
  }
 }
 return '<g data-density-schlieren="resolved-samples" shape-rendering="crispEdges" transform="translate('+left+' '+top+') scale('+step+')">'+
  [...paths].map(([tone,d])=>'<path fill="rgb('+tone+','+tone+','+tone+')" d="'+d+'"/>').join('')+'</g>';
}
