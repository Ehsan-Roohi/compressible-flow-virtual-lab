import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCaseLink,readCaseLink,restoreCaseInputs} from './case-link.js';
import {defaults,inputDefinitions,labs} from './labs.js';

const base='https://example.com/lab/?v=release#nozzle?example=8-1';
const tokenFrom=link=>new URLSearchParams(new URL(link).hash.split('?')[1]).get('case');

test('every laboratory can produce a versioned case link with its own inputs',()=>{
 for(const lab of Object.keys(labs)){
  const inputs=defaults(lab);
  const link=makeCaseLink(base,lab,inputs,'SI');
  assert.equal(new URL(link).search,'');
  assert.match(new URL(link).hash,new RegExp(`^#${lab}\\?case=`));
  const decoded=readCaseLink(tokenFrom(link));
  assert.deepEqual(decoded.inputs,inputs);
  assert.deepEqual(restoreCaseInputs(inputs,decoded.inputs,inputDefinitions(lab,inputs)),inputs);
 }
});

test('custom geometry and Unicode modes round-trip with the chosen display units and plot',()=>{
 const wallSegments=[{angle:12.5,length:1.25},{angle:8,length:.7}];
 const inputs={wallShape:'Custom wall',wallSegments,nozzleType:'Converging–diverging',gamma:1.37};
 const link=makeCaseLink(base,'wall',inputs,'US','nozzle-moc-wall-segments');
 assert.deepEqual(readCaseLink(tokenFrom(link)),{
  inputs,units:'US',plot:'nozzle-moc-wall-segments'
 });
});

test('case links reject unreadable and unsafe data and ignore unknown keys during restore',()=>{
 for(const token of ['',':','Zg','x'.repeat(24001)])assert.equal(readCaseLink(token),null);
 const encoded=btoa(JSON.stringify({v:1,units:'SI',inputs:{fluid:'<unsafe value>'}}));
 assert.equal(readCaseLink(encoded.replace(/=+$/,'')),null);
 assert.throws(()=>makeCaseLink(base,'normal',{M1:NaN},'SI'),/Complete the inputs/);
 const seed={M1:2,fluid:'Air',wallSegments:[{angle:10,length:1}]};
 assert.deepEqual(restoreCaseInputs(seed,{
  M1:'2',fluid:'Helium',wallSegments:[null],unrecognized:1,radius:.055
 },[{key:'radius',value:1}]),{...seed,fluid:'Helium',radius:.055});
});
