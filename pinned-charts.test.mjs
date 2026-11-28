import test from 'node:test';
import assert from 'node:assert/strict';
import {pinnedChartFigure,pinnedChartPanels} from './pinned-charts.js';

const plot=(changes={})=>({
 title:'Static pressure',xlabel:'Mach number M',ylabel:'p (kPa)',
 series:[{name:'Duct',points:[[1,100],[2,125]]}],...changes,
});
const pin=(number,chart,label='Fanno')=>({number,chart,label});

test('pins with matching axes overlay and other axes get their own panel',()=>{
 const first=plot({yRange:[90,130]});
 const second=plot({series:[{name:'Duct',points:[[1,200],[2,250]]}]});
 const reversed=plot({invertXAxis:true});
 const otherUnit=plot({ylabel:'p (psia)'});
 const panels=pinnedChartPanels([pin(1,first),pin(2,otherUnit),pin(3,second),pin(4,reversed)]);
 assert.equal(panels.length,3);
 const overlay=panels[0].chart;
 assert.deepEqual(overlay.series.map(s=>s.name),['Pin 1 · Fanno · Duct','Pin 3 · Fanno · Duct']);
 assert.equal(new Set(overlay.series.map(s=>s.color)).size,2);
 assert.deepEqual(overlay.series[0].points,first.series[0].points);
 assert.deepEqual(overlay.series[1].points,second.series[0].points);
 assert.equal(overlay.yRange,undefined);
 assert.deepEqual(first.yRange,[90,130]);
 assert.equal(panels[1].chart,otherUnit);
 assert.equal(panels[2].chart,reversed);
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
