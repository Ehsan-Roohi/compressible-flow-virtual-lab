import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {calculate, defaults, inputDefinitions} from './labs.js';
import {sceneSVG} from './graphics.js';
import {plotOptions} from './plot-options.js';
import {fannoSystemMode} from './fanno-system.js';
import {fannoRayleighMode, fannoRayleighPreset, fannoRayleighExample, specifiedRayleighHeat} from './fanno-rayleigh.js';

const run = (id, changes = {}) => calculate(id, {...defaults(id), ...fannoRayleighPreset, ...changes});
const near = (actual, expected, tol = 1e-6) =>
 assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);

test('Chapter 5 Problem 3 yields the same three station states from both labs', () => {
 const fanno = run('fanno');
 const rayleigh = run('rayleigh');
 const {result} = fanno;
 assert.deepEqual(result, rayleigh.result);
 assert.equal(result.status, 'sonic-limit');
 assert.equal(result.stations.length, 3);
 near(result.s1.p0 / 1000, 1034.2);
 near(result.junction.M, 2.0025874413);
 near(result.junction.T0, 333.3);
 near(result.junction.p / 1000, 52.5743875);
 assert.equal(result.s2.M, 1);
 near(result.s2.p / 1000, 144.897182);
 near(result.s2.T0, 420.371290);
 near(result.heatAdded, 87.463111);
 assert.ok(Object.values(fanno.checks).every(error => error < 1e-11));
 assert.equal(result.referenceTable.columns.length, 3);
 assert.ok(result.referenceTable.rows.every(row => row.values.length === 3));
 assert.equal(result.longitudinal.find(point => point.x === .5).state, result.junction);
 assert.deepEqual(fanno.chart.series[0].points.at(-1), fanno.chart.series[1].points[0]);
});

test('Both lab selectors and shared visualizations expose the two-stage calculation', () => {
 for (const id of ['fanno', 'rayleigh']) {
  const choices = inputDefinitions(id, defaults(id)).find(field => field.key === 'ductProblem').options;
  assert.ok(choices.includes(fannoRayleighMode));
  const d = run(id);
  assert.ok(!inputDefinitions(id, d.inputs).some(field => field.key === 'q'));
  assert.ok(inputDefinitions(id, {...d.inputs, fannoRayleighOutlet: specifiedRayleighHeat}).some(field => field.key === 'q'));
  const view = sceneSVG(d.scene, d.inputs);
  assert.match(view.svg, /data-fanno-rayleigh="true"/);
  assert.match(view.svg, /data-duct-station="junction"/);
  assert.doesNotMatch(view.svg, /NaN|undefined|Infinity/);
  const axial = plotOptions(d).find(option => option.key === 'fanno-rayleigh-axial-mach');
  assert.deepEqual(axial.chart.markers.map(marker => marker.x), [0, .5, 1]);
 }
 const systemChoices = inputDefinitions('fanno', {...defaults('fanno'), ductProblem: fannoSystemMode})
  .find(field => field.key === 'ductProblem').options;
 assert.ok(systemChoices.includes(fannoRayleighMode));
});

test('User heat input and both friction conventions respect stage limits', () => {
 const darcy = run('fanno', {frictionConvention: 'Darcy', frictionFactor: .02});
 assert.deepEqual(darcy.result, run('fanno').result);
 const heated = run('rayleigh', {fannoRayleighOutlet: specifiedRayleighHeat, q: 30});
 assert.equal(heated.result.heatAdded, 30);
 assert.ok(heated.result.s2.M > 1 && heated.result.s2.M < heated.result.junction.M);
 const cooled = run('rayleigh', {fannoRayleighOutlet: specifiedRayleighHeat, q: -20});
 assert.ok(cooled.result.s2.M > cooled.result.junction.M);
 assert.throws(() => run('rayleigh', {fannoRayleighOutlet: specifiedRayleighHeat, q: 100}), {code: 'heat-limit'});
 assert.throws(() => run('fanno', {ductLength: 20}), {code: 'length-limit'});
});

test('Problem 3 is the default for the new mode and can be opened from both example menus', () => {
 const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
 const byId = new Map(['examplesPanel', 'exampleSelect'].map(key => [key, {}]));
 const context = vm.createContext({
  $: key => byId.get(key), experimentDefaults: defaults, id: 'fanno', inputs: {},
  fannoRayleighMode, fannoRayleighPreset, fannoRayleighExample,
  fannoExamples: [], reservoirExamples: [], rayleighBookExamples: {}, request: 0, timer: 0,
  sweepFinished: false, sweepPositioned: false,
  addDataExport() {}, clearTimeout() {}, stopSweep() {}, renderInputs() {}, solve() {},
  unitView: {text: String},
 });
 vm.runInContext(source.slice(source.indexOf('function defaults(id,'), source.indexOf('const $=')), context);
 vm.runInContext(source.slice(source.indexOf('function renderExamples(){'), source.indexOf('function knownRayleighData')), context);
 for (const id of ['fanno', 'rayleigh']) {
  const preset = context.defaults(id, {ductProblem: fannoRayleighMode});
  assert.equal(preset.bookExample, fannoRayleighExample);
  assert.equal(preset.M1, 3);
  context.id = id;
  context.inputs = {};
  context.renderExamples();
  assert.match(byId.get('examplesPanel').innerHTML, /Chapter 5 · Problem 3 · Fanno \+ Rayleigh/);
  byId.get('exampleSelect').onchange({target: {value: fannoRayleighExample}});
  assert.equal(context.inputs.ductProblem, fannoRayleighMode);
  assert.equal(context.inputs.bookExample, fannoRayleighExample);
  near(calculate(id, context.inputs).result.heatAdded, 87.463111);
 }
});
