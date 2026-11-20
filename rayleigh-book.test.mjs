import {plotOptions} from './plot-options.js';
import {rayleighBookInputs, rayleighBookPlotKey} from './rayleigh-book.js';
import test from 'node:test';import assert from 'node:assert/strict';import {defaults,calculate} from './labs.js';
const close=(a,b,t)=>assert.ok(Math.abs(a-b)<t,`${a} vs ${b}`),run=x=>calculate('rayleigh',{...defaults('rayleigh'),...x});
test('Book 4-4: upstream adjustment, actual duct inlet and sonic pressure',()=>{const d=run({ductProblem:'Upstream adjustment to sonic outlet',M1:.41,p1:68.95,inletT0:229.4,outletT0:1666.7});assert.equal(d.result.stations.length,3);close(d.result.s1.M,.176,.001);close(d.result.s2.p/1000,32.94,.02);close(d.result.s2.T0,1666.7,1e-7);close(d.result.s1.p0,d.result.stations[0].state.p0,1e-6);});
test('Book 4-5: inlet speed and static properties reproduce exit state',()=>{const d=run({velocityInput:'Flow speed',inletSpeed:122.5,T1:222.2,p1:68.95,q:116.3});close(d.result.s2.M,.603,.001);close(d.result.s2.T,322,.1);close(d.result.s2.p/1000,56.445,.02);});
test('Book 4-6: distinguish first-stage, additional and total heat',()=>{const d=run({ductProblem:'Two-stage heating to sonic outlet',inletSpeed:122.5,T1:222.2,p1:68.95,q:116.3});const value=n=>d.rows.find(r=>r.label===n).value;close(value('Additional heat to sonic outlet'),75.19,.04);close(value('First-stage heat')+value('Additional heat to sonic outlet'),value('Total heat to sonic outlet'),1e-9);close(d.result.s2.M,1,1e-9);close(d.result.s2.p/1000,35.49,.01);});
test('Book 4-7: heat rejection, normal shock and isentropic converging nozzle',()=>{const d=run({ductProblem:'Heat + shock + converging nozzle',systemInletType:'Static duct inlet',M1:1.6,T1:200,p1:56,backPressure:120});const [a,b,c,e]=d.result.stations.map(z=>z.state);close(b.M,2.906,.005);close(c.M,.481,.001);close(d.rows.find(r=>r.label==='Heat transfer').value,-76.3,.5);close(b.T0,c.T0,1e-8);close(c.p0,e.p0,1e-6);close(a.p*(1+1.4*a.M*a.M),c.p*(1+1.4*c.M*c.M),1e-6);close(e.p/1000,120,1e-8);});

const pressureComparison = (overrides = {}) => {
 const d = run({...rayleighBookInputs, ...overrides});
 const [plot] = plotOptions(d);
 assert.equal(plot.key, rayleighBookPlotKey);
 return plot;
};

test('example 4–1 pressure curves coincide and reproduce the printed outlet within table rounding', () => {
 const {chart} = pressureComparison();
 assert.equal(chart.series.length, 1);
 const [book] = chart.series;
 assert.equal(book.points[0][1], 101);
 close(book.points.at(-1)[1], 302.54, 0.2);
 assert.equal(book.points.at(-1)[0], 1);
 assert.match(chart.ylabel, /kPa/);
 assert.match(book.name, /Current and textbook/);
});

test('signed heat updates only the live duct pressure and keeps the book axes stable', () => {
 const base = pressureComparison().chart;
 for (const [q, expected] of [[200, 222.14316], [0, 101], [-40, 80.33791]]) {
  const {chart} = pressureComparison({q});
  assert.deepEqual(chart.yRange, base.yRange);
  assert.deepEqual(chart.series[1].points, base.series[0].points);
  close(chart.series[0].points.at(-1)[1], expected, 1e-4);
 }
 const changed = pressureComparison({fluid: 'Custom gas', gamma: 1.3, R: 300, p1: 115, q: 55});
 assert.deepEqual(changed.chart.series[1].points, base.series[0].points);
 assert.equal(changed.chart.series[0].points[0][1], 115);
});

test('thermal choking retains the sonic endpoint and an excessive heat input shows the book curve alone', () => {
 const qmax = run(rayleighBookInputs).result.qmax / 1000;
 const sonic = pressureComparison({q: qmax});
 close(sonic.chart.series[0].points.at(-1)[1], 101 * (1 + 1.4 * 9) / 2.4, 1e-8);
 const limited = pressureComparison({q: qmax + 1});
 assert.equal(limited.chart.series.length, 1);
 assert.deepEqual(limited.chart.series[0], sonic.chart.series[1]);
 assert.match(limited.note, /exceeds choking heat/);
 assert.ok(!plotOptions(run({ductProblem: 'Heat + shock + converging nozzle', systemInletType: 'Static duct inlet', M1: 1.6, T1: 200, p1: 56, backPressure: 120})).some(p => p.key === rayleighBookPlotKey));
});

test('the pressure scale covers complete heating and cooling branches for high inlet pressures', () => {
 for (const p1 of [500, 5000]) {
  for (const M1 of [0.5, 3]) {
   const inlet = {...rayleighBookInputs, p1, M1};
   const qmax = run(inlet).result.qmax / 1000;
   const baseline = pressureComparison({...inlet, q: 0}).chart;
   for (const q of [-40, 0.9 * qmax, qmax]) {
    const {chart} = pressureComparison({...inlet, q});
    assert.deepEqual(chart.yRange, baseline.yRange);
    for (const curve of chart.series) {
     assert.ok(curve.points.every(([, pressure]) => pressure >= 0 && pressure <= chart.yRange[1]));
    }
   }
  }
 }
});
