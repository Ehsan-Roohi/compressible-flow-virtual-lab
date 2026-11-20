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

test('Book figures show numerical shock and fan annotations for the solved waves',()=>{
 const shockCounts=[1,1,1,4,3,0,2,2,2,4,4,2,4,2,3];
 for(const [i,count] of shockCounts.entries()){
  const d=run(i+1),{svg}=sceneSVG(d.scene,d.inputs);
  assert.match(svg,/data-chapter6-wave-labels/);
  assert.equal([...svg.matchAll(/data-wave-readout="S\d+"/g)].length,count,`Example ${i+1}`);
  assert.equal([...svg.matchAll(/β = [\d.]+° · θ = [\d.]+°<\/text><text\b[^>]*>M = [\d.]+ → [\d.]+/g)].length,count);
 }
 const ramp=run(2),corner=sceneSVG(ramp.scene,ramp.inputs).svg;
 assert.match(corner,/β = 37\.76° · θ = 20°<\/text><text\b[^>]*>M = 3 → 1\.9941/);
 assert.doesNotMatch(sceneSVG(ramp.scene,{...ramp.inputs,bookExample:''}).svg,/data-chapter6-wave-labels/);
 const fan=run(6);
 assert.match(sceneSVG(fan.scene,fan.inputs).svg,/θ = 20°<\/text><text\b[^>]*>M = 2 → 2\.8306/);
 assert.doesNotMatch(sceneSVG(fan.scene,fan.inputs).svg,/β =/);
 const inlet=run(9),schlieren=sceneSVG(inlet.scene,inlet.inputs,0,'schlieren').svg;
 assert.match(schlieren,/data-schlieren-outline="true"/);
 assert.match(schlieren,/Reflected shock · 2 → 3/);
});
