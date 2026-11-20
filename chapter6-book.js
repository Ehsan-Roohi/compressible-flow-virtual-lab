import {deg,rad} from './physics.js';
import {chapter6Example} from './regular-channel.js?v=20261109-wedge-cone';
import {ramjetMode,ramjetPreset} from './ramjet-inlet.js?v=20261114-restored-inlet-text';
import {shockFanMode,shockFanPreset} from './shock-fan-example.js?v=20261118-wave-density';
import {multiRampMode} from './multi-ramp-inlet.js?v=20261120-region-numbers';

const air={fluid:'Air',gamma:1.4,R:287,p1:101.325,T1:300,inletPressureType:'Static pressure',temperatureInput:'Static temperature'};
const compression={wallShape:'Compression ramp',boundaryMode:'Single wall',wallSide:'Gas above wall',branch:'weak'};
const airfoil={airfoilMethod:'Shock–Expansion',airfoilFieldMode:'Before first wave interaction'};
const diamond=angle=>({airfoilShape:'Diamond',geometryInput:'Angles',diamondFrontAngle:angle,diamondRearAngle:angle});
const bentPlateAngle=deg(Math.atan(.24)),bentPlateLength=Math.hypot(.5,.12);

function entry(number,title,note,preset,lab='wall'){
 const value=`6–${number}`;
 return {number,value,lab,label:title,note,inputs:{...air,...preset,bookExample:value}};
}

export const chapter6BookExamples=[
 entry(1,'Weak oblique shock','Find the weak shock angle for a 25° flow turn. Pressure and temperature are reference values.',{...compression,M1:2.5,theta:25}),
 entry(2,'Oblique-shock states','Find the shock angle and downstream static and stagnation properties for a 20° ramp.',{...compression,M1:3,theta:20,p1:101,T1:288}),
 entry(3,'Stronger ramp compression','Repeat Example 2 with a 30° ramp and inspect downstream pressure and Mach number.',{...compression,M1:3,theta:30,p1:101,T1:288}),
 entry(4,'Opposing shock interaction','Inspect regions 2, 3, 4, and 4′ and the slip-line angle. Temperature and channel dimensions are reference values.',chapter6Example(4)),
 entry(5,'Successive compression corners','Two successive 10° turns on one wall produce interacting shocks. Inspect regions 2–5 and the slip-line angle.',{...chapter6Example(5),boundaryMode:'Single wall',wallSide:'Gas above wall'}),
 entry(6,'Prandtl–Meyer expansion','The inlet is at 1.8 kPa and 250 °C. Read the two fan-ray inclinations relative to the inlet direction.',{wallShape:'Expansion corner',boundaryMode:'Single wall',wallSide:'Gas above wall',M1:2,p1:1.8,T1:523.15,theta:20}),
 entry(7,'Shock–expansion interaction','Read the matched pressure, Mach numbers, and slip-line angle. The pressure–deflection diagram shows all four wave paths and the matched state. Inlet temperature is a reference value.',{...shockFanPreset,trackingStep:2}),
 entry(9,'Ramjet inlet regular reflection','An 8° ramp at Mach 2 produces an incident shock and one regular reflection. Read both shock angles and pressure ratios.',ramjetPreset),
 entry(10,'Symmetric diamond airfoil','The 3° half-angle diamond at zero incidence has zero lift and finite wave drag. Inlet temperature is a reference value.',{...airfoil,...diamond(3),M:3,alpha:0,p1:6.895},'airfoil'),
 entry(11,'Symmetric diamond airfoil · 5° half-angle','Inspect the surface states, lift and wave drag for a 5° half-angle diamond at Mach 2.5 and zero incidence.',{...airfoil,...diamond(5),M:2.5,alpha:0,p1:100,T1:293},'airfoil'),
 entry(12,'Inclined flat plate','Find lift and wave drag at Mach 2.6 and 5° incidence. Pressure and temperature are reference values.',{...airfoil,airfoilShape:'Flat plate',M:2.6,alpha:5},'airfoil'),
 entry(13,'Diamond-airfoil forces','Find the four panel pressure coefficients and the lift and drag per unit span for the 1 m chord. Inlet temperature is a reference value.',{...airfoil,...diamond(8),M:3,alpha:4,p1:101,bookAirfoilChord:1},'airfoil'),
 entry(14,'Triangular airfoil','Two 5° upper panels meet above a flat lower surface. Find lift and drag at Mach 2.4 and 15° incidence.',{...airfoil,airfoilShape:'Asymmetric double wedge',geometryInput:'Angles & lengths',upperSegments:[{angle:5,length:.5/Math.cos(rad(5))}],lowerSegments:[],M:2.4,alpha:15},'airfoil'),
 entry(15,'Connected flat plates','Two zero-thickness panels with a mid-chord bend of h/c = 0.12. Inspect the waves at all three stations and the wave-drag coefficient.',{...airfoil,airfoilShape:'Connected flat plates',geometryInput:'Angles & lengths',M:2.5,alpha:4.2,upperSegments:[{angle:bentPlateAngle,length:bentPlateLength},{angle:-bentPlateAngle,length:bentPlateLength}]},'airfoil')
];

