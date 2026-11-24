import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareCriticalMach, criticalMachMethods, solveCriticalMach} from './critical-mach.js';
import {automaticPressure, manualPressure, readPublishedPressure} from './critical-mach-pressure.js';
import {publishedPressureAngles} from './critical-mach-data.js';
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
 const id = 'critical-mach', inputs = {...defaults(id), criticalAlpha: 2.9, compressibilityCorrection: compareCriticalMach};
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
 assert.equal(match.alpha, 2.9);
 assert.equal(match.source.tunnelAlpha, 4);
 assert.equal(match.measuredCp, -1.25);
 assert.equal(match.cp, -1.25 * Math.sqrt(1 - .059 ** 2));
 const {result} = calculate(id, inputs, match);
 assert.equal(result.pressureInput.kind, 'published');
 for (const method of result.corrections) {
  assert.equal(method.mach, solveCriticalMach(match.cp, inputs.gamma, method.method).mach);
 }
 assert.equal(await readPublishedPressure({...inputs, criticalAlpha: 3}, read), null);
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

test('the new sources supply measured minima at the documented angles', async () => {
 const id = 'critical-mach';
 const cases = [
  {code: '0012', alpha: 4, cp: -1.11383, x: .02333, side: 'upper', label: /Bristol/, download: /71156013$/},
  {code: '0018', alpha: 8, cp: -2.29, x: .019, side: 'upper', label: /Waterloo/, download: /#page=93$/},
  {code: '2412', alpha: -3.9, cp: -1.72, x: .02, side: 'lower', label: /digitized/, download: /#page=27$/},
  {code: '2412', alpha: .2, cp: -.52, x: .15, side: 'upper', label: /digitized/, download: /#page=27$/},
  {code: '2412', alpha: 12.4, cp: -6.07, x: .008, side: 'upper', label: /digitized/, download: /#page=28$/},
  {code: '4415', alpha: 4, cp: -1.358, x: .124, side: 'upper', label: /Ohio State/, download: /n4415\.zip/},
  {code: '4415', alpha: -4, cp: -1.665, x: .014, side: 'lower', label: /Ohio State/, download: /n4415\.zip/},
 ];
 let downloads = 0;
 const read = async () => { downloads++; throw Error('Offline'); };
 for (const {code, alpha, cp, x, side, label, download} of cases) {
  const inputs = {...defaults(id), criticalNacaCode: code, criticalAlpha: alpha};
  const measurement = await readPublishedPressure(inputs, read);
  assert.equal(measurement.measuredCp, cp);
  assert.equal(measurement.cp, cp * Math.sqrt(1 - measurement.source.mach ** 2));
  assert.equal(measurement.x, x);
  assert.equal(measurement.side, side);
  assert.match(measurement.source.label, label);
  assert.match(measurement.source.dataUrl, download);
  assert.equal(calculate(id, inputs, measurement).result.pressureInput.kind, 'published');
 }
 const inputs = {...defaults(id), criticalNacaCode: '2412', criticalAlpha: 4};
 assert.equal(await readPublishedPressure(inputs, read), null);
 assert.equal(calculate(id, inputs).result.pressureInput.alpha, 4);
 assert.equal(downloads, 0);
 assert.deepEqual(publishedPressureAngles('0012'), [0, 4, 5, 6, 7, 8, 9, 10]);
 assert.deepEqual(publishedPressureAngles('0018'), [0, 2, 4, 6, 8, 10]);
 assert.deepEqual(publishedPressureAngles('2412'), [-3.9, .2, 4.3, 8.3, 12.4]);
 assert.deepEqual(publishedPressureAngles('4415'), [-8.1, -6, -4, -2.1, 0, 2.1, 4, 6.2, 8.1]);
});

const aspireFixture = (mach, nearNose = 0) => {
 const branch = Array.from({length: 11}, (_, i) => [nearNose + (1 - nearNose) * i / 10, i === 2 ? -1.1 : 0]);
 const lower = branch.map(([x, cp], i) => [x, i === 3 ? -1.6 : cp]);
 return [`,${mach}`, ...[...branch.reverse(), ...lower.slice(1)].map(row => row.join(','))].join('\n');
};

test('ASPIRE reads both surfaces and uses the Mach in the CSV rather than the rounded file tag', async () => {
 const inputs = {...defaults('critical-mach'), criticalNacaCode: 'NACA 0015', criticalAlpha: 0};
 const read = async url => {
  assert.match(url, /NACA%200015_A0_M0\.13_Re1\.5e6_A\.csv$/);
  return aspireFixture(.12);
 };
 const match = await readPublishedPressure(inputs, read);
 assert.equal(match.source.mach, .12);
 assert.equal(match.source.reynolds, 1.5e6);
 assert.equal(match.measuredCp, -1.6);
 assert.equal(match.side, 'lower');
 assert.equal(match.x, .3);
 assert.deepEqual(publishedPressureAngles('23012'), [-6.32, -.27, 2.7, 5.74, 8.83, 12.05]);
 assert.equal(await readPublishedPressure({...inputs, criticalAlpha: .1}, read), null);
 assert.equal(await readPublishedPressure(inputs, async () => aspireFixture(.12, .15)), null);
 assert.equal(await readPublishedPressure(inputs, async () => aspireFixture(.4)), null);
});

test('the alternate report for 4412 runs after an unavailable primary source', async () => {
 const inputs = {...defaults('critical-mach'), criticalAlpha: 1.2};
 const requests = [];
 const match = await readPublishedPressure(inputs, async url => {
  requests.push(url);
  if (url.endsWith('experiment-reference.json')) throw Error('Offline');
  return aspireFixture(.051);
 });
 assert.equal(requests.length, 2);
 assert.match(requests[1], /TR-563\/NACA%204412_A2\.0_M0\.05_Re3\.1e6_A_NACA%20TR-563\.csv$/);
 assert.equal(match.source.mach, .051);
 assert.equal(match.alpha, 1.2);
 assert.equal(match.source.tunnelAlpha, 2);
 assert.match(match.source.label, /TR-563/);
});

test('NACA 4412 does not use a geometric tunnel angle as its 2D angle', async () => {
 const id = 'critical-mach', inputs = {...defaults(id), criticalAlpha: 4};
 assert.deepEqual(publishedPressureAngles('4412'), [-11, -10.9, -10.8, -7.5, -7.4, -7.3, -7.2, -5.7, -5.6, -5.4, -4, -3.9, -3.7, -2.3, -2.2, -2, -.6, -.5, 1.2, 2.9, 6.3, 6.4, 9.9, 10, 13.8]);
 let requests = 0;
 const published = await readPublishedPressure(inputs, async () => { requests++; });
 assert.equal(requests, 0);
 assert.equal(published, null);
 const {result} = calculate(id, inputs, published);
 assert.equal(result.pressureInput.kind, 'panel');
 assert.equal(result.pressureInput.alpha, 4);
 assert.ok(Math.abs(result.pressureInput.cp - (-1.37406)) < 1e-5);
});

test('Pinkerton table data retain the effective Reynolds number and geometric angle', async () => {
 const inputs = {...defaults('critical-mach'), criticalAlpha: -10.8};
 const match = await readPublishedPressure(inputs);
 assert.equal(match.source.tunnelAlpha, -12);
 assert.equal(match.alpha, -10.8);
 assert.equal(match.source.effectiveReynolds, true);
 assert.equal(match.source.reynolds, 3.4e6);
 assert.equal(match.x, .0036);
 assert.equal(match.measuredCp, -7.407);
 assert.equal(match.side, 'lower');
 assert.match(match.source.dataUrl, /#page=16$/);
 const overlap = await readPublishedPressure({...inputs, criticalAlpha: -7.4}, async () => { throw Error('Offline'); });
 assert.equal(overlap.alpha, -7.4);
 assert.equal(overlap.source.reynolds, 1.8e6);
 assert.equal(overlap.measuredCp, -4.018);
});

test('missing, unavailable and mismatched measurements fall back to the existing Wing AeroStruct panel solution', async () => {
 const id = 'critical-mach', inputs = {...defaults(id), criticalAlpha: -.6};
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
