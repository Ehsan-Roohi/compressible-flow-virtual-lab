// Synthetic, display-space density-gradient magnitude. No optical ray tracing
// and no physical shock thickness are inferred from the piecewise inviscid field.
const ramps=[['#2536c7','#0879f5','#00c8dc','#16bf59','#efe51b','#ff9718','#ee2727'],['#1834b8','#007fff','#00c9e8','#20c75a','#e6e529','#ff961f','#db2525']];
const rgb=color=>/^#[\da-f]{6}$/i.test(color)?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)):(color.match(/^rgb\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)\s*\)$/i)?.slice(1).map(Number)??null);
// Invert only known linear contour ramps. Geometry, labels and hatching never
// enter the derivative. The small tolerance accounts for rounded RGB channels.
export function densityColourCoordinate(color,palettes=ramps){
 const p=rgb(color);if(!p)return null;let best=null;
 for(const ramp of palettes){const q=ramp.map(rgb);if(q.some(c=>!c))continue;
  for(let i=0;i<q.length-1;i++){const a=q[i],d=q[i+1].map((v,k)=>v-a[k]),den=d.reduce((s,v)=>s+v*v,0);if(!den)continue;const t=Math.max(0,Math.min(1,p.reduce((s,v,k)=>s+(v-a[k])*d[k],0)/den)),error=p.reduce((s,v,k)=>s+(v-a[k]-t*d[k])**2,0);if(!best||error<best.error)best={error,value:(i+t)/(q.length-1)};}
 }
 return best&&best.error<=1.2?best.value:null;
}
const replaceAttr=(tag,name,value)=>new RegExp(`\\b${name}="[^"]*"`).test(tag)?tag.replace(new RegExp(`\\b${name}="[^"]*"`),`${name}="${value}"`):tag.replace(/\/?\s*>$/,m=>` ${name}="${value}"${m}`);
export function schlierenLayers(svg,palette){
 const palettes=palette?[palette,...ramps]:ramps,cache=new Map(),coordinate=c=>{if(!cache.has(c))cache.set(c,densityColourCoordinate(c,palettes));return cache.get(c);};
 const gradients=new Set();for(const m of svg.matchAll(/<linearGradient\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/linearGradient>/g))if([...m[2].matchAll(/stop-color="([^"]+)"/g)].some(z=>coordinate(z[1])!==null))gradients.add(m[1]);
 let count=0,defs=0;
 const source=svg.replace(/<text\b[\s\S]*?<\/text>/g,'').replace(/<(?:title|desc)\b[\s\S]*?<\/(?:title|desc)>/g,'').replace(/<\/?[\w:-]+\b[^>]*>/g,tag=>{
  if(/^<defs\b/.test(tag)){defs++;return tag;}if(/^<\/defs/.test(tag)){defs--;return tag;}
  if(/^<stop\b/.test(tag)){const c=tag.match(/stop-color="([^"]+)"/)?.[1],t=c?coordinate(c):null;return t===null?tag:replaceAttr(tag,'stop-color',`rgb(${Array(3).fill(Math.round(255*t)).join(',')})`);}
  if(defs||!/^<(?:path|polygon|rect|circle|ellipse|polyline|line|image)\b/.test(tag))return tag;
  const c=tag.match(/\bfill="([^"]+)"/)?.[1],t=c?coordinate(c):null,isGradient=c&&gradients.has(c.match(/^url\(#([^)]*)\)$/)?.[1]);
  if(t!==null||isGradient){count++;tag=replaceAttr(tag,'fill',isGradient?c:`rgb(${Array(3).fill(Math.round(255*t)).join(',')})`);}else tag=replaceAttr(tag,'fill','none');
  return replaceAttr(replaceAttr(tag,'stroke','none'),'shape-rendering','crispEdges');
 });
 const overlay=svg.replace(/<(?:path|polygon|rect|circle|ellipse|polyline|line)\b[^>]*>/g,tag=>{const c=tag.match(/\bfill="([^"]+)"/)?.[1];return c&&(coordinate(c)!==null||gradients.has(c.match(/^url\(#([^)]*)\)$/)?.[1]))?replaceAttr(tag,'fill','none'):tag;}).replace(/<text\b[^>]*>/g,tag=>tag.replace(/fill="(?:white|#fff(?:fff)?)"/gi,'fill="#24313c"'));
 const body=s=>s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 const density=body(source).replace(/\bid="([^"]+)"/g,'id="schSource-$1"').replace(/url\(#([^)]*)\)/g,'url(#schSource-$1)');
 let foregroundDefs=0;
 const foreground=body(overlay).replace(/<\/?[\w:-]+\b[^>]*>/g,tag=>{if(/^<defs\b/.test(tag)){foregroundDefs++;return tag;}if(/^<\/defs/.test(tag)){foregroundDefs--;return tag;}if(foregroundDefs||!/^<(?:path|polygon|rect|circle|ellipse|polyline)\b/.test(tag))return tag;return replaceAttr(tag,'fill','none');});
 return {density,overlay:body(overlay),foreground,count};
}
export function schlierenView(view){
 const layers=schlierenLayers(view.svg,view.field?.palette);if(!layers.count)return null;
 const root=view.svg.match(/^<svg[^>]*>/)?.[0];if(!root)return null;
 // Sobel derivatives of normalized density: signed bias -> absolute value ->
 // sum of squares -> square root. Alpha erosion suppresses fluid-mask edges.
 const filter=`<filter id="syntheticSchlieren" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
 <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="smooth"/>
 <feConvolveMatrix in="smooth" order="3" kernelMatrix="-1 0 1 -2 0 2 -1 0 1" divisor="8" bias="0.5" preserveAlpha="true" result="dx"/>
 <feConvolveMatrix in="smooth" order="3" kernelMatrix="-1 -2 -1 0 0 0 1 2 1" divisor="8" bias="0.5" preserveAlpha="true" result="dy"/>
 <feComponentTransfer in="dx" result="ax"><feFuncR type="table" tableValues="8 0 8"/><feFuncG type="table" tableValues="8 0 8"/><feFuncB type="table" tableValues="8 0 8"/></feComponentTransfer>
 <feComponentTransfer in="dy" result="ay"><feFuncR type="table" tableValues="8 0 8"/><feFuncG type="table" tableValues="8 0 8"/><feFuncB type="table" tableValues="8 0 8"/></feComponentTransfer>
 <feComposite in="ax" in2="ax" operator="arithmetic" k1="1" result="xx"/><feComposite in="ay" in2="ay" operator="arithmetic" k1="1" result="yy"/>
 <feComposite in="xx" in2="yy" operator="arithmetic" k2="1" k3="1" result="sum"/>
 <feComponentTransfer in="sum" result="strength"><feFuncR type="gamma" amplitude="1" exponent="0.5" offset="0"/><feFuncG type="gamma" amplitude="1" exponent="0.5" offset="0"/><feFuncB type="gamma" amplitude="1" exponent="0.5" offset="0"/></feComponentTransfer>
 <feComponentTransfer in="strength" result="grey"><feFuncR type="linear" slope="-1" intercept="1"/><feFuncG type="linear" slope="-1" intercept="1"/><feFuncB type="linear" slope="-1" intercept="1"/></feComponentTransfer>
 <feMorphology in="SourceAlpha" operator="erode" radius="2.5" result="interior"/><feComposite in="grey" in2="interior" operator="in"/>
 </filter>`;
 return {...view,label:'Synthetic schlieren · density gradient',svg:root.replace('>',' data-schlieren="true">')+`${layers.overlay}<defs>${filter}</defs><g filter="url(#syntheticSchlieren)">${layers.density}</g>${layers.foreground}</svg>`,field:{...view.field,quantity:'schlieren',label:'Synthetic schlieren |∇ρ|',options:[...new Set([...view.field.options,'schlieren'])],min:0,max:1,units:'relative',palette:['#ffffff','#000000'],note:'White: uniform density; black: strong density changes. Display-space gradient of normalized density with fixed contrast and smoothing; not a dimensional gradient, shock thickness or optical simulation. '+(view.field.note??'')}};
}
