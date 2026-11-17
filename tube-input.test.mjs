import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,defaults,inputDefinitions} from './labs.js';
import {resolveTubeInputs,tubeModes} from './tube-input.js';
import {plotOptions} from './plot-options.js';
import {sceneSVG} from './graphics.js';
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} vs ${b}`);
test('Example 7–1 reproduces independent moving-shock results and resolved plots',()=>{
 const d=calculate('tube',{...defaults('tube'),tubeInput:tubeModes[2],shockRatio:10,p1:100,T1:300,T4:300});
 near(d.result.Ms,2.9519969028245465);near(d.result.shockSpeed,1024.8999951214753);
 near(d.result.u,756.0737668928915);near(d.result.T2/300,2.622950819672131);
 near(d.result.p2p1,10);near(d.result.residual,0);
 assert.ok(d.inputs.p4>1000);assert.equal(d.scene.p4,d.inputs.p4);
 const pressure=plotOptions(d,.001).find(o=>o.key==='tube-profile-p');
 near(pressure.chart.series[0].points[0][1],d.inputs.p4);
 assert.ok(!sceneSVG(d.scene,d.inputs,.001,'pressure').svg.includes('NaN'));
});
test('all four input modes give the same solution, including non-air gas',()=>{
 for(const [gamma,R] of [[1.4,287],[1.667,2076.9]]){
  const x={...defaults('tube'),gamma,R,T4:500},d=calculate('tube',x);
  for(const extra of [{tubeInput:tubeModes[1],driverRatio:x.p4/x.p1},{tubeInput:tubeModes[2],shockRatio:d.result.p2p1},{tubeInput:tubeModes[3],inducedSpeed:d.result.u}]){
   const z=calculate('tube',{...x,...extra});near(z.inputs.p4,x.p4,1e-6);near(z.result.u,d.result.u,1e-6);
  }
 }
});
test('conditional pressure fields preserve original input mode',()=>{
 for(const [i,visible,hidden] of [[0,'p4',['shockRatio','driverRatio','inducedSpeed']],[1,'driverRatio',['p4','shockRatio','inducedSpeed']],[2,'shockRatio',['p4','driverRatio','inducedSpeed']],[3,'inducedSpeed',['p4','driverRatio','shockRatio']]]){
  const keys=inputDefinitions('tube',{...defaults('tube'),tubeInput:tubeModes[i]}).map(f=>f.key);
  assert.ok(keys.includes(visible));for(const k of hidden)assert.ok(!keys.includes(k));
 }
 near(calculate('tube',defaults('tube')).result.p2p1,4.738621385708);
});
test('reject nonphysical ratios and unattainable driver expansion',()=>{
 for(const value of [1,0,NaN,Infinity])for(const [mode,key] of [[tubeModes[1],'driverRatio'],[tubeModes[2],'shockRatio']])
  assert.throws(()=>resolveTubeInputs({...defaults('tube'),tubeInput:mode,[key]:value}),/ratio/);
 assert.throws(()=>resolveTubeInputs({...defaults('tube'),tubeInput:tubeModes[2],shockRatio:1000,T4:100}),/Increase the driver temperature/);
});

test('Example 7–2: given induced speed, reference choices and exact Celsius conversion',()=>{
 const x={...defaults('tube'),tubeInput:tubeModes[3],inducedSpeed:150,p1:100,T1:298,T4:298};
 const d=calculate('tube',x);
 near(d.result.shockSpeed,447.5421653455715);near(d.result.u,150);near(d.result.Ms,1.2933642742484381);
 near(calculate('tube',{...x,T1:298.15}).result.shockSpeed,447.6264391792084);
 const z=calculate('tube',{...x,p1:50,T4:500});near(z.result.shockSpeed,d.result.shockSpeed);near(z.result.u,d.result.u);
 for(const value of [0,-150,NaN,Infinity])assert.throws(()=>resolveTubeInputs({...x,inducedSpeed:value}),/Induced gas speed/);
 assert.throws(()=>resolveTubeInputs({...x,inducedSpeed:10000}),/Increase the driver temperature/);
});
