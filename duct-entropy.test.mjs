import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate, defaults} from './labs.js';
import {chartSVG} from './graphics.js';
import {plotOptions} from './plot-options.js';
import {createUnitView} from './unit-system.js';
import {fannoExamples} from './fanno-examples.js';
import {reservoirExamples} from './reservoir-examples.js';
import {fannoConditions, fannoPressurePlan, fannoSystemMode} from './fanno-system.js';
import {fannoRayleighPreset, rayleighFannoOrder} from './fanno-rayleigh.js';

const run = (id, changes = {}) => calculate(id, {...defaults(id), ...changes});
const diagram = data => {
 const options = plotOptions(data).filter(plot => plot.key === 'duct-temperature-entropy');
 assert.equal(options.length, 1);
 const [option] = options;
 const view = chartSVG(option.chart);
 assert.match(view.svg, /Temperature–entropy diagram/);
 assert.doesNotMatch(view.svg, /NaN|undefined|Infinity/);
 return option;
};
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const entropy = (state, reference, {cp, R}) =>
 (cp * Math.log(state.T / reference.T) - R * Math.log(state.p / reference.p)) / 1000;

test('Single-duct diagrams use the solved static states and show signed entropy change', () => {
 for (const data of [run('fanno'), run('rayleigh'), run('rayleigh', {q:-10})]) {
  const {s1, s2, longitudinal} = data.result;
  const {chart} = diagram(data);
  const [{points}] = chart.series;
  assert.deepEqual(points[0], [0, s1.T]);
  assert.equal(points.length, longitudinal.length);
  for (let i = 0; i < points.length; i++) {
   near(points[i][0], entropy(longitudinal[i].state, s1, data.gas));
   assert.equal(points[i][1], longitudinal[i].state.T);
  }
  assert.equal(Math.sign(points.at(-1)[0]), data.result.heatAdded < 0 ? -1 : 1);
  assert.deepEqual(chart.markers.map(marker => marker.name), ['Inlet', 'Outlet']);
  assert.equal(points.at(-1)[1], s2.T);
  const us = createUnitView('US').plot({chart}).chart;
  assert.match(us.xlabel, /Btu\/\(lbm·°R\)/);
  assert.match(us.ylabel, /°R/);
  near(us.series[0].points[0][1], s1.T * 1.8);
 }
 const limit = diagram(run('rayleigh', {q:1000}));
 assert.equal(limit.chart.series[0].points.length, 1);
 assert.match(limit.note, /no steady outlet/);
});

test('Reservoir and two-stage modes all offer a temperature–entropy diagram', () => {
 for (const [, preset] of reservoirExamples) {
  const {chart} = diagram(run('rayleigh', preset));
  assert.deepEqual(chart.series.map(series => series.name), ['Isentropic entry', 'Rayleigh duct']);
  assert.ok(chart.series[0].points.every(([delta]) => delta === 0));
 }
 const reference = run('rayleigh', {ductProblem:'Reservoir-fed duct', ductSolve:'Upstream reference + sonic outlet',
  M1:.41, p1:68.95, inletT0:229.4, outletT0:1666.7});
 assert.match(diagram(reference).note, /separate operating state/);
 assert.deepEqual(diagram(reference).chart.series.map(series => series.name), ['Rayleigh duct']);
 for (const id of ['fanno', 'rayleigh']) {
  for (const preset of [fannoRayleighPreset, {...fannoRayleighPreset, ductStageOrder:rayleighFannoOrder}]) {
   const {chart} = diagram(run(id, preset));
   assert.equal(chart.series.length, 2);
   assert.deepEqual(chart.series[0].points.at(-1), chart.series[1].points[0]);
   assert.deepEqual(chart.markers.map(marker => marker.name), ['1', '2', '3']);
  }
 }
});

test('Nozzle diagrams have constant-entropy isentropic segments and split real shocks', () => {
 const setup = {ductProblem:fannoSystemMode, fannoCondition:fannoConditions[0], lambda:.2, systemAreaRatio:2};
 const {limits} = fannoPressurePlan({...defaults('fanno'), ...setup});
 const data = [
  ...fannoExamples.map(({inputs}) => run('fanno', inputs)),
  ...[(limits.ductExit + limits.nozzleExit) / 2, limits.nozzleExit, (limits.nozzleExit + limits.throat) / 2, 1]
   .map(backRatio => run('fanno', {...setup, backRatio})),
  run('rayleigh', {ductProblem:'Heat + shock + converging nozzle', systemInletType:'Static duct inlet', M1:1.6,
   T1:200, p1:56, backPressure:120}),
 ];
 for (const d of data) {
  const {result: r} = d;
  const {chart} = diagram(d);
  const jump = chart.series.find(series => series.name === 'Normal shock');
  assert.equal(Boolean(jump), r.shockX != null || r.shockAt != null);
  for (const {name, points} of chart.series) {
   if (name.startsWith('Isentropic')) for (const [delta] of points) near(delta, points[0][0], 1e-9);
  }
  if (!jump) continue;
  assert.ok(jump.dash);
  assert.equal(jump.points.length, 2);
  assert.ok(jump.points[1][0] > jump.points[0][0]);
  const reference = r.reservoir ?? r.s1;
  for (const [i, name] of ['Before shock', 'After shock'].entries()) {
   const station = r.stations.find(point => point.name === name);
   near(jump.points[i][0], entropy(station.state, reference, d.gas));
   near(jump.points[i][1], station.state.T);
  }
 }
});
