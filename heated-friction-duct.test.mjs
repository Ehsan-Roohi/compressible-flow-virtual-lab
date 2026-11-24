import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {calculate, defaults, inputDefinitions} from './labs.js';
import {fanno, fannoRatios, rayleigh} from './physics.js';
import {plotOptions} from './plot-options.js';
import {sceneSVG, chartSVG} from './graphics.js';
import {createUnitView} from './unit-system.js';
import {changeHeatedDuctInput, ductFrictionInputs, ductHeatInputs, ductHeatingModes,
 heatedFrictionMode, heatedFrictionPreset} from './heated-friction-duct.js';

import {fannoRayleighMode} from './fanno-rayleigh.js';
import {fannoSystemMode} from './fanno-system.js';

const run = (id, input = {}) => calculate(id,{...defaults(id),...heatedFrictionPreset,...input});
const near = (a,b,t=1e-9) => assert.ok(Math.abs(a-b) <= t * Math.max(1,Math.abs(b)),`${a} != ${b}`);
const direct = {heatedFrictionInput:ductFrictionInputs.parameter, heatedDuctModel:ductHeatingModes.uniform};
const params = d => ({M1:d.result.s1.M,T1:d.result.s1.T,p1:d.result.s1.p,gamma:d.gas.gamma,R:d.gas.R});

test('Shapiro §8.9 constant-wall benchmark is offered and reproduced by both labs', () => {
 const fanno = run('fanno'), rayleighResult = run('rayleigh');
 assert.deepEqual(fanno.result, rayleighResult.result);
 const {result:r} = fanno;
 near(r.s2.M,.5292168314458615);
 near(r.s2.M,.5293,1e-4);
 near(r.s2.T0/r.s1.T0,1.05);
 near(r.s2.T0,315);
 near(r.heatAdded,15.0675);
 assert.ok(Object.values(fanno.checks).every(error=>error<1e-12));
 // Independent check of the integral momentum balance.
 const impulse = s=>s.p+s.rho*s.u**2;
 const flux = s=>s.rho*s.u**2;
 const wallDrag = r.longitudinal.slice(1).reduce((sum,z,i)=>{
  const a=r.longitudinal[i];
  return sum+(z.x-a.x)*(flux(z.state)+flux(a.state))*r.frictionLength/4;
 },0);
 near(impulse(r.s1)-impulse(r.s2),wallDrag,1e-7);
 for (const id of ['fanno','rayleigh']) {
  const problem = inputDefinitions(id,{...defaults(id),...heatedFrictionPreset}).find(f=>f.key==='ductProblem');
  assert.equal(problem.selection,'Single duct');
 }
});

test('Uniform heat with zero friction and zero heat with friction recover the analytical limits', () => {
 for (const M1 of [.5,2.5]) {
  const pureFanno=run('rayleigh',{...direct,M1,heatedFrictionParameter:.125,heatedTotalHeat:0});
  const expectedFanno=fanno({...params(pureFanno),lambda:.125}).s2;
  near(pureFanno.result.s2.M,expectedFanno.M);
  near(pureFanno.result.s2.p,expectedFanno.p);
  for (const q of [-20,30]) {
   const pureRayleigh=run('fanno',{...direct,M1,heatedFrictionParameter:0,heatedTotalHeat:q});
   const expectedRayleigh=rayleigh({...params(pureRayleigh),q:q*1000}).s2;
   near(pureRayleigh.result.s2.M,expectedRayleigh.M);
   near(pureRayleigh.result.s2.p,expectedRayleigh.p);
  }
 }
});

test('A sonic point inside the duct truncates both the field and chart without an outlet state', () => {
 const d=run('fanno',{...direct,heatedTotalHeat:0,heatedFrictionParameter:2});
 const {result:r}=d;
 assert.equal(r.status,'length-limit');
 assert.equal(r.s2,null);
 assert.equal(r.profileEnd.M,1);
 near(r.endFraction,fannoRatios(.5).F/2,1e-8);
 assert.deepEqual(r.referenceTable.columns,['Inlet','Choking station']);
 assert.ok(r.longitudinal.every(z=>z.x<=r.endFraction && z.state.M<=1));
 const figure=sceneSVG(d.scene,d.inputs).svg;
 assert.match(figure,/data-heated-friction-duct="true"/);
 assert.match(figure,/data-duct-limit="true"/);
 assert.doesNotMatch(figure,/NaN|Infinity|undefined/);
 const plots=plotOptions(d);
 assert.ok(plots.find(p=>p.key==='heated-friction-axial-mach').chart.markers.some(m=>m.name==='Choking station'));
 const entropyPlots=plots.filter(p=>p.key==='duct-temperature-entropy');
 assert.equal(entropyPlots.length,1);
 assert.match(chartSVG(entropyPlots[0].chart).svg,/Temperature–entropy diagram/);
 assert.equal(entropyPlots[0].chart.series[0].points.length,r.longitudinal.length);
});

