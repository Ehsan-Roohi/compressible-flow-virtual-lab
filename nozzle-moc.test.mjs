import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate, defaults, inputDefinitions} from './labs.js';
import {gasPresets, selectGas} from './gas-properties.js';
import {designMinimumLengthNozzle, nozzleMocExamples} from './nozzle-moc.js';
import {plotOptions} from './plot-options.js';

const near=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<=tolerance,
 `Expected ${actual} within ${tolerance} of ${expected}`);

test('nozzle design presets solve the wall and characteristic net with parallel flow at the exit',()=>{
 for(const example of nozzleMocExamples){
  const inputs={...defaults('nozzle-design'),...example.inputs};
  const {result}=calculate('nozzle-design',inputs);
  assert.equal(result.exitMach,inputs.mocExitMach);
  assert.equal(result.exitAngle,0);
  assert.equal(result.wall.length,inputs.mocFanRays+1);
  assert.ok(Math.abs(result.areaErrorPct)<.1,example.value);
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
