import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareCriticalMach, criticalMachMethods, solveCriticalMach} from './critical-mach.js';
import {automaticPressure, manualPressure, readPublishedPressure} from './critical-mach-pressure.js';
import {calculate, chapters, defaults, inputDefinitions} from './labs.js';
import {chartSVG} from './graphics.js';
import {plotOptions} from './plot-options.js';

test('each Chapter 9 correction gives a distinct sonic crossing for the same pressure input', () => {
 const expected = [0.6235950054, 0.6032137495, 0.5771217558];
 const gamma = 1.4;
 for (const [i, method] of criticalMachMethods.entries()) {
  const result = solveCriticalMach(-.9, gamma, method);
  assert.ok(Math.abs(result.mach - expected[i]) < 1e-9);
  const mach = result.mach;
  const surfaceRatio = 1 + gamma * mach ** 2 * result.pressureCoefficient / 2;
  const sonicRatio = ((1 + (gamma - 1) * mach ** 2 / 2) / ((gamma + 1) / 2)) ** (gamma / (gamma - 1));
  assert.ok(Math.abs(surfaceRatio - sonicRatio) < 1e-12);
  for (const {points} of result.chart.series) {
   assert.ok(points.every(point => point.every(Number.isFinite)));
   assert.ok(points.some(([x, y]) => x === mach && y === result.pressureCoefficient));
  }
  assert.equal(result.chart.series[0].points[0][1], -.9);
 }
});

test('the critical Mach lab keeps the airfoil route first and exposes only its relevant inputs', () => {
 const chapter = chapters.find(([number]) => number === 9);
 assert.deepEqual(chapter[3], ['airfoil', 'critical-mach']);
 const id = 'critical-mach';
 assert.deepEqual(inputDefinitions(id).map(({key}) => key),
  ['gamma', 'criticalPressureSource', 'criticalNacaCode', 'criticalAlpha', 'compressibilityCorrection']);
 const inputs = {...defaults(id), criticalPressureSource: manualPressure};
 assert.deepEqual(inputDefinitions(id, inputs).map(({key}) => key),
  ['gamma', 'criticalPressureSource', 'minimumIncompressibleCp', 'compressibilityCorrection']);
 assert.equal(inputs.compressibilityCorrection, criticalMachMethods[0]);
 const data = calculate(id, inputs);
 assert.equal(data.rows[0].value, data.result.mach);
 assert.equal(data.rows[1].value, data.result.pressureCoefficient);
 assert.equal(plotOptions(data)[0].chart, data.chart);
 assert.throws(() => calculate(id, {...inputs, minimumIncompressibleCp: 0}), /negative value/);
 assert.throws(() => calculate(id, {...inputs, gamma: 1}), /greater than 1/);
});

test('comparison shows the same three solutions on one chart with a shared sonic curve', () => {
 const id = 'critical-mach';
 const settings = {...defaults(id), criticalPressureSource: manualPressure};
 assert.deepEqual(inputDefinitions(id).at(-1).options, [...criticalMachMethods, compareCriticalMach]);
 for (const [cp0, gamma] of [[-.9, 1.4], [-.01, 1.01], [-3, 2]]) {
  const data = calculate(id, {...settings, minimumIncompressibleCp: cp0, gamma, compressibilityCorrection: compareCriticalMach});
  const {corrections} = data.result;
  const {series, markers, yRange} = data.chart;
  assert.deepEqual(corrections.map(r => r.method), criticalMachMethods);
  assert.equal(series.length, 4);
  assert.equal(markers.length, 3);
  assert.equal(data.rows.length, 6);
  for (const [i, result] of corrections.entries()) {
   const single = solveCriticalMach(cp0, gamma, result.method);
   const crossing = [single.mach, single.pressureCoefficient];
   assert.deepEqual([result.mach, result.pressureCoefficient], crossing);
   assert.deepEqual([markers[i].x, markers[i].y], crossing);
   assert.equal(markers[i].color, series[i].color);
   const hasCrossing = ({points}) => points.some(([x, y]) => x === crossing[0] && y === crossing[1]);
   assert.ok(hasCrossing(series[i]) && hasCrossing(series.at(-1)));
   assert.ok(Math.abs(series[i].points.at(-1)[1] - yRange[0]) < 1e-7);
   assert.deepEqual(data.rows.slice(2 * i, 2 * i + 2).map(r => r.value), crossing);
  }
  const {svg, legend} = chartSVG(plotOptions(data)[0].chart);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
  for (const method of criticalMachMethods) {
   assert.ok(legend.includes(method));
   assert.ok(svg.includes(`<title>${method}</title>`));
  }
 }
});

