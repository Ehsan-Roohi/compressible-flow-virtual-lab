import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {segmentSurface,constrainedSurface} from './airfoil.js';
const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('function segmentEditor('),source.indexOf('function bindSegmentEditor('));
test('Geometry editor displays calculated lengths and hides a nonexistent closing panel',()=>{
 const values=[{angle:5,length:.5},{angle:-5,length:.5}],elements=new Map();
 const lengths=values.map((_,i)=>({readOnly:true,dataset:{index:String(i)}}));
 const box={querySelector(s){if(!elements.has(s))elements.set(s,{});return elements.get(s);},querySelectorAll(){return lengths;}};
 const context=vm.createContext({inputs:{airfoilShape:'Custom panels',upperSegments:values},$:()=>box,fmt:(n,d)=>Number(n.toPrecision(d)),segmentSurface,constrainedSurface});
 vm.runInContext(functions,context);const html=context.segmentEditor({key:'upperSegments'});assert.equal((html.match(/readonly title=/g)??[]).length,2);
 context.updateClosingSegment('upperSegments');assert.equal(elements.get('[data-closing-row]').hidden,true);
 for(const n of lengths)assert.ok(Math.abs(Number(n.value)-.50190992)<1e-8);
 assert.match(elements.get('[data-closure-message]').textContent,/No extra panel/);
 values[1].angle=10;context.inputs.upperSegments[1].angle=10;context.updateClosingSegment('upperSegments');
 assert.ok(lengths.every(n=>n.value===''));assert.match(elements.get('[data-closure-message]').textContent,/cannot close/);
});
