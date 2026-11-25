import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate, defaults, inputDefinitions} from './labs.js';
import {gasPresets, selectGas} from './gas-properties.js';
import {designMinimumLengthNozzle, nozzleMocExamples, nozzleMocMethods, nozzleMocStarts} from './nozzle-moc.js';
import {plotOptions} from './plot-options.js';
import {sceneSVG} from './graphics.js';
import {areaMach,deg,isentropic,prandtlMeyer} from './physics.js';

const near=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<=tolerance,
 `Expected ${actual} within ${tolerance} of ${expected}`);

test('nozzle design presets solve the wall and characteristic net with parallel flow at the exit',()=>{
 for(const example of nozzleMocExamples){
  const inputs={...defaults('nozzle-design'),...example.inputs};
  const {result}=calculate('nozzle-design',inputs);
  assert.equal(result.exitMach,inputs.mocExitMach);
  assert.equal(result.exitAngle,0);
  assert.equal(result.wall.length,inputs.mocFanRays+1);
  assert.ok(Math.abs(result.areaErrorPct)<(result.inletMach>1?1:.1),example.value);
  for(const [i,row] of result.mesh.entries()){
   const center=row[0];
   assert.equal(center.y,0);
   assert.equal(center.theta,0);
   for(const [j,point] of row.entries()){
    near(point.nu-point.theta,center.nu,1e-14);
    if(i>0&&j<row.length-1){
     const upstream=result.mesh[i-1][j+1];
     near(point.nu+point.theta,upstream.nu+upstream.theta,1e-14);
    }
   }
  }
 }
});

test('John–Keith throat angle, NASA exit coordinates and physical dimensions',()=>{
 const john=designMinimumLengthNozzle({...nozzleMocExamples[0].inputs,mocThroatHalfHeight:1});
 near(john.wallAngle,12.15124,1e-5);
 near(john.isentropicAreaRatio,1.5397551,1e-7);

 // NASA TM X-1502 Table II uses a different discretization of the sonic fan.
 const nasa={...nozzleMocExamples[2].inputs,mocThroatHalfHeight:1};
 const design=designMinimumLengthNozzle(nasa);
 near(design.length,64.15586,.006*64.15586);
 near(design.areaRatio,12.9735,.001*12.9735);
 const dimensional=designMinimumLengthNozzle({...nasa,mocThroatHalfHeight:.05});
 near(dimensional.length,.05*design.length,1e-13);
 near(dimensional.exitHeight,.1*design.areaRatio,1e-13);
});

test('the exported contour uses the calculated upper wall and its mirror',()=>{
 const run=calculate('nozzle-design',defaults('nozzle-design'));
 const plot=plotOptions(run).find(o=>o.key==='nozzle-moc-wall');
 const [upper,lower]=plot.chart.series;
 for(const [i,{x,y}] of run.result.wall.entries()){
  assert.deepEqual(upper.points[i],[x,y]);
  assert.deepEqual(lower.points[i],[x,-y]);
 }
});

test('the nozzle field exposes normalized properties and an independent characteristic overlay',()=>{
 const run=calculate('nozzle-design',defaults('nozzle-design'));
 const {scene,inputs,result}=run,g=inputs.gamma;
 const sonic=isentropic(1,g),exit=isentropic(result.exitMach,g);
 const expected={
  mach:[1,result.exitMach],
  'pressure-ratio':[1/exit.p0p,1/sonic.p0p],
  'temperature-ratio':[1/exit.T0T,1/sonic.T0T],
  'density-ratio':[1/exit.rho0rho,1/sonic.rho0rho],
  'speed-ratio':[1/Math.sqrt(sonic.T0T),result.exitMach/Math.sqrt(exit.T0T)],
  'sound-speed-ratio':[1/Math.sqrt(exit.T0T),1/Math.sqrt(sonic.T0T)],
 };
 for(const [key,range] of Object.entries(expected)){
  const view=sceneSVG(scene,inputs,0,key);
  assert.equal(view.field.quantity,key);
  near(view.field.min,range[0],1e-10);
  near(view.field.max,range[1],1e-10);
  assert.match(view.svg,/data-nozzle-moc-field/);
  assert.doesNotMatch(view.svg,/NaN|Infinity|undefined/);
 }
 const angles=sceneSVG(scene,{...inputs,showNozzleCharacteristics:false},0,'flow-angle');
 assert.ok(angles.field.min<0&&angles.field.max>0);
 near(angles.field.min,-angles.field.max,1e-10);
 assert.doesNotMatch(angles.svg,/data-nozzle-moc-characteristics/);
 assert.match(sceneSVG(scene,inputs,0,'mach').svg,/data-nozzle-moc-characteristics/);
});

