import test from 'node:test';
import assert from 'node:assert/strict';
import {solvePistonShocks,pistonExperiment} from './piston-shocks.js';
import {calculate,defaults,inputDefinitions} from './labs.js';
import {plotOptions} from './plot-options.js';
import {sceneSVG,chartSVG} from './graphics.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b}`);
const book={...defaults('tube'),unsteadyExperiment:pistonExperiment,fluid:'Custom gas',gamma:1.667,R:2077,T1:300,p1:100,pistonSpeed1:25,pistonSpeed2:50,pistonDelay:1};

test('Example 7–3 agrees with full-precision independent moving-shock solution',()=>{
 const r=solvePistonShocks(book);
 near(r.first.speed,1035.9751549767186);near(r.second.speed,1069.3126549767187);
 near(r.regions[1].a,1027.5087095539564);near(r.catchTime,31.325463966305687);near(r.catchX,32452.40238721115);
 near(r.launchX,25);near(r.regions[1].u,25);near(r.regions[2].u,50);
 for(const v of Object.values(r.checks))assert.ok(v<1e-12);
});

test('both shocks independently satisfy moving-control-surface conservation for several gases',()=>{
 for(const [gamma,R] of [[1.4,287],[1.667,2077],[1.289,188.9]])for(const [u,v] of [[25,50],[100,300],[1000,1200]]){
  const r=solvePistonShocks({...book,gamma,R,pistonSpeed1:u,pistonSpeed2:v});
  for(const w of [r.first,r.second]){
   const a=w.before,b=w.after,C=w.speed,cp=gamma*R/(gamma-1),rel=(x,y)=>Math.abs(x-y)/Math.max(1,Math.abs(x),Math.abs(y));
   assert.ok(rel(a.rho*(C-a.u),b.rho*(C-b.u))<1e-12);
   assert.ok(rel(a.p+a.rho*(C-a.u)**2,b.p+b.rho*(C-b.u)**2)<1e-12);
   assert.ok(rel(cp*a.T+(C-a.u)**2/2,cp*b.T+(C-b.u)**2/2)<1e-12);
   assert.ok(b.T>a.T&&b.p>a.p&&b.rho>a.rho&&C>b.u);
  }
  const end2=r.launchX+r.second.speed*(r.catchTime-r.delay);near(end2,r.catchX,1e-6);
  assert.ok(r.catchTime>r.delay&&r.pistonCatchX<r.catchX);
 }
});

test('delay scales catch-up; initial pressure changes only dimensional states',()=>{
 const r=solvePistonShocks(book),z=solvePistonShocks({...book,pistonDelay:2.5,p1:250});
 near(z.catchTime,2.5*r.catchTime);near(z.catchX,2.5*r.catchX);near(z.first.speed,r.first.speed);near(z.second.speed,r.second.speed);
 near(z.regions[2].p,2.5*r.regions[2].p);near(z.regions[2].T,r.regions[2].T);
});

test('interface provides piston inputs and two consistent trajectories without chamber fields',()=>{
 const d=calculate('tube',book),keys=inputDefinitions('tube',book).map(f=>f.key);
 for(const k of ['pistonSpeed1','pistonSpeed2','pistonDelay','p1','T1'])assert.ok(keys.includes(k));
 for(const k of ['p4','T4','tubeInput','shockRatio','driverRatio','inducedSpeed'])assert.ok(!keys.includes(k));
 const plots=plotOptions(d);assert.equal(plots.length,2);
 const full=plots[0].chart,early=plots[1].chart;
 assert.equal(full.ylabel,'Time t (s)');assert.deepEqual(full.series[1].points[0],[25,1]);
 assert.deepEqual(full.series[0].points.at(-1),full.series[1].points.at(-1));
 assert.equal(early.series[0].points.at(-1)[1],2);
 const svg=sceneSVG(d.scene,d.inputs).svg;assert.ok(svg.includes('Shock 1')&&svg.includes('Shock 2')&&svg.includes('not to scale'));assert.ok(!svg.includes('NaN'));
 assert.ok(chartSVG(full).svg.includes('Catch-up'));assert.equal(d.result.referenceTable.columns.length,3);
 const normal=inputDefinitions('tube',defaults('tube')).map(f=>f.key);assert.ok(normal.includes('p4'));assert.ok(!normal.includes('pistonSpeed1'));
 assert.ok(!calculate('tube',defaults('tube')).result.twoStagePiston);
});

test('rejects speed decreases, nonpositive delay, and invalid states',()=>{
 for(const extra of [{pistonSpeed2:25},{pistonSpeed2:20},{pistonSpeed1:0},{pistonDelay:0},{pistonDelay:NaN},{T1:-1},{p1:0},{pistonSpeed2:Infinity}])assert.throws(()=>solvePistonShocks({...book,...extra}));
});
