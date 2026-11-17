import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {calculate,defaults,inputDefinitions} from './labs.js';
import {chartSVG,sceneSVG,finiteTubeFlowView} from './graphics.js';
import {plotOptions} from './plot-options.js';
import {finiteTubeDrawing,finiteTubeFrame,finiteTubeMode} from './finite-tube.js';

const near=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} vs ${expected}`);
const base={...defaults('tube'),tubeDomain:finiteTubeMode};

test('Example 7–12 gives the reflected-shock table and wall/contact trajectories',()=>{
 const d=calculate('tube',{...base,tubeInput:'Shock pressure ratio p₂/p₁',shockRatio:10,p1:100,T1:300,T4:300});
 const {reflected,wallTime,contactTime}=d.result;
 near(reflected.mach,2.09165,1e-5);
 near(reflected.pressureRatio,4.9375,1e-8);
 near(reflected.T,1387.588,.001);
 const line=d.chart.series.find(s=>s.name==='Reflected shock');
 assert.deepEqual(line.points[0],[6,wallTime*1000]);
 near(line.points[1][0],d.result.incident.u*contactTime,1e-10);
 assert.ok(d.rows.filter(r=>r.label.includes('Δh₀')).length===2);
});

test('Example 7–13 reproduces the first-wave solution and evolves the flow after reflections from both ends',()=>{
 const d=calculate('tube',base),r=d.result;
 near(r.incident.p2p1,4.7386213857,1e-8);
 near(r.wallTime,.0084541513,1e-9);
 near(r.contactTime,.0111911116,1e-9);
 assert.ok(d.rows.every(row=>!/sample/i.test(row.label)));
 assert.ok(r.driverWallTime>r.contactTime);
 const initial=finiteTubeFrame(r,0),pre=finiteTubeFrame(r,.0065),reflection=finiteTubeFrame(r,.0105),end=finiteTubeFrame(r,r.end);
 near(initial.pressure[0],200000,1e-6);
 near(pre.pressure.at(-1),5000,10);
 near(reflection.pressure.at(-1),r.reflected.p,500);
 assert.ok(end.pressure.at(-1)>1.5*r.reflected.p);
 assert.ok(end.pressure[0]<initial.pressure[0]/2);
 assert.equal(end.time,.03);
 assert.ok(r.frames.every(f=>f.pressure.every(p=>Number.isFinite(p)&&p>0)&&f.density.every(z=>Number.isFinite(z)&&z>0)));
 assert.ok(r.checks.mass<1e-10&&r.checks.energy<1e-10);
 const plots=plotOptions(d,.02),map=plots.find(p=>p.key==='finite-map-pressure');
 assert.ok(plots.every(p=>!/sample/i.test(p.key)));
 assert.ok(plots.some(p=>p.key==='tube-profile-h0'));
 const view=chartSVG(map.chart);
 assert.doesNotMatch(view.svg,/NaN|Infinity|undefined/);
 assert.match(view.svg,/id="finiteTimeCursor"/);
 for(const dash of ['8 4','1 4','6 3 1 3'])assert.ok(view.legend.includes(`stroke-dasharray="${dash}"`));
 assert.match(finiteTubeDrawing(r,.02).svg,/Driven wall/);
});

test('finite geometry is conditional and simulation duration and geometry are validated',()=>{
 const keys=x=>inputDefinitions('tube',x).map(f=>f.key);
 assert.ok(keys(base).includes('finiteEndTime'));
 assert.ok(keys(base).includes('tubeInitialVelocity'));
 assert.ok(!keys(defaults('tube')).includes('finiteEndTime'));
 assert.ok(!keys({...base,unsteadyExperiment:'Two-stage piston'}).includes('tubeDomain'));
 assert.ok(keys(base).every(key=>!/sample/i.test(key)));
 assert.throws(()=>calculate('tube',{...base,finiteEndTime:101}),/100 ms/);
 const short=calculate('tube',{...base,finiteEndTime:2});
 assert.equal(short.result.frames.at(-1).time,.002);
 assert.equal(short.chart.series.find(s=>s.name==='Reflected shock').points.length,0);
});

test('contours interpolate the full grid and render one high-resolution raster with time increasing upward',async()=>{
 const {contourColor,contourPixels}=await import('./contour-raster.js');
 const data=new Uint8ClampedArray(3*3*4);
 contourPixels([[0,0],[1,1]],3,3,data);
 assert.deepEqual([...data.slice(0,4)],[...contourColor(1),255]);
 assert.deepEqual([...data.slice(-4)],[...contourColor(0),255]);
 const middle=[...data.slice(16,19)];
 contourColor(.5).forEach((value,i)=>assert.ok(Math.abs(value-middle[i])<=1));
 const moving=new Uint8ClampedArray(4*2*4);
 contourPixels([[0,0],[1,1]],4,2,moving,[0,.5]);
 assert.deepEqual([moving[3],moving[7],moving[11],moving[15]],[0,0,255,255]);
 const d=calculate('tube',{...base,finiteEndTime:2});
 const options=plotOptions(d,.001),chart=options.find(p=>p.key==='finite-map-pressure').chart;
 assert.equal(chart.heatmap.rows[0].length,base.finiteCells);
 assert.equal(plotOptions(d,.002).find(p=>p.key==='finite-map-pressure').chart.heatmap,chart.heatmap);
 let renders=0;
 const original=globalThis.document;
 globalThis.document={createElement:()=>{
  const canvas={getContext:()=>({
   createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
   putImageData:()=>renders++
  }),toDataURL:()=>`data:image/png;base64,${canvas.width}x${canvas.height}`};
  return canvas;
 }};
 try{
  const svg=chartSVG(chart).svg;
  assert.match(svg,/<image href="data:image\/png;base64,1080x440"/);
  assert.doesNotMatch(svg,/contourRow/);
  chartSVG(chart);
  assert.equal(renders,1);
 }finally{
  if(original===undefined)delete globalThis.document;else globalThis.document=original;
 }
});

test('closed two-stage piston tracks its moving boundary and reflects waves from both ends',()=>{
 const inputs={...defaults('tube'),unsteadyExperiment:'Two-stage piston',pistonDomain:'Finite tube · closed far end',
  pistonTubeLength:6,pistonDelay:.001,p1:100,T1:300,finiteEndTime:60,finiteCells:300};
 const d=calculate('tube',inputs),r=d.result;
 assert.ok(r.finiteTube&&r.movingPiston);
 assert.equal(finiteTubeFrame(r,0).left,0);
 near(r.frames.at(-1).left,2.975,1e-10);
 assert.ok(r.pistonWork>0&&r.checks.energy<1e-10&&r.checks.mass<1e-10);
 near(finiteTubeFrame(r,.014).pressure.at(-1),100000,500);
 assert.ok(finiteTubeFrame(r,.026).pressure.at(-1)>140000);
 assert.ok(finiteTubeFrame(r,.04).pressure[0]>160000);
 assert.ok(r.frames.at(-1).pressure.at(-1)>250000);
 const options=plotOptions(d,.06);
 assert.ok(options.some(o=>o.key==='piston-wall-pressure'));
 assert.ok(options.find(o=>o.key==='tube-profile-p').chart.series[0].points[0][0]>2.975);
 const map=options.find(o=>o.key==='finite-map-pressure').chart;
 near(map.heatmap.leftFractions.at(-1),2.975/6,1e-10);
 assert.match(finiteTubeDrawing(r,.06).svg,/Fixed wall/);
 const preview=finiteTubeDrawing(r,.004).svg;
 assert.match(preview,/data-launch-shock="1"/);
 assert.match(preview,/data-launch-shock="2"/);
 near(r.initialShocks.mergeTime,.01225042,1e-8);
 assert.doesNotMatch(finiteTubeDrawing(r,.02).svg,/data-launch-shock="2"/);
 const fields=inputDefinitions('tube',inputs).map(f=>f.key);
 assert.ok(fields.includes('pistonTubeLength')&&fields.includes('finiteEndTime')&&!fields.includes('p4'));
 assert.ok(!inputDefinitions('tube',{...inputs,pistonDomain:'Before shock catch-up'}).some(f=>f.key==='pistonTubeLength'));
 const early=calculate('tube',{...inputs,pistonTubeLength:.5,pistonDelay:1}).result;
 assert.ok(early.stoppedAtGap);
 near(early.frames.at(-1).left,.45,1e-10);
 near(early.end,.018,1e-12);
 assert.throws(()=>calculate('tube',{...inputs,pistonTubeLength:0}),/length/);
});

test('finite tube uses the original 50 expansion bands before the first wall reflection',()=>{
 for(const values of [base,{...base,tubeInput:'Shock pressure ratio p₂/p₁',shockRatio:10,p1:100,T1:300,T4:300}]){
  const finite=calculate('tube',values);
  const analytical=calculate('tube',{...values,tubeDomain:'Before wall reflections'});
  const original=sceneSVG(analytical.scene,analytical.inputs,.001,'pressure').svg;
  const before=finiteTubeFlowView(finite.result,finite.inputs,.004).svg;
  const after=finiteTubeFlowView(finite.result,finite.inputs,.03).svg;
  assert.equal((original.match(/data-expansion-band/g)??[]).length,50);
  assert.equal((before.match(/data-expansion-band/g)??[]).length,50);
  assert.doesNotMatch(before,/data-expansion-characteristics/);
  assert.doesNotMatch(after,/data-expansion-band/);
  assert.match(after,/id="finitePressure"/);
 }
});

test('closed Example 7–7 retains its moving-gas reference and simulates the wall response',()=>{
 const d=calculate('tube',{...base,tubeInput:'Shock pressure ratio p₂/p₁',shockRatio:10,tubeInitialVelocity:-200,p1:100,T1:300,T4:300});
 const r=d.result;
 near(r.incident.shockSpeed,824.9,.001);
 near(r.incident.u,556.07377,.001);
 assert.ok(r.frames[0].velocity.every(u=>u===-200));
 assert.ok(Math.abs(r.frames.at(-1).velocity[0]+200)>50);
 assert.ok(r.checks.mass<1e-10&&r.checks.energy<1e-10);
 assert.equal(r.reflected,null);
});

test('closing the valve retains Example 7–4 shock values and reflects the wave at the upstream piston',()=>{
 const d=calculate('tube',{...base,unsteadyExperiment:'Sudden valve closure',valveInletSpeed:60,p1:101,T1:300});
 const r=d.result;
 assert.ok(r.closedValve&&r.finiteTube);
 near(r.valveSpeed,325.05014,1e-5);
 assert.ok(r.frames[0].velocity.every(u=>Math.abs(u-60)<1e-10));
 assert.ok(r.frames.at(-1).pressure[0]>150000);
 assert.ok(r.checks.mass<1e-10&&r.checks.energy<1e-10);
 assert.match(finiteTubeDrawing(r,.004).svg,/Closed valve/);
});

test('closed Example 7–3 preserves the helium merger result and reaches the wall later',()=>{
 const d=calculate('tube',{...base,unsteadyExperiment:'Two-stage piston',pistonDomain:'Finite tube · closed far end',
  gamma:1.667,R:2077,p1:100,T1:300,pistonDelay:1,pistonTubeLength:40000,finiteCells:1200,finiteEndTime:90000});
 const r=d.result;
 near(r.initialShocks.mergeTime,31.325464,1e-6);
 near(d.rows.find(row=>row.label==='Launch shocks merge · analytical position').value,32452.402,.001);
 assert.equal(r.frames.at(-1).time,90);
 near(finiteTubeFrame(r,30).pressure.at(-1),100000,1);
 assert.ok(r.frames.at(-1).pressure.at(-1)>110000);
 assert.ok(r.checks.mass<1e-10&&r.checks.energy<1e-10);
});

test('every browser example opens the closed model and the separate demo is gone',()=>{
 const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 const elements=new Map();
 const context=vm.createContext({id:'tube',experimentDefaults:defaults,inputs:{},finiteTubeMode,closedPistonMode:'Finite tube · closed far end',
  valveExperiment:'Sudden valve closure',request:0,
  $:key=>{if(!elements.has(key))elements.set(key,{});return elements.get(key);},
  stopAnimation(){},stopSweep(){},renderInputs(){},solve(){}});
 vm.runInContext(source.slice(source.indexOf('function defaults(id)'),source.indexOf('const $=')),context);
 vm.runInContext(source.slice(source.indexOf('function renderExamples(){'),source.indexOf('function knownRayleighData')),context);
 context.renderExamples();
 assert.doesNotMatch(elements.get('examplesPanel').innerHTML,/closed-piston-demo/);
 for(const code of ['7–1','7–2','7–3','7–4','7–7','7–12','7–13']){
  assert.ok(elements.get('examplesPanel').innerHTML.includes(`value="${code}"`));
  elements.get('exampleSelect').onchange({target:{value:code}});
  assert.equal(context.inputs.tubeDomain,finiteTubeMode);
  assert.equal(calculate('tube',context.inputs).result.finiteTube,true);
 }
});