export function getChapter6BookExample(value){
 const bookNumber=/^6[-–](\d+)$/.exec(value??'');
 if(!bookNumber)return undefined;
 const number=Number(bookNumber[1]);
 return chapter6BookExamples.find(e=>e.number===(number===8?7:number));
}

export const chapter6WallGeometries=[
 {name:'Compression ramp',example:'6–2'},
 {name:'Expansion corner',example:'6–6'},
 {name:'Opposing shocks',example:'6–4'},
 {name:'Same-direction shocks',example:'6–5'},
 {name:shockFanMode,example:'6–7'},
 {name:ramjetMode,example:'6–9'},
 {name:multiRampMode,example:'6–P1b'},
 {name:'Custom wall'}
];

export function chapter6GeometryExample(shape){
 return getChapter6BookExample(chapter6WallGeometries.find(g=>g.name===shape)?.example);
}

export function activeChapter6WallGeometry(inputs){
 if(inputs.customInteraction===multiRampMode)return multiRampMode;
 const example=getChapter6BookExample(inputs.bookExample);
 if(inputs.wallShape==='Custom wall'&&example?.inputs.wallShape==='Custom wall'&&
    inputs.boundaryMode===example.inputs.boundaryMode)
  return chapter6WallGeometries.find(g=>g.example===example.value)?.name??inputs.wallShape;
 return inputs.wallShape;
}

export function chapter6ResetExample(lab,inputs){
 const selected=getChapter6BookExample(inputs.bookExample);
 if(lab==='airfoil'){
  if(selected?.lab==='airfoil'&&selected.inputs.airfoilShape===inputs.airfoilShape)return selected;
  return chapter6BookExamples.find(e=>e.lab==='airfoil'&&e.inputs.airfoilShape===(inputs.airfoilShape??'Diamond'));
 }
 if(selected?.lab==='wall'&&selected.inputs.wallShape===inputs.wallShape)return selected;
 return chapter6GeometryExample(inputs.wallShape??'Compression ramp');
}

const row=(label,value,unit)=>({label,value,unit});
export function chapter6AirfoilFields(inputs){
 return getChapter6BookExample(inputs.bookExample)?.number===13?
  [{key:'bookAirfoilChord',label:'Chord length',min:.01,max:20,step:.01,unit:'m'}]:[];
}

export function chapter6BookResult(d){
 const {inputs:x,result:r}=d;
 const n=getChapter6BookExample(x.bookExample)?.number;
 const corner=r.wallReference??r;
 if(n===6&&corner.cornerKind==='expansion'){
  const side=x.wallSide==='Gas below wall'?-1:1;
  const reference=r.wallReference?'Analytical reference · ':'';
  return {rows:[row(reference+'Leading ray · to inlet direction',side*corner.mu1,'°'),
   row(reference+'Trailing ray · to inlet direction',deg(corner.regions[2].theta)+side*corner.mu2,'°')]};
 }
 if(d.id==='airfoil'&&n===13){
  if(!r.models.includes('nonlinear')||r.nonlinear.status!=='ok')return {notice:'Select a valid Shock–Expansion solution for the textbook result.'};
  if(!(Number.isFinite(x.bookAirfoilChord)&&x.bookAirfoilChord>0))return {notice:'Enter a positive chord length for the forces per unit span.'};
  const scale=r.q*x.bookAirfoilChord/1000;
  return {rows:[row('Lift per unit span',r.nonlinear.CL*scale,'kN/m'),row('Wave drag per unit span',r.nonlinear.CD*scale,'kN/m')]};
 }
 return null;
}
