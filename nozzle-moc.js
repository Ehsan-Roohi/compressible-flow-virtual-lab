import {areaMach, deg, isentropic, prandtlMeyer} from './physics.js';
import {bisect, finite, requireValue} from './numerics.js';

export const nozzleMocMethods = Object.freeze({
 point:'Point-to-Point',
 region:'Region-to-Region',
 compare:'Compare both'
});

export const nozzleMocStarts = Object.freeze({sonic:'Sonic throat',supersonic:'Supersonic inlet'});

export const nozzleMocTargets = Object.freeze({
 mach:'Exit Mach number',
 pressure:'Exit pressure ratio',
 area:'Exit area ratio'
});

const minimumExitMach=1.01, maximumExitMach=8;

function startingMach(inputs){
 return inputs.nozzleMocStart===nozzleMocStarts.supersonic?inputs.mocInletMach:1;
}

export function nozzleMocTargetValues(inputs,mach=inputs.mocExitMach){
 const {gamma}=inputs;
 return {
  mocExitMach:mach,
  mocExitPressureRatio:1/isentropic(mach,gamma).p0p,
  mocExitAreaRatio:areaMach(mach,gamma)/areaMach(startingMach(inputs),gamma)
 };
}

export function resolveNozzleMocExitMach(inputs){
 const {
  nozzleMocTarget=nozzleMocTargets.mach,nozzleMocStart=nozzleMocStarts.sonic,
  gamma,mocExitMach,mocExitPressureRatio,mocExitAreaRatio
 }=inputs;
 const inlet=startingMach(inputs);
 const inletMessage='For a supersonic inlet, enter conditions satisfying 1 < inlet Mach < exit Mach.';
 requireValue(finite(gamma)&&gamma>=1.1&&gamma<=1.67,'Enter a specific heat ratio from 1.1 to 1.67.');
 requireValue(Object.values(nozzleMocStarts).includes(nozzleMocStart),'Choose a nozzle starting section.');
 requireValue(nozzleMocStart===nozzleMocStarts.sonic||(finite(inlet)&&inlet>1&&inlet<maximumExitMach),inletMessage);

 let mach=mocExitMach;
 const machRange='The design exit Mach number must be from 1.01 to 8.';
 if(nozzleMocTarget===nozzleMocTargets.pressure){
  requireValue(finite(mocExitPressureRatio)&&mocExitPressureRatio>0&&mocExitPressureRatio<1,
   'Enter an exit-to-stagnation pressure ratio between 0 and 1.');
  mach=Math.sqrt(2*Math.expm1(-Math.log(mocExitPressureRatio)*(gamma-1)/gamma)/(gamma-1));
  const tolerance=8*Number.EPSILON*maximumExitMach;
  requireValue(finite(mach)&&mach>=minimumExitMach-tolerance&&mach<=maximumExitMach+tolerance,machRange);
  mach=Math.min(maximumExitMach,Math.max(minimumExitMach,mach));
 }else if(nozzleMocTarget===nozzleMocTargets.area){
  requireValue(finite(mocExitAreaRatio)&&mocExitAreaRatio>1,'Enter an exit area ratio greater than 1.');
  const inletArea=areaMach(inlet,gamma);
  const lowerMach=Math.max(inlet,minimumExitMach);
  const areaRatio=exitMach=>areaMach(exitMach,gamma)/inletArea;
  const lower=areaRatio(lowerMach),upper=areaRatio(maximumExitMach);
  requireValue(mocExitAreaRatio>=lower*(1-8*Number.EPSILON)&&mocExitAreaRatio<=upper*(1+8*Number.EPSILON),machRange);
  const target=Math.min(upper,Math.max(lower,mocExitAreaRatio));
  mach=bisect(exitMach=>areaRatio(exitMach)-target,lowerMach,maximumExitMach,{ftol:0}).value;
 }else{
  requireValue(nozzleMocTarget===nozzleMocTargets.mach,'Choose a nozzle design target.');
 }
 requireValue(finite(mach)&&mach>=minimumExitMach&&mach<=maximumExitMach,machRange);
 requireValue(mach>inlet,inletMessage);
 return mach;
}

