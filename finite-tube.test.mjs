import assert from 'node:assert/strict';
import test from 'node:test';
import {calculate,defaults,inputDefinitions} from './labs.js';
import {chartSVG} from './graphics.js';
import {plotOptions} from './plot-options.js';
import {finiteTubeDrawing,finiteTubeFrame,finiteTubeMode} from './finite-tube.js';

const near=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} vs ${expected}`);
const base={...defaults('tube'),tubeDomain:finiteTubeMode};

test('Example 7–12 gives the reflected-shock table and wall/contact trajectories',()=>{
 const d=calculate('tube',{...base,tubeInput:'Shock pressure ratio p₂/p₁',shockRatio:10,p1:100,T1:300,T4:300,finiteSampleX:0});
 const {reflected,wallTime,contactTime}=d.result;
 near(reflected.mach,2.09165,1e-5);
 near(reflected.pressureRatio,4.9375,1e-8);
 near(reflected.T,1387.588,.001);
 const line=d.chart.series.find(s=>s.name==='Reflected shock');
 assert.deepEqual(line.points[0],[6,wallTime*1000]);
 near(line.points[1][0],d.result.incident.u*contactTime,1e-10);
 assert.ok(d.rows.filter(r=>r.label.includes('Δh₀')).length===2);
});

test('Example 7–13 reproduces sample timings and evolves the flow after reflections from both ends',()=>{
 const d=calculate('tube',base),r=d.result;
 near(r.incident.p2p1,4.7386213857,1e-8);
 near(r.wallTime,.0084541513,1e-9);
 near(r.contactTime,.0111911116,1e-9);
 near(d.rows.find(row=>row.label==='Time between shock and contact at sample').value,2.4283264,1e-6);
 assert.ok(r.driverWallTime>r.contactTime);
 const initial=finiteTubeFrame(r,0),pre=finiteTubeFrame(r,.0065),reflection=finiteTubeFrame(r,.0105),end=finiteTubeFrame(r,r.end);
 near(initial.pressure[0],200000,1e-6);
 near(pre.pressure.at(-1),5000,10);
 near(reflection.pressure.at(-1),r.reflected.p,500);
 assert.ok(end.pressure.at(-1)>1.5*r.reflected.p);
 assert.ok(end.pressure[0]<initial.pressure[0]/2);
 assert.equal(end.time,.03);
 assert.ok(r.frames.every(f=>f.pressure.every(p=>Number.isFinite(p)&&p>0)&&f.density.every(z=>Number.isFinite(z)&&z>0)));
 assert.ok(r.checks.mass<1e-10&&r.checks.energy<1e-10);
 const plots=plotOptions(d,.02),map=plots.find(p=>p.key==='finite-map-pressure');
 assert.ok(plots.some(p=>p.key==='finite-sample-p'));
 assert.ok(plots.some(p=>p.key==='tube-profile-h0'));
 assert.doesNotMatch(chartSVG(map.chart).svg,/NaN|Infinity|undefined/);
 assert.match(finiteTubeDrawing(r,.02).svg,/Driven wall/);
});

test('finite geometry is conditional and simulation duration and geometry are validated',()=>{
 const keys=x=>inputDefinitions('tube',x).map(f=>f.key);
 assert.ok(keys(base).includes('finiteEndTime'));
 assert.ok(!keys(base).includes('tubeInitialVelocity'));
 assert.ok(!keys(defaults('tube')).includes('finiteEndTime'));
 assert.ok(!keys({...base,unsteadyExperiment:'Two-stage piston'}).includes('tubeDomain'));
 assert.throws(()=>calculate('tube',{...base,finiteSampleX:7}),/sample/);
 assert.throws(()=>calculate('tube',{...base,finiteEndTime:101}),/100 ms/);
 const short=calculate('tube',{...base,finiteEndTime:2,tubeInitialVelocity:-200});
 assert.equal(short.result.incident.initialVelocity,0);
 assert.equal(short.result.frames.at(-1).time,.002);
 assert.equal(short.chart.series.find(s=>s.name==='Reflected shock').points.length,0);
});
