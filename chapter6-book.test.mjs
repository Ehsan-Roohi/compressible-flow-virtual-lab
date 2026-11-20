import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,defaults} from './labs.js';
import {sceneSVG} from './graphics.js';
import {plotOptions} from './plot-options.js';
import {chapter6BookExamples,getChapter6BookExample,chapter6GeometryExample,chapter6ResetExample,chapter6BookResult} from './chapter6-book.js';

const run=(number,patch={})=>{
 const {lab,inputs}=getChapter6BookExample(`6-${number}`);
 return calculate(lab,{...defaults(lab),...inputs,...patch});
};
const near=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} ≠ ${expected}`);

test('All fifteen textbook examples load a physical scene in the appropriate lab',()=>{
 assert.deepEqual(chapter6BookExamples.map(e=>e.number),Array.from({length:15},(_,i)=>i+1));
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
 assert.equal(chapter6GeometryExample('Custom wall').number,4);
 assert.equal(chapter6GeometryExample('Expansion corner').number,6);
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
 assert.equal(plotOptions(run(8))[0].key,'pressure-turning');
 const ramjet=run(9);
 near(ramjet.result.regions[3].M,1.437,.01);
 assert.equal(plotOptions(ramjet)[0].key,'inlet-p-theta');
 near(run(10).result.nonlinear.CL,0,1e-10);
 near(run(10).result.nonlinear.CD,.004,.0002);
 const boom=chapter6BookResult(run(11));
 near(boom.rows.at(-1).value,.14,.001);
 near(boom.rows.at(-2).value,119.94,.3);
 assert.equal(boom.plot.chart.series.length,3);
 assert.ok(chapter6BookResult(run(11,{alpha:3})).notice);
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
