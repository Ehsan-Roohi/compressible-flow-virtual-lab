import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,defaults,inputDefinitions} from './labs.js';
import {sceneSVG} from './graphics.js';
import {plotOptions} from './plot-options.js';
import {opposingShockSlipAngle} from './pressure-turning.js';
import {fittedShockFanSlipLayer} from './channel-moc-shocks.js';
import {deg,rad} from './physics.js';
import {chapter6BookExamples,getChapter6BookExample,chapter6WallGeometries,activeChapter6WallGeometry,chapter6GeometryExample,chapter6ResetExample,chapter6AirfoilFields,chapter6BookResult} from './chapter6-book.js';

const run=(number,patch={})=>{
 const {lab,inputs}=getChapter6BookExample(`6-${number}`);
 return calculate(lab,{...defaults(lab),...inputs,...patch});
};
const near=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} ≠ ${expected}`);

test('Supported wave examples offer a characteristic solution and a common-section comparison',()=>{
 for(const e of chapter6BookExamples.filter(e=>e.lab==='wall')){
  const input={...defaults(e.lab),...e.inputs,mocResolution:41};
  const fields=inputDefinitions(e.lab,input);
  assert.deepEqual(fields.find(f=>f.key==='channelSolver').options,
   ['Shock–Expansion','Method of characteristics','Compare both'],e.label);
  const moc=run(e.number,{channelSolver:'Method of characteristics',mocResolution:41});
  assert.ok(moc.result.moc.rows.at(-1)?.x>0,e.label);
  const compare=run(e.number,{channelSolver:'Compare both',mocResolution:41});
  assert.ok(compare.result.comparison.end>0,e.label);
  assert.ok(plotOptions(compare).some(p=>p.key==='compare-mach'),e.label);
  assert.doesNotMatch(sceneSVG(moc.scene,moc.inputs).svg,/NaN|undefined|Infinity/,e.label);
 }
 const e=getChapter6BookExample('6-2');
 assert.ok(!inputDefinitions('wall',{...defaults('wall'),...e.inputs,branch:'strong'}).some(f=>f.key==='channelSolver'));
});

test('The consecutive-ramp and shock–fan examples resolve their characteristic interaction',()=>{
 const consecutive=run(5,{channelSolver:'Method of characteristics',mocResolution:41});
 assert.equal(consecutive.result.moc.traces.length,3);
 assert.ok(consecutive.result.moc.fan);
 assert.equal(opposingShockSlipAngle(consecutive.result),null);
 assert.equal(opposingShockSlipAngle(run(5,{channelSolver:'Compare both',mocResolution:41}).result),null);
 assert.ok(consecutive.result.moc.maxMassResidual<.002);
 const {svg}=sceneSVG(consecutive.scene,consecutive.inputs);
 assert.match(svg,/data-moc-slip-line/);
 for(const n of [1,2,3,4,5])assert.ok(svg.includes(`data-flow-region-number="${n}"`));
 const fan=run(7,{channelSolver:'Method of characteristics',mocResolution:61});
 const shock=fan.result.moc.traces[0].points;
 assert.ok(shock.at(-1).before.M-shock[0].before.M>.3);
 assert.ok(Math.abs(shock.at(-1).beta-shock[0].beta)>.05);
 assert.ok(fan.result.moc.maxMassResidual<.01);
 assert.ok(plotOptions(fan).some(p=>p.key==='pressure-turning'&&p.chart.series.length===4));
 assert.ok(fan.rows.some(r=>r.label==='Shock–Expansion · Common pressure p₄ = p₅'));
 const measured=fan.rows.find(r=>r.label==='MOC · Equivalent slip-line angle φ');
 near(measured.value,20.027,.002);
 near(fan.result.slipLayer.x,1.35,1e-8);
 assert.equal(measured.value,deg(fan.result.slipLayer.angle));
 assert.equal(fittedShockFanSlipLayer(fan.result,rad(10),.7),null);
 assert.doesNotMatch(fan.notice,/book|textbook/i);
 assert.ok(plotOptions(fan).some(p=>p.label==='Pressure–deflection · Shock–Expansion'));
 const comparison=run(7,{channelSolver:'Compare both',mocResolution:61}).result;
 assert.ok(comparison.slipLayer?.x<=comparison.comparison.end);
 near(deg(comparison.slipLayer.angle),20.027,.002);
});

test('All listed textbook examples load a physical scene in the appropriate lab',()=>{
 assert.deepEqual(chapter6BookExamples.map(e=>e.number),[1,2,3,4,5,6,7,9,10,11,12,13,14,15]);
 for(const e of chapter6BookExamples){
  assert.equal(e.lab,e.number<10?'wall':'airfoil');
  const d=run(e.number);
  assert.ok(['ok','partial'].includes(d.result.status??'ok'),e.value);
  assert.equal(d.inputs.bookExample,e.value);
  if(e.lab==='airfoil')assert.equal(d.result.nonlinear.status,'ok');
  const scene=sceneSVG(d.scene,d.inputs).svg;
  assert.match(scene,/<svg/);
  assert.doesNotMatch(scene,/NaN|undefined/);
 }
});

test('Geometry defaults select the corresponding textbook example and Reset keeps an active case',()=>{
 assert.equal(chapter6GeometryExample('Compression ramp').number,2);
 assert.equal(chapter6GeometryExample('Custom wall'),undefined);
 assert.equal(chapter6GeometryExample('Expansion corner').number,6);
 for(const [name,number] of [['Opposing shocks',4],['Same-direction shocks',5]]){
  const example=chapter6GeometryExample(name);
  assert.equal(example.number,number);
  assert.equal(activeChapter6WallGeometry(example.inputs),name);
  assert.equal(activeChapter6WallGeometry({...example.inputs,bookExample:`6-${number}`}),name);
  assert.equal(activeChapter6WallGeometry({...example.inputs,bookExample:''}),'Custom wall');
 }
 const inlet=chapter6WallGeometries.find(g=>g.example==='6–P1b');
 assert.equal(activeChapter6WallGeometry({wallShape:'Custom wall',customInteraction:inlet.name}),inlet.name);
 assert.equal(chapter6ResetExample('wall',{wallShape:'Custom wall'}),undefined);
 for(const [shape,number] of [['Diamond',10],['Flat plate',12],['Asymmetric double wedge',14],['Connected flat plates',15]])
  assert.equal(chapter6ResetExample('airfoil',{airfoilShape:shape}).number,number);
 for(const number of [3,5,8,9,11,13]){
  const e=getChapter6BookExample(`6–${number}`);
  assert.equal(chapter6ResetExample(e.lab,e.inputs),e);
 }
});

test('Chapter 6 numerical outputs reproduce the key book comparisons',()=>{
 near(run(1).result.beta*180/Math.PI,50.247,0.002);
 assert.equal(chapter6BookResult(run(1)),null);
 near(run(2).result.regions[2].M,1.994,.003);
 near(run(3).result.regions[2].M,1.41,.006);
 assert.equal(run(4).result.bookCase,'6–4');
 assert.equal(run(5).result.bookCase,'6–5');
 const expansion=chapter6BookResult(run(6)).rows;
 near(expansion[0].value,30,1e-8);
 near(expansion[1].value,.69,.004);
 near(run(7).result.slipAngle,20.004,.03);
 const [polar]=plotOptions(run(7));
 assert.equal(polar.key,'pressure-turning');
 assert.equal(polar.chart.series.length,4);
 assert.equal(getChapter6BookExample('6–8'),getChapter6BookExample('6–7'));
 const ramjet=run(9);
 near(ramjet.result.regions[3].M,1.437,.01);
 assert.equal(plotOptions(ramjet)[0].key,'inlet-p-theta');
 near(run(10).result.nonlinear.CL,0,1e-10);
 near(run(10).result.nonlinear.CD,.004,.0002);
 near(run(12).result.nonlinear.CL,.146,.001);
 const forces=chapter6BookResult(run(13)).rows;
 near(forces[0].value,66.84,.6);
 near(forces[1].value,23.31,.15);
 const doubleChord=chapter6BookResult(run(13,{bookAirfoilChord:2})).rows;
 near(doubleChord[0].value,2*forces[0].value,1e-10);
 const shape=run(14).result;
 assert.equal(shape.geometry.panels.length,3);
 near(shape.nonlinear.CL,.48854,.00002);
 near(shape.nonlinear.CD,.134,.00002);
 assert.deepEqual(run(15).result.nonlinear.waves.map(w=>w.kind),['Oblique shock','Expansion fan','Expansion fan','Oblique shock']);
});

test('The second diamond example uses the 6–11 book inputs and steady flow outputs',()=>{
 const first=run(10),second=run(11);
 assert.equal(first.inputs.M,3);
 assert.equal(first.inputs.diamondFrontAngle,3);
 const {M,alpha,p1,T1,diamondFrontAngle,diamondRearAngle,bookAirfoilChord}=second.inputs;
 assert.deepEqual([M,alpha,p1,T1,diamondFrontAngle,diamondRearAngle,bookAirfoilChord],[2.5,0,100,293,5,5,4]);
 const {waves}=second.result.nonlinear,lower=waves.filter(w=>w.side==='Lower');
 near(lower[0].beta*180/Math.PI,27.42,.01);
 near(lower[0].after.M,2.29,.01);
 near(lower[1].after.M,2.72,.01);
 assert.deepEqual(chapter6AirfoilFields(second.inputs),[]);
 assert.equal(chapter6BookResult(second),null);
 assert.ok(run(11,{alpha:3}).result.nonlinear.CL>0);
});

test('Chapter 6 diagrams omit supplementary annotation boxes and leaders',()=>{
 for(const e of chapter6BookExamples){
  const d=run(e.number),{svg}=sceneSVG(d.scene,d.inputs);
  assert.doesNotMatch(svg,/data-chapter6-(?:problem|wave-labels)|data-wave-(?:readout|leader)/,e.value);
 }
 const inlet=run(9),schlieren=sceneSVG(inlet.scene,inlet.inputs,0,'schlieren').svg;
 assert.match(schlieren,/data-schlieren-outline="true"/);
 assert.doesNotMatch(schlieren,/data-wave-readout/);
});

test('Chapter 6 solved interaction regions use the same numbers in each figure as in the table',()=>{
 const numbers=svg=>[...svg.matchAll(/data-flow-region-number="([^"]+)"/g)].map(m=>m[1]).sort();
 for(const [example,channelSolver]of [[4,'Shock–Expansion'],[4,'Method of characteristics'],[5,'Shock–Expansion']]){
  const d=run(example,{channelSolver});
  const expected=Object.keys(d.result.regions).map(name=>name.replace(/^Region /,'')).sort();
  assert.deepEqual(numbers(sceneSVG(d.scene,d.inputs).svg),expected);
 }
 const compare=run(4,{channelSolver:'Compare both'}),svg=sceneSVG(compare.scene,compare.inputs).svg;
 assert.deepEqual(numbers(svg),['1','1','2','2','3','3','4','4','4′','4′']);
 for(const example of [14,15]){
  const d=run(example);
  assert.match(sceneSVG(d.scene,d.inputs).svg,/data-airfoil-region="1"/);
 }
});

test('Compression ramps show both region numbers directly on the flow',()=>{
 for(const example of [1,2,3])for(const cornerView of ['Analytical contours','Textbook schematic']){
  const d=run(example,{cornerView});
  const {svg}=sceneSVG(d.scene,d.inputs);
  assert.deepEqual([...svg.matchAll(/data-flow-region-number="([12])"/g)].map(m=>m[1]),['1','2']);
  assert.doesNotMatch(svg,/<circle/);
 }
});

test('Example 5 solves its first regular interaction on a single physical wall',()=>{
 const preset=getChapter6BookExample('6–5');
 assert.equal(preset.inputs.boundaryMode,'Single wall');
 const result=run(5).result;
 assert.ok(result.singleWallInteraction);
 assert.deepEqual(Object.keys(result.geometry.walls),['Gas above wall']);
 near(result.geometry.B[0],1.908668771529,1e-8);
 near(result.slipAngle,20.1426632123,1e-7);
 near(result.regions[4].p,result.regions[5].p,1e-5);
 assert.deepEqual([result.a.kind,result.b.kind],['Expansion fan','Oblique shock']);
 assert.ok(sceneSVG(run(5).scene,preset.inputs).svg.includes('data-slip-line'));
 const mirrored=run(5,{wallSide:'Gas below wall',wallSegments:preset.inputs.wallSegments.map(p=>({...p,angle:-p.angle}))});
 near(mirrored.result.slipAngle,-result.slipAngle,1e-8);
 near(mirrored.result.geometry.B[1],-result.geometry.B[1],1e-8);
 const short=run(5,{wallSegments:[preset.inputs.wallSegments[0],{angle:20,length:.3}]});
 assert.equal(short.result.singleWallInteraction,undefined);
 assert.ok(!short.rows.some(r=>r.label.includes('slip-line')));
});
