import assert from 'node:assert/strict';
import test from 'node:test';
import {createUnitView} from './unit-system.js';
import {calculate, defaults, inputDefinitions} from './labs.js';
import {nozzleModeDefaults, nozzleSolveModes} from './nozzle-book.js';

const near = (actual, expected, relativeTolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) <= relativeTolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

test('English engineering units use absolute pressure and temperature and preserve ratios', () => {
  const u = createUnitView('US');
  assert.equal(u.label('kPa'), 'psia');
  assert.equal(u.label('K'), '°R');
  near(u.value(1000, 'kPa'), 145.0377377302);
  near(u.value(300, 'K'), 540);
  near(u.value(500, 'cm²'), 77.50015500031);
  near(u.value(100, 'kJ/kg'), 42.9922613929);
  near(u.value(1, 'm/s'), 3.280839895);
  assert.equal(u.value(.5, 'pᵦ/p₀'), .5);
  assert.equal(u.value(12, 'ms'), 12);
  assert.equal(u.value(30, '°'), 30);
  assert.equal(u.text('x = 1 m, T = 300 K, and t = 1 ms.'), 'x = 3.28084 ft, T = 540 °R, and t = 1 ms.');
  u.setSystem('SI');
  assert.equal(u.text('x = 1 m, T = 300 K'), 'x = 1 m, T = 300 K');
});

test('editing converted inputs round-trips the nozzle design and Rayleigh heat-limit calculations', () => {
  const u = createUnitView('US');
  const states = [
    ['nozzle', nozzleModeDefaults(defaults('nozzle'), {nozzleSolve:nozzleSolveModes[2]})],
    ['rayleigh', {...defaults('rayleigh'), ductProblem:'Single duct', q:40}],
  ];
  for (const [lab, params] of states) {
    const display = {...params};
    for (const field of inputDefinitions(lab, params)) {
      if (typeof params[field.key] !== 'number') continue;
      display[field.key] = u.inputValue(u.fieldValue(params[field.key], field), field);
    }
    const a = calculate(lab, params), b = calculate(lab, display);
    assert.equal(a.result.status, b.result.status);
    for (const name of lab === 'nozzle' ? ['Me','onset','exitShock','design','massFlow'] : ['qmax','ds_R'])
      near(a.result[name], b.result[name]);
  }
});

test('chart values, overlay labels and maps are converted on display without mutating the solver data', () => {
  const u = createUnitView('US');
  const source = {
    xlabel:'Position x (m)', ylabel:'Pressure (kPa)', yRange:[0,200],
    series:[{name:'Initial 100 kPa',points:[[0,100],[1,200]]}],
    markers:[{x:1,y:200}],
  };
  const c = u.plot({chart:source}).chart;
  assert.equal(c.xlabel, 'Position x (ft)');
  assert.equal(c.ylabel, 'Pressure (psia)');
  assert.equal(c.series[0].name, 'Initial 14.50377 psia');
  near(c.series[0].points[1][0], u.value(1,'m'));
  near(c.markers[0].y, c.yRange[1]);
  assert.deepEqual(source.series[0].points, [[0,100],[1,200]]);
  const map = u.plot({chart:{...source,ylabel:'Time t (ms)',heatmap:{left:-1,right:1,end:20,rows:[[.1,.2]]}}}).chart.heatmap;
  near(map.left, u.value(-1,'m'));
  near(map.right, u.value(1,'m'));
  assert.equal(map.end, 20);
  assert.deepEqual(map.rows, [[.1,.2]]);
  const exported = u.exportData({rows:[{label:'Pressure',before:100,after:200,ratio:2,unit:'kPa'}]}).rows[0];
  near(exported.before, u.value(100,'kPa'));
  near(exported.after, u.value(200,'kPa'));
  assert.equal(exported.ratio, 2);
  assert.equal(exported.unit, 'psia');
});
