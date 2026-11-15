import test from 'node:test';import assert from 'node:assert/strict';
import {calculate,defaults} from './labs.js';import {sceneSVG} from './graphics.js';import {airfoilTables} from './airfoil-tables.js';import {plotOptions} from './plot-options.js';
test('Diamond figure and state table retain textbook region numbers without charts',()=>{
 const d=calculate('airfoil',{...defaults('airfoil'),alpha:4}),svg=sceneSVG(d.scene,d.inputs).svg;
 assert.deepEqual([...svg.matchAll(/data-airfoil-region="([^"]+)"/g)].map(m=>m[1]).sort(),['1','2','3','4','5','6']);
 const html=airfoilTables(d.result,String);for(const n of ['2','3','4','5'])assert.ok(html.includes(`scope="row">${n}</th>`));assert.ok(html.includes('6 (upper)')&&html.includes('6 (lower)'));
 assert.deepEqual(plotOptions(d),[]);
 const shocks=[...d.result.nonlinear.waves,...d.result.trailingEdge.waves].filter(w=>w.kind==='Oblique shock');
 for(const w of shocks){assert.ok(svg.includes(`data-shock-angle="${w.id}"`));const value=Number((w.beta*180/Math.PI).toPrecision(4));assert.ok(svg.includes(`= ${value}°`));}
});

test('Front-panel flow arrows stay wholly inside regions 2 and 4',async()=>{
 const {airfoilFieldSampler}=await import('./airfoil-field.js');
 for(const alpha of [-4,0,4]){
  const d=calculate('airfoil',{...defaults('airfoil'),alpha,geometryInput:'Angles',diamondFrontAngle:10,diamondRearAngle:10});
  const sample=airfoilFieldSampler(d.result).sample,svg=sceneSVG(d.scene,d.inputs,0,'pressure').svg;
  const arrows=[...svg.matchAll(/data-flow-region="([24])" data-flow-x="([^"]+)" data-flow-y="([^"]+)" data-flow-dx="([^"]+)" data-flow-dy="([^"]+)"/g)];
  assert.equal(arrows.length,2);
  for(const [,region,x,y,dx,dy]of arrows)for(const t of [-15,0,15]){
   const state=sample((Number(x)+t*Number(dx)-84)/350,(150-Number(y)-t*Number(dy))/350);
   assert.equal(state?.region,region,`alpha=${alpha}, region=${region}, arrow offset=${t}`);
  }
 }
});

test('Flat plate uses regions 1–5 consistently in the figure, tables and contour probe',async()=>{
 const {airfoilFieldSampler}=await import('./airfoil-field.js');
 for(const alpha of [-6,6]){
  const d=calculate('airfoil',{...defaults('airfoil'),airfoilShape:'Flat plate',alpha});
  const svg=sceneSVG(d.scene,d.inputs).svg,html=airfoilTables(d.result,String),sample=airfoilFieldSampler(d.result).sample;
  assert.deepEqual([...svg.matchAll(/data-airfoil-region="([^"]+)"/g)].map(m=>m[1]).sort(),['1','2','3','4','5']);
  for(const n of ['2','3','4','5'])assert.ok(html.includes(`scope="row">${n}</th>`));
  assert.equal(sample(-.1,0).region,'1');assert.equal(sample(.5,.02).region,'2');assert.equal(sample(.5,-.02).region,'3');
  const y=Math.tan(d.result.trailingEdge.phi)*.1;
  assert.equal(sample(1.1,y+.002).region,'4');assert.equal(sample(1.1,y-.002).region,'5');
  assert.ok(!svg.includes('>TE-U+</text>')&&!svg.includes('>TE-L+</text>'));
 }
});
