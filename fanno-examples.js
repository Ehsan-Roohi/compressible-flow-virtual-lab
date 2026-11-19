import {fannoSystemMode,fannoConditions,fannoUnknowns,solveFannoSystem} from './fanno-system.js?v=20261119-fanno-system-relations';

// Chapter 5, Examples 5-1 through 5-6. The book uses Fanning f.
const system={ductProblem:fannoSystemMode,fannoInterfaceVersion:2,frictionInput:'Dimensionless',fannoUnknown:'Back pressure'};
export const fannoExamples=[
 {number:1,inputs:{ductProblem:'Single duct',fannoInput:'Friction length',M1:.6,p1:150,T1:300,frictionInput:'Length and friction factor',hydraulicDiameter:.03,ductLength:.45,frictionFactor:.005,frictionConvention:'Fanning'},note:'Compute the outlet Mach number, pressure, and temperature from the specified inlet state, duct dimensions, and Fanning friction factor.'},
 {number:2,inputs:{ductProblem:'Single duct',fannoInput:'Outlet Mach',M1:2.5,targetMach:1.5,hydraulicDiameter:.05,frictionFactor:.02,frictionConvention:'Fanning'},note:'The required friction parameter fᴅL/D and its maximum value (sonic exit) answer the two parts. Inlet pressure and temperature are reference values for visualization; they do not affect either friction parameter.'},
 {number:3,inputs:{...system,fannoCondition:fannoConditions[1],fannoUnknown:'Reservoir pressure',systemAreaRatio:5.42,backPressure:101.35,ductLength:2.44,ductSection:'Rectangular',ductWidth:1.22,ductHeight:2.44,hydraulicDiameter:2*1.22*2.44/(1.22+2.44),lambda:.02*2.44/(2*1.22*2.44/(1.22+2.44)),reservoirT0:300},note:'Minimum supply pressure for the specified supersonic duct flow. The reference reservoir temperature does not affect the pressure solution.'},
 {number:4,inputs:{...system,fannoCondition:fannoConditions[4],fannoUnknown:'Friction parameter',reservoirP0:800,reservoirT0:300,systemAreaRatio:2.4,backPressure:300},note:'Find the duct friction parameter fᴅL/D for a normal shock at the duct exit, using the specified reservoir conditions, nozzle area ratio, and back pressure.'},
 {number:5,inputs:{...system,fannoCondition:fannoConditions[2],reservoirP0:1034.2,reservoirT0:305.56,systemAreaRatio:3.33,lambda:.3,ductLength:.6,hydraulicDiameter:.05,frictionConvention:'Fanning',frictionFactor:.00625},note:'For (a), choose Sonic throat limit, Nozzle exit, or Duct exit in the Shock position menu. Read the required back pressure below the station table. For (b), the duct-pressure chart compares static pressure from duct inlet to exit for all three cases.'},
 {number:6,inputs:{...system,fannoCondition:fannoConditions[0],fannoUnknown:'Shock location / flow regime',reservoirP0:304,reservoirT0:840,systemAreaRatio:4.23456790123457,lambda:.6,backRatio:50.66/304,backPressure:50.66,ductLength:3,hydraulicDiameter:.05,frictionFactor:.0025},note:'The nozzle supplies the specified duct inlet: M = 3, T = 300 K, p₀ = 304 kPa. L/D = 60; divide the reported shock distance by D = 0.05 m to obtain x/D.'}
];
export function fannoExample(number){return fannoExamples.find(x=>x.number===Number(number));}

export const fannoExample5PlotKey='fanno-example5-pressure';
const example5Cases=[
 ['throat',fannoConditions[2],'(a-1) Nozzle throat limit'],
 ['nozzleExit',fannoConditions[3],'(a-2) Nozzle exit'],
 ['ductExit',fannoConditions[4],'(a-3) Duct exit']
];
export function fannoExample5Plot({inputs,result}){
 if(inputs.bookExample!=='5–5'||inputs.fannoUnknown!==fannoUnknowns[0]||
    !example5Cases.some(([,condition])=>condition===inputs.fannoCondition)||
    !example5Cases.every(([threshold])=>Number.isFinite(result.thresholds?.[threshold])))return null;
 const series=example5Cases.map(([,condition,label])=>{
  const solution=inputs.fannoCondition===condition?result:solveFannoSystem({...inputs,fannoCondition:condition}).result;
  return {
   name:`${label} · pᵦ = ${(solution.backPressure/1000).toFixed(2)} kPa`,
   points:solution.longitudinal.map(z=>[z.x,z.state.p/1000])
  };
 });
 const label='Duct pressure · three shock locations';
 return {key:fannoExample5PlotKey,label,note:'Example 5(b), Fig. 5-18. The duct runs from x/L = 0 (inlet) to 1 (exit). The vertical jump at the exit shows the normal shock in (a-3).',
  chart:{title:label,xlabel:'Duct position x/L',ylabel:'Static pressure (kPa)',zeroBaseline:false,series}};
}
