import {readFileSync} from 'node:fs';import vm from 'node:vm';
import test from 'node:test';import assert from 'node:assert/strict';
import {calculate,defaults,inputDefinitions} from './labs.js';import {airfoilGeometry,constrainedSurface,automaticSurface,segmentSurface,surfaceSegments} from './airfoil.js';import {airfoilFieldSampler} from './airfoil-field.js';import {sceneSVG} from './graphics.js';import {plotOptions} from './plot-options.js';
const preset={...defaults('airfoil'),airfoilShape:'Bent flat plate',M:2.5,alpha:4.2,bendHeight:.12,bendPosition:.5,airfoilMethod:'Shock–Expansion'};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)));
test('Example 6–15 is a zero-thickness cambered two-panel plate closed at the trailing edge',()=>{
 const d=calculate('airfoil',preset),g=d.result.geometry;
 assert.deepEqual(g.upper,g.lower);assert.deepEqual(g.upper,[{x:0,y:0},{x:.5,y:.12},{x:1,y:0}]);assert.equal(g.panels.length,4);
 near(g.panels[0].theta,Math.atan(.24));near(g.panels[1].theta,-Math.atan(.24));
 assert.equal(d.result.nonlinear.status,'ok');assert.equal(d.result.trailingEdge.status,'ok');assert.ok(Number.isFinite(d.result.nonlinear.CL)&&d.result.nonlinear.CD>0);
 const kinds=d.result.nonlinear.waves.map(w=>w.kind);assert.deepEqual(kinds,['Oblique shock','Expansion fan','Expansion fan','Oblique shock']);
 const sample=airfoilFieldSampler(d.result).sample;assert.equal(sample(.25,.061).region,'U1');assert.equal(sample(.25,.059).region,'L1');
 const fields=inputDefinitions('airfoil',preset).map(f=>f.key);assert.ok(!fields.includes('bendHeight')&&!fields.includes('bendPosition'));for(const k of ['upperSegments','lowerSegments','thickness','upperProfile','geometryInput'])assert.ok(!fields.includes(k));
 assert.deepEqual(plotOptions(d),[]);const v=sceneSVG(d.scene,d.inputs);assert.ok(v.svg.includes('h/c = 0.12'));assert.deepEqual(new Set(v.field.options),new Set(['pressure','mach','temperature','density','speed','cp']));
});
test('Bent geometry allows an off-center bend and rejects invalid height or position',()=>{
 const g=airfoilGeometry({...preset,bendPosition:.4,bendHeight:.08});assert.deepEqual(g.upper[1],{x:.4,y:.08});assert.deepEqual(g.upper,g.lower);assert.deepEqual(g.upper.at(-1),{x:1,y:0});
 for(const patch of [{bendHeight:.31},{bendPosition:0},{bendPosition:NaN}])assert.throws(()=>airfoilGeometry({...preset,...patch}),/Bent plate/);
 const flat=airfoilGeometry({...preset,bendHeight:0});assert.ok(flat.upper.every(p=>p.y===0));
});


test('Example dropdown loads connected plates with the textbook input values',()=>{
 const source=readFileSync(new URL('./app.js',import.meta.url),'utf8'),start=source.indexOf('function renderExamples(){'),end=source.indexOf('\nfunction knownRayleighData',start),elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);};let solves=0;
 const context=vm.createContext({$,id:'airfoil',inputs:defaults('airfoil'),defaults,stopSweep(){},renderInputs(){},solve(){solves++;},sweepFinished:false,sweepPositioned:false,request:0});
 vm.runInContext(source.slice(start,end),context);context.renderExamples();assert.match($('examplesPanel').innerHTML,/<option value="6–15"[^>]*>Example (?:6–)?15/);
 $('exampleSelect').onchange({target:{value:'6–15'}});assert.equal(solves,1);
 for(const [k,v]of Object.entries({airfoilShape:'Connected flat plates',M:2.5,alpha:4.2,bookExample:'6–15'}))assert.equal(context.inputs[k],v);
 context.renderExamples();assert.match($('examplesPanel').innerHTML,/zero[- ]thickness/i);
});

test('Reversing bend height and incidence swaps sides and reverses lift',()=>{
 const a=calculate('airfoil',preset).result,b=calculate('airfoil',{...preset,bendHeight:-.12,alpha:-4.2}).result;
 near(a.nonlinear.CL,-b.nonlinear.CL);near(a.nonlinear.CD,b.nonlinear.CD);
 for(let i=0;i<2;i++){near(a.nonlinear.panels[i].p,b.nonlinear.panels[i+2].p);near(a.nonlinear.panels[i].M,b.nonlinear.panels[i+2].M);}
});

test('Multiple-panel plate shares one zero-thickness path and exposes one segment editor',()=>{
 const x={...preset,plateDefinition:'Multiple panels',upperSegments:[{angle:8,length:.25},{angle:0,length:.2},{angle:-8,length:.3}]},d=calculate('airfoil',x),g=d.result.geometry;
 assert.deepEqual(g.upper,g.lower);assert.equal(g.upper.length,4);assert.deepEqual(g.upper.at(-1),{x:1,y:0});assert.equal(g.panels.length,6);
 assert.equal(d.result.nonlinear.status,'ok');
 const fields=inputDefinitions('airfoil',x);assert.equal(fields.find(f=>f.key==='upperSegments').label,'Plate segments');assert.ok(!fields.some(f=>['lowerSegments','bendHeight','bendPosition'].includes(f.key)));
 assert.match(sceneSVG(d.scene,d.inputs).svg,/3 panels/);
});

test('Switching to multiple panels and adding a panel preserves the plate geometry',()=>{
 const source=readFileSync(new URL('./app.js',import.meta.url),'utf8'),elements=new Map(),button={};
 const box={querySelector(s){if(s==='.segment-add')return button;if(!elements.has(s))elements.set(s,{});return elements.get(s);},querySelectorAll(){return [];}};
 const context=vm.createContext({$:()=>box,inputs:structuredClone(preset),airfoilGeometry,constrainedSurface,automaticSurface,segmentSurface,surfaceSegments,fmt:String,renderInputs(){},schedule(){},request:0});
 const functions=source.slice(source.indexOf('function segmentEditor('),source.indexOf('function arrangeWallInputs('));
 vm.runInContext(functions,context);const before=airfoilGeometry(preset);
 context.changeAirfoilGeometry('plateDefinition','Multiple panels');
 airfoilGeometry(context.inputs).upper.forEach((p,i)=>{near(p.x,before.upper[i].x);near(p.y,before.upper[i].y);});
 context.bindSegmentEditor({key:'upperSegments'});button.onclick();assert.equal(context.inputs.upperSegments.length,3);
 const after=airfoilGeometry(context.inputs);assert.deepEqual(after.upper.at(-1),{x:1,y:0});near(after.upper[1].y/after.upper[1].x,.24);near(after.upper[2].x,before.upper[1].x);near(after.upper[2].y,before.upper[1].y);
});

