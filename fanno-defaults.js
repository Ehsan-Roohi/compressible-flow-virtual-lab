import {fannoExample} from './fanno-examples.js?v=20261120-fanno-plot-menu';
import {fannoConditions,fannoSolveOptions,fannoSystemMode,fannoUnknowns,solveFannoSystem} from './fanno-system.js?v=20261119-fanno-system-relations';
import {fannoRatios,isentropic} from './physics.js';
import {fannoInletMachModes} from './duct-input.js?v=20261124-fanno-inverse-ratios';

const [varyPressure,matchedExit,throatLimit,nozzleExitShock,ductExitShock,sonicExit]=fannoConditions;
const [backPressure,reservoirPressure,frictionParameter,flowRegime]=fannoUnknowns;
const precise=value=>Number(value.toPrecision(10));

function frictionData(inputs,selection){
 const frictionConvention=selection.frictionConvention??inputs.frictionConvention;
 const factorScale=frictionConvention===inputs.frictionConvention?1:frictionConvention==='Darcy'?4:1/4;
 return {...inputs,frictionConvention,frictionFactor:inputs.frictionFactor*factorScale,
  frictionInput:selection.frictionInput??inputs.frictionInput};
}

function singleDuctDefaults(base,selection){
 const fannoInput=selection.fannoInput??'Friction length';
 const hasFriction=fannoInput==='Friction length';
 const x={...base,...fannoExample(hasFriction?1:2).inputs};
 const {M1,targetMach,T1,gamma,R,ductLength,hydraulicDiameter,frictionFactor}=x;
 const fd=4*frictionFactor;
 // The inverse inlet-Mach mode uses the duct length found in Example 2.
 const lambda=hasFriction?fd*ductLength/hydraulicDiameter:fannoRatios(M1,gamma).F-fannoRatios(targetMach,gamma).F;
 const ratios=Object.values(fannoInletMachModes).includes(fannoInput)
  ?{fannoTemperatureRatio:fannoRatios(targetMach,gamma).T/fannoRatios(M1,gamma).T,
    fannoPressureRatio:fannoRatios(targetMach,gamma).p/fannoRatios(M1,gamma).p}
  :{};
 return {...frictionData(x,selection),...ratios,fannoInput,lambda:precise(lambda),
  ductLength:hasFriction?ductLength:precise(lambda*hydraulicDiameter/fd),
  inletSpeed:precise(M1*Math.sqrt(gamma*R*T1)),inletT0:T1*isentropic(M1,gamma).T0T,
  ductWidth:hydraulicDiameter,ductHeight:hydraulicDiameter};
}

export function fannoModeDefaults(base,selection={}){
 if(selection.ductProblem!==fannoSystemMode)return singleDuctDefaults(base,selection);
 const fannoCondition=selection.fannoCondition??ductExitShock;
 const options=fannoSolveOptions(fannoCondition);
 const fannoUnknown=options.includes(selection.fannoUnknown)?selection.fannoUnknown:options[0];
 const example=fannoCondition===varyPressure?6:fannoCondition===matchedExit?3:
  fannoCondition===ductExitShock&&fannoUnknown===frictionParameter?4:fannoCondition===sonicExit?null:5;
 const preset=example?fannoExample(example).inputs:{};
 const x=frictionData({...base,...preset,ductProblem:fannoSystemMode,fannoInterfaceVersion:2,
  fannoCondition,fannoUnknown,
  bookExample:example===5&&fannoUnknown===backPressure&&selection.bookExample==='5–5'?'5–5':''},selection);
 if(fannoUnknown===flowRegime||example===4)return x;
 if(fannoCondition===matchedExit){
  if(fannoUnknown!==reservoirPressure){
   const {result}=solveFannoSystem({...x,fannoUnknown:reservoirPressure});
   x.reservoirP0=precise(result.supplyPressure/1000);
  }
 }else if(fannoUnknown!==backPressure){
  const {result}=solveFannoSystem({...x,fannoUnknown:backPressure});
  x.backPressure=precise(result.backPressure/1000);
 }
 return x;
}

export function fannoModeSelection(previous,key,value){
 if(key==='ductProblem')return {ductProblem:value};
 const selection={ductProblem:previous.ductProblem,fannoCondition:previous.fannoCondition,
  fannoUnknown:previous.fannoUnknown,[key]:value};
 if(previous.bookExample==='5–5'&&selection.fannoUnknown===backPressure&&
    [throatLimit,nozzleExitShock,ductExitShock].includes(selection.fannoCondition))selection.bookExample=previous.bookExample;
 return selection;
}
