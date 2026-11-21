export const tubeSolutionMethods=['Nonlinear','Linearized','Compare both'];
export const tubeComparisonNote='Initial diaphragm waves, before any end-wall encounter. The acoustic approximation uses one reference pressure and density and is valid for small differences in chamber conditions. All velocities are signed in the laboratory frame.';

export function linearizedTube(x,nonlinear){
 const pLeft=x.p4*1000,pRight=x.p1*1000;
 // Linearize around the mean chamber pressure and density. Both gases share γ, R and u₀.
 const pressure=(pLeft+pRight)/2,density=(pLeft/x.T4+pRight/x.T1)/(2*(x.R??287));
 const sound=Math.sqrt((x.gamma??1.4)*pressure/density),u0=x.tubeInitialVelocity;
 const linear={pressure,velocity:u0+(pLeft-pRight)/(2*density*sound),leftSpeed:u0-sound,rightSpeed:u0+sound};
 const speeds=[linear.leftSpeed,linear.rightSpeed,...(nonlinear?[nonlinear.head,nonlinear.shockSpeed]:[])];
 const end=Math.min((x.finiteEndTime??30)/1000,...speeds.map(speed=>speed<0
  ?-(x.finiteDriverLength??4)/speed:speed>0?(x.finiteDrivenLength??6)/speed:Infinity));
 const trajectory=(name,speed,color,dash)=>({name,color,dash,points:[[0,0],[speed*end,end*1000]]});
 const series=[
  ...(nonlinear?[
   trajectory('Nonlinear · expansion head',nonlinear.head,'#197a92'),
   trajectory('Nonlinear · expansion tail',nonlinear.tail,'#197a92'),
   trajectory('Nonlinear · contact',nonlinear.contact,'#776e64','2 3'),
   trajectory('Nonlinear · incident shock',nonlinear.shockSpeed,'#202b38')
  ]:[]),
  trajectory('Linearized · left acoustic wave',linear.leftSpeed,'#bc621b','7 4'),
  trajectory('Linearized · right acoustic wave',linear.rightSpeed,'#bc621b','7 4')
 ];
 const rows=[
  {label:'Intermediate pressure',unit:'kPa',linear:pressure/1000,nonlinear:nonlinear?nonlinear.p/1000:null},
  {label:'Intermediate velocity',unit:'m/s',linear:linear.velocity,nonlinear:nonlinear?.u??null},
  {label:'Left wave speed · acoustic / fan head',unit:'m/s',linear:linear.leftSpeed,nonlinear:nonlinear?.head??null},
  {label:'Right wave speed · acoustic / shock',unit:'m/s',linear:linear.rightSpeed,nonlinear:nonlinear?.shockSpeed??null}
 ];
 return {...linear,end,rows,chart:{title:nonlinear?'Wave trajectories · method comparison':'Linearized wave trajectories',xlabel:'Position x (m)',ylabel:'Time t (ms)',series}};
}

export function movingShockSonicMach(gamma){
 // With gas at rest ahead of the shock, impose u₂² = a₂² using the normal-shock ratios.
 // Solve in q = 1/Mₛ². For γ ≥ 2, the downstream lab-frame Mach stays below 1 at finite Mₛ.
 if(gamma>=2)return null;
 const b=7-gamma,c=2-gamma;
 // The smaller root of 2q² − bq + 2c = 0 lies in (0,1).
 return Math.sqrt((b+Math.sqrt(b*b-16*c))/(4*c));
}
