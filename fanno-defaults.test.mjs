import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,defaults} from './labs.js';
import {fannoModeDefaults,fannoModeSelection} from './fanno-defaults.js';
import {fannoConditions,fannoPressurePlan,fannoSolveOptions,fannoSystemMode,fannoUnknowns,migrateFannoInputs} from './fanno-system.js';
import {fannoExample,fannoExample5PlotKey} from './fanno-examples.js';
import {plotOptions} from './plot-options.js';

const base=defaults('fanno');
const preset=selection=>fannoModeDefaults(base,selection);
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const system=(condition,unknown)=>({ductProblem:fannoSystemMode,fannoCondition:fannoConditions[condition],fannoUnknown:fannoUnknowns[unknown]});

test('Every Fanno mode and solve-for choice has a valid state in both friction conventions',()=>{
 const modes=['Friction length','Outlet Mach','Outlet Mach + friction length'].map(fannoInput=>({fannoInput}));
 for(const fannoCondition of fannoConditions)for(const fannoUnknown of fannoSolveOptions(fannoCondition)){
  modes.push({ductProblem:fannoSystemMode,fannoCondition,fannoUnknown});
 }
 for(const mode of modes){
  const nominal=calculate('fanno',preset(mode)).result;
  for(const frictionInput of ['Dimensionless','Length and friction factor'])for(const frictionConvention of ['Fanning','Darcy']){
   const {result}=calculate('fanno',preset({...mode,frictionInput,frictionConvention}));
   assert.ok(result.s1?.M>0&&result.s2?.M>0,JSON.stringify(mode));
   near(result.s2.M,nominal.s2.M);
   near(result.s2.p,nominal.s2.p,1e-3);
  }
 }
});

test('Fanno defaults reuse book inputs and recover the relevant book results',()=>{
 const first=preset();
 for(const [key,value] of Object.entries(fannoExample(1).inputs))assert.equal(first[key],value,key);
 const second=calculate('fanno',preset({fannoInput:'Outlet Mach + friction length'})).result;
 near(second.s1.M,2.5);near(second.s2.M,1.5);
 const third=calculate('fanno',preset(system(1,1))).result;
 near(third.supplyPressure/1000,4871.6966,.001);
 near(third.backPressure/1000,101.35);
 const fourth=calculate('fanno',preset(system(4,2))).result;
 near(fourth.lambda,.172343);
 [1004.8267,328.6415,260.4449].forEach((pressure,i)=>{
  const {result}=calculate('fanno',preset(system(i+2,0)));
  near(result.backPressure/1000,pressure,.001);
 });
 const sixth=preset(system(0,3)),plan=fannoPressurePlan(migrateFannoInputs(sixth));
 assert.ok(sixth.backRatio>=plan.min&&sixth.backRatio<=plan.max);
 const location=calculate('fanno',sixth).result;
 near(location.backPressure/1000,50.66);
 assert.equal(location.shockPart,'duct');
 for(const unknown of [0,1])near(calculate('fanno',preset(system(5,unknown))).result.s2.M,1);
});

test('Changing Fanno modes discards incompatible inputs and keeps Example 5 comparison across its cases',()=>{
 const previous={...preset(system(2,0)),bookExample:'5–5',lambda:9};
 const next=preset(fannoModeSelection(previous,'fannoCondition',fannoConditions[3]));
 assert.equal(next.lambda,.3);
 assert.equal(next.bookExample,'5–5');
 assert.equal(plotOptions(calculate('fanno',next))[0].key,fannoExample5PlotKey);
 const inverse=preset(fannoModeSelection(next,'fannoUnknown',fannoUnknowns[1]));
 assert.equal(inverse.bookExample,'');
 near(calculate('fanno',inverse).result.supplyPressure/1000,1034.2);
 const single=preset(fannoModeSelection(inverse,'ductProblem','Single duct'));
 assert.equal(single.ductProblem,'Single duct');
 assert.equal(single.M1,.6);
});
