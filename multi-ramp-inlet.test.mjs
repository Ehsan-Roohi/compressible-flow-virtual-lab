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
 const a=solveMultiRamp(x()),b=solveMultiRamp({...x(),inletReference:3,inletUpperWallRatio:.5,inletLowerWallRatio:2});
 near(b.geometry.cowl,3*a.geometry.cowl);near(b.geometry.lower[1].a[0],3*a.geometry.lower[1].a[0]);near(b.final.M,a.final.M);near(b.geometry.upperWall.a[1],b.geometry.upperWall.b[1]);near(b.geometry.lowerWall.a[1],b.geometry.lowerWall.b[1]);near(b.geometry.upperWall.b[0]-b.geometry.upperWall.a[0],.5*b.geometry.wedgeLength);near(b.geometry.lowerWall.b[0]-b.geometry.lowerWall.a[0],2*b.geometry.wedgeLength);assert.ok(b.geometry.end>=6);
 const c=solveMultiRamp({...x(),inletLowerSegments:[{angle:5,length:.3},{angle:10,length:.3},{angle:15,length:.4}]});assert.equal(c.waves.length,3);assert.equal(Object.keys(c.regions).length,5);
});
test('invalid cowl clearance, crossed walls, detached shocks and invalid lengths fail explicitly',()=>{
 for(const patch of [{inletLowerWallRatio:0},{inletUpperWallRatio:-1},{inletHeightRatio:.1},{inletHeightRatio:2},{inletCowlRatio:.1},{inletLowerSegments:[{angle:70,length:1}]},{inletLowerSegments:[{angle:7,length:0}]}])assert.throws(()=>solveMultiRamp({...x(),...patch}));
});
test('integration exposes ratio editors and only a numbered pressure–theta plot',()=>{
 const d=calculate('wall',x()),plots=plotOptions(d);assert.ok(d.result.multiRamp);assert.equal(plots.length,1);assert.equal(plots[0].chart.markers.length,4);assert.equal(d.shockDetails.length,3);
 const fields=inputDefinitions('wall',x());assert.ok(fields.some(f=>f.key==='inletLowerSegments'));assert.ok(fields.some(f=>f.key==='inletUpperWallRatio'));assert.ok(fields.some(f=>f.key==='inletLowerWallRatio'));assert.ok(!fields.some(f=>f.key==='inletUpperSegments'));assert.ok(!fields.some(f=>f.key==='wallSegments'));
 for(const q of ['pressure','mach','temperature','density','speed'])assert.doesNotMatch(multiRampDrawing(d.result,x(),q).svg,/NaN|undefined|Infinity/);
 const r=solveMultiRamp({...x(),inletTerminal:'None'});assert.equal(r.normal,null);assert.equal(Object.keys(r.regions).length,3);
});

test('horizontal walls accept half/equal/double wedge length and remain independent of wedge breaks',()=>{for(const a of [.5,1,2])for(const b of [.5,1,2]){const r=solveMultiRamp({...x(),inletUpperWallRatio:a,inletLowerWallRatio:b}),g=r.geometry;near(g.upperWall.b[0]-g.upperWall.a[0],a*g.wedgeLength);near(g.lowerWall.b[0]-g.lowerWall.a[0],b*g.wedgeLength);near(g.upperWall.a[0],0);near(g.upperWall.a[1],g.upperWall.b[1]);near(g.lowerWall.a[1],g.lowerWall.b[1]);const svg=multiRampDrawing(r,x()).svg;assert.match(svg,/data-solid="segmented-wedge"/);assert.match(svg,/data-solid="upper-horizontal-wall"/);assert.doesNotMatch(svg,/NaN|undefined|Infinity/);}});
