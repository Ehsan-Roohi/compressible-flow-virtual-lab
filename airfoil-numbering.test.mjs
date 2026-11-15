import test from 'node:test';import assert from 'node:assert/strict';
import {calculate,defaults} from './labs.js';import {sceneSVG} from './graphics.js';import {airfoilTables} from './airfoil-tables.js';import {plotOptions} from './plot-options.js';
test('Diamond figure, state table and pressure deflection markers use textbook region numbers',()=>{
 const d=calculate('airfoil',{...defaults('airfoil'),alpha:4}),svg=sceneSVG(d.scene,d.inputs).svg;
 assert.deepEqual([...svg.matchAll(/data-airfoil-region="([^"]+)"/g)].map(m=>m[1]).sort(),['1','2','3','4','5','6']);
 const html=airfoilTables(d.result,String);for(const n of ['2','3','4','5'])assert.ok(html.includes(`scope="row">${n}</th>`));assert.ok(html.includes('6 (upper)')&&html.includes('6 (lower)'));
 const chart=plotOptions(d).find(p=>p.key==='pressure-turning').chart;assert.ok(chart.markers.some(m=>m.name==='1'));assert.ok(chart.markers.some(m=>m.name.includes('6 (upper)')));
 const shocks=[...d.result.nonlinear.waves,...d.result.trailingEdge.waves].filter(w=>w.kind==='Oblique shock');
 for(const w of shocks){assert.ok(svg.includes(`data-shock-angle="${w.id}"`));const value=Number((w.beta*180/Math.PI).toPrecision(4));assert.ok(svg.includes(`= ${value}°`));}
});
