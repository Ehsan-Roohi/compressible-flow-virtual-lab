// Synthetic, display-space signed vertical density gradient. No optical ray tracing
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
export function schlierenLayers(svg,palette,{lightSurround=false}={}){
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
 const overlay=svg.replace(/<(?:path|polygon|rect|circle|ellipse|polyline|line)\b[^>]*>/g,tag=>{const c=tag.match(/\bfill="([^"]+)"/)?.[1];return c&&(coordinate(c)!==null||gradients.has(c.match(/^url\(#([^)]*)\)$/)?.[1]))?replaceAttr(tag,'fill',lightSurround?'#909090':'none'):tag;});
 const body=s=>s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 const density=body(source).replace(/\bid="([^"]+)"/g,'id="schSource-$1"').replace(/url\(#([^)]*)\)/g,'url(#schSource-$1)');
 let foregroundDefs=0;
 const foreground=body(overlay).replace(/<\/?[\w:-]+\b[^>]*>/g,tag=>{if(/^<defs\b/.test(tag)){foregroundDefs++;return tag;}if(/^<\/defs/.test(tag)){foregroundDefs--;return tag;}if(foregroundDefs||!/^<(?:path|polygon|rect|circle|ellipse|polyline)\b/.test(tag))return tag;return replaceAttr(tag,'fill','none');});
 const grayscaleContext=markup=>markup
  .split(/(<clipPath\b[\s\S]*?<\/clipPath>)/g)
  .map(part=>part.startsWith('<clipPath')?part:part
   .replace(/\b(fill|stroke)="([^"]+)"/g,(attr,name,color)=>{
    if (/^(?:white|#fff(?:fff)?|#fcfdfc|#f8fbf6|#eef1f2|#edf0f0)$/i.test(color))return `${name}="${lightSurround?'#f2f5f0':'#909090'}"`;
    const channels=rgb(color);
    if(!channels)return attr;
    const gray=Math.round(.2126*channels[0]+.7152*channels[1]+.0722*channels[2]);
    return `${name}="rgb(${gray},${gray},${gray})"`;
   })
   .replace(/<text\b[^>]*>/g,tag=>replaceAttr(tag,'fill','#242424'))).join('');
 return {density,overlay:grayscaleContext(body(overlay)),foreground:grayscaleContext(foreground.replace(/<defs\b[\s\S]*?<\/defs>/g,'')),count};
}
export function schlierenView(view,direction='vertical',{lightSurround=false}={}){
 const sensitivity={
  axial:{kernel:'1 0 -1 2 0 -2 1 0 -1',divisor:8,result:'dx',label:'axial'},
  diagonal:{kernel:'0 -2 -2 2 0 -2 2 2 0',divisor:16,result:'diagonal',label:'diagonal'},
  vertical:{kernel:'-1 -2 -1 0 0 0 1 2 1',divisor:8,result:'dy',label:'vertical'},
 }[direction];
 const layers=schlierenLayers(view.svg,view.field?.palette,{lightSurround});if(!layers.count)return null;
 const root=view.svg.match(/^<svg[^>]*>/)?.[0];if(!root)return null;
 // The Sobel kernel projects the signed gradient onto the selected direction.
 // Alpha erosion suppresses false gradients at the fluid mask.
 const filter=`<filter id="syntheticSchlieren" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
 <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="smooth"/>
 <feConvolveMatrix in="smooth" order="3" kernelMatrix="${sensitivity.kernel}" divisor="${sensitivity.divisor}" bias="0.5" preserveAlpha="true" result="${sensitivity.result}"/>
 <feComponentTransfer in="${sensitivity.result}" result="tone">
  <feFuncR type="table" tableValues="0.91 0.91 0.565 0.10 0.10"/>
  <feFuncG type="table" tableValues="0.91 0.91 0.565 0.10 0.10"/>
  <feFuncB type="table" tableValues="0.91 0.91 0.565 0.10 0.10"/>
 </feComponentTransfer>
 <feMorphology in="SourceAlpha" operator="erode" radius="2.5" result="interior"/><feComposite in="tone" in2="interior" operator="in"/>
 </filter>`;
 return {...view,label:'Synthetic schlieren · density gradient',svg:root.replace('>',' data-schlieren="true">')+`<rect x="0" y="0" width="100%" height="100%" fill="${lightSurround?'#f2f5f0':'#909090'}"/>${layers.overlay}<defs>${filter}</defs><g filter="url(#syntheticSchlieren)">${layers.density}</g>${layers.foreground}</svg>`,field:{...view.field,quantity:'schlieren',label:`Synthetic schlieren · signed ${sensitivity.label} density gradient`,options:[...new Set([...view.field.options,'schlieren'])],min:-1,max:1,units:'relative',palette:['#e8e8e8','#909090','#1a1a1a'],note:`Mid-gray: uniform density. Light and dark indicate opposite signs of the ${sensitivity.label} density gradient. Relative display contrast. `+(view.field.note??'')}};
}
