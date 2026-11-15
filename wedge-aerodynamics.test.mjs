import test from 'node:test';import assert from 'node:assert/strict';
import {solveWedge} from './wedge-cone.js';import {calculate,defaults} from './labs.js';
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('Zero-incidence wedge face coefficients recover the independent NASA pressure reference',()=>{
 const a=solveWedge({M:2.5,thetaCone:15,gamma:1.4}).aerodynamics;
 // NASA NPARC analytic p2/p1 = 2.467500 (rounded), axial-length × span reference.
 const cp=2*(2.467500-1)/(1.4*2.5**2);near(a.Cpu,cp,1e-7);near(a.Cpl,cp,1e-7);near(a.CD,.17975563,1e-7);near(a.CL,0);
 assert.equal(a.status,'ok');assert.match(a.referenceArea,/Axial reference length/);
});
test('Incidence reflection swaps surface Cp, reverses lift and preserves drag',()=>{
 for(const alpha of [3,8]){const a=solveWedge({M:3,thetaCone:5,wedgeAlpha:alpha}).aerodynamics,b=solveWedge({M:3,thetaCone:5,wedgeAlpha:-alpha}).aerodynamics;near(a.CD,b.CD);near(a.CL,-b.CL);near(a.Cpu,b.Cpl);near(a.Cpl,b.Cpu);assert.ok(a.CD>0&&a.CL>0);}
 assert.ok(solveWedge({M:3,thetaCone:5,wedgeAlpha:8}).aerodynamics.Cpu<0);
 near(solveWedge({M:3,thetaCone:5,wedgeAlpha:5}).aerodynamics.Cpu,0);
});
test('Thin small-angle wedge approaches linearized wave drag and lift',()=>{
 const theta=.01,alpha=.005,t=theta*Math.PI/180,a=alpha*Math.PI/180,z=solveWedge({M:3,thetaCone:theta,wedgeAlpha:alpha}).aerodynamics;
 assert.ok(Math.abs(z.CD/(4*(t*t+a*a)/Math.sqrt(8))-1)<.001);assert.ok(Math.abs(z.CL/(4*a/Math.sqrt(8))-1)<.001);
});
test('Detached face does not produce an invented net force coefficient',()=>{
 const w=solveWedge({M:2,thetaCone:20,wedgeAlpha:10});assert.equal(w.status,'partial');assert.equal(w.aerodynamics.CD,null);assert.equal(w.aerodynamics.CL,null);assert.equal(w.aerodynamics.Cpl,null);assert.ok(Number.isFinite(w.aerodynamics.Cpu));
});
test('Wedge outputs include the coefficients across free and nearby-wall modes, excluding pure cone',()=>{
 const x={...defaults('cone'),bodyGeometry:'Wedge',M:3,thetaCone:5,wedgeAlpha:0};
 for(const nearbyWall of ['None','Below wedge','Above wedge','Both walls']){const d=calculate('cone',{...x,nearbyWall,wallDistance:1}),a=d.result.wedge.aerodynamics;for(const [key,value]of [['C_D',a.CD],['C_L',a.CL],['upper-surface C_p',a.Cpu],['lower-surface C_p',a.Cpl]]){const r=d.rows.find(r=>r.label.endsWith(key));assert.ok(r);near(r.value,value);}}
 const compare=calculate('cone',{...x,bodyGeometry:'Compare both'});assert.ok(compare.rows.some(r=>r.label==='Wedge pressure-drag coefficient C_D'));
 const cone=calculate('cone',{...x,bodyGeometry:'Cone'});assert.ok(!cone.rows.some(r=>r.label.includes('Wedge pressure-drag')));
});
