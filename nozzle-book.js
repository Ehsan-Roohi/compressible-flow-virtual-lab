import {areaMach,isentropic,machFromArea,nozzle} from './physics.js';
import {gas,positive,requireValue} from './numerics.js';

export const nozzleSolveModes = [
  'Specified back pressure', 'Required reservoir pressure', 'Design exit Mach', 'Supply pressure for target mass flow'
];
export const nozzleDesignTargets = ['Exit Mach number', 'Exit-to-throat area ratio'];
export const nozzleSizingInputs = ['Throat area', 'Target mass flow'];

export const nozzleBookPlotKey = 'nozzle-book-pressure';
export const nozzleBookInputs = Object.freeze({
  fluid: 'Air',
  gamma: 1.4,
  R: 287,
  nozzleType: 'Converging–diverging',
  nozzleView: 'Internal flow',
  areaRatio: 3,
  backRatio: 0.5,
  p0: 101.32, // The lab input is in kPa.
  nozzlePressureType: 'Stagnation pressure',
  nozzleTemperatureType: 'Stagnation temperature',
  plotProperty: 'Pressure'
});

const converging = {nozzleType:'Converging',p0:500,T0:400,minAreaCm2:6};
const cd = {areaRatio:3,p0:1216,T0:500,minAreaCm2:6};
const pressureRatio = (M,gamma=1.4) => 1/isentropic(M,gamma).p0p;
const subsonicRatio = (areaRatio,gamma=1.4) => pressureRatio(machFromArea(areaRatio,'subsonic',gamma),gamma);

export const nozzleExamples = [
  {value:'8-1a', label:'Converging nozzle', inputs:{...converging,backRatio:350/500},
    note:'With a 500 kPa reservoir, compare 350 kPa back pressure (pᵦ/p₀ = 0.70, unchoked) with 200 kPa (pᵦ/p₀ = 0.40, choked). Use the pressure sweep or enter the ratio to compare exit Mach and pressure.'},
  {value:'8-2a', label:'Perfectly expanded', inputs:{...cd,backRatio:pressureRatio(machFromArea(3))},
    note:'Find the throat and exit states for a perfectly expanded C–D nozzle. The throat area is a reference value because only the area ratio is specified.'},
  {value:'8-2b', label:'Sonic throat, subsonic exit', inputs:{...cd,backRatio:subsonicRatio(3)},
    note:'Find the throat and subsonic exit states at the onset of choking.'},
  {value:'8-2c', label:'Required reservoir pressure', inputs:{...cd,nozzleSolve:nozzleSolveModes[1],nozzleExitPressure:47.42},
    note:'Find the reservoir pressure for a sonic throat and a 47.42 kPa subsonic exit.'},
  {value:'8-3', label:'Design for Mach 3.5', inputs:{nozzleSolve:nozzleSolveModes[2],nozzleDesignMach:3.5,p0:1000,T0:333.15,minAreaCm2:500},
    note:'Find exit area, design mass flow and the back-pressure ranges for internal shock, overexpanded flow and underexpanded flow.'},
  {value:'8-4', label:'Internal normal shock', inputs:{},
    note:'Find the normal-shock location for an exit-to-throat area ratio of 3 and a back pressure of 50.66 kPa. The axial location uses the displayed nozzle contour.'},
];

export function nozzleModeDefaults(base,selection={}){
  const {nozzleType='Converging–diverging',nozzleSolve=nozzleSolveModes[0],outletCondition='Matched isentropic',sonicBranch='supersonic'}=selection;
  const chokedPreset=selection.bookExample==='8-1b';
  const bookExample=chokedPreset?'8-1a':selection.bookExample;
  const example=nozzleExamples.find(e=>e.value===bookExample);
  const choice=example??nozzleExamples.find(e=>e.value===(
    nozzleType==='Converging'?'8-1a':nozzleType==='Diverging'?
      (outletCondition==='Specified back pressure'?'8-4':sonicBranch==='subsonic'?'8-2b':'8-2a'):
      nozzleSolve===nozzleSolveModes[1]?'8-2c':nozzleSolve===nozzleSolveModes[2]?'8-3':'8-4'
  ));
  const inputs={...base,...nozzleBookInputs,nozzleSolve:nozzleSolveModes[0],...choice.inputs,bookExample:choice.value};
  if(!example&&nozzleType==='Converging–diverging'&&nozzleSolve===nozzleSolveModes[3]){
    return {...inputs,nozzleSolve,bookExample:''};
  }
  if(!example&&nozzleType==='Converging–diverging'&&nozzleSolve===nozzleSolveModes[2]&&
     (selection.nozzleDesignTarget===nozzleDesignTargets[1]||selection.nozzleSizingInput===nozzleSizingInputs[1])){
    return {...inputs,nozzleDesignTarget:selection.nozzleDesignTarget??base.nozzleDesignTarget,
      nozzleSizingInput:selection.nozzleSizingInput??base.nozzleSizingInput,bookExample:''};
  }
  if(chokedPreset)inputs.backRatio=200/500;
  if(!example&&nozzleType==='Diverging'){
    return {...inputs,nozzleType,MIn:1,sonicBranch:outletCondition==='Specified back pressure'?'supersonic':sonicBranch,outletCondition,bookExample:''};
  }
  return inputs;
}

