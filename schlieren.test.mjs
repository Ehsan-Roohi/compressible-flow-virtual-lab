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
 const l=schlierenLayers(simple().svg,cornerPalette);assert.equal(l.count,2);assert.match(l.density,/rgb\(0,0,0\)/);assert.match(l.density,/rgb\(255,255,255\)/);assert.doesNotMatch(l.density,/<text/);assert.match(l.density,/id="schSource-gas"/);assert.match(l.density,/url\(#schSource-gas\)/);assert.match(l.overlay,/fill="#c8dae8">2<\/text>/);assert.match(l.overlay,/fill="white"\/><\/clipPath>/);assert.doesNotMatch(l.foreground,/<defs/);
});
test('Sobel magnitude uses both directions and masks domain edges, including SVG exports',()=>{
 const v=schlierenView(simple());assert.equal(v.field.quantity,'schlieren');assert.deepEqual(v.field.palette,['#0c1420','#5cd6e6']);assert.equal(v.field.units,'relative');assert.match(v.svg,/data-schlieren="true"/);assert.match(v.svg,/result="dx"/);assert.match(v.svg,/result="dy"/);assert.match(v.svg,/in="xx" in2="yy"/);assert.match(v.svg,/exponent="0.5"/);assert.match(v.svg,/operator="erode"/);assert.match(v.field.note,/not a dimensional gradient/);assert.ok(v.svg.indexOf('fill="#0c1420"')<v.svg.indexOf('<g filter='));assert.ok(v.svg.lastIndexOf('>2</text>')>v.svg.indexOf('<g filter='));
});
test('schlieren is available on supported density fields and changes the inlet scene without changing states',()=>{
 const x={...defaults('wall'),...multiRampPreset,inletFlowSide:'Both sides'},d=calculate('wall',x),before=JSON.stringify(d.result.regions),normal=sceneSVG(d.scene,x,0,'pressure'),v=sceneSVG(d.scene,x,0,'schlieren');
 assert.ok(normal.field.options.includes('schlieren'));assert.equal(v.field.quantity,'schlieren');assert.match(v.svg,/data-schlieren="true"/);assert.match(v.svg,/>U2<\/text>/);assert.match(v.svg,/>L2<\/text>/);assert.equal(JSON.stringify(d.result.regions),before);assert.doesNotMatch(v.svg,/NaN|undefined|Infinity/);
});
test('Cp-only models do not offer a density-gradient mode',()=>{
 const x={...defaults('airfoil'),airfoilMethod:'Linearized theory'},d=calculate('airfoil',x),v=sceneSVG(d.scene,x,0,'pressure');assert.ok(!v.field?.options.includes('density'));assert.ok(!v.field?.options.includes('schlieren'));
 assert.equal(schlierenView({svg:'<svg><text>No spatial field</text></svg>',field:{options:[]}}),null);
});
