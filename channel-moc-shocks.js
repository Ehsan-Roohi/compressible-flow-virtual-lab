import {solveWaveChannel,channelOrdinate} from './wave-channel.js';
import {state,obliqueShock,normalShock,turnAngle,shockLimit,prandtlMeyer,rad} from './physics.js';
import {matchInteractionStreams} from './wave-interaction.js?v=20261120-opposing-moc';
import {regularPattern,solveRegularChannel} from './regular-channel.js';
import {requireValue,PhysicsError} from './numerics.js';
// Rotational planar characteristic marching with explicit, one-sided shock
// boundaries. In smooth flow: d(theta) +/- sqrt(M²-1)/(gamma M²) d(ln p)=0
// on C+/C-, while ln(p0) is transported on streamlines. T0 is constant.
// General marching handles one active fitted shock. For two straight
// opposing ramps, constant characteristic patches meet at fitted waves.
const mix=(a,b,t)=>({theta:a.theta+(b.theta-a.theta)*t,l:a.l+(b.l-a.l)*t,k:a.k+(b.k-a.k)*t});
const coeff=z=>Math.sqrt(z.M*z.M-1)/(z.g*z.M*z.M);
export function fittedJumpResidual(before,after,beta,g=1.4){
 const delta=Math.abs(after.theta-before.theta),un1=before.u*Math.sin(beta),un2=after.u*Math.sin(beta-delta),ut1=before.u*Math.cos(beta),ut2=after.u*Math.cos(beta-delta),energy1=g/(g-1)*before.p/before.rho+before.u**2/2,energy2=g/(g-1)*after.p/after.rho+after.u**2/2;
 const relative=(a,b)=>Math.abs(a-b)/Math.max(1,Math.abs(a),Math.abs(b));
 return Math.max(relative(before.rho*un1,after.rho*un2),relative(before.p+before.rho*un1**2,after.p+after.rho*un2**2),relative(ut1,ut2),relative(energy1,energy2),Math.max(0,Math.log(after.p0/before.p0)));
}
export function fittedState(r,z){const p=Math.exp(z.l),factor=Math.exp((z.k-z.l)*(r.gamma-1)/r.gamma),M=Math.sqrt(2*(factor-1)/(r.gamma-1));return {...state(M,r.s1.T0/factor,p,r.gamma,r.R),theta:z.theta};}
function packed(s,g){return {theta:s.theta??0,l:Math.log(s.p),k:Math.log(s.p0),M:s.M,g};}
function decoded(z,g){const M=Math.sqrt(2*Math.expm1((z.k-z.l)*(g-1)/g)/(g-1));requireValue(Number.isFinite(M)&&M>1.00001&&M<=50&&Math.abs(z.theta)+Math.asin(1/M)<Math.PI/2-1e-5,'The fitted characteristic field reaches a sonic, upstream-directed or Mach-50 boundary.','moc-limit');return {...z,M,g};}
function interp(region,y,g){
 const a=region.z,N=a.length,t=region.hi-region.lo>1e-12?Math.max(0,Math.min(N-1,(y-region.lo)/(region.hi-region.lo)*(N-1))):0,i=Math.min(N-2,Math.floor(t)),f=t-i;
 const harmonic=(x,y)=>x*y>0?2*x*y/(x+y):0;
 const value=key=>{const left=a[i][key],right=a[i+1][key],d=right-left,m0=i?harmonic(left-a[i-1][key],d):d,m1=i+2<N?harmonic(d,a[i+2][key]-right):d;
  const v=(2*f**3-3*f*f+1)*left+(f**3-2*f*f+f)*m0+(-2*f**3+3*f*f)*right+(f**3-f*f)*m1;
  return Math.max(Math.min(left,right),Math.min(Math.max(left,right),v));
 };
 return decoded({theta:value('theta'),l:value('l'),k:value('k')},g);
}
const angle=(z,f)=>z.theta+(f?f*Math.asin(1/z.M):0);
function wallAngle(w,x){return (w.panels.find(p=>x<p.b.x-1e-10)??w.panels.at(-1)).theta;}
export function needsShockFitting(x){for(const [segments,side]of [[x.wallSegments,1],[x.upperWallSegments,-1]]){let last=0;for(const p of segments??[]){if(side*(rad(p.angle)-last)>1e-10)return true;last=rad(p.angle);}}return false;}
// With straight inlet ramps, every smooth patch has constant theta, ln p
// and ln p0. Both characteristic compatibility equations and streamline
// transport are then exact. Only the jump conditions couple the patches.
function solveOpposingRamps(base,N){
 const {geometry:g,gamma,s1}=base;
 const lower=base.waves.find(w=>w.wall==='L'&&w.origin.x===0);
 const upper=base.waves.find(w=>w.wall==='U'&&w.origin.x===0);
 requireValue(lower?.kind==='Oblique shock'&&upper?.kind==='Oblique shock',
  'Both inlet ramps must generate attached oblique shocks.','moc-topology');
 const slope=w=>Math.tan(w.rays[0]),m1=slope(lower),m2=slope(upper);
 const x=g.height/(m1-m2),y=m1*x;
 const low=xx=>channelOrdinate(g.lower,xx),high=xx=>channelOrdinate(g.upper,xx);
 requireValue(x>0&&x<g.end-1e-9&&low(x)<y&&y<high(x),
  'The shocks must meet inside the shared channel.','moc-topology');
 const {a,b,phi}=matchInteractionStreams({...lower.after,gamma,R:base.R},{...upper.after,gamma,R:base.R});
 requireValue(a.kind==='Oblique shock'&&b.kind==='Oblique shock',
  'The collision must produce two attached outgoing shocks and a slip line.','moc-topology');
 const states=[s1,lower.after,upper.after,a.after,b.after];
 const [inlet,postLower,postUpper,belowSlip,aboveSlip]=states.map(z=>decoded(packed(z,gamma),gamma));
 const slopes=[Math.tan(a.rays[0].angle),Math.tan(phi),Math.tan(b.rays[0].angle)];
 requireValue(slopes[0]<slopes[1]&&slopes[1]<slopes[2],
  'The outgoing waves must bound two distinct downstream streams.','moc-topology');
 const wallHits=slopes.flatMap(m=>[[low(x),Math.tan(g.lower.panels[0].theta)],
  [high(x),Math.tan(g.upper.panels[0].theta)]].map(([wall,mw])=>(wall-y)/(m-mw)))
  .filter(distance=>distance>1e-9&&Number.isFinite(distance));
 const firstWall=x+Math.min(...wallHits),end=Math.min(g.end,firstWall);
 requireValue(end-x>1e-8,'An outgoing wave reaches a wall at the interaction.','moc-topology');

 const ray=(xx,m)=>y+m*(xx-x);
 const mesh=(start,finish,lines,patches)=>{
  const sections=Math.min(72,N);
  return Array.from({length:sections+1},(_,i)=>{
   const xx=i===sections?finish:start+(finish-start)*i/sections;
   const lower=low(xx),upper=high(xx);
   const bounds=[lower,...lines.map(f=>Math.max(lower,Math.min(upper,f(xx)))),upper];
   return {x:xx,lower,upper,parts:patches.map((z,j)=>({lo:bounds[j],hi:bounds[j+1],z:Array(N).fill(z)}))};
  });
 };
 const rows=[...mesh(0,x,[xx=>m1*xx,xx=>g.height+m2*xx],[postLower,inlet,postUpper]),
  ...mesh(x,end,slopes.map(m=>xx=>ray(xx,m)),[postLower,belowSlip,aboveSlip,postUpper])];
 const incident=(w,startY)=>({beta:w.beta,before:s1,after:w.after,start:[0,startY],end:[x,y]});
 const outgoing=(w,m)=>({beta:w.beta,before:w.before,after:w.after,start:[x,y],end:[end,ray(end,m)]});
 const waves=[incident(lower,0),incident(upper,g.height),outgoing(a,slopes[0]),outgoing(b,slopes[2])];
 const traces=waves.map(({start,end,...jump},i)=>({id:i+1,side:[1,-1,-1,1][i],
  type:i<2?'Incident shock':'Outgoing shock',points:[start,end].map(([x,y])=>({x,y,...jump}))}));
 const inletFlux=s1.rho*s1.u*g.height;
 const massResidual=row=>Math.abs(row.parts.reduce((sum,p)=>{
  const z=fittedState(base,p.z[0]);
  return sum+(p.hi-p.lo)*z.rho*z.u*Math.cos(z.theta);
 },0)/inletFlux-1);
 const maxMassResidual=Math.max(...rows.map(massResidual));
 const maxJumpResidual=Math.max(...waves.map(w=>fittedJumpResidual(w.before,w.after,w.beta,gamma)));
 requireValue(maxMassResidual<1e-7&&maxJumpResidual<1e-7,
  'The matched shock field did not satisfy mass and shock conservation.','moc-accuracy');
 const stopsAtWall=firstWall<=g.end+1e-9;
 const status=end<g.end-1e-9?'partial':'ok';
 const reason=stopsAtWall?'Regular shock interaction solved. The characteristic field ends at the first downstream wall encounter.':null;
 const slip={angle:phi,pressure:(a.after.p+b.after.p)/2,pressureResidual:Math.abs(Math.log(a.after.p/b.after.p)),
  points:[{x,y},{x:end,y:ray(end,slopes[1])}]};
 return {...base,status,reason,limitX:stopsAtWall?end:null,
  regions:{1:s1,2:lower.after,3:upper.after,'4′':a.after,4:b.after},
  waves:traces.map(t=>({id:'S'+t.id,kind:'Oblique shock',title:t.type+' · S'+t.id,
   origin:{x:t.points[0].x,y:t.points[0].y},before:t.points[0].before,after:t.points[0].after,beta:t.points[0].beta})),
  moc:{fitted:true,status,rows,traces,resolution:N,slip,massResidual:massResidual(rows.at(-1)),
   maxMassResidual,maxJumpResidual,events:[{type:'Wave interaction',x,y}]}};
}
export function solveFittedChannelMOC(x){
 const base=solveWaveChannel(x),g=base.gamma,R=base.R,G=base.geometry,N=Math.round(x.mocResolution??81),H=G.height,T0=base.s1.T0;
 requireValue(Number.isFinite(N)&&N>=31&&N<=201,'MOC resolution must be 31–201 points across each smooth region.');
 const r={...base,waves:[],panels:[],regions:{Inlet:base.s1},moc:{fitted:true,rows:[],traces:[],resolution:N,massResidual:0,maxMassResidual:0,maxJumpResidual:0,events:[]},status:'unsupported',reason:null,limitX:0};
 const straight=w=>w.panels.every(p=>p.a.x>=G.end-1e-9||Math.abs(p.theta-w.panels[0].theta)<1e-10);
 if(regularPattern(G)?.same){
  try{return solveSuccessiveRamps(x,base,N);}
  catch(e){if(!(e instanceof PhysicsError))throw e;}
 }
 if(wallAngle(G.lower,0)>1e-10&&wallAngle(G.upper,0)<-1e-10&&straight(G.lower)&&straight(G.upper)){
  try{return solveOpposingRamps(base,N);}
  catch(e){if(!(e instanceof PhysicsError))throw e;return {...r,reason:e.message,moc:{...r.moc,status:'unsupported'}};}
 }
 const inlet=packed(base.s1,g),traces=r.moc.traces;let front=null,traceId=0,reason=null,totalPoints=0;
 const fresh=(lo,hi,z)=>({lo,hi,z:Array.from({length:N},()=>({...z}))});
 const record=(f,xx)=>{r.moc.maxJumpResidual=Math.max(r.moc.maxJumpResidual,fittedJumpResidual(f.before,f.after,f.beta,g));const q={x:xx,y:f.y,beta:f.beta,before:f.before,after:f.after};f.trace.points.push(q);};
 const shock=(s,beta,side)=>{const delta=turnAngle(s.M,beta,g),w=normalShock(s.M*Math.sin(beta),g),theta=s.theta+side*delta,M=w.M2/Math.sin(beta-delta);return {...state(M,s.T*w.T,s.p*w.p,g,R),theta};};
 const startShock=(s,theta,side,xx,y,type)=>{const w=obliqueShock(s.M,Math.abs(theta-s.theta),g),after={...state(w.M2,s.T*w.T,s.p*w.p,g,R),theta};decoded(packed(after,g),g);const trace={id:++traceId,side,type,points:[]};traces.push(trace);const f={side,y,beta:w.beta,m:Math.tan(s.theta+side*w.beta),before:s,after,trace};record(f,xx);r.moc.events.push({type,x:xx,y,shockId:trace.id});return f;};
 const rows=r.moc.rows;
 function topology(xx,source){
  const lo=channelOrdinate(G.lower,xx),hi=channelOrdinate(G.upper,xx);
  if(!front)return {x:xx,lower:lo,upper:hi,parts:[{lo,hi,z:source}],shock:null};
  const down=packed(front.after,g),up=packed(front.before,g),lower=front.side===1?down:up,upper=front.side===1?up:down;
  return {x:xx,lower:lo,upper:hi,parts:[fresh(lo,front.y,lower),fresh(front.y,hi,upper)],shock:{y:front.y,side:front.side,id:front.trace.id}};
 }
 function flux(row){let sum=0;for(const part of row.parts){const dy=(part.hi-part.lo)/(part.z.length-1);for(let j=0;j<part.z.length;j++){const s=fittedState(r,part.z[j]);sum+=(j===0||j===part.z.length-1?.5:1)*s.rho*s.u*Math.cos(s.theta)*dy;}}return sum;}
 const initialFlux=base.s1.rho*base.s1.u*H;
 function finishRow(row){const e=Math.abs(flux(row)/initialFlux-1);requireValue(e<.02,'Cross-section mass imbalance exceeds 2%; refine the characteristic grid. The last accepted field is retained.','moc-accuracy');r.moc.massResidual=e;r.moc.maxMassResidual=Math.max(r.moc.maxMassResidual,e);rows.push(row);totalPoints+=row.parts.reduce((n,p)=>n+p.z.length,0);}
 // Initial corners: expansions launch from their wall boundary, a finite
 // compression inserts a shock and two independent smooth meshes.
 let first=topology(0,Array.from({length:N},()=>({...inlet})));
 try{
  let boundary=[null,null];
  for(const [j,w,side]of [[0,G.lower,1],[1,G.upper,-1]]){const theta=wallAngle(w,0);if(side*theta>1e-10){requireValue(!front,'This shock/shock/contact topology requires two straight inlet compression ramps in fitted MOC. Use Shock–Expansion for this geometry.','moc-topology');front=startShock({...base.s1,theta:0},theta,side,0,j?H:0,'Wall corner');boundary[j]=packed(front.after,g);}else{const nu=prandtlMeyer(base.s1.M,g)-side*theta;requireValue(nu>1e-8&&nu<prandtlMeyer(50,g),'The initial expansion exceeds the fitted MOC Mach range.','moc-limit');let lo=1.000001,hi=50;for(let k=0;k<65;k++){const m=(lo+hi)/2;if(prandtlMeyer(m,g)<nu)lo=m;else hi=m;}const M=(lo+hi)/2,factor=1+(g-1)*M*M/2;boundary[j]=packed({...state(M,T0/factor,base.s1.p0/factor**(g/(g-1)),g,R),theta},g);}}
  first=topology(0,Array.from({length:N},()=>({...inlet})));first.parts[0].z[0]=boundary[0];first.parts.at(-1).z[N-1]=boundary[1];finishRow(first);
  const corners=[...new Set([G.end,...G.lower.points.map(p=>p.x),...G.upper.points.map(p=>p.x)])].filter(v=>v>1e-9&&v<=G.end).sort((a,b)=>a-b);
  while(rows.at(-1).x<G.end-1e-9){
   requireValue(totalPoints<600000,'The fitted-characteristic grid budget was reached; shorten the channel or reduce resolution.','moc-budget');
   const old=rows.at(-1),nextCorner=corners.find(v=>v>old.x+1e-8)??G.end;let speed=.1;
   for(const p of old.parts)for(const z of p.z)for(const f of [-1,1])speed=Math.max(speed,Math.abs(Math.tan(angle(z,f))));
   let dx=Math.min(.45*(old.upper-old.lower)/(N-1)/speed,nextCorner-old.x,G.end-old.x);
   for(const p of old.parts)for(let j=1;j<p.z.length;j++){const a=p.z[j-1],b=p.z[j],compression=[-1,1].some(f=>Math.tan(angle(b,f))<Math.tan(angle(a,f))-1e-6);requireValue(!(compression&&Math.abs(b.l-a.l)>.08&&Math.abs(b.theta-a.theta)>.015),'A smooth compression steepens below the resolved grid scale. Formation of a new interior shock is outside this fitted topology.','moc-coalescence');}
   if(front){const wall=front.side===1?G.upper:G.lower,ywall=channelOrdinate(wall,old.x),d=(ywall-front.y)/(front.m-Math.tan(wallAngle(wall,old.x)));if(d>1e-10)dx=Math.min(dx,d);}
   requireValue(dx>1e-11,'The fitted shock step collapsed at a wall or geometric event.','moc-limit');
   let acceptedRow=null,newFront=null;
   for(let retry=0;retry<16&&!acceptedRow;retry++){
    const xx=old.x+dx,lower=channelOrdinate(G.lower,xx),upper=channelOrdinate(G.upper,xx);
    const wallState=(part,y,theta,family)=>{let z=interp(part,y,g);const k=family===-1?part.z[0].k:part.z.at(-1).k;for(let it=0;it<10;it++){const prior=interp(part,y-dx*Math.tan(angle(z,family)),g),foot=interp(part,y-dx*.5*(Math.tan(angle(z,family))+Math.tan(angle(prior,family))),g),A=(coeff(z)+coeff(foot))/2;z=decoded({theta,l:foot.l+(foot.theta-theta)/(family*A),k},g);}return z;};
    const wallLo=wallState(old.parts[0],lower,wallAngle(G.lower,xx-1e-9),-1),wallHi=wallState(old.parts.at(-1),upper,wallAngle(G.upper,xx-1e-9),1);
    let fit=front?{...front,y:front.y+dx*front.m}:null;
    if(front){
     const side=front.side,upPart=old.parts[side===1?1:0],downPart=old.parts[side===1?0:1];let beta=front.beta,lastY=fit.y,fitConverged=false;
     const upstreamAt=y=>{
      const lo=side===1?fit.y:lower,hi=side===1?upper:fit.y,low=side===1?upPart.z[0]:wallLo,high=side===1?wallHi:upPart.z.at(-1);
      const foot=(z,f)=>{const prior=interp(upPart,y-dx*Math.tan(angle(z,f)),g),yy=y-dx*.5*(Math.tan(angle(z,f))+Math.tan(angle(prior,f)));
       if(yy<upPart.lo&&upPart.lo-yy+y-lo>1e-14){const t=Math.max(0,Math.min(1,(upPart.lo-yy)/(upPart.lo-yy+y-lo)));return decoded(mix(upPart.z[0],low,t),g);}
       if(yy>upPart.hi&&yy-upPart.hi+hi-y>1e-14){const t=Math.max(0,Math.min(1,(yy-upPart.hi)/(yy-upPart.hi+hi-y)));return decoded(mix(upPart.z.at(-1),high,t),g);}
       return interp(upPart,yy,g);
      };
      let z=interp(upPart,y,g);
      for(let k=0;k<10;k++){const a=foot(z,1),b=foot(z,-1),stream=foot(z,0),A=(coeff(z)+coeff(a))/2,B=(coeff(z)+coeff(b))/2,C=a.theta+A*a.l,D=b.theta-B*b.l,next=decoded({theta:(B*C+A*D)/(A+B),l:(C-D)/(A+B),k:stream.k},g),err=Math.abs(next.l-z.l)+Math.abs(next.theta-z.theta);z=next;if(err<1e-9)break;}
      return z;
     };

     for(let it=0;it<12;it++){
      const upZ=upstreamAt(fit.y),before=fittedState(r,upZ),limit=shockLimit(before.M,g),mu=limit.mu+1e-8;let hi=limit.beta;
      const marchesDownstream=b=>{const s=shock(before,b,side);return s.M>1.0001&&Math.abs(s.theta)+Math.asin(1/s.M)<Math.PI/2-1e-5;};
      if(!marchesDownstream(hi)){
       let valid=mu,invalid=hi;
       for(let k=0;k<32;k++){const mid=(valid+invalid)/2;if(marchesDownstream(mid))valid=mid;else invalid=mid;}
       hi=valid;
      }
      const residual=b=>{const after=shock(before,b,side),z=packed(after,g),foot=interp(downPart,fit.y-dx*.5*(Math.tan(angle(z,side))+Math.tan(angle(interp(downPart,fit.y-dx*Math.tan(angle(z,side)),g),side))),g),A=(coeff(z)+coeff(foot))/2;return {value:z.theta-foot.theta+side*A*(z.l-foot.l),after};};
      let lo=mu,a=residual(lo),b=residual(hi);requireValue(a.value*b.value<=0,'No attached, supersonic fitted-shock compatibility root remains. Detached shocks and Mach reflections are outside this solver.','moc-shock-limit');
      for(let k=0;k<38;k++){beta=(lo+hi)/2;const f=residual(beta);if(Math.abs(f.value)<2e-11)break;if(a.value*f.value<=0)hi=beta;else{lo=beta;a=f;}}
      const after=residual(beta).after,m=Math.tan(before.theta+side*beta),y=front.y+dx*(front.m+m)/2;fit={...front,y,beta,m,before,after};if(Math.abs(y-lastY)<1e-10*H){fitConverged=true;break;}lastY=y;
     }
     if(!fitConverged){dx*=.5;continue;}
     if(fit.y<lower-1e-8*H||fit.y>upper+1e-8*H){dx*=.5;continue;}
     fit.y=Math.max(lower,Math.min(upper,fit.y));
    }
    const endpoints=fit?[wallLo,packed(fit.side===1?fit.after:fit.before,g),packed(fit.side===1?fit.before:fit.after,g),wallHi]:[wallLo,wallHi];
    const bounds=fit?[lower,fit.y,upper]:[lower,upper],parts=[];
    for(let q=0;q<bounds.length-1;q++){
     const a=old.parts[q],lo=bounds[q],hi=bounds[q+1],low=endpoints[2*q],high=endpoints[2*q+1];
     const foot=(y,z,f)=>{const m=Math.tan(angle(z,f)),prior=interp(a,y-dx*m,g),m2=.5*(m+Math.tan(angle(prior,f))),yy=y-dx*m2;
      if(yy<a.lo&&a.lo-yy+ y-lo>1e-14){const t=(a.lo-yy)/(a.lo-yy+y-lo);return decoded(mix(a.z[0],low,Math.max(0,Math.min(1,t))),g);}
      if(yy>a.hi&&yy-a.hi+hi-y>1e-14){const t=(yy-a.hi)/(yy-a.hi+hi-y);return decoded(mix(a.z.at(-1),high,Math.max(0,Math.min(1,t))),g);}
      return interp(a,yy,g);
     };
     const z=[];
     for(let j=0;j<N;j++){if(j===0){z.push(low);continue;}if(j===N-1){z.push(high);continue;}const y=lo+(hi-lo)*j/(N-1);let v=interp(a,y,g);
      for(let it=0;it<10;it++){const plus=foot(y,v,1),minus=foot(y,v,-1),stream=foot(y,v,0),A=(coeff(v)+coeff(plus))/2,B=(coeff(v)+coeff(minus))/2,C=plus.theta+A*plus.l,D=minus.theta-B*minus.l,l=(C-D)/(A+B),theta=(B*C+A*D)/(A+B),next=decoded({theta,l,k:stream.k},g),err=Math.abs(v.l-next.l)+Math.abs(v.theta-next.theta);v=next;if(err<1e-9)break;}z.push(v);
     }parts.push({lo,hi,z});
    }
    acceptedRow={x:xx,lower,upper,parts,shock:fit?{y:fit.y,side:fit.side,id:fit.trace.id}:null};newFront=fit;
   }
   requireValue(acceptedRow,'The shock/wall intersection could not be located within tolerance.','moc-limit');finishRow(acceptedRow);front=newFront;if(front)record(front,acceptedRow.x);
   const at=acceptedRow.x;
   if(front){const side=front.side,wall=side===1?G.upper:G.lower,y=channelOrdinate(wall,at);if(Math.abs(front.y-y)<1e-7*H){
    const upstream=front.after,theta=wallAngle(wall,at+1e-9);requireValue((-side)*(theta-upstream.theta)>1e-9,'A fitted shock reaches a wall with an unsupported non-compressive reflection.','moc-reflection');const incident=front.trace.id;
    const source=acceptedRow.parts[side===1?0:1];front=startShock(upstream,theta,-side,at,y,'Wall reflection');front.trace.incidentId=incident;
    const reset=topology(at,source.z);const upstreamPart=reset.parts[side===1?0:1];upstreamPart.z=source.z.map(z=>({...z}));finishRow(reset);
   }}
   if(at<G.end-1e-9&&Math.abs(at-nextCorner)<1e-8){
    for(const [wall,side,j]of [[G.lower,1,0],[G.upper,-1,1]]){const oldAngle=wallAngle(wall,at-1e-7),theta=wallAngle(wall,at+1e-7);if(Math.abs(theta-oldAngle)<1e-10)continue;
     if(side*(theta-oldAngle)>1e-10){requireValue(!front,'A new compression shock would create an unresolved shock/shock/contact topology. Use Shock–Expansion for this geometry.','moc-topology');const row=rows.at(-1),up=fittedState(r,j?row.parts.at(-1).z.at(-1):row.parts[0].z[0]);front=startShock(up,theta,side,at,j?row.upper:row.lower,'Wall corner');const reset=topology(at,row.parts[0].z);reset.parts[side===1?1:0].z=row.parts[0].z.map(z=>({...z}));finishRow(reset);}
    }
   }
  }
 }catch(e){if(!(e instanceof PhysicsError))throw e;reason=e.message;}
 const last=rows.at(-1);if(!last){r.moc.traces=[];r.moc.events=[];}r.status=reason?(last&&last.x>1e-9?'partial':'unsupported'):'ok';r.reason=reason;r.limitX=reason?(last?.x??0):null;r.moc.status=r.status;
 if(last){r.regions={Inlet:base.s1,['Lower '+(reason?'limit':'outlet')]:fittedState(r,last.parts[0].z[0]),['Upper '+(reason?'limit':'outlet')]:fittedState(r,last.parts.at(-1).z.at(-1))};}
 // Each trace retains all one-sided states for export; finite shocks are
 // reported at their birth and latest computed point, not as one uniform jump.
 r.waves=(last?traces:[]).flatMap(t=>[t.points[0],...(t.points.length>1?[t.points.at(-1)]:[])].map((p,i)=>({id:`S${t.id}-${i}`,kind:'Oblique shock',title:`Fitted shock S${t.id} · ${i?'last station':'origin'}`,origin:{x:p.x,y:p.y},before:p.before,after:p.after,beta:p.beta})));
 return r;
}
function solveSuccessiveRamps(input,base,N){
 const r=solveRegularChannel(input,{fallback:false}),g=base.geometry;
 requireValue(r.interaction&&r.a.kind==='Expansion fan'&&r.b.kind==='Oblique shock',
  r.reason??'The characteristic patches require a regular outgoing expansion and shock.');
 const {A,C,B,endX}=r.geometry,[x,y]=B,[start]=C;
 const pack=s=>decoded(packed(s,base.gamma),base.gamma);
 const [s1,s2,s3,s4,s5]=Object.values(r.regions).map(pack);
 const slope=angle=>{requireValue(Math.cos(angle)>1e-5,'A characteristic is directed upstream.');return Math.tan(angle);};
 const line=(p,m)=>xx=>p[1]+m*(xx-p[0]);
 const first=line(A,slope(r.n2.beta)),second=line(C,slope(r.regions[2].theta+r.n3.beta));
 const fan=r.a.rays.map(z=>({m:slope(z.angle),z:pack(z.state)})).sort((a,b)=>a.m-b.m);
 const head=line(B,fan[0].m),tail=line(B,fan.at(-1).m);
 const slip=line(B,slope(r.delta)),shock=line(B,slope(r.b.rays[0].angle));
 requireValue(tail(endX)<slip(endX)&&slip(endX)<shock(endX),'The outgoing characteristic patches overlap.');
 const minSlope=fan[0].m,maxSlope=fan.at(-1).m;
 const fanValues=Array.from({length:N},(_,i)=>{
  const m=minSlope+(maxSlope-minSlope)*i/(N-1);
  const j=Math.max(0,fan.findIndex((v,j)=>j<fan.length-1&&m<=fan[j+1].m+1e-12));
  const a=fan[j],b=fan[j+1];
  return decoded(mix(a.z,b.z,(m-a.m)/(b.m-a.m)),base.gamma);
 });
 const mesh=(from,to,lines,patches)=>Array.from({length:Math.min(72,N)+1},(_,i)=>{
  const xx=i===Math.min(72,N)?to:from+(to-from)*i/Math.min(72,N);
  const lower=channelOrdinate(g.lower,xx),upper=channelOrdinate(g.upper,xx);
  const bounds=[lower,...lines.map(fn=>Math.max(lower,Math.min(upper,fn(xx)))),upper];
  return {x:xx,lower,upper,parts:patches.map((z,j)=>({lo:bounds[j],hi:bounds[j+1],z:Array.isArray(z)?z:Array(N).fill(z)}))};
 });
 const rows=[
  ...mesh(0,start,[first],[s2,s1]),
  ...mesh(start,x,[second,first],[s3,s2,s1]),
  ...mesh(x,endX,[head,tail,slip,shock],[s3,fanValues,s4,s5,s1])
 ];
 const traces=[
  [A,B,r.waves[0],1],
  [C,B,r.waves[1],1],
  [B,[endX,shock(endX)],r.b,1]
 ].map(([origin,end,w,side],i)=>({id:i+1,side,type:i<2?'Incident shock':'Outgoing shock',
  points:[origin,end].map(([x,y])=>({x,y,beta:w.beta,before:w.before,after:w.after}))}));
 const inletFlux=base.s1.rho*base.s1.u*g.height;
 const massResidual=row=>Math.abs(row.parts.reduce((sum,p)=>{
  const flow=p.z.reduce((total,z,i)=>{
   const s=fittedState(base,z);
   return total+(i===0||i===N-1?.5:1)*s.rho*s.u*Math.cos(s.theta);
  },0);
  return sum+(p.hi-p.lo)*flow/(N-1);
 },0)/inletFlux-1);
 const maxMassResidual=Math.max(...rows.map(massResidual));
 const maxJumpResidual=Math.max(...traces.map(t=>{const p=t.points[0];return fittedJumpResidual(p.before,p.after,p.beta,base.gamma);}));
 requireValue(maxMassResidual<.02&&maxJumpResidual<1e-7,'Characteristic patches did not satisfy conservation tolerances.');
 const status=endX<g.end-1e-9?'partial':'ok';
 return {...base,status,reason:r.reason,limitX:r.limitX,regions:r.regions,
  waves:traces.map(t=>({id:'S'+t.id,kind:'Oblique shock',title:t.type+' · S'+t.id,
   origin:{x:t.points[0].x,y:t.points[0].y},before:t.points[0].before,after:t.points[0].after,beta:t.points[0].beta})),
  moc:{fitted:true,status,rows,traces,resolution:N,successiveRamps:true,
   fan:[{x,y},{x:endX,head:head(endX),tail:tail(endX)}],
   slip:{angle:r.delta,pressure:r.regions[4].p,points:[{x,y},{x:endX,y:slip(endX)}]},
   massResidual:massResidual(rows.at(-1)),maxMassResidual,maxJumpResidual,events:[{type:'Wave interaction',x,y}]}};
}