export const nozzleMocExamples = [
 {value:'john-keith', menuNumber:1, label:'Mach 1.8 nozzle',
  inputs:{mocExitMach:1.8, fluid:'Custom gas', gamma:1.2, mocFanRays:20},
  note:'Design a minimum-length nozzle for Mach 1.8 with γ = 1.20. The design conditions are from John & Keith, Example 14.5.'},
 {value:'anderson', menuNumber:2, label:'Mach 2.4 air nozzle',
  inputs:{mocExitMach:2.4, fluid:'Air', gamma:1.4, mocFanRays:30},
  note:'Expand air to Mach 2.4 and find the wall contour that gives parallel flow at the exit. Based on Anderson, Example 11.1.'},
 {value:'nasa-x-1502', menuNumber:3, label:'Mach 4.05 nozzle',
  inputs:{mocExitMach:4.05, fluid:'Custom gas', gamma:1.36, mocFanRays:330},
  note:'Design for Mach 4.05 with γ = 1.36 and a fan increment of about 0.1°. Based on NASA TM X-1502, Table I.'},
 {value:'supersonic-inlet', menuNumber:4, label:'Mach 1.5 to 2.4 expansion',
  inputs:{nozzleMocStart:nozzleMocStarts.supersonic,mocInletMach:1.5,mocExitMach:2.4,fluid:'Air',gamma:1.4,mocFanRays:30},
  note:'Design a downstream contour that expands uniform air from Mach 1.5 to Mach 2.4 with parallel exit flow.'},
];

function intersect(a, angleA, b, angleB) {
 const ax=Math.cos(angleA), ay=Math.sin(angleA);
 const bx=Math.cos(angleB), by=Math.sin(angleB);
 const determinant=ax*by-ay*bx;
 requireValue(Math.abs(determinant)>1e-12,'The characteristic directions are too close to intersect reliably.');
 const distance=((b.x-a.x)*by-(b.y-a.y)*bx)/determinant;
 return {x:a.x+distance*ax, y:a.y+distance*ay};
}

function minus(a,b){return (a.theta+b.theta-a.mu-b.mu)/2;}
function plus(a,b){return (a.theta+b.theta+a.mu+b.mu)/2;}

export function designMinimumLengthNozzle(inputs) {
 const {
  gamma,mocFanRays:count,mocThroatHalfHeight:halfHeight,
  nozzleMocMethod=nozzleMocMethods.point,nozzleMocStart=nozzleMocStarts.sonic
 }=inputs;
 const regional=nozzleMocMethod===nozzleMocMethods.region;
 const supersonic=nozzleMocStart===nozzleMocStarts.supersonic;
 const inletMach=startingMach(inputs);
 requireValue(regional||nozzleMocMethod===nozzleMocMethods.point,'Choose one nozzle design method.');
 const mach=resolveNozzleMocExitMach(inputs);
 requireValue(Number.isInteger(count)&&count>=4&&count<=400,'Enter a whole number from 4 to 400 for the number of fan rays.');
 requireValue(finite(halfHeight)&&halfHeight>=.001&&halfHeight<=100,'Enter a starting half-height from 0.001 to 100 m.');

 // The centered expansion adds θ to ν. At the last C−, symmetry gives
 // νₑ = νᵢ + 2θmax because the exit flow is parallel.
 const nuInlet=prandtlMeyer(inletMach,gamma),nuExit=prandtlMeyer(mach,gamma);
 const wallAngle=(nuExit-nuInlet)/2;
 const increment=wallAngle/count;
 const corner={x:0,y:1,theta:wallAngle,M:inletMach};
 const states=Array.from({length:2*count+1},(_,i)=>{
  const nu=nuInlet+i*increment;
  const M=i===0?inletMach:i===2*count?mach:bisect(m=>prandtlMeyer(m,gamma)-nu,inletMach,mach,{ftol:1e-15}).value;
  return {M,mu:Math.asin(1/M)};
 });
 // A region bordered by reflected wave i and incident wave j carries
 // ν − θ = νᵢ + 2 i Δθ and ν + θ = νᵢ + 2 j Δθ.
 const state=(i,j)=>({...states[i+j],theta:(j-i)*increment,nu:nuInlet+(i+j)*increment});
 const fan=regional?Array.from({length:count+1},(_,j)=>state(0,j)):null;
 const mesh=[];
 const wall=[corner];
 const axis=[{x:0,y:0,theta:0,M:inletMach}];
 // Each row follows a reflected C+ from the symmetry line to the wall.
 // Along C− and C+ respectively, nu + theta and nu − theta are constant.
 for(let i=1;i<=count;i++){
  const previous=mesh.at(-1);
  const row=[];
  for(let j=i;j<=count;j++){
   const downstream=state(i,j);
   const upstream=previous?.[j-i+1]??corner;
   // Region-to-region wave directions use the two constant states on either side.
   const origin=i===1?(supersonic?state(0,j):downstream):upstream;
   const incoming=regional?minus(state(i-1,j-1),state(i-1,j)):minus(origin,downstream);
   if(supersonic)requireValue(incoming<0&&incoming>-Math.PI/2,
    'The centered expansion does not march to the axis. Reduce the target Mach number for this inlet.');
   const left=row.at(-1);
   if(!left){
    const point=intersect(upstream,incoming,axis[0],0);
    row.push({...downstream,x:point.x,y:0});
    axis.push(row[0]);
   }else{
    const reflected=regional?plus(state(i-1,j-1),left):plus(left,downstream);
    row.push({...downstream,...intersect(upstream,incoming,left,reflected)});
   }
  }
  const left=row.at(-1), previousWall=wall.at(-1);
  const reflected=regional?plus(state(i-1,count),left):left.theta+left.mu;
  const tangent=regional?previousWall.theta:(previousWall.theta+left.theta)/2;
  const point=intersect(left,reflected,previousWall,tangent);
  const wallPoint={...left,...point};
  requireValue(finite(point.x,point.y)&&point.x>previousWall.x&&point.y>=previousWall.y,
   'The characteristic grid folds for these inputs. Increase the fan resolution or reduce the exit Mach number.');
  wall.push(wallPoint);
  row.push(wallPoint);
  mesh.push(row);
 }
 const last=wall.at(-1), expected=areaMach(mach,gamma)/areaMach(inletMach,gamma);
 const areaErrorPct=100*(last.y/expected-1);
 requireValue(Math.abs(areaErrorPct)<=10,
  'This mesh gives an exit area more than 10% from the isentropic value. Increase the number of fan rays.');
 const endState=isentropic(last.M,gamma);
 return {method:nozzleMocMethod,nozzleMocStart,inletMach,mesh,wall,axis,fan,wallInletMach:states[count].M,halfHeight,wallAngle:deg(wallAngle),fanIncrement:deg(increment),
  length:last.x*halfHeight,exitHeight:2*last.y*halfHeight,areaRatio:last.y,
  isentropicAreaRatio:expected,areaErrorPct,
  exitMach:last.M,exitAngle:deg(last.theta),exitPressureRatio:1/endState.p0p,exitTemperatureRatio:1/endState.T0T};
}

