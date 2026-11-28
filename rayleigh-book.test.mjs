import {plotOptions} from './plot-options.js';
import {rayleighBookInputs} from './rayleigh-book.js';
import test from 'node:test';import assert from 'node:assert/strict';import {defaults,calculate} from './labs.js';
const close=(a,b,t)=>assert.ok(Math.abs(a-b)<t,`${a} vs ${b}`),run=x=>calculate('rayleigh',{...defaults('rayleigh'),...x});
test('Book 4-4: upstream adjustment, actual duct inlet and sonic pressure',()=>{const d=run({ductProblem:'Upstream adjustment to sonic outlet',M1:.41,p1:68.95,inletT0:229.4,outletT0:1666.7});assert.equal(d.result.stations.length,3);close(d.result.s1.M,.176,.001);close(d.result.s2.p/1000,32.94,.02);close(d.result.s2.T0,1666.7,1e-7);close(d.result.s1.p0,d.result.stations[0].state.p0,1e-6);});
test('Book 4-5: inlet speed and static properties reproduce exit state',()=>{const d=run({velocityInput:'Flow speed',inletSpeed:122.5,T1:222.2,p1:68.95,q:116.3});close(d.result.s2.M,.603,.001);close(d.result.s2.T,322,.1);close(d.result.s2.p/1000,56.445,.02);});
test('Book 4-6: distinguish first-stage, additional and total heat',()=>{const d=run({ductProblem:'Two-stage heating to sonic outlet',inletSpeed:122.5,T1:222.2,p1:68.95,q:116.3});const value=n=>d.rows.find(r=>r.label===n).value;close(value('Additional heat to sonic outlet'),75.19,.04);close(value('First-stage heat')+value('Additional heat to sonic outlet'),value('Total heat to sonic outlet'),1e-9);close(d.result.s2.M,1,1e-9);close(d.result.s2.p/1000,35.49,.01);});
test('Book 4-7: heat rejection, normal shock and isentropic converging nozzle',()=>{const d=run({ductProblem:'Heat + shock + converging nozzle',systemInletType:'Static duct inlet',M1:1.6,T1:200,p1:56,backPressure:120});const [a,b,c,e]=d.result.stations.map(z=>z.state);close(b.M,2.906,.005);close(c.M,.481,.001);close(d.rows.find(r=>r.label==='Heat transfer').value,-76.3,.5);close(b.T0,c.T0,1e-8);close(c.p0,e.p0,1e-6);close(a.p*(1+1.4*a.M*a.M),c.p*(1+1.4*c.M*c.M),1e-6);close(e.p/1000,120,1e-8);});

const pressurePlot = (overrides = {}) => {
 const options = plotOptions(run({...rayleighBookInputs, ...overrides}));
 assert.ok(!options.some(p => p.key === 'rayleigh-axial-book-pressure'));
 return options.find(p => p.key === 'rayleigh-axial-pressure');
};

test('example 4–1 has one pressure profile and reproduces the printed outlet within table rounding', () => {
 const {chart} = pressurePlot();
 assert.equal(chart.series.length, 1);
 const [profile] = chart.series;
 assert.equal(profile.points[0][1], 101);
 close(profile.points.at(-1)[1], 302.54, 0.2);
 assert.equal(profile.points.at(-1)[0], 1);
 assert.match(chart.ylabel, /kPa/);
});

test('the duct pressure plot reflects only the current inlet pressure and heat transfer', () => {
 for (const [q, expected] of [[200, 222.14316], [0, 101], [-40, 80.33791]]) {
  const {chart} = pressurePlot({q});
  assert.equal(chart.series.length, 1);
  close(chart.series[0].points.at(-1)[1], expected, 1e-4);
 }
 const {chart} = pressurePlot({fluid: 'Custom gas', gamma: 1.3, R: 300, p1: 115, q: 55});
 assert.equal(chart.series.length, 1);
 assert.equal(chart.series[0].points[0][1], 115);
});

test('the pressure profile reaches the sonic endpoint and is absent beyond thermal choking', () => {
 const qmax = run(rayleighBookInputs).result.qmax / 1000;
 const sonic = pressurePlot({q: qmax});
 close(sonic.chart.series[0].points.at(-1)[1], 101 * (1 + 1.4 * 9) / 2.4, 1e-8);
 assert.equal(pressurePlot({q: qmax + 1}), undefined);
});
