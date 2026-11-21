import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate, defaults, inputDefinitions} from './labs.js';
import {plotOptions} from './plot-options.js';
import {chartSVG} from './graphics.js';
import {nozzleBookInputs, nozzleBookPlotKey, nozzleExamples, nozzleModeDefaults, nozzleSolveModes} from './nozzle-book.js';

function plots(overrides = {}) {
  return plotOptions(calculate('nozzle', {...defaults('nozzle'), ...nozzleBookInputs, ...overrides}));
}

function shockPosition(points) {
  const index = points.findIndex(([x, p], i) =>
    i > 0 && x === points[i - 1][0] && p > points[i - 1][1]
  );
  assert.ok(index > 0, 'the pressure curve contains both states at the shock');
  return points[index][0];
}

test('example 8–4 matches its fixed pressure profile and draws coincident curves once', () => {
  const [comparison] = plots();
  assert.equal(comparison.key, nozzleBookPlotKey);
  assert.equal(comparison.chart.series.length, 1);
  const [book] = comparison.chart.series;
  assert.ok(Math.abs(book.points.at(-1)[1] - 0.5) < 1e-9);
  assert.ok(shockPosition(book.points) < 1);
  const view = chartSVG(comparison.chart);
  assert.equal(view.axis.ymin, 0);
  assert.equal(view.axis.ymax, 1);
  assert.match(comparison.note, /coincide/);
});

test('raising back pressure moves the current shock upstream while the example stays fixed', () => {
  const reference = plots()[0].chart.series[0].points;
  const [live, book] = plots({backRatio: 0.6})[0].chart.series;
  assert.deepEqual(book.points, reference);
  assert.ok(shockPosition(live.points) < shockPosition(book.points));
  assert.ok(Math.abs(live.points.at(-1)[1] - 0.6) < 1e-9);
  const changedGas = plots({fluid: 'Helium (He)', gamma: 1.667, R: 2077, areaRatio: 2, p0: 220})[0];
  assert.deepEqual(changedGas.chart.series[1].points, reference);
});

test('the axial comparison stays available during combined-view playback, apart from external-only and other geometries', () => {
  const combined = plots({nozzleView: 'Nozzle + external waves', backRatio: 0.02});
  assert.equal(combined[0].key, nozzleBookPlotKey);
  assert.equal(combined[0].chart.series[0].points.at(-1)[0], 1);
  assert.ok(combined.some(o => o.key === 'external-M'));
  for (const overrides of [{nozzleView: 'External waves'}, {nozzleType: 'Converging'}, {nozzleType: 'Diverging'}]) {
    assert.ok(!plots(overrides).some(o => o.key === nozzleBookPlotKey));
  }
});

function bookCase(code, overrides={}){
  const x=nozzleModeDefaults(defaults('nozzle'),{bookExample:code});
  return calculate('nozzle',{...x,...overrides});
}
const near=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);

test('Chapter 8 presets reproduce the converging, choked throat and internal-shock examples',()=>{
  assert.deepEqual(nozzleExamples.map(e=>e.value),['8-1a','8-1b','8-2a','8-2b','8-2c','8-3','8-4']);
  const a=bookCase('8-1a').result,b=bookCase('8-1b').result;
  near(a.Me,.7324,.0001);near(a.exitPressure/1000,350,1e-6);
  assert.equal(b.Me,1);near(b.exitPressure/1000,264.14,.01);
  for(const r of [a,b]){
    assert.deepEqual(r.referenceTable.columns,['Inlet','Throat','Exit']);
    for(const {values} of r.referenceTable.rows)assert.equal(values[1],values[2]);
  }
  for(const [code,Me,pe,Te] of [['8-2a',2.63742,57.5152,209.06],['8-2b',.19745,1183.389,496.13]]){
    const {result}=bookCase(code);
    assert.equal(result.minimumMach,1);
    near(result.Me,Me,.00001);near(result.exitPressure/1000,pe,.01);near(result.exitTemperature,Te,.1);
    assert.deepEqual(result.referenceTable.columns,['Inlet','Throat','Exit']);
    assert.equal(result.referenceTable.rows[0].values[0],result.points[0].M);
    assert.equal(result.referenceTable.rows[0].values[1],1);
    near(result.referenceTable.rows[1].values[1],642.391,.002);
    near(result.referenceTable.rows[2].values[1],416.667,.001);
  }
  const shock=bookCase('8-4');
  near(shock.result.AsAt,2.33973,.00001);near(shock.result.Me,.38034,.00001);
  assert.ok(shock.shockDetails.length);
});

test('The chapter inverse cases recalculate from changed known data and expose their solved outputs',()=>{
  const inverse=bookCase('8-2c'),modified=bookCase('8-2c',{nozzleExitPressure:54});
  near(inverse.result.p0/1000,48.727,.002);near(modified.result.exitPressure/1000,54,1e-7);
  near(modified.result.p0/inverse.result.p0,54/47.42,1e-8);
  assert.ok(inverse.rows.some(r=>r.label==='Required reservoir stagnation pressure'));
  const design=bookCase('8-3');
  near(design.result.exitArea,.339481,1e-6);near(design.result.massFlow,110.721,.001);
  near(design.result.exitShock*design.result.p0/1000,185.192,.001);
  near(design.result.onset*design.result.p0/1000,994.887,.001);
  near(design.result.design*design.result.p0/1000,13.1109,.001);
  near(bookCase('8-3',{nozzleDesignMach:3}).result.Me,3,1e-8);
  for(const [code,key,hidden]of [['8-2c','nozzleExitPressure','p0'],['8-3','nozzleDesignMach','areaRatio']]){
    const x=nozzleModeDefaults(defaults('nozzle'),{bookExample:code});
    const fields=inputDefinitions('nozzle',x).map(f=>f.key);
    assert.ok(fields.includes(key));
    assert.ok(!fields.includes(hidden));
    assert.ok(!fields.includes('backRatio'));
  }
});

test('Nozzle modes select the corresponding chapter defaults',()=>{
  const base=defaults('nozzle');
  for(const [selection,example]of [[{},'8-4'],[{nozzleType:'Converging'},'8-1a'],
    [{nozzleSolve:nozzleSolveModes[1]},'8-2c'],[{nozzleSolve:nozzleSolveModes[2]},'8-3']]){
    assert.equal(nozzleModeDefaults(base,selection).bookExample,example);
  }
  for(const [selection,expectedMach]of [[{sonicBranch:'supersonic'},2.63742],
    [{sonicBranch:'subsonic'},.19745],[{outletCondition:'Specified back pressure'},.38034]]){
    const x=nozzleModeDefaults(base,{nozzleType:'Diverging',...selection});
    assert.equal(x.MIn,1);
    const {result}=calculate('nozzle',x);
    near(result.Me,expectedMach,.00001);
    for(const {values} of result.referenceTable.rows)assert.equal(values[0],values[1]);
  }
});
