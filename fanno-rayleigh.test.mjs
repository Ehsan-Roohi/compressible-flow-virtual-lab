import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {calculate, defaults, inputDefinitions} from './labs.js';
import {sceneSVG} from './graphics.js';
import {plotOptions} from './plot-options.js';
import {fannoSystemMode} from './fanno-system.js';
import {fannoRatios} from './physics.js';
import {fannoRayleighMode, fannoRayleighPreset, fannoRayleighExample, fannoRayleighOrder, rayleighFannoOrder, rayleighFannoPreset, rayleighFannoExample, stagedDuctDefaults, changeDuctStageOrder, specifiedRayleighHeat} from './fanno-rayleigh.js';
import {heatedFrictionMode,heatedFrictionPreset,heatedFrictionExample} from './heated-friction-duct.js';

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

test('Both labs load the correct default and example for each stage order', () => {
 const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
 const byId = new Map(['examplesPanel', 'exampleSelect'].map(key => [key, {}]));
 const context = vm.createContext({
  $: key => byId.get(key), experimentDefaults: defaults, id: 'fanno', inputs: {},
  fannoRayleighMode, fannoRayleighPreset, fannoRayleighExample, rayleighFannoPreset, rayleighFannoExample, stagedDuctDefaults,
  heatedFrictionMode, heatedFrictionPreset, heatedFrictionExample,
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
  assert.equal(preset.ductStageOrder, fannoRayleighOrder);
  context.id = id;
  context.inputs = {};
  context.renderExamples();
  assert.match(byId.get('examplesPanel').innerHTML, /<option value="5–P3"[^>]*>Fanno \+ Rayleigh<\/option>/);
  byId.get('exampleSelect').onchange({target: {value: fannoRayleighExample}});
  assert.equal(context.inputs.ductProblem, fannoRayleighMode);
  assert.equal(context.inputs.bookExample, fannoRayleighExample);
  near(calculate(id, context.inputs).result.heatAdded, 87.463111);

  assert.match(byId.get('examplesPanel').innerHTML, /Rayleigh → Fanno · Known heat and friction/);
  const reverse = context.defaults(id, {ductProblem: fannoRayleighMode, ductStageOrder: rayleighFannoOrder});
  assert.equal(reverse.bookExample, rayleighFannoExample);
  assert.equal(reverse.fannoRayleighOutlet, specifiedRayleighHeat);
  assert.equal(reverse.q, 35);
  byId.get('exampleSelect').onchange({target: {value: rayleighFannoExample}});
  assert.equal(context.inputs.bookExample, rayleighFannoExample);
  const {result} = calculate(id, context.inputs);
  assert.equal(result.heatAdded, 35);
  assert.equal(result.status, 'ok');
  near(result.frictionLength, 4 * .005 * 3.3 / .305);
  near(result.junction.M, 2.412738325438113);
  near(result.s2.M, 1.667445471100574);
  assert.match(byId.get('examplesPanel').innerHTML, /<optgroup label="Simultaneous heat \+ friction">.*Example 1 · Constant wall temperature<\/option><\/optgroup>/);
  assert.doesNotMatch(byId.get('examplesPanel').innerHTML, /Shapiro|§8\.9/);
  assert.equal(context.defaults(id, {ductProblem:heatedFrictionMode}).bookExample, heatedFrictionExample);
  byId.get('exampleSelect').onchange({target: {value:heatedFrictionExample}});
  assert.equal(context.inputs.ductProblem, heatedFrictionMode);
  near(calculate(id, context.inputs).result.s2.M, .52921683144586);
 }
});

test('Changing the order switches the default examples and keeps custom inputs', () => {
 const forward = stagedDuctDefaults(fannoRayleighOrder);
 const reverse = changeDuctStageOrder(forward, rayleighFannoOrder);
 assert.equal(reverse.bookExample, rayleighFannoExample);
 assert.equal(reverse.fannoRayleighOutlet, specifiedRayleighHeat);
 assert.equal(reverse.q, 35);
 assert.equal(changeDuctStageOrder(reverse, fannoRayleighOrder).bookExample, fannoRayleighExample);

 const custom = {...reverse, frictionFactor:.006, q:40};
 assert.deepEqual(changeDuctStageOrder(custom, fannoRayleighOrder),
  {...custom, ductStageOrder:fannoRayleighOrder, bookExample:''});
});

test('Rayleigh first applies the heat at the inlet and reaches Mach 1 in the Fanno section', () => {
 const reversed = {ductStageOrder: rayleighFannoOrder};
 const fanno = run('fanno', reversed);
 assert.deepEqual(fanno.result, run('rayleigh', reversed).result);
 const {result, chart} = fanno;
 assert.deepEqual(result.stageNames, ['Rayleigh', 'Fanno']);
 near(result.junction.M, 1.724790101485795);
 near(result.heatAdded, 102.29229809932018);
 near(fannoRatios(result.junction.M).F, result.frictionLength, 1e-12);
 assert.equal(result.s2.M, 1);
 near(result.junction.T0, result.s2.T0);
 assert.ok(Object.values(fanno.checks).every(error => error < 1e-11));
 assert.deepEqual(chart.series.map(series => series.name), ['Rayleigh · 1 → 2', 'Fanno · 2 → 3']);
 assert.deepEqual(chart.series[0].points.at(-1), chart.series[1].points[0]);
 assert.equal(result.longitudinal.find(point => point.x === .5).state, result.junction);
});

test('Both form layouts and the heat arrow move with the chosen order', () => {
 for (const id of ['fanno', 'rayleigh']) {
  const forward = run(id);
  const reversed = run(id, {ductStageOrder: rayleighFannoOrder});
  const headings = d => inputDefinitions(id, {...d.inputs, fannoRayleighOutlet:specifiedRayleighHeat}).map(field => field.section).filter(Boolean);
  assert.deepEqual(headings(forward).slice(-2), ['Fanno section · 1 → 2', 'Rayleigh section · 2 → 3']);
  assert.deepEqual(headings(reversed).slice(-2), ['Rayleigh section · 1 → 2', 'Fanno section · 2 → 3']);
  assert.deepEqual(inputDefinitions(id, reversed.inputs).find(field => field.key === 'ductStageOrder').options,
   [fannoRayleighOrder, rayleighFannoOrder]);
  const picture = sceneSVG(reversed.scene, reversed.inputs).svg;
  assert.match(picture, /data-duct-stage="Rayleigh".*data-duct-stage="Fanno"/);
  assert.match(picture, /data-heat-transfer="into-duct".*M232\.5 72V116/);
  const axial = plotOptions(reversed).find(option => option.key === 'fanno-rayleigh-axial-mach');
  assert.match(axial.note, /first half represents the Rayleigh section/);
 }
});

test('Reversing the sections allows prescribed heat and detects limits in the correct stage', () => {
 const reversed = {ductStageOrder: rayleighFannoOrder};
 const heated = {...reversed, fannoRayleighOutlet: specifiedRayleighHeat};
 const d = run('rayleigh', {...heated, q: 35});
 assert.equal(d.result.heatAdded, 35);
 assert.ok(d.result.junction.M < d.result.s1.M && d.result.s2.M < d.result.junction.M && d.result.s2.M > 1);
 assert.throws(() => run('fanno', {...heated, q: 120}), {code: 'length-limit'});
 assert.throws(() => run('rayleigh', {...heated, q: 400}), {code: 'heat-limit'});
 assert.throws(() => run('rayleigh', {...reversed, ductLength: 20}), {code: 'length-limit'});
 const cooled = run('fanno', {...reversed, M1: 1.6});
 assert.ok(cooled.result.heatAdded < 0);
 assert.match(sceneSVG(cooled.scene, cooled.inputs).svg, /data-heat-transfer="out-of-duct"/);
 assert.equal(run('rayleigh', {...reversed, ductLength: 0}).result.s2.M, 1);
});

test('Rayleigh first supports subsonic flow and both cooling branches from a sonic inlet', () => {
 const reversed = {ductStageOrder: rayleighFannoOrder};
 const sub = run('rayleigh', {...reversed, M1: .5});
 assert.ok(sub.result.junction.M > .5 && sub.result.junction.M < 1);
 assert.equal(sub.result.s2.M, 1);
 for (const branch of ['Subsonic', 'Supersonic']) {
  const d = run('fanno', {...reversed, M1: 1, rayleighCoolingBranch: branch});
  assert.ok(d.result.heatAdded < 0);
  assert.equal(d.result.s2.M, 1);
  assert.equal(d.result.junction.M < 1, branch === 'Subsonic');
  assert.ok(inputDefinitions('fanno', d.inputs).some(field => field.key === 'rayleighCoolingBranch'));
 }
});
