import {areaMach, deg, isentropic, prandtlMeyer} from './physics.js';
import {bisect, finite, requireValue} from './numerics.js';

export const nozzleMocExamples = [
 {value:'john-keith', label:'Mach 1.8 · John & Keith', inputs:{mocExitMach:1.8, gamma:1.2, mocFanRays:20},
  note:'Design inputs from Gas Dynamics, Example 14.5. The lab computes the contour on its own grid.'},
 {value:'anderson', label:'Mach 2.4 · Anderson', inputs:{mocExitMach:2.4, gamma:1.4, mocFanRays:30},
  note:'Design inputs from Modern Compressible Flow, 3rd ed., Example 11.1.'},
 {value:'nasa-x-1502', label:'Mach 4.05 · NASA TM X-1502', inputs:{mocExitMach:4.05, gamma:1.36, mocFanRays:330},
  note:'Design inputs from NASA TM X-1502, Table I. The fan is resolved at about 0.1° per step.'},
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

export function designMinimumLengthNozzle({mocExitMach, gamma, mocFanRays, mocThroatHalfHeight}) {
 const mach=mocExitMach, count=mocFanRays, halfHeight=mocThroatHalfHeight;
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
 const mesh=[];
 const wall=[throat];
 const axis=[{x:0,y:0,theta:0,M:1}];
 // Each row follows a reflected C+ from the symmetry line to the wall.
 // Along C− and C+ respectively, nu + theta and nu − theta are constant.
 for(let i=1;i<=count;i++){
  const previous=mesh.at(-1);
  const row=[];
  for(let j=i;j<=count;j++){
   const state={...states[i+j],theta:(j-i)*increment,nu:(i+j)*increment};
   const upstream=previous?.[j-i+1]??throat;
   const incoming=i===1?state.theta-state.mu:minus(upstream,state);
   const left=row.at(-1);
   if(!left){
    const point=intersect(upstream,incoming,axis[0],0);
    row.push({...state,x:point.x,y:0});
    axis.push(row[0]);
   }else row.push({...state,...intersect(upstream,incoming,left,plus(left,state))});
  }
  const left=row.at(-1), previousWall=wall.at(-1);
  const point=intersect(left,left.theta+left.mu,previousWall,(previousWall.theta+left.theta)/2);
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
 return {mesh,wall,axis,wallInletMach:states[count].M,halfHeight,wallAngle:deg(wallAngle),fanIncrement:deg(increment),
  length:last.x*halfHeight,exitHeight:2*last.y*halfHeight,areaRatio:last.y,
  isentropicAreaRatio:expected,areaErrorPct,
  exitMach:last.M,exitAngle:deg(last.theta),exitPressureRatio:1/endState.p0p,exitTemperatureRatio:1/endState.T0T};
}
