import {rayleighRatios,fannoRatios} from './physics.js?v=20261110-rayleigh-audit';
function root(fn,target,sub){let lo=sub?1e-6:1,hi=sub?1:1e6,a=fn(lo)-target,b=fn(hi)-target;if(Math.abs(a)<1e-12)return lo;if(Math.abs(b)<1e-12)return hi;if(a*b>0)throw Error('The supplied data have no finite solution on this Mach branch.');for(let i=0;i<160;i++){const mid=(lo+hi)/2,v=fn(mid)-target;if(a*v<=0)hi=mid;else{lo=mid;a=v;}}return (lo+hi)/2;}
export function ductInputs(id,x){x={...x};if(id==='rayleigh'&&['Heat transfer + Inlet Mach','Heat transfer + Outlet Mach'].includes(x.rayleighInput)){const g=x.gamma??1.4,cp=g*(x.R??287)/(g-1),data='Specific heat q';if(x.rayleighInput==='Heat transfer + Outlet Mach'){if(data==='Specific heat q')x.outletT0=x.inletT0+x.q*1000/cp;x.rayleighInput='Outlet Mach + stagnation temperatures';}else if(data==='Stagnation temperatures'){x.T1=x.inverseTemperatureType==='Static temperature'?x.inletT0:x.inletT0/(1+(g-1)*x.M1*x.M1/2);x.rayleighInput='Inlet Mach + outlet stagnation temperature';}else x.rayleighInput={'Specific heat q':'Heat transfer','Outlet Mach':'Outlet Mach','Outlet pressure':'Outlet pressure','Sonic outlet':'Sonic outlet'}[data]??'Heat transfer';}const g=x.gamma??1.4,mode=id==='rayleigh'?x.rayleighInput:x.fannoInput;
if(id==='rayleigh'&&mode==='Outlet Mach + stagnation temperatures'){const m=x.targetMach,A=x.inletT0,B=x.outletT0;if(!(m>0&&A>0&&B>0))throw Error('Mach and stagnation temperatures must be positive.');const sub=m===1?x.inletBranch!=='Supersonic':m<1;x.M1=root(M=>rayleighRatios(M,g).T0,A/B*rayleighRatios(m,g).T0,sub);x.T1=A/(1+(g-1)*x.M1*x.M1/2);x.rayleighInput='Outlet Mach';}
if(id==='fanno'&&mode&&mode!=='Friction length')resolveFannoOutlet(x,g,mode);
return x;}

export const fannoInletMachModes = {
 friction:'Outlet Mach + friction length',
 temperature:'Outlet Mach + temperature ratio',
 pressure:'Outlet Mach + pressure ratio',
};

function resolveFannoOutlet(x,g,mode){
 const outlet=x.targetMach;
 if(!Number.isFinite(outlet)||outlet<=0)throw Error('Outlet Mach must be finite and positive.');
 const {friction,temperature,pressure}=fannoInletMachModes;
 if(mode===friction){
  if(!(x.lambda>=0))throw Error('Require a nonnegative friction parameter.');
  const subsonic=outlet===1?x.inletBranch!=='Supersonic':outlet<1;
  x.M1=x.lambda===0?outlet:root(M=>fannoRatios(M,g).F,fannoRatios(outlet,g).F+x.lambda,subsonic);
 }else if(mode===temperature||mode===pressure){
  x.M1=fannoInletMachFromRatio(outlet,g,mode===temperature,x.fannoTemperatureRatio,x.fannoPressureRatio);
 }

 if([friction,temperature,pressure].includes(mode)){
  if(!(x.inletT0>0))throw Error('Inlet temperature must be positive.');
  x.T1=x.inverseTemperatureType==='Static temperature'?x.inletT0:x.inletT0/(1+(g-1)*x.M1*x.M1/2);
 }
 if(mode===friction)return;
 if((x.M1-1)*(outlet-1)<0)throw Error('Fanno flow cannot cross the sonic state.');
 const lambda=fannoRatios(x.M1,g).F-fannoRatios(outlet,g).F;
 if(lambda< -1e-10)throw Error('The specified outlet requires negative friction length.');
 x.lambda=Math.max(0,lambda);
}

function fannoInletMachFromRatio(outlet,g,fromTemperature,temperatureRatio,pressureRatio){
 const ratio=fromTemperature?temperatureRatio:pressureRatio;
 const symbol=fromTemperature?'T₂/T₁':'p₂/p₁';
 if(!Number.isFinite(ratio)||ratio<=0)throw Error(`The static ratio ${symbol} must be finite and positive.`);
 if(ratio===1)return outlet;

 const halfGammaMinusOne=(g-1)/2;
 const outletSquared=outlet**2;
 const outletTemperatureFactor=1+halfGammaMinusOne*outletSquared;
 // T0 is constant. Continuity then gives p2/p1=(M1/M2)*sqrt(T2/T1).
 const pressureTerm=(ratio*outlet)**2*outletTemperatureFactor;
 const inletSquared=fromTemperature
  ?outletSquared+(ratio-1)*outletTemperatureFactor/halfGammaMinusOne
  :2*pressureTerm/(1+Math.sqrt(1+4*halfGammaMinusOne*pressureTerm));
 if(!(inletSquared>0&&Number.isFinite(inletSquared)))
  throw Error(`The static ratio ${symbol} gives no finite, positive inlet Mach number.`);
 const inlet=Math.sqrt(inletSquared);
 const awayFromSonic=(outlet<1&&inlet>outlet)||(outlet>1&&inlet<outlet);
 if(awayFromSonic)
  throw Error(`The static ratio ${symbol} is incompatible with the specified outlet Mach. Friction moves the flow toward Mach 1.`);
 return inlet;
}
