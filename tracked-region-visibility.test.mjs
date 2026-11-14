import test from 'node:test';import assert from 'node:assert/strict';
import {calculate,defaults} from './labs.js';import {sceneSVG} from './graphics.js';import {drawableTrackingEvents} from './wave-tracker-tables.js';
test('Event field omits region numbers while the selected table retains numbered states',()=>{
 const x={...defaults('wall'),wallShape:'Custom wall',boundaryMode:'Channel',channelSolver:'Shock–Expansion',M1:1.95,p1:482.65,inletPressureType:'Stagnation pressure',channelHeight:1,trackingStep:1.25,wallSegments:[{angle:0,length:.5},{angle:10,length:2}],upperWallSegments:[{angle:10,length:3}]},r=calculate('wall',x).result;
 assert.ok(drawableTrackingEvents(r).has(r.selectedTrackingEvent));assert.ok(!drawableTrackingEvents(r).has(r.tracking.events.at(-1).index));
 const svg=sceneSVG({kind:'wall',...r},x).svg;
 assert.ok(!svg.includes('data-tracked-region'));assert.ok(Object.keys(r.regions).every(name=>name.startsWith('Region ')));
 assert.ok(!/NaN|Infinity/.test(svg));
});
