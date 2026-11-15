import test from 'node:test';import assert from 'node:assert/strict';
import {calculate,defaults} from './labs.js';import {airfoilFieldSampler,airfoilContour,probeAirfoilField} from './airfoil-field.js';import {sceneSVG} from './graphics.js';import {plotOptions} from './plot-options.js';import {prandtlMeyer} from './physics.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('Airfoil contours expose six distinct physical quantities and no chart',()=>{
 const d=calculate('airfoil',defaults('airfoil'));assert.deepEqual(plotOptions(d),[]);
 for(const key of ['pressure','mach','temperature','density','speed','cp']){const v=sceneSVG(d.scene,d.inputs,0,key);assert.equal(v.field.quantity,key);assert.ok(Number.isFinite(v.field.min)&&v.field.max>v.field.min);assert.ok(v.svg.includes(`data-airfoil-contour="${key}"`));assert.ok(!v.svg.includes('SUPERSONIC AIRFOIL'));assert.ok(!v.svg.includes('surface regions'));}
});
test('Uniform regions, fan interior and matched wake retain their calculated states',()=>{
 const r=calculate('airfoil',defaults('airfoil')).result,sample=airfoilFieldSampler(r).sample;
 near(sample(-.1,.1).M,r.freestream.M);assert.equal(sample(.5,0),null);
 const p=r.geometry.panels[0],x=(p.a.x+p.b.x)/2,y=(p.a.y+p.b.y)/2+.005;
 const z=sample(x,y);near(z.M,r.nonlinear.panels[0].M);near(z.p,r.nonlinear.panels[0].p);
 const w=r.nonlinear.waves.find(w=>w.kind==='Expansion fan'&&w.side==='Upper'),M=(w.before.M+w.after.M)/2,turn=prandtlMeyer(M,r.gamma)-prandtlMeyer(w.before.M,r.gamma),theta=w.before.theta-turn,angle=theta+Math.asin(1/M),f=sample(w.origin.x+.15*Math.cos(angle),w.origin.y+.15*Math.sin(angle));
 assert.equal(f.region,'Expansion fan');near(f.p0,w.before.p0);near(f.T0,w.before.T0);
 for(const [sign,side]of [[1,'upper'],[-1,'lower']]){const z=sample(1.3,Math.tan(r.trailingEdge.phi)*.3+sign*.005);near(z.p,r.trailingEdge[side].after.p);near(z.M,r.trailingEdge[side].after.M);}
 assert.ok(probeAirfoilField(r,84+x*350,150-y*350));
});
test('Linearized-only model does not invent dimensional exterior states',()=>{
 const d=calculate('airfoil',{...defaults('airfoil'),airfoilMethod:'Linearized theory'});assert.equal(airfoilFieldSampler(d.result),null);assert.equal(airfoilContour(d.result),null);assert.deepEqual(sceneSVG(d.scene,d.inputs).field.options,['cp']);
});
test('Intersecting wave families are left unresolved rather than assigned a fabricated contour',()=>{
 const r=calculate('airfoil',{...defaults('airfoil'),airfoilShape:'Custom panels',airfoilFieldMode:'Local analytical · resolved regions',alpha:0,upperSegments:[{angle:5,length:.2},{angle:10,length:.25}],lowerSegments:[{angle:-5,length:.2},{angle:-10,length:.25}]}).result;
 const [a,b]=r.nonlinear.waves.filter(w=>w.side==='Upper'),ma=Math.tan(a.before.theta+a.beta),mb=Math.tan(b.before.theta+b.beta),ix=(b.origin.y-a.origin.y+ma*a.origin.x-mb*b.origin.x)/(ma-mb),x=ix+.15,y=(a.origin.y+ma*(x-a.origin.x)+b.origin.y+mb*(x-b.origin.x))/2;
 assert.equal(airfoilFieldSampler(r).sample(x,y),null);
 const schematic={...r,airfoilFieldMode:'Schematic · independent waves'},filled=airfoilFieldSampler(schematic).sample(x,y);
 assert.ok(filled?.approximate&&filled.schematic);near(filled.p,b.after.p);near(filled.M,b.after.M);
 const d={...calculate('airfoil',defaults('airfoil')).result,airfoilFieldMode:'Schematic · independent waves'};assert.equal(airfoilFieldSampler(d).sample(.5,0),null);
 const view=sceneSVG({kind:'airfoil',...schematic},{});assert.match(view.field.note,/Approximate display; wave interactions are neglected/);
 assert.ok(airfoilContour(schematic).cells.length>airfoilContour(r).cells.length);
});

test('Schematic fans retain rainbow variation on both sides and disclose the local color scale',()=>{
 const x={...defaults('airfoil'),airfoilShape:'Custom panels',alpha:15,upperSegments:[{angle:5,length:.5},{angle:-4,length:.3}],lowerSegments:[{angle:0,length:.5}]};
 const d=calculate('airfoil',x),c=airfoilContour(d.result),fans=c.cells.filter(z=>Number.isFinite(z.fanColor));
 for(const upper of [true,false]){
  const colors=fans.filter(z=>upper?z.py<150:z.py>150).map(z=>z.fanColor);
  assert.ok(Math.min(...colors)<.1);assert.ok(Math.max(...colors)>.9);
 }
 const local=calculate('airfoil',{...x,airfoilFieldMode:'Local analytical · resolved regions'});
 assert.ok(airfoilContour(local.result).cells.every(z=>z.fanColor===undefined));
 const view=sceneSVG(d.scene,d.inputs);assert.match(view.svg,/data-airfoil-approximation="true"/);assert.match(view.svg,/fan colors use local rainbow scales/);assert.match(view.field.note,/read values with cursor/);
 assert.deepEqual(d.result.nonlinear,local.result.nonlinear);
});