test('the nozzle design uses named gas gamma or an editable custom value',()=>{
 const id='nozzle-design', base=defaults(id);
 assert.equal(base.fluid,'Custom gas');
 assert.equal(base.gamma,1.2);
 for(const [name,{gamma}] of Object.entries(gasPresets)){
  const inputs=selectGas(base,name);
  const [fluid,ratio]=inputDefinitions(id,inputs);
  assert.equal(fluid.key,'fluid');
  assert.ok(fluid.options.includes(name));
  assert.equal(ratio.key,'gamma');
  assert.equal(ratio.readOnly,true);
  assert.deepEqual(calculate(id,inputs).gas,{name,gamma});
 }
 const custom={...selectGas(base,'Custom gas'),gamma:1.3};
 assert.equal(inputDefinitions(id,custom)[1].readOnly,false);
 assert.deepEqual(calculate(id,custom).gas,{name:'Custom gas',gamma:1.3});
 assert.notEqual(calculate(id,custom).result.wallAngle,calculate(id,base).result.wallAngle);
 assert.ok(!inputDefinitions(id,custom).some(field=>field.key==='R'));
});

test('region marching uses adjacent constant states to locate characteristics and wall segments',()=>{
 const inputs={...defaults('nozzle-design'),nozzleMocMethod:nozzleMocMethods.region,mocFanRays:4};
 const {result}=calculate('nozzle-design',inputs);
 // John and Keith, Problem 14.22: four equal turns, sonic first region.
 near(result.fan[1].M,1.1659,5e-5);
 near(result.mesh[0][0].M,1.2727,5e-5);
 const incident=Math.atan2(-1,result.axis[1].x)*180/Math.PI;
 near(incident,-73.0120,5e-5);
 const firstWall=result.wall[1];
 const [lastInterior]=result.mesh[0].slice(-2);
 const reflected=Math.atan2(firstWall.y-lastInterior.y,firstWall.x-lastInterior.x)*180/Math.PI;
 near(reflected,52.4393,5e-5);
 for(let i=1;i<result.wall.length;i++){
  const [a,b]=result.wall.slice(i-1,i+1);
  near((b.y-a.y)/(b.x-a.x),Math.tan(a.theta),1e-12);
 }
 const view=sceneSVG({kind:'nozzleMoc',...result},inputs,0,'mach');
 assert.equal(view.field.note,'Piecewise-constant region states');
});

test('region marching agrees with NASA exit coordinates and approaches the point solution with refinement',()=>{
 const nasa={...nozzleMocExamples[2].inputs,mocThroatHalfHeight:1,nozzleMocMethod:nozzleMocMethods.region};
 const benchmark=designMinimumLengthNozzle(nasa);
 near(benchmark.length,64.15586,.03);
 near(benchmark.areaRatio,12.9735,.01);

 const design=(count,method)=>designMinimumLengthNozzle({...nozzleMocExamples[0].inputs,
  mocThroatHalfHeight:1,mocFanRays:count,nozzleMocMethod:method});
 const lengthDifference=count=>Math.abs(design(count,nozzleMocMethods.point).length-design(count,nozzleMocMethods.region).length);
 assert.ok(lengthDifference(20)>.01);
 assert.ok(lengthDifference(100)<lengthDifference(20)/4);
});

