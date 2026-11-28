import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate, defaults, inputDefinitions} from './labs.js';
import {calculatorModes, shockCalculatorLabs, obliqueInputs, conicalInputs} from './appendix-calculator.js';
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
    assert.equal(fields.some(f=>f.key==='calculatorConeAngle'),mode===calculatorModes.conical);
    const inlet=d.result.s1??d.result;
    near(inlet.p,137900);
    near(inlet.T,277.78);
    assert.equal(d.scene,null,mode);
    const plots=plotOptions(d);
    assert.ok(plots.length>1,mode);
    assert.equal(new Set(plots.map(p=>p.key)).size,plots.length,mode);
    for(const {chart} of plots){
      const svg=chartSVG(chart).svg;
      assert.match(svg,/<svg/);
      assert.doesNotMatch(svg,/NaN|Infinity|undefined/);
    }
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

test('oblique calculator selects a branch and recovers it from wave angle or normal Mach number',()=>{
  for(const [known,title,beta] of [[obliqueInputs.weak,'Weak shock',39.3139318],[obliqueInputs.strong,'Strong shock',83.7000804]]){
    const attached=run(calculatorModes.oblique,{M:2,calculatorTurn:10,calculatorObliqueGiven:known});
    const [table]=attached.result.calculatorComparisons;
    assert.equal(table.title,title);
    const actualBeta=attached.rows.find(r=>r.label.endsWith('Shock angle β')).value;
    near(actualBeta,beta,1e-5);
    const normalMach=table.rows[1],angle=actualBeta*Math.PI/180;
    assert.equal(normalMach.label,'Mach number normal to shock');
    near(normalMach.inlet,2*Math.sin(angle));
    const squared=normalMach.inlet**2;
    near(normalMach.outlet,Math.sqrt((1+.2*squared)/(1.4*squared-.2)));
    for(const patch of [
      {calculatorObliqueGiven:obliqueInputs.wave,calculatorObliqueBeta:actualBeta},
      {calculatorObliqueGiven:obliqueInputs.normalMach,calculatorObliqueNormalMach:normalMach.inlet},
    ]){
      const inverse=run(calculatorModes.oblique,{M:2,...patch});
      assert.equal(inverse.result.calculatorComparisons[0].title,title);
      near(inverse.result.calculatorSections[0].rows[0].value,10);
      near(inverse.result.s2.M,attached.result.s2.M);
    }
  }
});

test('oblique calculator reports the attached-shock limit and rejects invalid inverse inputs',()=>{
  const detached=run(calculatorModes.oblique,{M:2,calculatorTurn:30});
  assert.equal(detached.result.status,'detached');
  assert.match(detached.notice,/exceeds the limit/);
  assert.equal(detached.result.calculatorSections.length,1);
  assert.ok(detached.result.calculatorComparisons[0].rows.every(r=>r.outlet===null));
  const [weak,strong]=plotOptions(detached)[0].chart.series;
  assert.equal(weak.name,'Weak shock');
  assert.equal(strong.name,'Strong shock');
  assert.deepEqual(weak.points.at(-1),strong.points.at(-1));
  near(weak.points.at(-1)[0],detached.result.calculatorSections[0].rows[1].value);
  assert.throws(()=>run(calculatorModes.normal,{M:.5}),/Mach number between/);
  assert.throws(()=>run(calculatorModes.oblique,{M:2,calculatorObliqueGiven:obliqueInputs.wave,calculatorObliqueBeta:20}),/inlet Mach angle/);
  assert.throws(()=>run(calculatorModes.oblique,{M:2,calculatorObliqueGiven:obliqueInputs.normalMach,calculatorObliqueNormalMach:2.1}),/inlet Mach number/);
});

