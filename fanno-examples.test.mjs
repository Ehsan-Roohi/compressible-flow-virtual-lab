import test from 'node:test';
import assert from 'node:assert/strict';
import {fannoExamples,fannoExample} from './fanno-examples.js';
import {calculate,defaults,inputDefinitions} from './labs.js';
import {migrateFannoInputs,fannoConditions} from './fanno-system.js';
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
 assert.ok(pressures[0]>pressures[1]&&pressures[1]>pressures[2]);
 near(pressures[0]/1000,1004.8267,.01);
 const r=solve(6).result;
 near(r.s1.M,3);near(r.s1.T,300);near(r.s2.p/1000,50.66);
 near((r.shockX-1)/.05,28.9572,.001);
});
