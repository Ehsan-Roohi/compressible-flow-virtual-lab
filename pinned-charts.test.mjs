import test from 'node:test';
import assert from 'node:assert/strict';
import {pinnedChartFigure,pinnedChartPanels} from './pinned-charts.js';

const plot=(changes={})=>({
 title:'Static pressure',xlabel:'Mach number M',ylabel:'p (kPa)',
 series:[{name:'Duct',points:[[1,100],[2,125]]}],...changes,
});
const pin=(number,chart,label='Fanno')=>({number,chart,label});

test('matching axes share one scale and a different horizontal quantity gets its own frame',()=>{
 const first=plot({yRange:[90,130]});
 const second=plot({invertXAxis:true,series:[{name:'Duct',points:[[2,250],[1,200]]}]});
 const otherHorizontal=plot({xlabel:'Axial position x/L'});
 const panels=pinnedChartPanels([pin(1,first),pin(2,otherHorizontal),pin(3,second)]);
 assert.equal(panels.length,2);
 const overlay=panels[0].chart;
 assert.deepEqual(overlay.series.map(s=>s.name),['Pin 1 · Fanno · Duct','Pin 3 · Fanno · Duct']);
 assert.equal(new Set(overlay.series.map(s=>s.color)).size,2);
 assert.deepEqual(overlay.series[0].points,first.series[0].points);
 assert.deepEqual(overlay.series[1].points,second.series[0].points);
 assert.equal(overlay.yRange,undefined);
 assert.deepEqual(first.yRange,[90,130]);
 assert.equal(panels[1].chart,otherHorizontal);
});

test('pressure and temperature use two physical scales in one shared Mach frame',()=>{
 const pressure=plot({zeroBaseline:false});
 const temperature=plot({title:'Static temperature',ylabel:'T (K)',scatter:true,zeroBaseline:false,
  series:[{name:'Temperature',points:[[1,298],[2,510]]}]});
 const pins=[pin(1,pressure),pin(2,temperature)];
 const panels=pinnedChartPanels(pins);
 assert.equal(panels.length,1);
 const {chart}=panels[0];
 assert.deepEqual(chart.yAxes.map(axis=>axis.label),['p (kPa)','T (K)']);
 assert.deepEqual(chart.yRange,[0,1]);
 assert.equal(chart.series[0].scatter,false);
 assert.equal(chart.series[1].scatter,true);
 for(const [i,source] of [pressure,temperature].entries()){
  const [bottom,top]=chart.yAxes[i].range;
  assert.equal(chart.series[i].color,chart.yAxes[i].color);
  for(const [j,[x,y]] of chart.series[i].points.entries()){
   assert.equal(x,source.series[0].points[j][0]);
   assert.ok(Math.abs(bottom+y*(top-bottom)-source.series[0].points[j][1])<1e-9);
  }
 }
 const figure=pinnedChartFigure(pins);
 assert.equal((figure.svg.match(/data-pinned-panel=/g)??[]).length,1);
 assert.match(figure.svg,/data-chart-y-axis="T \(K\)"/);
 assert.ok(figure.width>640);
 assert.doesNotMatch(figure.svg,/NaN|Infinity|undefined/);
});

test('the combined SVG retains heatmap orientation and cursor without duplicate IDs',()=>{
 const wave=plot({
  title:'Density map',xlabel:'Time t (ms)',ylabel:'Position x (m)',timeCursorFraction:.5,
  heatmap:{left:0,right:2,end:30,rows:[[0,.5],[.5,1]],transposed:true},
  series:[{name:'Wave',points:[[0,0],[30,2]]}],
 });
 const figure=pinnedChartFigure([pin(1,wave),pin(2,wave),pin(3,plot(),'<Shock & duct>')]);
 assert.ok(figure.height>3*266);
 assert.equal((figure.svg.match(/data-pinned-panel=/g)??[]).length,3);
 assert.match(figure.svg,/id="pinned-1-finiteTimeCursor" x1="358.5" x2="358.5"/);
 assert.match(figure.svg,/url\(#pinned-2-contourRow0\)/);
 assert.match(figure.svg,/&lt;Shock &amp; duct&gt;/);
 const ids=Array.from(figure.svg.matchAll(/\bid="([^"]+)"/g),m=>m[1]);
 assert.equal(new Set(ids).size,ids.length);
 assert.doesNotMatch(figure.svg,/NaN|Infinity|undefined/);
});