test('all calculator modes report ratios separately from distinctly labeled flow states',()=>{
  const labels={
    [calculatorModes.isentropic]: ['Specified flow state','Stagnation reference'],
    [calculatorModes.normal]: ['Before shock','After shock'],
    [calculatorModes.rayleigh]: ['Specified flow state','Sonic reference'],
    [calculatorModes.fanno]: ['Specified flow state','Sonic reference'],
    [calculatorModes.oblique]: ['Before shock','After shock'],
    [calculatorModes.expansion]: ['Specified flow state','Stagnation reference'],
    [calculatorModes.conical]: ['Freestream','Behind shock','Cone surface'],
  };
  for(const mode of Object.values(calculatorModes)){
    const d=run(mode,{M:2,p1:101,T1:300,calculatorTurn:10});
    const {calculatorSections,calculatorComparisons,calculatorStateLabel}=d.result;
    assert.deepEqual([calculatorStateLabel,...calculatorComparisons.map(c=>c.outletLabel)],labels[mode],mode);
    assert.ok(calculatorSections.flatMap(s=>s.rows).some(r=>r.label.includes('/')),mode);
    assert.ok(calculatorSections.flatMap(s=>s.rows).every(r=>!r.unit||r.unit==='°'),mode);
    const oblique=mode===calculatorModes.oblique;
    assert.equal(calculatorComparisons.length,mode===calculatorModes.conical?2:1,mode);
    for(const comparison of calculatorComparisons){
      assert.equal(comparison.rows.length,oblique?9:8,mode);
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

test('Rayleigh velocity ratio agrees with the dimensional inlet and sonic speeds',()=>{
  const d=run(calculatorModes.rayleigh,{M:.5});
  const expected=4/9;
  near(d.result.s1.u/d.result.sonic.u,expected);
  near(d.rows.find(r=>r.label.endsWith('u/u*')).value,expected);
  const chart=plotOptions(d).find(o=>o.chart.ylabel==='u/u*').chart;
  near(chart.series[0].points.find(([m])=>m===.5)[1],expected);
});

test('conical flow distinguishes the shock and wall states and reports unsupported inputs',()=>{
  const d=run(calculatorModes.conical,{M:5,calculatorConeAngle:20});
  const {relations:r,s1,s2,surface}=d.result;
  near(r.coneAngle,20);
  assert.ok(r.shockTurn<r.coneAngle&&r.coneAngle<r.waveAngle);
  assert.ok(surface.M<s2.M&&surface.p>s2.p);
  near(s2.p0/s1.p0,r.p02p01);
  near(surface.p0/s1.p0,r.p0cp01);
  near(r.p0cp01,r.p02p01);
  const expectedProfiles={
    M:[s2.M,surface.M],
    p:[s2.p/s1.p,surface.p/s1.p],
    T:[s2.T/s1.T,surface.T/s1.T],
    rho:[s2.rho/s1.rho,surface.rho/s1.rho],
    p0:[s2.p0/s1.p0,surface.p0/s1.p0],
    T0:[1,1],
    uRatio:[s2.u/s1.u,surface.u/s1.u],
    aRatio:[s2.a/s1.a,surface.a/s1.a],
    deflection:[r.shockTurn,r.coneAngle],
  };
  const plots=plotOptions(d);
  assert.deepEqual(plots.map(p=>p.key),Object.keys(expectedProfiles).map(key=>'appendix-conical-'+key));
  for(const {key,chart} of plots){
    const property=key.replace('appendix-conical-','');
    const [downstream,wall]=expectedProfiles[property];
    assert.equal(chart.series.length,1);
    const [{points}]=chart.series;
    const {axis}=chartSVG(chart);
    near(axis.xmin,r.waveAngle);
    near(axis.xmax,r.coneAngle);
    near(points[0][0],r.waveAngle);
    near(points[0][1],downstream);
    near(points.at(-1)[0],r.coneAngle);
    near(points.at(-1)[1],wall);
    assert.ok(points.every(([theta],i)=>i===0||theta<points[i-1][0]));
    if(property==='p0'||property==='T0')assert.ok(points.every(([,y])=>y===points[0][1]));
  }
  for(const patch of [
    {calculatorConeGiven:conicalInputs.wave,calculatorConeBeta:r.waveAngle},
    {calculatorConeGiven:conicalInputs.surfaceMach,calculatorConeSurfaceMach:r.surfaceMach},
  ]){
    const inverse=run(calculatorModes.conical,{M:5,...patch}).result.relations;
    near(inverse.coneAngle,20);
    near(inverse.waveAngle,r.waveAngle);
    near(inverse.pcp1,r.pcp1);
  }
  const unresolved=run(calculatorModes.conical,{M:2,calculatorConeAngle:69});
  assert.equal(unresolved.result.status,'unsupported');
  assert.deepEqual(plotOptions(unresolved),[]);
});

test('shock input menus show only the numeric field relevant to the selected relation',()=>{
  for(const [mode,key,choices] of [
    [calculatorModes.oblique,'calculatorObliqueGiven',[
      [obliqueInputs.weak,'calculatorTurn'],[obliqueInputs.strong,'calculatorTurn'],
      [obliqueInputs.wave,'calculatorObliqueBeta'],[obliqueInputs.normalMach,'calculatorObliqueNormalMach'],
    ]],
    [calculatorModes.conical,'calculatorConeGiven',[
      [conicalInputs.cone,'calculatorConeAngle'],[conicalInputs.wave,'calculatorConeBeta'],
      [conicalInputs.surfaceMach,'calculatorConeSurfaceMach'],
    ]],
  ]){
    for(const [selection,expected] of choices){
      const fields=inputDefinitions('foundations',{...defaults('foundations'),calculatorMode:mode,[key]:selection});
      assert.deepEqual(fields.filter(f=>f.key.startsWith('calculator')).map(f=>f.key),['calculatorMode',key,expected]);
    }
  }
});