export function fittedShockFanSlipLayer(r,fanTurn,maxX=Infinity){
 const trace=r?.moc?.traces?.[0];
 if(trace?.side!==1)return null;
 const section=r.moc.rows.findLast(row=>row.x<=maxX+1e-9&&row.shock?.id===trace.id);
 if(!section)return null;
 const shock=trace.points.findLast(point=>point.x<=section.x+1e-9);
 if(!shock||!(fanTurn>0)||Math.abs(shock.before.theta-fanTurn)>fanTurn*.002)return null;

 // With constant stagnation temperature, entropy varies linearly with ln(p0).
 // The midpoint of the two post-shock plateaux follows a streamline through
 // the shear layer generated as the shock turns through the expansion fan.
 const inlet=Math.log(trace.points[0].after.p0),downstream=Math.log(shock.after.p0);
 if(Math.abs(inlet-downstream)<1e-7)return null;
 const k=(inlet+downstream)/2,{lo,hi,z}=section.parts[0];
 let sample=null;
 for(let i=1;i<z.length;i++){
  const a=z[i-1],b=z[i];
  if((a.k<k)===(b.k<k))continue;
  if(sample)return null;
  const t=(k-a.k)/(b.k-a.k);
  sample={x:section.x,y:lo+(hi-lo)*(i-1+t)/(z.length-1),angle:a.theta+t*(b.theta-a.theta)};
 }
 return sample;
}

