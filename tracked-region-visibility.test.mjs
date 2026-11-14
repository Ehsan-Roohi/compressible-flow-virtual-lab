import test from 'node:test';import assert from 'node:assert/strict';
import {calculate,defaults} from './labs.js';import {sceneSVG} from './graphics.js';import {drawableTrackingEvents} from './wave-tracker-tables.js';
test('Default shock-fan event has every numbered region in the drawn field',()=>{
 const x={...defaults('wall'),wallShape:'Custom wall',boundaryMode:'Channel',channelSolver:'Shock–Expansion',M1:1.95,p1:482.65,inletPressureType:'Stagnation pressure',channelHeight:1,trackingStep:1.25,wallSegments:[{angle:0,length:.5},{angle:10,length:2}],upperWallSegments:[{angle:10,length:3}]},r=calculate('wall',x).result;
 assert.ok(drawableTrackingEvents(r).has(r.selectedTrackingEvent));assert.ok(!drawableTrackingEvents(r).has(r.tracking.events.at(-1).index));
 const svg=sceneSVG({kind:'wall',...r},x).svg,labels=[...svg.matchAll(/data-tracked-region="([^"]+)"/g)].flatMap(m=>m[1].split('/'));
 for(const name of Object.keys(r.regions))assert.ok(labels.includes(name.replace(/^Region /,'')),name);
 assert.ok(!/NaN|Infinity/.test(svg));
});
