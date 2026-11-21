import {areaMach,isentropic,machFromArea,nozzle} from './physics.js';

export const nozzleSolveModes = ['Specified back pressure', 'Required reservoir pressure', 'Design exit Mach'];

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
    note:'Locate the shock for an exit-to-throat area ratio of 3 and back pressure of 50.66 kPa. The book gives no reservoir temperature, absolute throat area or axial contour. Dimensional values use the lab’s reference inputs and the axial position uses its schematic contour.'},
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
  if(chokedPreset)inputs.backRatio=200/500;
  if(!example&&nozzleType==='Diverging'){
    return {...inputs,nozzleType,MIn:1,sonicBranch:outletCondition==='Specified back pressure'?'supersonic':sonicBranch,outletCondition,bookExample:''};
  }
  return inputs;
}

export function resolveNozzleCase(x){
  if(x.nozzleType!=='Converging–diverging')return x;
  const g=x.gamma??1.4;
  if(x.nozzleSolve===nozzleSolveModes[1]){
    if(!Number.isFinite(x.nozzleExitPressure)||x.nozzleExitPressure<=0)throw Error('Specify a positive subsonic exit pressure.');
    const backRatio=subsonicRatio(x.areaRatio,g);
    return {...x,backRatio,p0:x.nozzleExitPressure/backRatio,nozzlePressureType:'Stagnation pressure'};
  }
  if(x.nozzleSolve===nozzleSolveModes[2]){
    if(!(Number.isFinite(x.nozzleDesignMach)&&x.nozzleDesignMach>1&&x.nozzleDesignMach<=20))throw Error('Specify a design exit Mach number greater than 1 and at most 20.');
    return {...x,areaRatio:areaMach(x.nozzleDesignMach,g),backRatio:pressureRatio(x.nozzleDesignMach,g)};
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
