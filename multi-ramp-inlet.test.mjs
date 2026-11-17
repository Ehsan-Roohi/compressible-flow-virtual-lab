import test from 'node:test';
import assert from 'node:assert/strict';
import {multiRampPreset,solveMultiRamp,multiRampDrawing} from './multi-ramp-inlet.js';
import {defaults,calculate,inputDefinitions} from './labs.js';
import {plotOptions} from './plot-options.js';
const x=()=>({...defaults('wall'),...multiRampPreset});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} vs ${b}`);
test('Problem 6–1 inlet sequences use absolute wall angles and normal shock conservation',()=>{
 const a=solveMultiRamp({...x(),inletLowerSegments:[{angle:15,length:1}]}),b=solveMultiRamp(x());
 near(a.final.p/1000,112.44402009);near(b.final.p/1000,117.01439127);
 near(b.waves[1].turn*180/Math.PI,8);assert.ok(b.final.p0>b.s1.p0*.74&&b.final.p0>a.final.p0);
 for(const r of [a,b]){near(r.final.T0,r.s1.T0);near(r.pre.rho*r.pre.u,r.final.rho*r.final.u);near(r.pre.p+r.pre.rho*r.pre.u**2,r.final.p+r.final.rho*r.final.u**2);assert.ok(r.final.M<1);}
});
test('relative lengths scale geometry while upper and lower segment chains remain editable',()=>{
 const a=solveMultiRamp(x()),b=solveMultiRamp({...x(),inletReference:3,inletUpperSegments:[{angle:15,length:.2},{angle:10,length:.8}]});
 near(b.geometry.cowl,3*a.geometry.cowl);near(b.geometry.lower[1].a[0],3*a.geometry.lower[1].a[0]);near(b.final.M,a.final.M);assert.equal(b.geometry.upper.length,2);assert.ok(b.geometry.end>4);
 const c=solveMultiRamp({...x(),inletLowerSegments:[{angle:5,length:.3},{angle:10,length:.3},{angle:15,length:.4}]});assert.equal(c.waves.length,3);assert.equal(Object.keys(c.regions).length,5);
});
test('invalid cowl clearance, crossed walls, detached shocks and invalid lengths fail explicitly',()=>{
 for(const patch of [{inletHeightRatio:.1},{inletHeightRatio:2},{inletCowlRatio:.1},{inletLowerSegments:[{angle:70,length:1}]},{inletLowerSegments:[{angle:7,length:0}]}])assert.throws(()=>solveMultiRamp({...x(),...patch}));
});
test('integration exposes ratio editors and only a numbered pressure–theta plot',()=>{
 const d=calculate('wall',x()),plots=plotOptions(d);assert.ok(d.result.multiRamp);assert.equal(plots.length,1);assert.equal(plots[0].chart.markers.length,4);assert.equal(d.shockDetails.length,3);
 const fields=inputDefinitions('wall',x());assert.ok(fields.some(f=>f.key==='inletLowerSegments'));assert.ok(fields.some(f=>f.key==='inletUpperSegments'));assert.ok(!fields.some(f=>f.key==='wallSegments'));
 for(const q of ['pressure','mach','temperature','density','speed'])assert.doesNotMatch(multiRampDrawing(d.result,x(),q).svg,/NaN|undefined|Infinity/);
 const r=solveMultiRamp({...x(),inletTerminal:'None'});assert.equal(r.normal,null);assert.equal(Object.keys(r.regions).length,3);
});
