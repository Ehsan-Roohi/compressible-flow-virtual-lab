import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate, defaults} from './labs.js';
import {plotOptions} from './plot-options.js';
import {chartSVG} from './graphics.js';
import {nozzleBookInputs, nozzleBookPlotKey} from './nozzle-book.js';

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

test('example 8–4 matches its fixed pressure profile and shows both styles when the curves coincide', () => {
  const [comparison] = plots();
  assert.equal(comparison.key, nozzleBookPlotKey);
  const [live, book] = comparison.chart.series;
  assert.deepEqual(live.points, book.points);
  assert.ok(Math.abs(book.points.at(-1)[1] - 0.5) < 1e-9);
  assert.ok(shockPosition(book.points) < 1);
  const view = chartSVG(comparison.chart);
  assert.equal(view.axis.ymin, 0);
  assert.equal(view.axis.ymax, 1);
  assert.ok(!live.dash && book.dash);
  assert.ok(view.svg.includes(`stroke-dasharray="${book.dash}"`));
  assert.ok(view.legend.includes(`stroke-dasharray="${book.dash}"`));
});

test('raising back pressure moves the current shock upstream while the example stays fixed', () => {
  const reference = plots()[0].chart.series[1].points;
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
