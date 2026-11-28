import test from 'node:test';import assert from 'node:assert/strict';
import {uniformDiagramText,diagramValueSize} from './diagram-typography.js';
import {diagramFontFamily} from './diagram-font.js';
import {calculate,defaults} from './labs.js';import {sceneSVG,chartSVG} from './graphics.js';
const labels=svg=>[...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)];
function check(svg){const ns=labels(svg).filter(m=>/[0-9₀₁₂₃₄₅₆₇₈₉]/.test(m[2]));assert.ok(ns.length);for(const [,a]of ns){assert.ok(a.includes(`font-size="${diagramValueSize}"`));assert.ok(a.includes(`font-family="${diagramFontFamily}"`));}}
test('Shared typography is idempotent and completes property pairs without changing ticks or region IDs',()=>{
 const s='<svg><text font-size="24">M₁ 2</text><text font-size="12">138 kPa</text><text>1</text><text>p₀ = 250 kPa</text></svg>',a=uniformDiagramText(s);check(a);assert.match(a,/>M₁ = 2<\/text>/);assert.match(a,/>p = 138 kPa<\/text>/);assert.match(a,/>1<\/text>/);assert.equal(uniformDiagramText(a),a);
});
test('Normal shock shows flow arrows and labeled Mach, pressure, and temperature on both sides',()=>{
 const d=calculate('normal',{...defaults('normal'),M1:2,p1:138,T1:300}),v=sceneSVG(d.scene,d.inputs);
 check(v.svg);
 const sides=[...v.svg.matchAll(/data-normal-side="([^"]+)">([\s\S]*?)(?=data-normal-side=|<\/svg>)/g)];
 assert.deepEqual(sides.map(side=>side[1]),['upstream','downstream']);
 const expected=[['M₁ = 2','p₁ = 138 kPa','T₁ = 300 K'],['M₂ = 0.57735','p₂ = 621 kPa','T₂ = 506.25 K']];
 for(const [i,[,,side]] of sides.entries()){
  assert.match(side,/data-flow-angle="0"/);
  const [,start,end]=side.match(/<line x1="(\d+)" y1="115" x2="(\d+)" y2="115"/)??[];
  assert.ok(Number(start)<Number(end)&& (i===0?Number(end)<315:Number(start)>315));
  for(const label of expected[i])assert.ok(side.includes(label),label);
 }
});
test('All principal scene renderers and exported chart SVGs share numerical typography',()=>{
 for(const id of ['foundations','normal','rayleigh','fanno','wall','collision','tube','nozzle','airfoil','cone']){
  const d=calculate(id,{...defaults(id),...(id==='cone'?{bodyGeometry:'Compare both'}:{})});if(d.scene)check(sceneSVG(d.scene,d.inputs).svg);check(chartSVG(d.chart).svg);
 }
 for(const x of [{ductProblem:'Reservoir-fed duct',ductSolve:'Sonic outlet'},{ductProblem:'Heat + shock + converging nozzle',systemInletType:'Static duct inlet',M1:1.6,T1:200,p1:56,backPressure:120}]){const d=calculate('rayleigh',{...defaults('rayleigh'),...x});check(sceneSVG(d.scene,d.inputs).svg);}
});
