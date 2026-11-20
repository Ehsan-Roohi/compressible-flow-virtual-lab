import {solveWaveWall} from './wave-wall.js?v=20261120-single-wall';
import {matchInteractionStreams,clipPolygon} from './wave-interaction.js';
import {PhysicsError,requireValue} from './numerics.js';
import {deg} from './physics.js';

export function solveSingleWall(x){
 const base=solveWaveWall(x),hit=base.intersection;
 const incident=base.waves.filter(w=>w.kind!=='No wave');
 if(!hit||incident.length!==2||incident.some(w=>w.kind!=='Oblique shock'||!hit.waveIds.includes(w.id)))return base;

 try{
  const {geometry:g,gamma,R}=base,sign=g.side==='Gas below wall'?-1:1;
  // Solve in gas-above-wall coordinates, then reflect the result if needed.
  const canonical=z=>({...z,theta:sign*z.theta,gamma,R});
  const [first,second]=incident;
  const z1=canonical(base.s1),z2=canonical(first.after),z3=canonical(second.after);
  const {root,phi,a,b,lo,hi}=matchInteractionStreams(z3,z1);
  const outgoing=[a,b],rays=outgoing.flatMap(w=>w.kind==='No wave'?[]:w.rays.map(ray=>({...ray,kind:w.kind})));
  const angles=[...rays.map(r=>r.angle),phi];
  requireValue(angles.every(angle=>Math.cos(angle)>1e-9),
   'An outgoing wave is not downstream-directed.','unsupported-pattern');
  const B=[hit.x,sign*hit.y],A=[first.origin.x,sign*first.origin.y],C=[second.origin.x,sign*second.origin.y];
  const atWall=g.panels.find(p=>p.a.x<=B[0]&&p.b.x>=B[0]);
  const wallSlope=Math.tan(sign*atWall.theta),wall=xx=>sign*atWall.a.y+wallSlope*(xx-atWall.a.x);
  const wallHits=angles.map(angle=>B[0]+(wall(B[0])-B[1])/(Math.tan(angle)-wallSlope))
   .filter(xx=>xx>B[0]+1e-8&&xx<=g.end);
  const nextCorner=g.panels.find(p=>p.a.x>B[0]&&p.theta!==atWall.theta)?.a.x??Infinity;
  const firstWallX=Math.min(...wallHits),endX=Math.min(g.end,firstWallX,nextCorner);
  requireValue(endX>B[0]+1e-8,'No open field remains downstream of the interaction.','geometry-limit');

  const startX=-.12*g.end,m1=Math.tan(sign*first.rays[0]),m2=Math.tan(sign*second.rays[0]);
  const rayY=(p,m,xx)=>p[1]+m*(xx-p[0]);
  // The upper edge clips the image. It never enters the wave or wall calculations.
  const H=1.12*Math.max(B[1],wall(endX),...angles.map(angle=>rayY(B,Math.tan(angle),endX)));
  const boundary=[[startX,0],...g.points.filter(p=>p.x<endX-1e-9).map(p=>[p.x,sign*p.y]),[endX,wall(endX)]];
  const domain=[...boundary,[endX,H],[startX,H]],fields=[];
  const physicalStates=new Map();
  const physical=z=>{
   if(!physicalStates.has(z))physicalStates.set(z,{...z,theta:sign*z.theta});
   return physicalStates.get(z);
  };
  const reflect=([xx,yy])=>[xx,sign*yy];
  const patch=(poly,state)=>{
   if(poly.length>=3)fields.push({poly:poly.map(reflect),state:physical(state)});
  };
  const strip=(l,r,ymin,ymax,state)=>{
   if(r-l>1e-10)patch([[l,ymin(l)],[r,ymin(r)],[r,ymax(r)],[l,ymax(l)]],state);
  };
  const firstRay=xx=>rayY(A,m1,xx),secondRay=xx=>rayY(C,m2,xx),top=()=>H;
  strip(startX,A[0],()=>0,top,z1);
  strip(A[0],B[0],firstRay,top,z1);
  strip(A[0],C[0],xx=>A[1]+Math.tan(z2.theta)*(xx-A[0]),firstRay,z2);
  strip(C[0],B[0],secondRay,firstRay,z2);
  strip(C[0],B[0],xx=>C[1]+Math.tan(z3.theta)*(xx-C[0]),secondRay,z3);
  const breaks=[-Math.PI/2,...new Set(angles)].sort((a,b)=>a-b).concat(Math.PI/2);
  const downstream=[[B[0],wall(B[0])],[endX,wall(endX)],[endX,H],[B[0],H]];
  for(let i=1;i<breaks.length;i++){
   const [low,high]=[breaks[i-1],breaks[i]],mid=(low+high)/2,w=mid<phi?a:b;
   const [head,tail]=[w.rays[0].angle,w.rays.at(-1).angle];
   const state=w.kind==='No wave'?w.after:w.side*(mid-head)>0?w.before:w.side*(mid-tail)<=0?w.after:
    w.rays.reduce((p,q)=>Math.abs(p.angle-mid)<Math.abs(q.angle-mid)?p:q).state;
   const side=angle=>([xx,yy])=>Math.cos(angle)*(yy-B[1])-Math.sin(angle)*(xx-B[0]);
   const belowHigh=side(high);
   patch(clipPolygon(clipPolygon(downstream,side(low)),p=>-belowHigh(p)),state);
  }
  const segment=angle=>({origin:reflect(B),end:reflect([endX,rayY(B,Math.tan(angle),endX)])});
  const wave=(w,before,after,title,origin)=>({...w,before:physical(before),after:physical(after),title,
   origin:{x:origin[0],y:sign*origin[1]}});
  const slip=Math.abs(Math.log(a.after.p0/b.after.p0))>1e-8?segment(phi):null;
  const limited=endX<g.end-1e-9;
  const waves=[wave(first,z1,z2,'Incident shock · 1 → 2',A),wave(second,z2,z3,'Incident shock · 2 → 3',C),
   wave(a,z3,a.after,a.kind+' · 3 → 4',B),wave(b,z1,b.after,b.kind+' · 1 → 5',B)];
  return {...base,interaction:true,singleWallInteraction:true,same:true,mirroredWall:sign<0,
   bookCase:/^6[-–]5$/.test(x.bookExample??'')?'6–5':null,geometryMode:'Custom geometry',
   regionLabels:{1:'1',2:'2',3:'3',4:'4',5:'5'},status:limited?'partial':'ok',limitX:limited?endX:null,
   reason:limited?'Regular interaction solved. The field ends at the next wall event.':null,
   s1:physical(z1),regions:{1:physical(z1),2:physical(z2),3:physical(z3),4:physical(a.after),5:physical(b.after)},
   waves,a,b,lower:z3,upper:z1,interval:[lo,hi],delta:sign*phi,slipAngle:slip?sign*deg(phi):null,residual:root.residual,
   geometry:{A:reflect(A),C:reflect(C),B:reflect(B),H,startX,endX,firstWallX,domain:domain.map(reflect),fields,
    incident:[{origin:reflect(A),end:reflect(B)},{origin:reflect(C),end:reflect(B)}],
    outgoing:rays.map(ray=>({...segment(ray.angle),kind:ray.kind})),slip,walls:{[g.side]:boundary.map(reflect)}}};
 }catch(e){
  if(!(e instanceof PhysicsError))throw e;
  return {...base,reason:e.message};
 }
}
