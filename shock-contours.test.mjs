import assert from 'node:assert/strict';
import test from 'node:test';
import {calculate,defaults} from './labs.js';
import {finiteTubeFrame,finiteTubeDrawing,resolvedShockFronts} from './finite-tube.js';
const b={...defaults('tube'),tubeDomain:'Finite tube · closed ends'};
test('shock markers follow reflected pressure fronts and ignore the contact surface',()=>{
 const r=calculate('tube',b).result;
 for(const time of [.004,.01,.02]){
  const f=finiteTubeFrame(r,time),fronts=resolvedShockFronts(r,f);
  assert.equal(fronts.length,1);
  if(time===.004)assert.ok(Math.abs(fronts[0].x-r.incident.shockSpeed*f.time)<.08);
  if(time===.01)assert.equal(fronts[0].direction,-1);
 }
 assert.match(finiteTubeDrawing(r,.02).svg,/data-numerical-shock/);
});
test('small sinusoidal acoustic waves remain smooth and are not labelled as shocks',()=>{
 const r=calculate('tube',{...b,unsteadyExperiment:'Sinusoidal piston',pistonEpsilon:.01,pistonFrequency:100,pistonCycles:1,pistonTubeLength:6,
  p1:100,T1:300,finiteEndTime:40,finiteCells:1200}).result;
 for(const time of [.0075,.02,.03])assert.equal(resolvedShockFronts(r,finiteTubeFrame(r,time)).length,0);
 assert.match(finiteTubeDrawing(r,.0075).svg,/no resolved shock front/);
});
