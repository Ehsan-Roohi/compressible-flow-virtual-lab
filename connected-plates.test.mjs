import {createUnitView} from './unit-system.js';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';import vm from'node:vm';
import {calculate,defaults,inputDefinitions}from'./labs.js';import {connectedSurface,automaticSurface,constrainedSurface,segmentSurface,migrateAirfoilGeometry,airfoilGeometry}from'./airfoil.js';import{airfoilView}from'./airfoil-view.js';import{probeAirfoilField}from'./airfoil-field.js';import{sceneSVG}from'./graphics.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const preset={...defaults('airfoil'),airfoilShape:'Connected flat plates',M:3,alpha:4.2,upperSegments:[{angle:8,length:.6},{angle:-5,length:.4},{angle:3,length:.7}]};
test('Independent panel angles and metre lengths form an exact chain with a free endpoint',()=>{
 const d=calculate('airfoil',preset),g=d.result.geometry;assert.deepEqual(g.upper,g.lower);assert.equal(g.panels.length,6);
 let x=0,y=0;for(const [i,p]of preset.upperSegments.entries()){x+=p.length*Math.cos(p.angle*Math.PI/180);y+=p.length*Math.sin(p.angle*Math.PI/180);near(g.connectedPlate.physical[i+1].x,x);near(g.connectedPlate.physical[i+1].y,y);near(g.panels[i].length*g.connectedPlate.reference,p.length);near(g.panels[i].theta*180/Math.PI,p.angle);}
 assert.ok(Math.abs(y)>.01);near(g.upper.at(-1).y,y/x);assert.equal(d.result.nonlinear.status,'ok');assert.equal(d.result.trailingEdge.status,'ok');
 for(const w of d.result.trailingEdge.waves)assert.deepEqual(w.origin,g.upper.at(-1));
 const v=airfoilView(d.result),p=g.upper[1],z=probeAirfoilField(d.result,v.leadingX+p.x*v.scale/2,v.originY-(p.y/2+.002)*v.scale);assert.equal(z.region,'U1');
 const fields=inputDefinitions('airfoil',preset);assert.equal(fields.find(f=>f.key==='alpha').label,'Inlet flow angle α');assert.ok(!fields.some(f=>f.key==='lowerSegments'||f.key==='plateLengthMode'));
 assert.match(sceneSVG(d.scene,d.inputs).svg,/exact input geometry/);
});
test('View fits elevated or descending chains and invalid panel data is rejected',()=>{
 for(const angle of [-60,60]){const g=connectedSurface([{angle,length:1},{angle:angle/2,length:1}]),v=airfoilView({geometry:{upper:g.points,connectedPlate:g}});for(const p of g.points){const y=v.originY-v.scale*p.y;assert.ok(y>=46&&y<=234);}}
 for(const a of [[],[{angle:90,length:1}],[{angle:5,length:-1}]])assert.throws(()=>connectedSurface(a));
});
test('Chain editor has editable length fields and appends rather than rescaling panels',()=>{
 const source=readFileSync(new URL('./app.js',import.meta.url),'utf8'),elements=new Map(),button={},input={dataset:{index:'1',property:'length'},value:'1.2',readOnly:false};
 const box={querySelector(s){if(s==='.segment-add')return button;if(!elements.has(s))elements.set(s,{});return elements.get(s);},querySelectorAll(s){return s==='input'?[input]:[];}};
 const context=vm.createContext({unitView:createUnitView(),displayValue:value=>String(value),inputs:structuredClone(preset),$:()=>box,fmt:String,connectedSurface,automaticSurface,constrainedSurface,segmentSurface,migrateAirfoilGeometry,airfoilGeometry,request:0,schedule(){},renderInputs(){}});
 vm.runInContext(source.slice(source.indexOf('function segmentEditor('),source.indexOf('function changeAirfoilGeometry(')),context);
 const html=context.segmentEditor({key:'upperSegments'});assert.ok(!html.includes('readonly'));assert.match(html,/Length \(m\)/);assert.ok(!html.includes('Target L/c'));
 context.bindSegmentEditor({key:'upperSegments'});input.oninput();assert.equal(context.inputs.upperSegments[1].length,1.2);assert.match(elements.get('[data-closure-message]').textContent,/No automatic closure/);
 button.onclick();assert.equal(context.inputs.upperSegments.length,4);assert.equal(context.inputs.upperSegments[1].length,1.2);assert.equal(context.inputs.upperSegments[3].length,.7);
});


test('Bent is absent from the menu and saved Bent geometries migrate without changing their path',()=>{
 const fields=inputDefinitions('airfoil',defaults('airfoil')),shape=fields.find(f=>f.key==='airfoilShape');assert.ok(!shape.options.includes('Bent flat plate'));
 for(const old of [
  {...defaults('airfoil'),airfoilShape:'Bent flat plate',bendHeight:.16,bendPosition:.4},
  {...defaults('airfoil'),airfoilShape:'Bent flat plate',plateDefinition:'Multiple panels',upperSegments:[{angle:8,length:.3},{angle:0,length:.4},{angle:-8,length:.3}]}
 ]){
  const before=airfoilGeometry(old),migrated=migrateAirfoilGeometry(old),after=airfoilGeometry(migrated);assert.equal(migrated.airfoilShape,'Connected flat plates');assert.equal(before.upper.length,after.upper.length);
  before.upper.forEach((p,i)=>{near(p.x,after.upper[i].x);near(p.y,after.upper[i].y);});
 }
});
