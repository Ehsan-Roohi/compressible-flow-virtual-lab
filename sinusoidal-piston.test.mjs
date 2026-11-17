import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,defaults,inputDefinitions} from './labs.js';
import {sinusoidalPosition,sinusoidalVelocity,sinusoidalReference,finiteTubeDrawing} from './finite-tube.js';
import {plotOptions} from './plot-options.js';
import {chartSVG} from './graphics.js';

const preset={...defaults('tube'),unsteadyExperiment:'Sinusoidal piston',pistonEpsilon:.01,pistonFrequency:100,pistonCycles:1,
 pistonTubeLength:6,finiteEndTime:40,finiteCells:1200,p1:100,T1:300};
const near=(a,b,t)=>assert.ok(Math.abs(a-b)<t,`${a} vs ${b}`);

test('Example 10 reproduces the one-cycle piston law and its small-amplitude outgoing wave',()=>{
 const d=calculate('tube',preset),r=d.result,m=r.motion;
 near(sinusoidalVelocity(m,.0025),.01*r.a1,1e-10);
 near(sinusoidalVelocity(m,.0075),-.01*r.a1,1e-10);
 near(sinusoidalPosition(m,.005),2*m.amplitude/m.omega,1e-10);
 assert.equal(sinusoidalVelocity(m,.011),0);
 near(r.frames.at(-1).left,0,1e-10);
 near(sinusoidalReference(r,.5*r.a1*.01,.0075).u,m.amplitude,1e-10);
 assert.ok(d.rows.find(row=>row.label==='Velocity RMS error / peak piston velocity').value<.015);
 assert.ok(d.rows.find(row=>row.label==='Pressure RMS error / linear pressure amplitude').value<.015);
 assert.ok(r.checks.mass<1e-10&&r.checks.energy<1e-10);
 const charts=plotOptions(d,.0075);
 for(const key of ['tube-profile-sine-u','tube-profile-sine-p']){
  const chart=charts.find(o=>o.key===key).chart;
  assert.equal(chart.series.length,2);
  assert.doesNotMatch(chartSVG(chart).svg,/NaN|undefined|Infinity/);
 }
 assert.ok(!plotOptions(d,.04).some(o=>o.key==='tube-profile-sine-u'));
 assert.match(finiteTubeDrawing(r,.0075).svg,/Piston · u = -3.47/);
 const fields=inputDefinitions('tube',preset).map(f=>f.key);
 assert.ok(fields.includes('pistonFrequency')&&fields.includes('pistonEpsilon')&&!fields.includes('pistonSpeed2'));
 assert.throws(()=>calculate('tube',{...preset,pistonTubeLength:.005}),/gap/);
});

test('lower amplitude approaches the book solution and reflected waves reverse at the fixed wall',()=>{
 const d=calculate('tube',{...preset,pistonEpsilon:.005}),r=d.result;
 assert.ok(d.rows.find(row=>row.label==='Velocity RMS error / peak piston velocity').value<.01);
 const at=t=>r.frames.reduce((a,b)=>Math.abs(a.time-t)<Math.abs(b.time-t)?a:b);
 const endCell=f=>f.pressure.at(-1);
 assert.ok(endCell(at(.020))>100000);
 assert.ok(endCell(at(.025))<100000);
 assert.ok(r.frames.every(f=>f.pressure.every(p=>p>0)&&f.density.every(v=>v>0)));
});