function machProfile(points,regional){
 if(!regional)return points.map(({x,M})=>[x,M]);
 return [[points[0].x,points[0].M],...points.slice(1).flatMap(({x,M},i)=>[[x,points[i].M],[x,M]])];
}

export function nozzleMocPlots(designs){
 const compare=designs.length===2;
 const scale=designs[0].inletMach>1?'hᵢ':'hₜ';
 const xlabel=`Axial position x/${scale}`;
 const color={ [nozzleMocMethods.point]:'#08716a', [nozzleMocMethods.region]:'#9a4929' };
 const machTitle=compare?'Mach number comparison':'Mach number along the nozzle';
 const wallTitle=compare?'Nozzle contour comparison':'Nozzle wall coordinates';
 const mach={key:'nozzle-moc-mach',label:machTitle,chart:{
  title:machTitle,xlabel,ylabel:'Mach number',series:designs.flatMap(design=>{
   const {axis,wall,wallInletMach,method}=design;
   const last=wall.at(-1),regional=method===nozzleMocMethods.region;
   const name=property=>compare?`${method} · ${property}`:property;
   const style=compare?{color:color[method]}:{};
   return [
    {name:name('Centerline'),points:machProfile([...axis,{x:last.x,M:last.M}],regional),...style},
    {name:name('Wall'),points:machProfile([wall[0],{x:0,M:wallInletMach},...wall.slice(1)],regional),
     ...(compare?{...style,dash:'6 4'}:{})}
   ];
  })
 }};
 const wall={key:'nozzle-moc-wall',label:wallTitle,chart:{
  title:wallTitle,xlabel,ylabel:`Wall coordinate y/${scale}`,series:compare?
   designs.map(({wall,method})=>({name:method,points:wall.map(p=>[p.x,p.y]),color:color[method],
    ...(method===nozzleMocMethods.region?{dash:'6 4'}:{})})):
   [{name:'Upper wall',points:designs[0].wall.map(p=>[p.x,p.y])},
    {name:'Lower wall',points:designs[0].wall.map(p=>[p.x,-p.y])}]
 },...(compare?{note:'Upper-wall profiles are overlaid. The lower walls are their reflections about the centerline.'}:{})};
 return compare?[wall,mach]:[mach,wall];
}