export function sampleFittedPatches(r,x,y){
 const {rows}=r.moc;
 if(x<0||x>rows.at(-1).x)return null;
 const next=rows.findIndex(row=>row.x>x),a=rows[next<0?rows.length-1:next-1],b=next<0?a:rows[next];
 const fraction=a===b?0:(x-a.x)/(b.x-a.x);
 const boundary=(left,right)=>left+(right-left)*fraction;
 const i=a.parts.findIndex((p,i)=>y>=boundary(p.lo,b.parts[i].lo)-1e-9&&y<=boundary(p.hi,b.parts[i].hi)+1e-9);
 if(i<0)return null;
 const p=a.parts[i],q=b.parts[i],lo=boundary(p.lo,q.lo),hi=boundary(p.hi,q.hi);
 const t=Math.max(0,Math.min(p.z.length-1,(y-lo)/(hi-lo||1)*(p.z.length-1)));
 const j=Math.min(p.z.length-2,Math.floor(t)),f=t-j;
 return fittedState(r,mix(p.z[j],p.z[j+1],f));
}
export function fittedProfilePlots(r,fraction=1){
 const rows=r.moc.rows;if(!rows.length)return [];requireValue(Number.isFinite(fraction)&&fraction>=0&&fraction<=1,'Profile station x/L must be between 0 and 1.');const target=Math.min(rows.at(-1).x,r.geometry.end*fraction),row=rows.reduce((a,b)=>Math.abs(a.x-target)<Math.abs(b.x-target)?a:b);
 const properties=[['M','Mach number','M',z=>z.M],['p','Static pressure','p (kPa)',z=>z.p/1000],['T','Static temperature','T (K)',z=>z.T],['rho','Density','ρ (kg/m³)',z=>z.rho],['u','Flow speed','u (m/s)',z=>z.u],['theta','Flow direction','θ (°)',z=>z.theta*180/Math.PI],['p0','Stagnation pressure','p₀ (kPa)',z=>z.p0/1000]];
 return properties.map(([key,label,unit,value])=>{
  const points=row.parts.flatMap(p=>p.z.map((z,j)=>[p.lo+(p.hi-p.lo)*j/(p.z.length-1),value(fittedState(r,z))]));
  return {key:'moc-'+key,label:'Cross-channel '+label.toLowerCase(),chart:{title:label+' · x = '+Number(row.x.toPrecision(5))+' m',xlabel:'Height y (m)',ylabel:unit,zeroBaseline:false,series:[{name:label,points}]},note:r.moc.slip?'Characteristic patches with one-sided shock and slip-line states.':'Rotational numerical characteristics with one-sided fitted-shock jumps. Refine transverse resolution.'};
 });
}
