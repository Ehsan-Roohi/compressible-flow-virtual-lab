import {normalShock,shockTube} from './physics.js';
import {gas,positive,requireValue} from './numerics.js';

export const tubeModes=['Chamber pressures','Initial pressure ratio p₄/p₁','Shock pressure ratio p₂/p₁','Induced gas speed'];
export const tubeFields=[
 {key:'tubeInput',label:'Known data',value:tubeModes[0],options:tubeModes},
 {key:'tubeInitialVelocity',label:'Initial gas velocity · both chambers',value:0,min:-3000,max:3000,step:1,unit:'m/s',help:'Signed velocity in the laboratory frame. Positive is toward the driven chamber; negative is toward the driver.'},
 {key:'driverRatio',label:'Initial driver-to-driven pressure ratio',value:40,min:1.000001,max:1e8,step:.1,unit:'p₄/p₁',help:'Initial chamber pressures before diaphragm rupture; this is not the shock pressure ratio.'},
 {key:'shockRatio',label:'Pressure ratio across the incident shock',value:10,min:1.000001,max:10000,step:.1,unit:'p₂/p₁',help:'Post-shock pressure divided by initial driven pressure. Driver pressure is calculated using T₄.'},
 {key:'inducedSpeed',label:'Gas velocity behind the shock · laboratory frame',value:150,min:-3000,max:10000,step:1,unit:'m/s',help:'Signed downstream gas velocity. It must exceed the initial gas velocity to produce this compression shock.'}
];

export function resolveTubeInputs(raw){
 const x={...raw},mode=x.tubeInput??tubeModes[0],g=x.gamma??1.4,R=x.R??287;
 gas(g,R);positive(x.p1,'Driven pressure');positive(x.T1,'Driven temperature');positive(x.T4,'Driver temperature');
 x.tubeInitialVelocity??=0;
 requireValue(Number.isFinite(x.tubeInitialVelocity),'Initial gas velocity must be finite.');
 requireValue(tubeModes.includes(mode),'Choose a supported shock-tube input mode.');
 if(mode===tubeModes[1]){
  requireValue(Number.isFinite(x.driverRatio)&&x.driverRatio>1,'Require initial pressure ratio p₄/p₁ > 1.');
  x.p4=x.p1*x.driverRatio;
 }else if(mode===tubeModes[2]||mode===tubeModes[3]){
  if(mode===tubeModes[3]){
   const velocityRise=x.inducedSpeed-x.tubeInitialVelocity;
   positive(velocityRise,'Induced gas speed minus initial gas velocity');
   const a1=Math.sqrt(g*R*x.T1),q=(g+1)*velocityRise/(4*a1),Ms=q+Math.hypot(1,q);
   x.shockRatio=1+2*g/(g+1)*(Ms*Ms-1);
  }
  const r=x.shockRatio;
  requireValue(Number.isFinite(r)&&r>1,'Require shock pressure ratio p₂/p₁ > 1.');
  const Ms=Math.sqrt(1+(g+1)/(2*g)*(r-1)),n=normalShock(Ms,g);
  const u=Ms*Math.sqrt(g*R*x.T1)*(1-1/n.rho),a4=Math.sqrt(g*R*x.T4);
  const expansionFactor=1-(g-1)*u/(2*a4);
  requireValue(expansionFactor>0,'This shock requires more driver expansion velocity than T₄ permits. Increase the driver temperature or reduce the requested shock ratio / induced gas speed.');
  x.p4=x.p1*r/expansionFactor**(2*g/(g-1));
 }
 requireValue(Number.isFinite(x.p4)&&x.p4>x.p1,'Require finite driver pressure p₄ > p₁.');
 return x;
}

export function solveTube(raw){
 const inputs=resolveTubeInputs(raw),g=inputs.gamma??1.4,R=inputs.R??287;
 const result=shockTube({...inputs,p1:inputs.p1*1000,p4:inputs.p4*1000,gamma1:g,gamma4:g,R1:R,R4:R});
 const initialVelocity=inputs.tubeInitialVelocity;
 const relativeShockSpeed=result.shockSpeed;
 // A common initial velocity translates the Riemann solution; wave-relative jumps and thermodynamic states are unchanged.
 return {inputs,result:{...result,initialVelocity,relativeShockSpeed,
  head:result.head+initialVelocity,tail:result.tail+initialVelocity,
  contact:result.contact+initialVelocity,u:result.u+initialVelocity,
  shockSpeed:relativeShockSpeed+initialVelocity}};
}
