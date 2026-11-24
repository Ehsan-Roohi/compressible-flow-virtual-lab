import {createUnitView} from './unit-system.js';
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {automaticSurface,constrainedSurface,segmentSurface} from './airfoil.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('All target lengths influence a positive closed plate without changing its angles',()=>{
 const segments=[{angle:10,length:.8},{angle:0,length:.7},{angle:-15,length:.6}],a=automaticSurface(segments),b=automaticSurface(segments.map((p,i)=>({...p,length:i===1?1.2:p.length})));
 for(const z of [a,b]){assert.deepEqual(z.points.at(-1),{x:1,y:0});assert.ok(z.lengths.every(v=>v>0));z.points.slice(0,-1).forEach((p,i)=>near(Math.atan2(z.points[i+1].y-p.y,z.points[i+1].x-p.x)*180/Math.PI,segments[i].angle));}
 assert.ok(Math.abs(a.lengths[1]-b.lengths[1])>.05);
 const closed=automaticSurface(segments.map((p,i)=>({...p,length:a.lengths[i]})));closed.lengths.forEach((v,i)=>near(v,a.lengths[i]));
 assert.throws(()=>automaticSurface([{angle:5,length:1},{angle:10,length:1}]),/cannot return/);
});
test('Every plate length field is editable and updates the separate calculated column',()=>{
 const source=readFileSync(new URL('./app.js',import.meta.url),'utf8'),elements=new Map(),cells=[0,1,2].map(i=>({dataset:{adjustedLength:String(i)}})),input={dataset:{index:'1',property:'length'},value:'1.2',readOnly:false};
 const box={querySelector(s){if(!elements.has(s))elements.set(s,{});return elements.get(s);},querySelectorAll(s){return s==='input'?[input]:s==='[data-adjusted-length]'?cells:[];}};
 const context=vm.createContext({unitView:createUnitView(),displayValue:value=>String(value),inputs:{airfoilShape:'Bent flat plate',plateLengthMode:'Adjust all lengths',upperSegments:[{angle:10,length:.8},{angle:0,length:.7},{angle:-15,length:.6}]},$:()=>box,fmt:String,automaticSurface,constrainedSurface,segmentSurface,request:0,schedule(){},renderInputs(){}});
 vm.runInContext(source.slice(source.indexOf('function segmentEditor('),source.indexOf('function changeAirfoilGeometry(')),context);
 const html=context.segmentEditor({key:'upperSegments'});assert.ok(!html.includes('readonly'));assert.match(html,/Target L\/c/);assert.match(html,/Adjusted L\/c/);
 context.bindSegmentEditor({key:'upperSegments'});const before=Number(cells[1].textContent);input.oninput();assert.equal(context.inputs.upperSegments[1].length,1.2);assert.ok(Number(cells[1].textContent)>before);assert.match(elements.get('[data-closure-message]').textContent,/All target lengths are editable/);
});
