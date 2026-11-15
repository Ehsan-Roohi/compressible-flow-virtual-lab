import test from 'node:test';import assert from 'node:assert/strict';
import {airfoilGeometry,diamondInputValues,diamondModes,solveAirfoil} from './airfoil.js';import {defaults,inputDefinitions} from './labs.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('All three Diamond definitions reproduce an off-centre mirrored geometry and its forces',()=>{
 const x={...defaults('airfoil'),upperSegments:[{angle:8,length:.35}]},ref=solveAirfoil(x),values=diamondInputValues(ref.geometry);
 for(const geometryInput of diamondModes){const data={...x,...values,geometryInput},z=solveAirfoil(data);
  ref.geometry.upper.forEach((p,i)=>{near(p.x,z.geometry.upper[i].x);near(p.y,z.geometry.upper[i].y);near(z.geometry.lower[i].y,-p.y);});
  for(const model of ['linear','nonlinear'])for(const k of ['CL','CD','CM'])near(z[model][k],ref[model][k]);
  assert.equal(inputDefinitions('airfoil',data).filter(f=>f.key.startsWith('diamond')).length,2);
 }
});
test('Impossible panel-length triangles, outside-chord peaks and invalid angles are rejected',()=>{
 const x={...defaults('airfoil'),geometryInput:'Length ratios'};
 for(const [diamondFrontLength,diamondRearLength]of [[.4,.4],[.5,.5],[1.2,.1],[2,2],[1.1,.2]])assert.throws(()=>airfoilGeometry({...x,diamondFrontLength,diamondRearLength}));
 assert.throws(()=>airfoilGeometry({...x,geometryInput:'Angles',diamondFrontAngle:0}));
 assert.throws(()=>airfoilGeometry({...x,geometryInput:'Angle & length ratio',diamondFrontAngle:8,diamondFrontLength:1.2}));
});
