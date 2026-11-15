import {solveTrailingEdge} from './airfoil-trailing.js?v=20261108-trailing-edge';
import {state,obliqueShock,expansion,rad,deg,isentropic,PhysicsError} from './physics.js';
import {requireValue,finite} from './numerics.js';
const point=(x,y)=>({x,y});
function coordinates(text,label){
 const rows=String(text).trim().split(/[;\n]+/).filter(s=>s.trim()).map(s=>s.trim().split(/[,\s]+/).map(Number));
 requireValue(rows.length>=2&&rows.length<=21&&rows.every(r=>r.length===2&&r.every(Number.isFinite)),`${label}: enter 2–21 x,y pairs, separated by semicolons or newlines.`);
 const points=rows.map(([x,y])=>point(x,y));requireValue(Math.abs(points[0].x)<1e-10&&Math.abs(points[0].y)<1e-10&&Math.abs(points.at(-1).x-1)<1e-10&&Math.abs(points.at(-1).y)<1e-10,`${label} must start at 0,0 and end at 1,0.`);
 requireValue(points.every((p,i)=>Math.abs(p.y)<=.3&&(!i||p.x>points[i-1].x)),`${label}: x must increase strictly and |y/c| must not exceed 0.3.`);points[0]=point(0,0);points[points.length-1]=point(1,0);return points;
}
export function segmentSurface(segments,label='Surface',max=19){
 requireValue(Array.isArray(segments)&&segments.length<=max,`${label}: use at most ${max} entered segments.`);
 const points=[point(0,0)];
 for(const [i,s]of segments.entries()){
  requireValue(finite(s.angle,s.length)&&Math.abs(s.angle)<85&&s.length>0&&s.length<=2,`${label} segment ${i+1}: require |angle| < 85° and 0 < L/c ≤ 2.`);
  const a=points.at(-1),b=point(a.x+s.length*Math.cos(rad(s.angle)),a.y+s.length*Math.sin(rad(s.angle)));
  requireValue(b.x<1-1e-6&&Math.abs(b.y)<=.3,`${label} segment ${i+1}: leave space before x/c = 1 for the automatic closing segment and keep |y/c| ≤ 0.3.`);points.push(b);
 }
 const last=points.at(-1);
 if(Math.abs(last.y)<1e-12&&last.x>0){const scale=1/last.x;for(const p of points){p.x*=scale;p.y*=scale;}points[points.length-1]=point(1,0);return {points,lengths:segments.map(s=>s.length*scale),closing:null};}
 const closing={angle:deg(Math.atan2(-last.y,1-last.x)),length:Math.hypot(1-last.x,last.y)};points.push(point(1,0));return {points,closing};
}
// With two or more prescribed panel angles, the final two lengths are dependent.
export function constrainedSurface(segments,label='Surface',max=20){
 requireValue(Array.isArray(segments)&&segments.length<=max,`${label}: use at most ${max} segments.`);
 if(segments.length<2)return segmentSurface(segments,label,max);
 const points=[point(0,0)],lengths=segments.map(p=>p.length);
 for(const [i,s]of segments.entries()){
  requireValue(finite(s.angle)&&Math.abs(s.angle)<85,`${label} segment ${i+1}: require |angle| < 85°.`);
  if(i>=segments.length-2)continue;
  requireValue(finite(s.length)&&s.length>0&&s.length<=2,`${label} segment ${i+1}: require 0 < L/c ≤ 2.`);
  const a=points.at(-1);points.push(point(a.x+s.length*Math.cos(rad(s.angle)),a.y+s.length*Math.sin(rad(s.angle))));
 }
 const n=segments.length,a=rad(segments[n-2].angle),b=rad(segments[n-1].angle),p=points.at(-1),dx=1-p.x,dy=-p.y,det=Math.sin(b-a);
 if(Math.abs(det)<1e-10){
  requireValue(Math.abs(dx*Math.sin(a)-dy*Math.cos(a))<1e-10,`${label}: the final two angles cannot reach the trailing edge. Choose different angles.`);
  const total=dx*Math.cos(a)+dy*Math.sin(a),weights=segments.slice(-2).map(z=>Number.isFinite(z.length)&&z.length>0?z.length:1),sum=weights[0]+weights[1];
  lengths[n-2]=total*weights[0]/sum;lengths[n-1]=total*weights[1]/sum;
 }else{
  lengths[n-2]=(dx*Math.sin(b)-dy*Math.cos(b))/det;
  lengths[n-1]=(Math.cos(a)*dy-Math.sin(a)*dx)/det;
 }
 requireValue(lengths.slice(-2).every(v=>Number.isFinite(v)&&v>1e-8&&v<=2),`${label}: these angles and preceding lengths cannot close at the trailing edge with positive panel lengths.`);
 for(let i=n-2;i<n;i++){const p=points.at(-1),a=rad(segments[i].angle);points.push(point(p.x+lengths[i]*Math.cos(a),p.y+lengths[i]*Math.sin(a)));}
 requireValue(points.every((p,i)=>Math.abs(p.y)<=.3&&(!i||p.x>points[i-1].x&&p.x<=1+1e-10)),`${label}: require downstream panels and |y/c| ≤ 0.3.`);
 points[points.length-1]=point(1,0);
 return {points,lengths,closing:null};
}
// Positive horizontal shares are adjusted with a common exponential tilt.
// This preserves requested proportions when already closed and keeps every panel.
export function automaticSurface(segments,label='Plate',max=20){
 requireValue(Array.isArray(segments)&&segments.length<=max,`${label}: use at most ${max} panels.`);
 if(!segments.length)return {points:[point(0,0),point(1,0)],lengths:[],closing:null};
 requireValue(segments.every(p=>finite(p.angle,p.length)&&Math.abs(p.angle)<85&&p.length>0),`${label}: enter finite angles within ±85° and positive target lengths.`);
 const slopes=segments.map(p=>Math.tan(rad(p.angle))),logs=segments.map(p=>Math.log(p.length*Math.cos(rad(p.angle))));
 const loSlope=Math.min(...slopes),hiSlope=Math.max(...slopes);
 requireValue(loSlope<-1e-12&&hiSlope>1e-12||Math.max(...slopes.map(Math.abs))<1e-12,`${label}: these angles cannot return to the trailing edge with positive lengths. Include upward and downward directions.`);
 const fractions=t=>{const ex=logs.map((v,i)=>v-t*slopes[i]),peak=Math.max(...ex),w=ex.map(v=>Math.exp(v-peak)),sum=w.reduce((a,b)=>a+b,0);return w.map(v=>v/sum);};
 const mean=t=>fractions(t).reduce((v,q,i)=>v+q*slopes[i],0);
 let low=-1,high=1,t=0;
 if(Math.max(...slopes.map(Math.abs))>=1e-12){while(mean(low)<0)low*=2;while(mean(high)>0)high*=2;for(let i=0;i<100;i++){t=(low+high)/2;if(mean(t)>0)low=t;else high=t;}}
 const q=fractions(t),lengths=q.map((v,i)=>v/Math.cos(rad(segments[i].angle))),points=[point(0,0)];
 for(let i=0;i<segments.length;i++){const a=points.at(-1);points.push(point(a.x+q[i],a.y+q[i]*slopes[i]));}
 requireValue(lengths.every(v=>v>1e-8)&&points.every(p=>Math.abs(p.y)<=.3),`${label}: adjusted geometry needs a negligible panel or exceeds |y/c| = 0.3. Change target proportions or angles.`);
 points[points.length-1]=point(1,0);return {points,lengths,closing:null};
}
export const surfaceSegments=(points,includeClosing=false)=>points.slice(0,includeClosing?-1:-2).map((p,i)=>{const b=points[i+1];return {angle:deg(Math.atan2(b.y-p.y,b.x-p.x)),length:Math.hypot(b.x-p.x,b.y-p.y)};});
export function presetSegments(x){
 const camber=x.airfoilShape==='Diamond'?0:x.camber??0,t=x.thickness??.08,peak=x.peak??.5;
 return {upper:[{angle:deg(Math.atan2(camber+t/2,peak)),length:Math.hypot(peak,camber+t/2)}],lower:[{angle:deg(Math.atan2(camber-t/2,peak)),length:Math.hypot(peak,camber-t/2)}]};
}
export const diamondModes=['Angles','Length ratios','Angle & length ratio'];
export function diamondInputValues(geometry){
 const p=geometry.upper[1];return {diamondFrontAngle:deg(Math.atan2(p.y,p.x)),diamondRearAngle:deg(Math.atan2(p.y,1-p.x)),diamondFrontLength:Math.hypot(p.x,p.y),diamondRearLength:Math.hypot(1-p.x,p.y)};
}
function diamondPoints(x){
 let px,py;const a=x.diamondFrontAngle??4.573921259900861,b=x.diamondRearAngle??4.573921259900861,l=x.diamondFrontLength??.5015974481593781,r=x.diamondRearLength??.5015974481593781;
 if(x.geometryInput==='Angles'){
  requireValue(finite(a,b)&&a>0&&b>0&&a<85&&b<85,'Front and rear panel angle magnitudes must be between 0° and 85°.');
  const f=Math.tan(rad(a)),q=Math.tan(rad(b));px=q/(f+q);py=px*f;
 }else if(x.geometryInput==='Length ratios'){
  requireValue(finite(l,r)&&l>0&&r>0&&l+r>1&&Math.abs(l-r)<1,'Panel lengths and the unit chord must form a nondegenerate triangle: Lf/c + Lr/c > 1 and |Lf/c − Lr/c| < 1.');
  px=(1+l*l-r*r)/2;py=Math.sqrt(Math.max(0,l*l-px*px));
 }else{
  requireValue(finite(a,l)&&a>0&&a<85&&l>0,'Require a positive front-panel length and an angle between 0° and 85°.');px=l*Math.cos(rad(a));py=l*Math.sin(rad(a));
 }
 requireValue(finite(px,py)&&px>1e-6&&px<1-1e-6&&py>0&&py<=.3,'The peak must lie between leading and trailing edges and satisfy 0 < t/c ≤ 0.6.');
 return [point(0,0),point(px,py),point(1,0)];
}
const ordinate=(points,x)=>{let i=0;while(i<points.length-2&&points[i+1].x<x)i++;const a=points[i],b=points[i+1];return a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);};
export function airfoilGeometry(x){
 requireValue(['Flat plate','Bent flat plate','Diamond','Asymmetric double wedge','Custom panels'].includes(x.airfoilShape),'Choose a supported sharp airfoil geometry.');
 let upper,lower;const angleMode=x.geometryInput==='Angles & lengths';
 if(x.airfoilShape==='Flat plate'){upper=[point(0,0),point(1,0)];lower=upper.map(p=>({...p}));}
 else if(x.airfoilShape==='Bent flat plate'){
  if(x.plateDefinition==='Multiple panels')upper=(x.plateLengthMode==='Keep earlier lengths'?constrainedSurface:automaticSurface)(x.upperSegments,'Plate',20).points;
  else{
  const h=x.bendHeight??.12,peak=x.bendPosition??.5;
  requireValue(finite(h,peak)&&Math.abs(h)<=.3&&peak>=.05&&peak<=.95,'Bent plate: require |h/c| ≤ 0.3 and 0.05 ≤ bend x/c ≤ 0.95.');
  upper=[point(0,0),point(peak,h),point(1,0)];
  }lower=upper.map(p=>({...p}));
 }
 else if(x.airfoilShape==='Diamond'&&diamondModes.includes(x.geometryInput)){upper=diamondPoints(x);lower=upper.map(p=>point(p.x,-p.y));}
 else if(angleMode){const custom=x.airfoilShape==='Custom panels',max=custom?20:1,build=custom?constrainedSurface:segmentSurface;upper=build(x.upperSegments,'Upper surface',max).points;lower=x.airfoilShape==='Diamond'?upper.map(p=>point(p.x,-p.y)):build(x.lowerSegments,'Lower surface',max).points;}
 else if(x.airfoilShape==='Custom panels'){upper=coordinates(x.upperProfile,'Upper surface');lower=coordinates(x.lowerProfile,'Lower surface');}
 else{
  requireValue(finite(x.thickness,x.peak,x.camber)&&x.thickness>=0&&x.thickness<=.2&&x.peak>=.15&&x.peak<=.85&&Math.abs(x.camber)<=.08,'Require 0 ≤ t/c ≤ 0.2, 0.15 ≤ peak x/c ≤ 0.85 and |camber/c| ≤ 0.08.');
  const camber=x.airfoilShape==='Diamond'?0:x.camber;
  upper=[point(0,0),point(x.peak,camber+x.thickness/2),point(1,0)];lower=[point(0,0),point(x.peak,camber-x.thickness/2),point(1,0)];
 }
 const stations=[...new Set([...upper,...lower].map(p=>p.x))];requireValue(stations.every(z=>ordinate(upper,z)>=ordinate(lower,z)-1e-10),'Upper and lower surfaces must not cross.');
 const panels=[];for(const [side,points]of [['Upper',upper],['Lower',lower]])for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y;panels.push({id:`${side[0]}${i+1}`,side,index:i,a,b,dx,dy,slope:dy/dx,theta:Math.atan2(dy,dx),length:Math.hypot(dx,dy),automatic:angleMode&&!(x.airfoilShape==='Custom panels'&&(side==='Upper'?x.upperSegments:x.lowerSegments).length>=2)&&i===points.length-2,automaticLength:angleMode&&x.airfoilShape==='Custom panels'&&(side==='Upper'?x.upperSegments:x.lowerSegments).length>=2&&i>=points.length-3});
 }
 return {upper,lower,panels,...(x.airfoilShape==='Bent flat plate'?{bentPlate:{multiple:x.plateDefinition==='Multiple panels',height:x.bendHeight??.12,position:x.bendPosition??.5}}:{}),...(x.airfoilShape==='Diamond'?{diamond:diamondInputValues({upper})}:{})};
}
export function airfoilForces(panels,cps,alpha=0,linear=false){
 let Cx=0,Cy=0,CM=0;panels.forEach((p,i)=>{const sign=p.side==='Upper'?1:-1,fx=sign*cps[i]*p.dy,fy=-sign*cps[i]*p.dx;Cx+=fx;Cy+=fy;CM+=(linear?0:(p.a.y+p.b.y)/2*fx)-((p.a.x+p.b.x)/2-.25)*fy;});
 return {Cx,Cy,CL:linear?Cy:-Cx*Math.sin(alpha)+Cy*Math.cos(alpha),CD:linear?Cx+alpha*Cy:Cx*Math.cos(alpha)+Cy*Math.sin(alpha),CM};
}
export function solveAirfoil(x){
 const {M,alpha=0,gamma:g=1.4,R=287,T1=300,p1=101}=x;
 requireValue(finite(M,alpha,T1,p1)&&M>=1.1&&M<=20&&Math.abs(alpha)<=30&&T1>0&&p1>0,'Require 1.1 ≤ M ≤ 20, |α| ≤ 30°, and positive freestream temperature and pressure.');
 const geometry=airfoilGeometry(x),a=rad(alpha),B=Math.sqrt(M*M-1),freestream={...state(M,T1,p1*1000,g,R),theta:a},q=.5*g*freestream.p*M*M;
 const linearPanels=geometry.panels.map(p=>({...p,Cp:(p.side==='Upper'?1:-1)*2*(p.slope-a)/B}));
 const linear={status:'ok',panels:linearPanels,...airfoilForces(geometry.panels,linearPanels.map(p=>p.Cp),a,true),potential:[]};
 for(const side of ['Upper','Lower']){let value=0;for(const p of linearPanels.filter(p=>p.side===side)){const derivative=-p.Cp/2,start=value;value+=derivative*p.dx;linear.potential.push({id:p.id,side,x0:p.a.x,x1:p.b.x,phi0:start,phi1:value,derivative,intercept:start-derivative*p.a.x});}}
 let nonlinear={status:'ok',panels:[],waves:[]};
 try{
  for(const side of ['Upper','Lower']){
   let before=freestream;
   for(const p of geometry.panels.filter(p=>p.side===side)){
    requireValue(before.M>1+1e-9,`${p.id}: incoming surface flow is not supersonic; sequential shock–expansion cannot continue.`,'airfoil-subsonic');
    const turn=p.theta-before.theta,compression=(side==='Upper'?1:-1)*turn>0,angle=Math.abs(turn);let wave,ratios;
    if(angle<1e-12){wave='No wave';ratios={M2:before.M,T:1,p:1,rho:1,p0:1};}
    else if(compression){wave='Oblique shock';ratios=obliqueShock(before.M,angle,g,'weak');}
    else{wave='Expansion fan';ratios=expansion(before.M,angle,g);}
    const after={...state(ratios.M2,before.T*ratios.T,before.p*ratios.p,g,R),theta:p.theta};
    // Continue only in a wholly supersonic surface solution; no invented downstream model.
    requireValue(after.M>1+1e-9,`${p.id}: post-wave flow is subsonic; this airfoil surface model is outside its domain.`,'airfoil-subsonic');
    const Cp=(after.p-freestream.p)/q;
    nonlinear.panels.push({...p,...after,a:p.a,b:p.b,soundSpeed:after.a,Cp,wave});nonlinear.waves.push({id:p.id,side,origin:p.a,kind:wave,turn:deg(turn),beta:ratios.beta??null,before,after});before=after;
   }
  }
  Object.assign(nonlinear,airfoilForces(geometry.panels,nonlinear.panels.map(p=>p.Cp),a));
 }catch(e){if(!(e instanceof PhysicsError))throw e;nonlinear={status:'unsupported',reason:e.message,panels:[],waves:[]};}
 const trailingEdge=nonlinear.status==='ok'?solveTrailingEdge(nonlinear.panels.filter(p=>p.side==='Upper').at(-1),nonlinear.panels.filter(p=>p.side==='Lower').at(-1),g,R):{status:'unavailable',reason:'An accepted supersonic Shock–Expansion surface solution is required.'};
 const method=x.airfoilMethod??'Compare both',models=method==='Linearized theory'?['linear']:method==='Shock–Expansion'?['nonlinear']:['linear','nonlinear'];
 const warnings=[];if(models.includes('linear')&&(Math.max(...geometry.panels.map(p=>Math.abs(p.theta-a)))>rad(6)||M<1.4))warnings.push('Small-disturbance approximation is strained; compare the methods carefully.');if(models.includes('nonlinear')&&nonlinear.status!=='ok')warnings.push('Shock–Expansion unavailable: '+nonlinear.reason);
 return {airfoilFieldMode:x.airfoilFieldMode??'Before first wave interaction',gamma:g,R,trailingEdge,status:models.length===1&&models[0]==='nonlinear'&&nonlinear.status!=='ok'?'unsupported':'ok',geometry,linear,nonlinear,models,freestream,q,alpha:a,warning:warnings.join(' ')||null};
}
export function airfoilPlots(r){
 const plots=[],step=(panels,value)=>panels.flatMap(p=>Array.from({length:41},(_,i)=>[p.a.x+p.dx*i/40,value(p)]));
 const add=(key,label,ylabel,series)=>{if(series.length)plots.push({key,label,chart:{title:label,xlabel:'Chord position x/c',ylabel,zeroBaseline:false,series},note:''});};
 add('airfoil-Cp','Surface pressure coefficient','Cp',r.models.flatMap(model=>r[model].status==='ok'?['Upper','Lower'].map(side=>({name:`${model==='linear'?'Linearized':'Shock–Expansion'} · ${side.toLowerCase()}`,points:step(r[model].panels.filter(p=>p.side===side),p=>p.Cp)})):[]));
 if(r.models.includes('nonlinear')&&r.nonlinear.status==='ok')for(const [key,label,unit,value]of [['M','Surface Mach number','M',p=>p.M],['p','Static pressure','p (kPa)',p=>p.p/1000],['T','Static temperature','T (K)',p=>p.T],['rho','Density','ρ (kg/m³)',p=>p.rho],['u','Flow speed','u (m/s)',p=>p.u],['p0','Stagnation pressure','p₀ (kPa)',p=>p.p0/1000]])add('airfoil-'+key,label,unit,['Upper','Lower'].map(side=>({name:side,points:step(r.nonlinear.panels.filter(p=>p.side===side),value)})));
 if(r.models.includes('linear'))add('airfoil-potential','Surface perturbation potential · linearized','φ/(U∞c)',['Upper','Lower'].map(side=>({name:side,points:r.linear.potential.filter(p=>p.side===side).flatMap(p=>Array.from({length:41},(_,i)=>{const x=p.x0+(p.x1-p.x0)*i/40;return [x,p.derivative*x+p.intercept];}))})));
 if(r.models.includes('linear'))add('airfoil-total-potential','Total surface potential · first order','Φ/(U∞c)',['Upper','Lower'].map(side=>({name:side,points:r.linear.potential.filter(p=>p.side===side).flatMap(p=>Array.from({length:41},(_,i)=>{const x=p.x0+(p.x1-p.x0)*i/40;return [x,x+p.derivative*x+p.intercept];}))})));
 for(const p of plots)if(p.key.includes('potential'))p.chart.leftMargin=86;
 return plots;
}
