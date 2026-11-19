import {test} from 'node:test';
import assert from 'node:assert/strict';
import {state} from './physics.js';
import {foundationExampleEntries, foundationExerciseRows, foundationExerciseNotice} from './foundation-exercises.js';

const [wing, euler] = foundationExampleEntries.map(entry => entry.inputs);
const solve = inputs => state(inputs.M, inputs.T1, 1000 * inputs.p1, inputs.gamma, inputs.R);
function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9 * Math.max(1, Math.abs(expected)), `${actual} vs ${expected}`);
}

test('wing example recovers the printed drop and responds to the live wing speed', () => {
  const result = solve(wing);
  near(result.u, 44.7);
  near(result.rho, 1.225);
  const [pressure, drop, percentage] = foundationExerciseRows(wing, result);
  const expected = 0.5 * 1.225 * (67 ** 2 - 44.7 ** 2);
  near(drop.value, expected);
  near(pressure.value, (101325 - expected) / 1000);
  assert.equal(percentage.value.toFixed(3), '1.506');
  const stagnant = foundationExerciseRows({...wing, wingSpeed: 0}, result);
  assert.ok(stagnant[1].value < 0);
});

test('the Bernoulli estimate enforces its low-Mach domain without losing the underlying gas state', () => {
  const result = solve(wing);
  for (const wingSpeed of [NaN, -1, result.a]) {
    const inputs = {...wing, wingSpeed};
    assert.ok(foundationExerciseNotice(inputs, result));
    assert.deepEqual(foundationExerciseRows(inputs, result), []);
  }
  assert.deepEqual(foundationExerciseRows(wing, solve({...wing, M: 0.5})), []);
  assert.deepEqual(foundationExerciseRows({}, result), []);
});

test('Euler exercise recovers the conserved state, fluxes and characteristic speeds with dimensions', () => {
  const rows = foundationExerciseRows(euler, solve(euler));
  const a = Math.sqrt(140000), u = 2 * a;
  const expected = [1, u, 530000, u, 660000, u * 630000, a, u, 3 * a];
  rows.forEach((r,i) => near(r.value, expected[i]));
  assert.deepEqual(rows.map(r => r.unit), ['kg/m³','kg/(m²·s)','J/m³','kg/(m²·s)','Pa','W/m²','m/s','m/s','m/s']);
  const varied = {...euler, gamma: 1.2, p1: 80, M: 0.4};
  const state2 = solve(varied), updated = foundationExerciseRows(varied, state2);
  near(updated[2].value, 80000/0.2 + 0.5 * state2.rho * state2.u ** 2);
  assert.ok(updated[6].value < 0);
});