test('automatic mode uses the minimum measured pressure of both surfaces at the exact angle', async () => {
 const id = 'critical-mach', inputs = {...defaults(id), criticalAlpha: 4, compressibilityCorrection: compareCriticalMach};
 const points = (min, at) => Array.from({length: 11}, (_, i) => [i / 10, i === at ? min : 0]);
 const fixture = JSON.stringify({source: {type: 'experiment'}, mach: .059, reynolds: 1.8e6, cases: [
  {alphaDeg: 2, branch1: points(-4, 3), branch2: points(-3, 4)},
  {alphaDeg: 4, branch1: points(-.9, 3), branch2: points(-1.25, 2)},
 ]});
 let requests = 0;
 const read = async url => {
  requests++;
  assert.match(url, /experiment-reference\.json$/);
  return fixture;
 };
 const match = await readPublishedPressure(inputs, read);
 assert.equal(match.side, 'lower');
 assert.equal(match.x, .2);
 assert.equal(match.measuredCp, -1.25);
 assert.equal(match.cp, -1.25 * Math.sqrt(1 - .059 ** 2));
 const {result} = calculate(id, inputs, match);
 assert.equal(result.pressureInput.kind, 'published');
 for (const method of result.corrections) {
  assert.equal(method.mach, solveCriticalMach(match.cp, inputs.gamma, method.method).mach);
 }
 assert.equal(await readPublishedPressure({...inputs, criticalAlpha: 4.1}, read), null);
 assert.equal(await readPublishedPressure({...inputs, criticalPressureSource: manualPressure}, read), null);
 assert.equal(requests, 1);
});

test('symmetric NACA 0012 uses the zero-angle zone without consuming the next angle', async () => {
 const inputs = {...defaults('critical-mach'), criticalNacaCode: '0012'};
 const points = Array.from({length: 11}, (_, i) => `${i / 10} ${i === 2 ? -.42 : 0}`).join('\n');
 const fixture = `# Upper surface only\nvariables="x/c","cp"\nzone, t="alpha=0"\n${points}\nzone, t="alpha=10"\n0.1 -5\n`;
 const match = await readPublishedPressure(inputs, async () => fixture);
 assert.equal(match.measuredCp, -.42);
 assert.equal(match.side, 'both');
 assert.equal(match.x, .2);
});

test('missing, unavailable and mismatched measurements fall back to the existing Wing AeroStruct panel solution', async () => {
 const id = 'critical-mach', inputs = defaults(id);
 const unavailable = await readPublishedPressure(inputs, async () => { throw Error('Offline'); });
 assert.equal(unavailable, null);
 const {result} = calculate(id, inputs, unavailable);
 assert.equal(result.pressureInput.kind, 'panel');
 assert.equal(result.pressureInput.panelsPerSide, 160);
 assert.ok(Math.abs(result.pressureInput.cp + .921) < .2);
 const other = {...inputs, criticalPressureSource: automaticPressure, criticalNacaCode: '0012', criticalAlpha: -2};
 const mismatched = {code: '4412', alpha: 0, cp: -4};
 const fallback = calculate(id, other, mismatched).result.pressureInput;
 assert.equal(fallback.kind, 'panel');
 assert.equal(fallback.side, 'lower');
 assert.equal(fallback.code, '0012');
 assert.notEqual(fallback.cp, mismatched.cp);
 assert.throws(() => calculate(id, {...inputs, criticalNacaCode: '0000'}), /thickness/);
 assert.throws(() => calculate(id, {...inputs, criticalAlpha: 16}), /angle of attack/);
});