test('Equivalent wall temperatures, friction formats, and heat inputs preserve the solution', () => {
 const baseline=run('rayleigh');
 let inputs=changeHeatedDuctInput(baseline.inputs,'heatedWallInput',ductHeatInputs.wallTemperature);
 inputs=changeHeatedDuctInput(inputs,'heatedFrictionInput',ductFrictionInputs.parameter);
 near(calculate('rayleigh',inputs).result.s2.M,baseline.result.s2.M);
 const uniform=run('rayleigh',{heatedDuctModel:ductHeatingModes.uniform,heatedTotalHeat:-25});
 inputs=changeHeatedDuctInput(uniform.inputs,'heatedFluxInput',ductHeatInputs.perLength);
 near(calculate('rayleigh',inputs).result.s2.M,uniform.result.s2.M);
 const fields=inputDefinitions('rayleigh',inputs);
 assert.ok(fields.some(f=>f.key==='heatedHeatRate'&&f.unit==='kJ/(kg·m)'));
 assert.ok(!fields.some(f=>f.key==='heatedTotalHeat'||f.key==='heatedWallRatio'));
 assert.equal(createUnitView('US').label('kJ/(kg·m)'),'Btu/(lbm·ft)');
 assert.match(sceneSVG(uniform.scene,uniform.inputs).svg,/data-heat-transfer="out-of-duct"/);
});

test('The problem menu puts the simultaneous model under Single duct and retains the two-duct entry', () => {
 for (const [id, mode] of [['rayleigh','Single duct'],['fanno','Single duct'],['fanno',fannoSystemMode]]) {
  const choices = inputDefinitions(id,{...defaults(id),ductProblem:mode}).find(f=>f.key==='ductProblem');
  assert.ok(choices.options.includes(fannoRayleighMode));
  assert.ok(!choices.options.includes(heatedFrictionMode));
  assert.equal(choices.optionLabels[fannoRayleighMode],'Two ducts · Fanno and Rayleigh');
 }
});

test('Top Single duct tabs switch models, retain edits, and stay hidden for two ducts', () => {
 const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
 const controls=new Map();
 const element=key=>{
  if(!controls.has(key))controls.set(key,{setAttribute(){},focus(){}});
  return controls.get(key);
 };
 const context=vm.createContext({
  heatedFrictionMode, $:element, id:'fanno', inputs:{ductProblem:'Single duct', M1:.8},
  defaults:(id, selection)=>({...defaults(id),...(selection.ductProblem===heatedFrictionMode?heatedFrictionPreset:selection)}),
  request:0, stopSweep(){}, renderInputs(){context.renderSingleDuctTabs();}, schedule(){},
 });
 vm.runInContext(source.slice(source.indexOf('const singleDuctTabInputs='),source.indexOf('function renderInputs(){')),context);
 for (const id of ['fanno','rayleigh']) {
  context.id=id;
  context.inputs={ductProblem:'Single duct',M1:.8};
  context.renderSingleDuctTabs();
  assert.equal(element('labTabs').hidden,false);
  assert.match(element('labTabs').innerHTML,id==='fanno'?/Fanno flow/:/Rayleigh flow/);
  assert.match(element('labTabs').innerHTML,/aria-pressed="false">Simultaneous heat \+ friction/);
  element('single-duct-tab-1').onclick();
  assert.equal(context.inputs.ductProblem,heatedFrictionMode);
  assert.match(element('labTabs').innerHTML,/aria-pressed="true">Simultaneous heat \+ friction/);
  context.inputs.heatedWallRatio=3.2;
  element('single-duct-tab-0').onclick();
  assert.equal(context.inputs.ductProblem,'Single duct');
  assert.equal(context.inputs.M1,.8);
  element('single-duct-tab-1').onclick();
  assert.equal(context.inputs.heatedWallRatio,3.2);
  context.inputs.ductProblem=fannoRayleighMode;
  context.renderSingleDuctTabs();
  assert.equal(element('labTabs').hidden,true);
 }
});