test('comparison keeps both contours and reports signed differences for the same inputs',()=>{
 const id='nozzle-design',inputs={...defaults(id),nozzleMocMethod:nozzleMocMethods.compare};
 for(const example of nozzleMocExamples){
  const d=calculate(id,{...inputs,...example.inputs});
  const [point,region]=d.result.designs;
  assert.equal(point.exitMach,region.exitMach);
  assert.notEqual(point.length,region.length);
  assert.deepEqual(d.result.nozzleComparison.table[0].values,[point.length,region.length,region.length-point.length]);
  const [walls,mach]=plotOptions(d);
  assert.deepEqual(walls.chart.series.map(series=>series.name),[nozzleMocMethods.point,nozzleMocMethods.region]);
  assert.equal(mach.chart.series.length,4);
 }
 const d=calculate(id,inputs);
 const view=sceneSVG(d.scene,inputs,0,'flow-angle');
 assert.match(view.svg,/data-nozzle-moc-method="Point-to-Point"/);
 assert.match(view.svg,/data-nozzle-moc-method="Region-to-Region"/);
 near(view.field.max,-view.field.min,1e-12);
 assert.doesNotMatch(view.svg,/NaN|Infinity|undefined/);
});

test('uniform supersonic starts produce parallel exit flow and converge to the inlet-based area ratio',()=>{
 const id='nozzle-design',preset=nozzleMocExamples.find(entry=>entry.value==='supersonic-inlet');
 const base={...defaults(id),...preset.inputs};
 const nu0=prandtlMeyer(base.mocInletMach,base.gamma);
 const expected=areaMach(base.mocExitMach,base.gamma)/areaMach(base.mocInletMach,base.gamma);
 const solve=(count,method)=>designMinimumLengthNozzle({...base,mocFanRays:count,nozzleMocMethod:method});
 for(const method of [nozzleMocMethods.point,nozzleMocMethods.region]){
  const coarse=solve(10,method),fine=solve(100,method);
  assert.equal(fine.inletMach,base.mocInletMach);
  assert.equal(fine.axis[0].M,base.mocInletMach);
  assert.equal(fine.exitMach,base.mocExitMach);
  assert.equal(fine.exitAngle,0);
  near(fine.wallAngle,deg((prandtlMeyer(base.mocExitMach,base.gamma)-nu0)/2),1e-12);
  near(fine.isentropicAreaRatio,expected,1e-12);
  near(fine.mesh[0][0].nu,nu0+2*(prandtlMeyer(base.mocExitMach,base.gamma)-nu0)/200,1e-12);
  assert.ok(Math.abs(fine.areaErrorPct)<Math.abs(coarse.areaErrorPct)/8);
 }
 const run=calculate(id,{...base,nozzleMocMethod:nozzleMocMethods.compare});
 assert.ok(run.result.nozzleComparison.table.some(({unit})=>unit==='Aₑ/Aᵢ'));
 assert.match(run.chart.xlabel,/x\/hᵢ/);
 const view=sceneSVG(run.scene,run.inputs,0,'mach');
 assert.equal(view.field.min,base.mocInletMach);
 assert.equal(view.field.max,base.mocExitMach);
 assert.match(view.svg,/Inlet · M = 1.5/);
 assert.doesNotMatch(view.svg,/NaN|Infinity|undefined/);
 assert.equal(inputDefinitions(id,base).find(f=>f.key==='mocThroatHalfHeight').label,'Inlet half-height');
 assert.ok(!inputDefinitions(id,defaults(id)).some(f=>f.key==='mocInletMach'));
 for(const mocInletMach of [NaN,.9,1,base.mocExitMach,3])
  assert.throws(()=>calculate(id,{...base,mocInletMach}),/1 < inlet Mach < exit Mach/);
 const sonic=calculate(id,{...base,nozzleMocStart:nozzleMocStarts.sonic,mocInletMach:.9});
 assert.equal(sonic.result.inletMach,1);
});
