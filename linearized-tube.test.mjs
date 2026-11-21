import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,defaults,inputDefinitions} from './labs.js';
import {finiteTubeMode} from './finite-tube.js';
import {plotOptions} from './plot-options.js';
import {sceneSVG} from './graphics.js';
import {movingShockSonicMach,tubeSolutionMethods} from './linearized-tube.js';
import {normalShock} from './physics.js';

const initial={...defaults('tube'),p1:100,p4:100.01,T1:300,T4:300,tubeDomain:finiteTubeMode};

test('Linearized and comparison modes use the same chamber data and acoustic state',()=>{
 const linear=calculate('tube',{...initial,tubeSolutionMethod:'Linearized'});
 const both=calculate('tube',{...initial,tubeSolutionMethod:'Compare both'});
 assert.equal(linear.result.finiteTube,undefined);
 assert.equal(both.result.finiteTube,true);
 const a=linear.result.acoustic,b=both.result.tubeComparison;
 assert.equal(a.pressure,b.pressure);
 assert.equal(a.velocity,b.velocity);
 assert.equal(a.chart.series.length,2);
 assert.equal(b.chart.series.length,6);
 assert.ok(Math.abs(b.rows[0].linear-b.rows[0].nonlinear)<1e-6);
 assert.ok(Math.abs(b.rows[1].linear-b.rows[1].nonlinear)<1e-5);
 assert.ok(b.end<=initial.finiteDrivenLength/both.result.incident.shockSpeed);
 assert.equal(plotOptions(both)[0].key,'tube-method-waves');
 assert.match(sceneSVG(linear.scene,linear.inputs).svg,/Linear acoustics/);
});

test('The acoustic approximation uses the chamber pressures resolved from inverse inputs',()=>{
 const x={...initial,tubeSolutionMethod:'Compare both',tubeInput:'Shock pressure ratio p₂/p₁',shockRatio:2,tubeInitialVelocity:-200};
 const d=calculate('tube',x);
 assert.ok(d.inputs.p4>x.p4);
 assert.ok(Math.abs(d.result.tubeComparison.pressure-500*(d.inputs.p4+d.inputs.p1))<1e-8);
 assert.ok(!d.rows.some(r=>r.label.startsWith('Critical shock Mach')));
 assert.deepEqual(inputDefinitions('tube',x).find(r=>r.key==='tubeSolutionMethod').options,tubeSolutionMethods);
 assert.ok(!inputDefinitions('tube',{...x,unsteadyExperiment:'Two-stage piston'}).some(r=>r.key==='tubeSolutionMethod'));
});

test('The moving-shock threshold gives unit downstream Mach in the laboratory',()=>{
 for(const gamma of [1.1,1.4,5/3,1.99]){
  const critical=movingShockSonicMach(gamma);
  const downstream=Ms=>{const jump=normalShock(Ms,gamma);return Ms*(1-1/jump.rho)/Math.sqrt(jump.T);};
  assert.ok(Math.abs(downstream(critical)-1)<1e-10);
  assert.ok(downstream(critical*.99)<1&&downstream(critical*1.01)>1);
 }
 assert.equal(movingShockSonicMach(2),null);
 const d=calculate('tube',{...initial,bookExample:'7–1',tubeSolutionMethod:'Nonlinear'});
 assert.equal(d.rows.find(r=>r.label.startsWith('Critical shock Mach')).value,movingShockSonicMach(1.4));
});
