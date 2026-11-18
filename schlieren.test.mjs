import test from 'node:test';
import assert from 'node:assert/strict';
import {densityColourCoordinate,schlierenLayers,schlierenView} from './schlieren.js';
import {cornerContourColor,cornerPalette} from './corner-graphics.js';
import {sceneSVG} from './graphics.js';
import {defaults,calculate} from './labs.js';
import {multiRampPreset} from './multi-ramp-inlet.js';
test('density colour inversion recovers the scalar rather than RGB brightness',()=>{
 for(let i=0;i<=100;i++){const t=i/100;assert.ok(Math.abs(densityColourCoordinate(cornerContourColor(t))-t)<.002);}
 for(const c of ['white','#ffffff','#d5b488','#24313c','none','url(#gas)'])assert.equal(densityColourCoordinate(c),null);
});
const simple=()=>({svg:'<svg viewBox="0 0 100 100"><defs><clipPath id="gas"><rect width="90" height="90" fill="white"/></clipPath></defs><rect width="100" height="100" fill="#fcfdfc"/><g clip-path="url(#gas)"><path d="M0 0H45V90H0Z" fill="#2536c7"/><path d="M45 0H90V90H45Z" fill="#ee2727"/></g><text x="20" y="30" fill="white">2</text><path d="M0 90H90" fill="none" stroke="black"/></svg>',field:{options:['density'],quantity:'density',min:1,max:2,palette:cornerPalette,note:'Resolved field'}});
test('density source excludes annotations, masks and solids; overlay retains them',()=>{
 const l=schlierenLayers(simple().svg,cornerPalette);assert.equal(l.count,2);assert.match(l.density,/rgb\(0,0,0\)/);assert.match(l.density,/rgb\(255,255,255\)/);assert.doesNotMatch(l.density,/<text/);assert.match(l.density,/id="schSource-gas"/);assert.match(l.density,/url\(#schSource-gas\)/);assert.match(l.overlay,/fill="#242424">2<\/text>/);assert.match(l.overlay,/fill="white"\/><\/clipPath>/);assert.doesNotMatch(l.foreground,/<defs/);
});
test('Signed vertical Sobel gradient uses mid-gray and masks domain edges',()=>{
 const v=schlierenView(simple());assert.equal(v.field.quantity,'schlieren');assert.deepEqual(v.field.palette,['#e8e8e8','#909090','#1a1a1a']);assert.equal(v.field.units,'relative');assert.match(v.svg,/data-schlieren="true"/);assert.equal(v.field.min,-1);assert.equal(v.field.max,1);assert.match(v.svg,/result="dy"/);assert.equal((v.svg.match(/tableValues="0\.91 0\.91 0\.565 0\.10 0\.10"/g)??[]).length,3);assert.match(v.svg,/operator="erode"/);assert.match(v.field.note,/opposite signs/);assert.ok(v.svg.indexOf('fill="#909090"')<v.svg.indexOf('<g filter='));assert.ok(v.svg.lastIndexOf('>2</text>')>v.svg.indexOf('<g filter='));
});
test('schlieren is available on supported density fields and changes the inlet scene without changing states',()=>{
 const x={...defaults('wall'),...multiRampPreset,inletFlowSide:'Both sides'},d=calculate('wall',x),before=JSON.stringify(d.result.regions),normal=sceneSVG(d.scene,x,0,'pressure'),v=sceneSVG(d.scene,x,0,'schlieren');
 assert.ok(normal.field.options.includes('schlieren'));assert.equal(v.field.quantity,'schlieren');assert.match(v.svg,/data-schlieren="true"/);assert.match(v.svg,/>U2<\/text>/);assert.match(v.svg,/>L2<\/text>/);assert.equal(JSON.stringify(d.result.regions),before);assert.doesNotMatch(v.svg,/NaN|undefined|Infinity/);
});
test('Cp-only models do not offer a density-gradient mode',()=>{
 const x={...defaults('airfoil'),airfoilMethod:'Linearized theory'},d=calculate('airfoil',x),v=sceneSVG(d.scene,x,0,'pressure');assert.ok(!v.field?.options.includes('density'));assert.ok(!v.field?.options.includes('schlieren'));
 assert.equal(schlierenView({svg:'<svg><text>No spatial field</text></svg>',field:{options:[]}}),null);
});

test('all three nozzle views use density for schlieren, with axial sensitivity inside',()=>{
 for (const nozzleView of ['Internal flow','External waves','Nozzle + external waves']){
  const inputs={...defaults('nozzle'),areaRatio:3,backRatio:nozzleView==='Internal flow'?.8:.05,nozzleView};
  const data=calculate('nozzle',inputs);
  const density=sceneSVG(data.scene,data.inputs,0,'density');
  const image=sceneSVG(data.scene,data.inputs,0,'schlieren');
  assert.equal(density.field.quantity,'density');
  assert.ok(density.field.max>density.field.min);
  assert.equal(image.field.quantity,'schlieren');
  assert.match(image.svg,/height="100%" fill="#f2f5f0"/);
  if(nozzleView!=='External waves')assert.match(image.svg,/id="schSource-nozzleDensityFill"/);
  assert.match(image.svg,new RegExp('result="'+({'Internal flow':'dx','External waves':'dy','Nozzle + external waves':'diagonal'}[nozzleView])+'"'));
  assert.doesNotMatch(image.svg,/NaN|undefined|Infinity/);
 }
});
