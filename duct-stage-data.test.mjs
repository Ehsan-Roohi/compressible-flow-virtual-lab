import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate, defaults, inputDefinitions} from './labs.js';
import {fannoRatios} from './physics.js';
import {ductData, ductStageValue} from './duct-stage-data.js';
import {changeDuctStageData, fannoRayleighOrder, rayleighFannoOrder, rayleighFannoPreset} from './fanno-rayleigh.js';

const run = (id, changes = {}) => calculate(id, {...defaults(id), ...rayleighFannoPreset, ...changes});
const near = (actual, expected, tolerance = 1e-8) => assert.ok(
 Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const {geometry, friction, heat, mach, pressure, temperature, stagnationTemperature} = ductData;

test('Both orders and both modules accept all independent pairs of known data', () => {
 for (const id of ['rayleigh', 'fanno']) {
  for (const ductStageOrder of [fannoRayleighOrder, rayleighFannoOrder]) {
   const baseline = run(id, {ductStageOrder});
   for (const rayKnown of [heat, mach, pressure, temperature, stagnationTemperature]) {
    const thermal = changeDuctStageData(baseline.inputs, 'rayleighStageData', rayKnown, baseline.result);
    for (const fannoKnown of [geometry, friction, mach, pressure, temperature]) {
     const inputs = changeDuctStageData(thermal, 'fannoStageData', fannoKnown, baseline.result);
     const actual = calculate(id, inputs);
     assert.equal(actual.result.stations.length, 3);
     for (const [index, {state}] of actual.result.stations.entries()) {
      const expected = baseline.result.stations[index].state;
      for (const key of ['M', 'T', 'p', 'T0', 'p0']) near(state[key], expected[key]);
     }
     near(actual.result.heatAdded, 35);
     near(actual.result.frictionLength, baseline.result.frictionLength);
     assert.ok(Object.values(actual.checks).every(value => value < 1e-9));
    }
   }
  }
 }
});

test('Rayleigh static temperature can produce two distinct admissible subsonic outlets', () => {
 const base = {M1:.5, fannoStageData:friction, fannoStageValue:.001};
 const specified = run('rayleigh', {...base, rayleighStageData:mach, rayleighStageValue:.8});
 const ratio = ductStageValue(specified.result, 'Rayleigh', temperature);
 const config = {...base, rayleighStageData:temperature, rayleighStageValue:ratio};
 const low = run('rayleigh', {...config, rayleighStaticTemperatureRoot:'Lower Mach'});
 const high = run('fanno', {...config, rayleighStaticTemperatureRoot:'Higher Mach'});
 near(low.result.junction.M, .8);
 near(high.result.junction.M, 1 / (1.4 * .8));
 near(low.result.junction.T, high.result.junction.T);
 assert.notEqual(low.result.heatAdded, high.result.heatAdded);
 assert.throws(() => run('rayleigh', {...config, rayleighStageValue:3}), {code:'rayleigh-temperature'});
});

test('Connected ducts reject a Rayleigh branch crossing and a Fanno outlet away from Mach 1', () => {
 assert.throws(() => run('rayleigh', {rayleighStageData:mach, rayleighStageValue:.7}), {code:'rayleigh-outlet'});
 assert.throws(() => run('fanno', {fannoStageData:mach, fannoStageValue:3}), {code:'fanno-outlet'});
 for (const branch of ['Subsonic', 'Supersonic']) {
  const inputs = {...rayleighFannoPreset, ductStageOrder:fannoRayleighOrder,
   fannoStageData:friction, fannoStageValue:fannoRatios(3).F, rayleighCoolingBranch:branch, q:-15};
  const solved = run('fanno', inputs);
  near(solved.result.junction.M, 1);
  assert.equal(solved.result.s2.M < 1, branch === 'Subsonic');
  assert.ok(inputDefinitions('fanno', solved.inputs).some(field => field.key === 'rayleighCoolingBranch'));
 }
});

test('Only the active known-data inputs appear and the joint sonic mode retains friction inputs', () => {
 for (const id of ['fanno', 'rayleigh']) {
  const fields = inputDefinitions(id, {...defaults(id), ...rayleighFannoPreset,
   rayleighStageData:temperature, fannoStageData:pressure});
  const keys = fields.map(field => field.key);
  assert.ok(keys.includes('rayleighStaticTemperatureRoot'));
  assert.ok(keys.includes('rayleighStageValue') && keys.includes('fannoStageValue'));
  assert.ok(!keys.includes('q') && !keys.includes('ductLength'));
  assert.deepEqual(fields.find(field => field.key === 'fannoStageData').options,
   [geometry, friction, mach, pressure, temperature]);
  assert.deepEqual(fields.find(field => field.key === 'rayleighStageData').options,
   [heat, mach, pressure, temperature, stagnationTemperature]);

  const sonic = inputDefinitions(id, {...defaults(id), ...rayleighFannoPreset, fannoRayleighOutlet:'Sonic outlet'});
  assert.deepEqual(sonic.find(field => field.key === 'fannoStageData').options, [geometry, friction]);
  assert.ok(!sonic.some(field => field.key === 'rayleighStageData'));
 }
});
