import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate, defaults, inputDefinitions} from './labs.js';
import {calculatorModes, shockCalculatorLabs} from './appendix-calculator.js';
import {chartSVG} from './graphics.js';
import {plotOptions} from './plot-options.js';

const run = (calculatorMode, patch={}) => calculate('foundations',{...defaults('foundations'),calculatorMode,...patch});
const near = (actual,expected,tolerance=1e-6) => assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);

test('all appendix calculators accept a Mach number, pressure, temperature and editable gamma',()=>{
  for(const mode of Object.values(calculatorModes)){
    const d=run(mode,{p1:137.9,T1:277.78,M:2});
    const fields=inputDefinitions('foundations',d.inputs);
    assert.ok(fields.some(f=>f.key==='calculatorMode'));
    assert.ok(fields.some(f=>f.key==='gamma'&&!f.readOnly));
    for(const key of ['M','p1','T1'])assert.ok(fields.some(f=>f.key===key),mode);
    assert.equal(fields.some(f=>f.key==='calculatorTurn'),mode===calculatorModes.oblique);
    const inlet=d.result.s1??d.result;
    near(inlet.p,137900);
    near(inlet.T,277.78);
    assert.equal(d.scene,null,mode);
    const svg=chartSVG(plotOptions(d)[0].chart).svg;
    assert.match(svg,/<svg/);
    assert.doesNotMatch(svg,/NaN|Infinity|undefined/);
    if(Object.hasOwn(shockCalculatorLabs,mode))assert.ok(shockCalculatorLabs[mode].href);
  }
});

test('the appendix ratios retain the book conventions and derive correct dimensional states',()=>{
  const iso=run(calculatorModes.isentropic);
  near(iso.result.relations.areaRatio,1.6875);
  assert.ok(!iso.rows.some(r=>/F\/F|P×A/.test(r.label)));
  const normal=run(calculatorModes.normal,{M:2,p1:101,T1:300}).result;
  near(normal.s2.M,.57735026919);
  near(normal.s2.p,454500);
  near(normal.s2.T,506.25);
  const normalPlot=plotOptions(run(calculatorModes.normal,{M:2}))[0].chart;
  near(normalPlot.series[0].points.find(([m])=>m===2)[1],4.5);
  for(const mode of [calculatorModes.rayleigh,calculatorModes.fanno]){
    const d=run(mode,{M:.5,p1:101,T1:300});
    near(d.result.sonic.M,1);
    near(d.result.s1.T/d.result.sonic.T,d.result.ratios.T);
    near(d.result.s1.p0/d.result.sonic.p0,d.result.ratios.p0);
    const row=d.rows.find(r=>r.label.includes(mode===calculatorModes.rayleigh?'ρ*/ρ':'ρ/ρ*'));
    near(row.value,mode===calculatorModes.rayleigh?4/9:1.870828693386971);
  }
  const pm=run(calculatorModes.expansion);
  near(pm.result.relations.pmAngle,26.3797608);
  near(pm.result.relations.machAngle,30);
});

test('oblique calculator resolves both branches and reports the attached-shock limit',()=>{
  const attached=run(calculatorModes.oblique,{M:2,calculatorTurn:10});
  const sections=attached.result.calculatorSections;
  const beta=name=>sections.find(s=>s.title===name).rows.find(r=>r.label==='Shock angle β').value;
  near(beta('Weak shock'),39.31393,1e-5);
  near(beta('Strong shock'),83.70008,1e-5);
  const detached=run(calculatorModes.oblique,{M:2,calculatorTurn:30});
  assert.equal(detached.result.status,'detached');
  assert.match(detached.notice,/exceeds the limit/);
  assert.equal(detached.result.calculatorSections.length,1);
  assert.ok(detached.result.calculatorComparisons[0].rows.every(r=>r.outlet===null));
  const [weak,strong]=plotOptions(detached)[0].chart.series;
  assert.equal(weak.name,'Weak shock');
  assert.equal(strong.name,'Strong shock');
  assert.deepEqual(weak.points.at(-1),strong.points.at(-1));
  near(weak.points.at(-1)[0],detached.result.calculatorSections[0].rows[0].value);
  assert.throws(()=>run(calculatorModes.normal,{M:.5}),/Mach number between/);
});

test('all calculator modes report ratios separately from aligned inlet and outlet or reference properties',()=>{
  for(const mode of Object.values(calculatorModes)){
    const d=run(mode,{M:2,p1:101,T1:300,calculatorTurn:10});
    const {calculatorSections,calculatorComparisons}=d.result;
    assert.ok(calculatorSections.flatMap(s=>s.rows).some(r=>r.label.includes('/')),mode);
    assert.ok(calculatorSections.flatMap(s=>s.rows).every(r=>!r.unit||r.unit==='°'),mode);
    assert.equal(calculatorComparisons.length,mode===calculatorModes.oblique?2:1,mode);
    for(const comparison of calculatorComparisons){
      assert.equal(comparison.rows.length,8,mode);
      const values=Object.fromEntries(comparison.rows.map(r=>[r.label,r]));
      near(values['Mach number'].inlet,2);
      near(values['Static pressure'].inlet,101);
      near(values['Static temperature'].inlet,300);
      assert.ok(comparison.rows.every(r=>Number.isFinite(r.outlet)),mode);
      if(comparison.outletLabel==='Sonic reference')near(values['Mach number'].outlet,1);
      if(comparison.outletLabel==='Stagnation reference'){
        near(values['Mach number'].outlet,0);
        near(values['Static pressure'].outlet,values['Stagnation pressure'].inlet);
        near(values['Static temperature'].outlet,values['Stagnation temperature'].inlet);
      }
    }
  }
});
