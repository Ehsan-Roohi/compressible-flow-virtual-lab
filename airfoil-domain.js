import {airfoilView} from './airfoil-view.js?v=20261115-connected-plates';
// Earliest forward intersection of independent wave envelopes in the fluid.
// This bounds the display; it does not solve the interaction.
const cache=new WeakMap();
export const limitedAirfoil=s=>s.airfoilFieldMode==='Before first wave interaction';
export function airfoilDomain(s){
 if(cache.has(s))return cache.get(s);
 const view=airfoilView(s),end=(620-view.leadingX)/view.scale,ordinate=(p,x)=>{let i=0;while(i<p.length-2&&p[i+1].x<x)i++;return p[i].y+(p[i+1].y-p[i].y)*(x-p[i].x)/(p[i+1].x-p[i].x);};
 const waves=[...(s.nonlinear?.status==='ok'?s.nonlinear.waves:[]),...(s.trailingEdge?.status==='ok'?s.trailingEdge.waves:[])].filter(w=>w.kind!=='No wave');
 const groups=waves.map(w=>{const sign=w.side==='Upper'?1:-1,angles=w.kind==='Oblique shock'?[w.before.theta+sign*w.beta]:[w.before.theta+sign*Math.asin(1/w.before.M),w.after.theta+sign*Math.asin(1/w.after.M)];return {...w,rays:angles.filter(a=>Math.cos(a)>1e-9).map(a=>({m:Math.tan(a),c:w.origin.y-Math.tan(a)*w.origin.x}))};});
 let hit=null;
 const accept=(x,y,a,b,kind)=>{
  if(!Number.isFinite(x)||x<=Math.max(a.origin.x,b.origin.x)+1e-7||hit&&x>=hit.x)return;
  if(x<=1){const wall=ordinate(a.side==='Upper'?s.geometry.upper:s.geometry.lower,x);if(a.side==='Upper'?y<wall-1e-9:y>wall+1e-9)return;}
  else if(s.trailingEdge?.status==='ok'){const line=s.geometry.upper.at(-1).y+Math.tan(s.trailingEdge.phi)*(x-1);if(a.side==='Upper'?y<line-1e-9:y>line+1e-9)return;}
  hit={x,y,waves:[a.id,b.id],kind,start:Math.max(a.origin.x,b.origin.x)};
 };
 for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
  const a=groups[i],b=groups[j];if(a.side!==b.side||Math.hypot(a.origin.x-b.origin.x,a.origin.y-b.origin.y)<1e-9)continue;
  for(const p of a.rays)for(const q of b.rays)if(Math.abs(p.m-q.m)>1e-12){const x=(q.c-p.c)/(p.m-q.m);accept(x,p.m*x+p.c,a,b,'Wave interaction');}
 }
 // A ray reaching a later surface also ends the independent-wave domain.
 for(const a of groups)for(const p of a.rays){const points=a.side==='Upper'?s.geometry.upper:s.geometry.lower;
  for(let i=1;i<points.length;i++){const u=points[i-1],v=points[i],m=(v.y-u.y)/(v.x-u.x),c=u.y-m*u.x;if(Math.abs(p.m-m)<1e-12)continue;
   const x=(c-p.c)/(p.m-m);if(x>u.x+1e-8&&x<v.x-1e-8)accept(x,p.m*x+p.c,a,{id:'surface',origin:u},'Wave meets surface');
  }
 }
 const limit=hit?Math.max(0,Math.min(end,hit.x-Math.min(.01,.02*(hit.x-hit.start)))):end;
 const result={limit,hit,clipped:limit<end-1e-6};cache.set(s,result);return result;
}
