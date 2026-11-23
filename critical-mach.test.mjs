import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareCriticalMach, criticalMachMethods, solveCriticalMach} from './critical-mach.js';
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
 assert.deepEqual(inputDefinitions(id).map(({key}) => key), ['gamma', 'minimumIncompressibleCp', 'compressibilityCorrection']);
 const inputs = defaults(id);
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
 const settings = defaults(id);
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
