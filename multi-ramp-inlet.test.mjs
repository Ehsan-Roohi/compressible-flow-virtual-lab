import test from 'node:test';
import assert from 'node:assert/strict';
import {multiRampPreset,multiRampProblemPreset,solveMultiRamp,multiRampDrawing} from './multi-ramp-inlet.js';
import {defaults,calculate,inputDefinitions} from './labs.js';
import {plotOptions} from './plot-options.js';
const x=()=>({...defaults('wall'),...multiRampProblemPreset});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} vs ${b}`);
test('Problem 6–1 inlet sequences use absolute wall angles and normal shock conservation',()=>{
 const a=solveMultiRamp({...x(),inletLowerSegments:[{angle:15,length:1}]}),b=solveMultiRamp(x());
 near(a.final.p/1000,112.44402009);near(b.final.p/1000,117.01439127);
 near(b.waves[1].turn*180/Math.PI,8);assert.ok(b.final.p0>b.s1.p0*.74&&b.final.p0>a.final.p0);
 for(const r of [a,b]){near(r.final.T0,r.s1.T0);near(r.pre.rho*r.pre.u,r.final.rho*r.final.u);near(r.pre.p+r.pre.rho*r.pre.u**2,r.final.p+r.final.rho*r.final.u**2);assert.ok(r.final.M<1);}
});
test('relative lengths scale geometry while wedge segments remain editable',()=>{
 const a=solveMultiRamp(x()),b=solveMultiRamp({...x(),inletReference:3,inletUpperWallRatio:.5,inletUpperStartRatio:.5});
 near(b.geometry.cowl,3*a.geometry.cowl);near(b.geometry.lower[1].a[0],3*a.geometry.lower[1].a[0]);near(b.final.M,a.final.M);near(b.geometry.upperWall.a[1],b.geometry.upperWall.b[1]);near(b.geometry.upperWall.b[0]-b.geometry.upperWall.a[0],.5*b.geometry.wedgeLength);near(b.geometry.upperWall.a[0],.5*b.geometry.wedgeLength);
 const c=solveMultiRamp({...x(),inletLowerSegments:[{angle:5,length:.3},{angle:10,length:.3},{angle:15,length:.4}]});assert.equal(c.waves.length,3);assert.equal(Object.keys(c.regions).length,5);
});
test('invalid cowl clearance, crossed walls, detached shocks and invalid lengths fail explicitly',()=>{
 for(const patch of [{inletUpperStartRatio:-1},{inletUpperWallRatio:-1},{inletHeightRatio:.1},{inletHeightRatio:2},{inletCowlRatio:.1},{inletLowerSegments:[{angle:70,length:1}]},{inletLowerSegments:[{angle:7,length:0}]}])assert.throws(()=>solveMultiRamp({...x(),...patch}));
});
test('integration exposes ratio editors and only a numbered pressure–theta plot',()=>{
 const d=calculate('wall',x()),plots=plotOptions(d);assert.ok(d.result.multiRamp);assert.equal(plots.length,1);assert.equal(plots[0].chart.markers.length,4);assert.equal(d.shockDetails.length,3);
 const fields=inputDefinitions('wall',x());assert.ok(fields.some(f=>f.key==='inletLowerSegments'));assert.ok(fields.some(f=>f.key==='inletUpperWallRatio'));assert.ok(fields.some(f=>f.key==='inletUpperStartRatio'));assert.ok(!fields.some(f=>f.key==='inletLowerWallRatio'));assert.ok(!fields.some(f=>f.key==='inletUpperSegments'));assert.ok(!fields.some(f=>f.key==='wallSegments'));
 for(const q of ['pressure','mach','temperature','density','speed'])assert.doesNotMatch(multiRampDrawing(d.result,x(),q).svg,/NaN|undefined|Infinity/);
 const r=solveMultiRamp({...x(),inletTerminal:'None'});assert.equal(r.normal,null);assert.equal(Object.keys(r.regions).length,3);
});

test('single upper wall length and start are independent and the lower wall is absent',()=>{for(const length of [.5,1,2])for(const start of [0,.5,1]){const x1={...x(),inletUpperWallRatio:length,inletUpperStartRatio:start},r=solveMultiRamp(x1),g=r.geometry;near(g.upperWall.b[0]-g.upperWall.a[0],length*g.wedgeLength);near(g.upperWall.a[0],start*g.wedgeLength);near(g.upperWall.a[1],g.upperWall.b[1]);const svg=multiRampDrawing(r,x1).svg;assert.match(svg,/data-solid="segmented-wedge"/);assert.match(svg,/data-solid="upper-horizontal-wall"/);assert.doesNotMatch(svg,/lower-horizontal-wall|NaN|undefined|Infinity/);}});

test('Example 6–9 in the common inlet mode computes the regular reflected shock without a normal shock',()=>{
 const x={...defaults('wall'),...multiRampPreset},d=calculate('wall',x),r=d.result;
 assert.equal(r.wallReflections,true);assert.equal(r.normal,null);assert.deepEqual(Object.keys(r.regions),['1','2','3']);
 near(r.regions[2].M,1.713743932037159);near(r.regions[3].M,1.4370356540871854);near(r.regions[3].theta,0);
 near(r.reflectionLocation,1.3169674970779564);assert.equal(d.shockDetails.length,2);assert.equal(plotOptions(d).length,1);
 assert.ok(!inputDefinitions('wall',x).some(f=>f.key==='inletCowlRatio'));
 assert.ok(r.reflectionField.cells.length>0);assert.ok(!r.reflectionField.partial);assert.doesNotMatch(multiRampDrawing(r,x).svg,/NaN|undefined|Infinity/);
});
test('obsolete normal-shock position cannot block a no-normal solution, including cleared and zero inputs',()=>{
 for(const station of [0,NaN,undefined,-1])for(const mode of ['Wall reflections','Compression only','None']){
  const r=solveMultiRamp({...multiRampPreset,inletTerminal:mode,inletCowlRatio:station});assert.equal(r.normal,null);assert.ok(r.final.M>1);
 }
 const d=calculate('wall',{...defaults('wall'),...multiRampProblemPreset});assert.ok(inputDefinitions('wall',d.inputs).some(f=>f.key==='inletCowlRatio'));
});
test('short finite walls still return the incident solution instead of failing a missing-reflection condition',()=>{
 const r=solveMultiRamp({...multiRampPreset,inletUpperWallRatio:.5});assert.equal(r.normal,null);assert.equal(r.reflectionLocation,null);assert.ok(r.regions[2]);assert.match(r.note,/No reflection/);
});
test('multi-corner inlet wall solver follows accepted reflections and preserves admissible results',()=>{
 const x={...multiRampPreset,M1:3,inletLowerSegments:[{angle:3,length:.5},{angle:6,length:.5}],inletHeightRatio:.2},r=solveMultiRamp(x);
 assert.ok(Object.keys(r.regions).length>=3);assert.ok(r.reflectionField.cells.length>0);assert.equal(r.normal,null);assert.doesNotMatch(multiRampDrawing(r,x).svg,/NaN|undefined|Infinity/);
});

test('a half-length upper wall cutting just beyond a wedge break solves its short final segment',()=>{const x={...multiRampProblemPreset,inletTerminal:'Wall reflections',inletUpperWallRatio:.5},r=solveMultiRamp(x);assert.ok(r.reflectionField.cells.length>0);assert.ok(r.regions[2]);assert.doesNotMatch(multiRampDrawing(r,x).svg,/NaN|undefined|Infinity/);});

test('wall start changes the actual reflection location and does not reflect at the removed upstream wall',()=>{const base=solveMultiRamp(multiRampPreset),late=solveMultiRamp({...multiRampPreset,inletUpperStartRatio:.75}),beyond=solveMultiRamp({...multiRampPreset,inletUpperStartRatio:1});near(base.reflectionLocation,1.3169674970779564);near(late.reflectionLocation,1.5);near(late.regions[3].M,base.regions[3].M);near(beyond.reflectionLocation,2);near(beyond.final.M,base.regions[3].M);assert.ok(!late.reflectionField.partial);assert.ok(!beyond.reflectionField.partial);});

test('a shock meeting the upper wall after the finite wedge ends is reflected and marched to the wall exit',()=>{const x={...multiRampPreset,inletReference:1,inletHeightRatio:.8,inletUpperWallRatio:3},r=solveMultiRamp(x);assert.ok(r.reflections[0].x>r.geometry.tip[0]);near(r.reflections[0].x,1.053573997662365);near(r.reflections[0].after.M,1.4370356540871854);near(r.reflections[0].after.theta,0);near(r.reflectionField.end,r.geometry.upperWall.b[0]);assert.equal(r.reflectionField.partial,false);assert.equal(r.normal,null);assert.ok(r.waves.every(w=>w.kind!=='No wave'));});

test('successive upper-wall shocks each produce their own downstream state and satisfy shock conservation',()=>{const x={...multiRampPreset,M1:3,inletReference:1,inletHeightRatio:.3,inletLowerSegments:[{angle:2,length:.5},{angle:4,length:.5}],inletUpperWallRatio:4},r=solveMultiRamp(x);assert.equal(r.reflections.length,2);assert.ok(r.reflections[1].x>r.geometry.tip[0]);for(const e of r.reflections){near(e.after.theta,0);assert.ok(e.after.p>e.before.p);assert.ok(e.after.p0<e.before.p0);assert.equal(r.regions[e.region],e.after);}for(const w of r.waves.filter(w=>w.kind==='Oblique shock')){const a=w.before,b=w.after,d=Math.abs(w.turn),un=a.u*Math.sin(w.beta),vn=b.u*Math.sin(w.beta-d);assert.ok(Math.abs(a.rho*un/(b.rho*vn)-1)<1e-7);assert.ok(Math.abs((a.p+a.rho*un**2)/(b.p+b.rho*vn**2)-1)<1e-7);near(a.T0,b.T0);}near(r.reflectionField.end,4);assert.equal(r.reflectionField.partial,false);const svg=multiRampDrawing(r,x).svg;assert.doesNotMatch(svg,/NaN|undefined|Infinity/);const d=calculate('wall',{...defaults('wall'),...x});assert.equal(d.rows.find(r=>r.label==='Computed upper-wall reflections').value,2);});

test('below-side solution is a physical mirror: pressures and Mach agree, signed flow turns reverse',()=>{const x={...multiRampPreset,inletFlowSide:'Flow below wedge'},lower=solveMultiRamp(x),upper=solveMultiRamp(multiRampPreset);for(const [n,u] of Object.entries(upper.regions)){const l=lower.regions['L'+n];for(const k of ['M','p','T','rho','u','p0','T0'])near(l[k],u[k]);near(l.theta,-u.theta);}const d=calculate('wall',{...defaults('wall'),...x});assert.ok(d.rows.some(r=>r.label==='Lower · Computed lower-wall reflections'));assert.equal(d.shockDetails.length,2);const chart=plotOptions(d)[0].chart;assert.ok(chart.markers.some(m=>m.name==='L2'&&m.x<0));assert.doesNotMatch(multiRampDrawing(lower,x).svg,/NaN|undefined|Infinity/);});
test('both sides share the scale and use unique region numbers in the diagram, table and chart',()=>{const x={...multiRampPreset,inletFlowSide:'Both sides'},r=solveMultiRamp(x);assert.deepEqual(Object.keys(r.regions),['U1','U2','U3','L1','L2','L3']);near(r.regions.U3.M,r.regions.L3.M);const d=calculate('wall',{...defaults('wall'),...x}),chart=plotOptions(d)[0].chart;assert.equal(d.shockDetails.length,4);assert.equal(new Set(chart.markers.map(m=>m.name)).size,6);const svg=multiRampDrawing(r,x).svg;for(const n of Object.keys(r.regions))assert.ok(svg.includes('>'+n+'</text>'));assert.match(svg,/id="UmultiInletGas"/);assert.match(svg,/id="LmultiInletGas"/);assert.match(svg,/data-solid="lower-horizontal-wall"/);assert.doesNotMatch(svg,/NaN|undefined|Infinity/);});
test('independent lower inputs change only the lower solution and expose editable lower geometry',()=>{const x={...defaults('wall'),...multiRampPreset,inletFlowSide:'Both sides',inletLowerDefinition:'Independent lower side',inletBottomSegments:[{angle:-5,length:1}],inletLowerHeightRatio:.3,inletLowerWallLengthRatio:1.5,inletLowerStartRatio:.1},r=solveMultiRamp(x),upper=solveMultiRamp(multiRampPreset);near(r.regions.U3.M,upper.regions[3].M);assert.ok(Math.abs(r.regions.L3.M-r.regions.U3.M)>.01);assert.ok(r.regions.L2.theta<0);const f=inputDefinitions('wall',x);for(const k of ['inletBottomSegments','inletLowerHeightRatio','inletLowerWallLengthRatio','inletLowerStartRatio'])assert.ok(f.some(f=>f.key===k));const below=solveMultiRamp({...x,inletFlowSide:'Flow below wedge',inletHeightRatio:0});assert.ok(below.regions.L3);assert.ok(!inputDefinitions('wall',{...x,inletFlowSide:'Flow below wedge'}).some(f=>f.key==='inletLowerSegments'));});
test('both-side normal-shock estimates retain the exercise pressure and physical signed angles',()=>{const x={...defaults('wall'),...multiRampProblemPreset,inletFlowSide:'Both sides'},d=calculate('wall',x);near(d.result.regions.U4.p/1000,117.0143912669);near(d.result.regions.L4.p,d.result.regions.U4.p);near(d.result.regions.L4.theta,-d.result.regions.U4.theta);assert.equal(d.shockDetails.length,6);assert.ok(d.shockDetails.every(s=>!s.title.includes('NaN')));assert.doesNotMatch(multiRampDrawing(d.result,x).svg,/NaN|undefined|Infinity/);});
