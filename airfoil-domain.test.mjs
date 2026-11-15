import test from 'node:test';import assert from 'node:assert/strict';
import {calculate,defaults} from './labs.js';import {airfoilDomain} from './airfoil-domain.js';import {airfoilContour,probeAirfoilField} from './airfoil-field.js';import {sceneSVG} from './graphics.js';
const a=Math.atan(.24)*180/Math.PI;
const preset={...defaults('airfoil'),airfoilShape:'Bent flat plate',plateDefinition:'Multiple panels',plateLengthMode:'Keep earlier lengths',M:2.5,alpha:4.2,upperSegments:[{angle:a,length:Math.hypot(.25,.06)},{angle:0,length:.5},{angle:-a,length:.25}]};
test('Three-panel contour ends before the lower shock enters the earlier expansion fan',()=>{
 const d=calculate('airfoil',preset),domain=airfoilDomain(d.result);
 assert.deepEqual(domain.hit.waves,['L1','L2']);assert.ok(Math.abs(domain.hit.x-.6769162033)<1e-8);assert.ok(domain.limit<domain.hit.x&&domain.limit>.65);
 const c=airfoilContour(d.result);assert.ok(c.cells.every(z=>(z.px+.5-84)/350<=domain.limit));
 assert.equal(probeAirfoilField(d.result,84+350*(domain.limit+.01),150),null);
 const v=sceneSVG(d.scene,d.inputs);assert.match(v.svg,/Geometry only/);assert.match(v.svg,/Contours stop before/);assert.ok(!v.svg.includes('data-trailing-interface'));
 assert.deepEqual(d.result.geometry.upper.at(-1),{x:1,y:0});assert.match(v.field.note,/Grey area: geometry only/);
});
test('One-sided rays from a common corner are not counted as an interaction',()=>{
 const d=calculate('airfoil',{...defaults('airfoil'),airfoilShape:'Flat plate',alpha:0}),domain=airfoilDomain(d.result);
 assert.equal(domain.hit,null);assert.equal(domain.clipped,false);assert.equal(domain.limit,(620-84)/350);
});
test('Display limit mirrors with the plate and does not change physical surface results',()=>{
 const d=calculate('airfoil',preset),mirror=calculate('airfoil',{...preset,alpha:-4.2,upperSegments:preset.upperSegments.map(p=>({...p,angle:-p.angle}))});
 assert.ok(Math.abs(airfoilDomain(d.result).limit-airfoilDomain(mirror.result).limit)<1e-9);
 const schematic=calculate('airfoil',{...preset,airfoilFieldMode:'Schematic · independent waves'});assert.deepEqual(d.result.nonlinear,schematic.result.nonlinear);assert.ok(airfoilContour(schematic.result).cells.length>airfoilContour(d.result).cells.length);
});
