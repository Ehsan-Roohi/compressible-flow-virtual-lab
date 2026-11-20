import {bodyPlots} from './wedge-cone.js';
import {pressureTurningPlot,opposingShockSlipAngle} from './pressure-turning.js';
import {annotateTurningRegions} from './turning-region-markers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,defaults} from './labs.js';
import {plotOptions} from './plot-options.js';
import {chartSVG} from './graphics.js';
import {ramjetPreset} from './ramjet-inlet.js';
import {chapter6Example} from './regular-channel.js';
const run=(id,x={})=>calculate(id,{...defaults(id),...x});
const chart=d=>d.inputs.bodyGeometry==='Wedge'?annotateTurningRegions(d,pressureTurningPlot(d)??bodyPlots(d.result).find(p=>/p-theta/.test(p.key))).chart:d.id==='airfoil'?annotateTurningRegions(d,pressureTurningPlot(d)).chart:plotOptions(d).find(p=>p.chart.regionMarkers).chart;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7);
test('Every turning chart has visible markers matching the solved states',()=>{
 for(const d of [run('oblique'),run('expansion'),run('wall'),run('collision'),run('wall',chapter6Example(4)),run('wall',ramjetPreset),run('airfoil'),run('cone'),run('cone',{bodyGeometry:'Wedge'}),run('cone',{bodyGeometry:'Wedge',nearbyWall:'Both walls'})]){
  const c=chart(d);assert.ok(c.markers.length>=2);const v=chartSVG(c);for(const m of c.markers){assert.ok(Number.isFinite(m.x)&&Number.isFinite(m.y));assert.ok(v.svg.includes('data-region-marker="'+m.name+'"'));assert.ok(v.axis.xmin<=m.x&&m.x<=v.axis.xmax);assert.ok(v.axis.ymin<=m.y&&m.y<=v.axis.ymax);}assert.doesNotMatch(v.svg,/NaN|undefined|Infinity/);
 }
});
test('Book regions retain their own labels and coincident wall reflections show both region numbers',()=>{
 const d=run('wall',ramjetPreset),c=chart(d);assert.deepEqual(c.markers.map(m=>m.name),['1','2','3']);near(c.markers[1].x,-8);near(c.markers[2].y,d.result.regions[3].p/d.result.s1.p);
 const b=chart(run('cone',{bodyGeometry:'Wedge',nearbyWall:'Both walls'}));assert.ok(b.markers.some(m=>m.name==='3 / 5'));assert.ok(!b.markers.some(m=>m.name==='5'));
 const interaction=chart(run('collision'));const all=interaction.markers.map(m=>m.name).join(' / ');for(const n of ['1','2','3','4','4′'])assert.ok(all.includes(n));
});
test('Airfoil labels match panel and trailing-edge identifiers; continuous cone locations are named',()=>{
 const c=chart(run('airfoil')),all=c.markers.map(m=>m.name).join(' / ');for(const label of ['1','2','3','4','5','6 (upper)','6 (lower)'])assert.ok(all.includes(label));
 assert.deepEqual(chart(run('cone')).markers.map(m=>m.name),['Shock','Surface']);
});

test('Example 4 pressure–deflection diagram connects all four shocks in every solution mode',()=>{
 for(const channelSolver of ['Shock–Expansion','Method of characteristics','Compare both']){
  const d=run('wall',{...chapter6Example(4),channelSolver}),[polar]=plotOptions(d);
  assert.equal(polar.key,'pressure-turning');assert.equal(polar.chart.ylabel,'p/p₁');
  const [a,b,c,e]=polar.chart.series;
  assert.deepEqual([a,b,c,e].map(s=>s.name),['1 → 2','1 → 3','2 → 4′','3 → 4']);
  assert.deepEqual(a.points[0],[0,1]);assert.deepEqual(b.points[0],[0,1]);
  assert.deepEqual(a.points.at(-1),c.points[0]);assert.deepEqual(b.points.at(-1),e.points[0]);
  near(a.points.at(-1)[0],20);near(a.points.at(-1)[1],5.2115725022);
  near(b.points.at(-1)[0],-10);near(b.points.at(-1)[1],2.5060431210);
  near(c.points.at(-1)[0],9.54488816868);near(c.points.at(-1)[1],10.10926478965);
  near(c.points.at(-1)[1],e.points.at(-1)[1]);
  assert.deepEqual(polar.chart.markers.map(m=>m.name),['1','2','3','4′ / 4']);
  near(opposingShockSlipAngle(d.result),9.54488816868);
  const svg=chartSVG(polar.chart).svg;
  assert.match(svg,/data-slip-angle-axis="true"[\s\S]*?φ = 9\.54°/);
  assert.doesNotMatch(svg,/NaN|undefined|Infinity/);
 }
});


test('Example 5 projects the slip-line angle onto the pressure–deflection x axis',()=>{
 const c=chart(run('wall',{...chapter6Example(5),boundaryMode:'Single wall'}));
 near(c.xReference.x,20.1426632123);
 const {svg}=chartSVG(c);
 assert.match(svg,/data-slip-angle-axis="true"[\s\S]*?φ = 20\.14°/);
});
