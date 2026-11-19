import test from 'node:test';
import assert from 'node:assert/strict';
import {fannoExamples,fannoExample,fannoExample5PlotKey} from './fanno-examples.js';
import {calculate,defaults,inputDefinitions} from './labs.js';
import {migrateFannoInputs,fannoConditions} from './fanno-system.js';
import {plotOptions} from './plot-options.js';
const solve=(n,extra={})=>calculate('fanno',migrateFannoInputs({...defaults('fanno'),...fannoExample(n).inputs,...extra}));
const near=(a,b,t=.001)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const value=(d,name)=>d.rows.find(r=>r.label===name).value;
test('All six book examples load valid distinct problems',()=>{
 assert.deepEqual(fannoExamples.map(x=>x.number),[1,2,3,4,5,6]);
 for(let n=1;n<=6;n++)assert.ok(solve(n).result.s2.M>0);
 near(solve(1).result.s2.M,.709257);
 near(solve(1).result.s2.p/1000,125.2332);
 near(value(solve(2),'Required friction parameter'),.295926472,.00001);
 near(value(solve(2),'Maximum friction parameter (sonic exit)'),.431976689,.00001);
 near(value(solve(2),'Required duct length'),.184954045,1e-8);
 near(value(solve(2),'Maximum duct length'),.269985431,1e-8);
 near(solve(3).result.supplyPressure/1000,4871.6966,.01);
 near(solve(4).result.lambda,.172343,.00001);
});
test('Known outlet Mach uses cross section and friction data to solve for physical length',()=>{
 const extra={ductSection:'Rectangular',ductWidth:.06,ductHeight:.02,frictionConvention:'Darcy',frictionFactor:.04};
 const d=solve(2,extra),fields=inputDefinitions('fanno',{...defaults('fanno'),...fannoExample(2).inputs,...extra});
 for(const key of ['ductWidth','ductHeight','frictionConvention','frictionFactor'])assert.ok(fields.some(f=>f.key===key),key);
 assert.ok(!fields.some(f=>f.key==='ductLength'||f.key==='lambda'));
 const hydraulicDiameter=.03;
 near(value(d,'Required duct length'),value(d,'Required friction parameter')*hydraulicDiameter/.04,1e-10);
 near(value(d,'Maximum duct length'),value(d,'Maximum friction parameter (sonic exit)')*hydraulicDiameter/.04,1e-10);
});
test('Example 5 covers each requested shock station; example 6 recovers the specified duct inlet',()=>{
 const pressures=[2,3,4].map(i=>solve(5,{fannoCondition:fannoConditions[i]}).result.backPressure);
 [1004.8267,328.6415,260.4449].forEach((p,i)=>near(pressures[i]/1000,p,.001));
 const r=solve(6).result;
 near(r.s1.M,3);near(r.s1.T,300);near(r.s2.p/1000,50.66);
 near((r.shockX-1)/.05,28.9572,.001);
});
test('Example 5 defaults to a duct-only pressure comparison with the exit shock jump',()=>{
 const bookExample='5–5';
 const plots=[2,3,4].map(i=>plotOptions(solve(5,{bookExample,fannoCondition:fannoConditions[i]})));
 const {key,chart}=plots[0][0];
 assert.equal(key,fannoExample5PlotKey);
 for(const options of plots){
  assert.deepEqual(options[0].chart,chart);
  assert.ok(options.some(o=>o.key==='fanno-full-Static pressure'));
 }
 assert.equal(chart.series.length,3);
 const [throat,nozzleExit,ductExit]=chart.series.map(s=>s.points);
 for(const points of [throat,nozzleExit,ductExit]){
  assert.equal(points[0][0],0);
  assert.equal(points.at(-1)[0],1);
 }
 assert.ok(throat[0][1]>throat.at(-1)[1]);
 assert.ok(nozzleExit[0][1]>nozzleExit.at(-1)[1]);
 assert.ok(ductExit[0][1]<ductExit.at(-2)[1]);
 assert.equal(ductExit.at(-2)[0],1);
 assert.ok(ductExit.at(-2)[1]<ductExit.at(-1)[1]);
 assert.ok(!plotOptions(solve(4,{bookExample:'5–4'})).some(o=>o.key===key));
 assert.ok(!plotOptions(solve(5,{bookExample,lambda:.6})).some(o=>o.key===key));
});
