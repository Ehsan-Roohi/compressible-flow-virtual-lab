import {areaMach, deg, isentropic, prandtlMeyer} from './physics.js';
import {bisect, finite, requireValue} from './numerics.js';

export const nozzleMocMethods = Object.freeze({
 point:'Point-to-Point',
 region:'Region-to-Region',
 compare:'Compare both'
});

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

export function designMinimumLengthNozzle({
 mocExitMach, gamma, mocFanRays, mocThroatHalfHeight, nozzleMocMethod=nozzleMocMethods.point
}) {
 const mach=mocExitMach, count=mocFanRays, halfHeight=mocThroatHalfHeight;
 const regional=nozzleMocMethod===nozzleMocMethods.region;
 requireValue(regional||nozzleMocMethod===nozzleMocMethods.point,'Choose one nozzle design method.');
 requireValue(finite(mach)&&mach>=1.01&&mach<=8,'Enter an exit Mach number from 1.01 to 8.');
 requireValue(finite(gamma)&&gamma>=1.1&&gamma<=1.67,'Enter a specific heat ratio from 1.1 to 1.67.');
 requireValue(Number.isInteger(count)&&count>=4&&count<=400,'Enter a whole number from 4 to 400 for the number of fan rays.');
 requireValue(finite(halfHeight)&&halfHeight>=.001&&halfHeight<=100,'Enter a throat half-height from 0.001 to 100 m.');

 const nuExit=prandtlMeyer(mach,gamma), wallAngle=nuExit/2;
 const increment=wallAngle/count;
 const throat={x:0,y:1,theta:wallAngle,M:1};
 const states=Array.from({length:2*count+1},(_,i)=>{
  const nu=i*increment;
  const M=i===0?1:i===2*count?mach:bisect(m=>prandtlMeyer(m,gamma)-nu,1,mach,{ftol:1e-15}).value;
  return {M,mu:Math.asin(1/M)};
 });
 // A region bordered by reflected wave i and incident wave j carries
 // nu - theta = 2 i Δθ and nu + theta = 2 j Δθ.
 const state=(i,j)=>({...states[i+j],theta:(j-i)*increment,nu:(i+j)*increment});
 const fan=regional?Array.from({length:count+1},(_,j)=>state(0,j)):null;
 const mesh=[];
 const wall=[throat];
 const axis=[{x:0,y:0,theta:0,M:1}];
 // Each row follows a reflected C+ from the symmetry line to the wall.
 // Along C− and C+ respectively, nu + theta and nu − theta are constant.
 for(let i=1;i<=count;i++){
  const previous=mesh.at(-1);
  const row=[];
  for(let j=i;j<=count;j++){
   const downstream=state(i,j);
   const upstream=previous?.[j-i+1]??throat;
   // Region-to-region wave directions use the two constant states on either side.
   const incoming=regional?minus(state(i-1,j-1),state(i-1,j)):
    i===1?downstream.theta-downstream.mu:minus(upstream,downstream);
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
 const last=wall.at(-1), expected=areaMach(mach,gamma);
 const areaErrorPct=100*(last.y/expected-1);
 requireValue(Math.abs(areaErrorPct)<=10,
  'This mesh gives an exit area more than 10% from the isentropic value. Increase the number of fan rays.');
 const endState=isentropic(last.M,gamma);
 return {method:nozzleMocMethod,mesh,wall,axis,fan,wallInletMach:states[count].M,halfHeight,wallAngle:deg(wallAngle),fanIncrement:deg(increment),
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
 const xlabel='Axial position x/hₜ';
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
  title:wallTitle,xlabel,ylabel:'Wall coordinate y/hₜ',series:compare?
   designs.map(({wall,method})=>({name:method,points:wall.map(p=>[p.x,p.y]),color:color[method],
    ...(method===nozzleMocMethods.region?{dash:'6 4'}:{})})):
   [{name:'Upper wall',points:designs[0].wall.map(p=>[p.x,p.y])},
    {name:'Lower wall',points:designs[0].wall.map(p=>[p.x,-p.y])}]
 },...(compare?{note:'Upper-wall profiles are overlaid. The lower walls are their reflections about the centerline.'}:{})};
 return compare?[wall,mach]:[mach,wall];
}