// The sonic mass flux is linear in stagnation pressure for a fixed gas and T₀.
function sonicMassFluxPerPressure(T0,gamma,R){
  gas(gamma,R);
  positive(T0,'Stagnation temperature');
  const sonic=isentropic(1,gamma);
  return Math.sqrt(gamma*sonic.T0T/(R*T0))/sonic.p0p;
}

export function resolveNozzleCase(x){
  if(x.nozzleType!=='Converging–diverging')return x;
  const {gamma:g=1.4,R=287,T0=400}=x;
  if(x.nozzleSolve===nozzleSolveModes[1]){
    positive(x.nozzleExitPressure,'Subsonic exit pressure');
    const backRatio=subsonicRatio(x.areaRatio,g);
    return {...x,backRatio,p0:x.nozzleExitPressure/backRatio,nozzlePressureType:'Stagnation pressure'};
  }
  if(x.nozzleSolve===nozzleSolveModes[2]){
    const byArea=x.nozzleDesignTarget===nozzleDesignTargets[1];
    const exitMach=byArea?machFromArea(x.nozzleDesignAreaRatio,'supersonic',g):x.nozzleDesignMach;
    requireValue(Number.isFinite(exitMach)&&exitMach>1&&exitMach<=20+(byArea?1e-10:0),
      'The design exit Mach number must be greater than 1 and at most 20.');
    const mach=Math.min(20,exitMach);
    const areaRatio=byArea?x.nozzleDesignAreaRatio:areaMach(mach,g);
    const design={...x,nozzleDesignMach:mach,areaRatio,backRatio:pressureRatio(mach,g)};
    if(x.nozzleSizingInput!==nozzleSizingInputs[1])return design;
    positive(x.p0,'Stagnation pressure');
    positive(x.nozzleTargetMassFlow,'Target mass flow');
    const area=x.nozzleTargetMassFlow/(x.p0*1000*sonicMassFluxPerPressure(T0,g,R));
    return {...design,minAreaCm2:area*1e4,nozzlePressureType:'Stagnation pressure',
      nozzleTemperatureType:'Stagnation temperature'};
  }
  if(x.nozzleSolve===nozzleSolveModes[3]){
    positive(x.nozzleTargetMassFlow,'Target mass flow');
    positive(x.nozzleAbsoluteBackPressure,'Back pressure');
    positive(x.minAreaCm2,'Throat area');
    requireValue(Number.isFinite(x.areaRatio)&&x.areaRatio>1,'Require exit-to-throat area ratio greater than 1.');
    const throatArea=x.minAreaCm2*1e-4,exitArea=throatArea*x.areaRatio;
    const pb=x.nozzleAbsoluteBackPressure*1000;
    const chokedPressure=x.nozzleTargetMassFlow/(throatArea*sonicMassFluxPerPressure(T0,g,R));
    const onset=subsonicRatio(x.areaRatio,g);
    let p0=chokedPressure;
    if(pb/chokedPressure>onset){
      // For the unchoked branch pₑ = pᵦ. Continuity gives
      // ṁ/(Aₑ pᵦ) sqrt(R T₀/γ) = Mₑ sqrt(1 + (γ−1) Mₑ²/2).
      const massParameter=x.nozzleTargetMassFlow*Math.sqrt(R*T0/g)/(exitArea*pb);
      const square=massParameter**2;
      const exitMach=Math.sqrt(2*square/(1+Math.sqrt(1+2*(g-1)*square)));
      p0=pb*isentropic(exitMach,g).p0p;
    }
    const backRatio=pb/p0;
    requireValue(Number.isFinite(p0)&&backRatio>0&&backRatio<1,
      'The requested mass flow is outside the pressure resolution of this model.');
    return {...x,backRatio,p0:p0/1000,nozzlePressureType:'Stagnation pressure',
      nozzleTemperatureType:'Stagnation temperature'};
  }
  return x;
}

const pressurePoints = result => result.points.map(({x, p}) => [x, p]);
let bookProfile;

export function nozzleBookPressurePlot(current) {
  if (!bookProfile) {
    const reference = nozzle({...nozzleBookInputs, p0: nozzleBookInputs.p0 * 1000});
    bookProfile = pressurePoints(reference);
  }
  const title = 'Nozzle pressure · internal shock comparison';
  const ratio = Number(current.backRatio.toPrecision(6));
  return {
    key: nozzleBookPlotKey,
    label: title,
    chart: {
      title,
      xlabel: 'Axial position x/L',
      ylabel: 'Static pressure p/p₀₁',
      yRange: [0, 1],
      series: [
        {name: `Current · pᵦ/p₀₁ = ${ratio}`, color: '#075c67', width: 3, points: pressurePoints(current)},
        {name: 'Internal normal-shock example · pᵦ/p₀₁ = 0.5', color: '#99451c', width: 2.3, dash: '8 5', points: bookProfile}
      ]
    },
    note: 'The dashed curve uses the internal normal-shock example (air, Aₑ/Aₜ = 3). Both profiles use the lab’s schematic nozzle contour and each case’s inlet stagnation pressure. A vertical jump marks a normal shock.'
  };
}
