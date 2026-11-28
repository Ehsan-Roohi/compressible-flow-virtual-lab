import {chartSVG,colors as chartColors} from './graphics.js?v=20261128-shared-chart-frames';

const colors=['#167c70','#a5531d','#376fa2','#784693','#a93a50','#597127','#9b6e00','#505e76'];
const escape=text=>String(text).replace(/[<>&"']/g,char=>({
 '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;',
})[char]);

function panelKey(chart){
 if(chart.heatmap)return null;
 return chart.xlabel;
}

function ordinateScale(pins){
 const original=pins[0].chart;
 let bottom=Infinity,top=-Infinity;
 const include=value=>{
  if(!Number.isFinite(value))return;
  bottom=Math.min(bottom,value);top=Math.max(top,value);
 };
 for(const {chart} of pins){
  for(const series of chart.series)for(const [,y] of series.points)include(y);
  for(const marker of chart.markers??[])include(marker.y);
  if(chart.xReference)include(chart.xReference.y);
  if(chart.zeroBaseline!==false)include(0);
  for(const y of chart.yRange??[])include(y);
 }
 const pad=(top-bottom)*.06||Math.max(Math.abs(top)*.04,1e-6);
 if(bottom!==0)bottom-=pad;
 top+=pad;
 return original.invertYAxis?[top,bottom]:[bottom,top];
}

function sharedFrame(group){
 const original=group[0].chart,byOrdinate=new Map();
 for(const pin of group){
  const label=pin.chart.ylabel;
  if(!byOrdinate.has(label))byOrdinate.set(label,[]);
  byOrdinate.get(label).push(pin);
 }
 const multipleScales=byOrdinate.size>1;
 const reference=original.xReference;
 const sharedReference=!multipleScales&&reference&&group.every(({chart})=>
  chart.xReference?.x===reference.x&&chart.xReference?.y===reference.y&&chart.xReference?.label===reference.label);
 const scales=new Map(Array.from(byOrdinate,([label,pins],i)=>[
  label,{label,range:ordinateScale(pins),color:colors[i%colors.length]},
 ]));
 let colorIndex=0;
 const series=[],markers=[];
 const dashPatterns=['','7 4','2 3','9 3 2 3','12 4','6 3 1 3'];
 const curveCounts=new Map();
 for(const pin of group){
  const chart=pin.chart,scale=scales.get(chart.ylabel);
  const [bottom,top]=scale.range;
  const value=y=>multipleScales?(y-bottom)/(top-bottom):y;
  for(const curve of chart.series){
   const index=curveCounts.get(scale)??0;
   curveCounts.set(scale,index+1);
   series.push({...curve,name:`Pin ${pin.number} · ${pin.label} · ${curve.name}`,
    color:multipleScales?scale.color:colors[colorIndex++%colors.length],
    legendColor:undefined,scatter:curve.scatter??!!chart.scatter,
    dash:multipleScales?dashPatterns[index%dashPatterns.length]||curve.dash:curve.dash,
    points:multipleScales?curve.points.map(([x,y])=>[x,value(y)]):curve.points,
   });
  }
  for(const marker of chart.markers??[])markers.push({...marker,y:value(marker.y)});
  if(chart.xReference&&!sharedReference){
   const {x,y,label}=chart.xReference;
   markers.push({x,y:value(y),name:label??`φ = ${Number(x.toFixed(2))}°`});
  }
 }
 const title=multipleScales?`Properties vs ${original.xlabel}`:`${original.ylabel} vs ${original.xlabel}`;
 return {title,source:'',chart:{...original,title,series,scatter:false,
  markers:[...new Map(markers.map(marker=>[JSON.stringify(marker),marker])).values()],
  regionMarkers:group.some(pin=>pin.chart.regionMarkers),
  xReference:sharedReference?reference:undefined,xRange:undefined,
  ...(multipleScales?{yAxes:[...scales.values()],yRange:[0,1],invertYAxis:false,zeroBaseline:false}:
   {yRange:undefined,zeroBaseline:group.every(pin=>pin.chart.zeroBaseline===false)?false:undefined}),
 }};
}

export function pinnedChartPanels(pins){
 const panels=[],byAxes=new Map();
 for(const pin of pins){
  const key=panelKey(pin.chart);
  if(key!==null&&byAxes.has(key)){byAxes.get(key).push(pin);continue;}
  const group=[pin];
  panels.push(group);
  if(key!==null)byAxes.set(key,group);
 }
 return panels.map(group=>{
  const original=group[0].chart;
  if(group.length===1)return {title:original.title,source:`Pin ${group[0].number} · ${group[0].label}`,chart:original};
  return sharedFrame(group);
 });
}

function wrappedLabel(text,maxLength){
 const lines=[];
 for(const word of String(text).split(/\s+/)){
  const last=lines.at(-1);
  if(last&&last.length+word.length+1<=maxLength)lines[lines.length-1]=last+' '+word;
  else lines.push(word);
 }
 return lines;
}

function scopedSvg(svg,prefix){
 return svg.replace(/\bid="([^"]+)"/g,(_,id)=>`id="${prefix}-${id}"`)
  .replace(/url\(#([^)]*)\)/g,(_,id)=>`url(#${prefix}-${id})`)
  .replace(/\bhref="#([^"]+)"/g,(_,id)=>`href="#${prefix}-${id}"`);
}

export function pinnedChartFigure(pins){
 const panels=pinnedChartPanels(pins).map(panel=>({...panel,rendered:chartSVG(panel.chart)}));
 const width=Math.max(640,...panels.map(panel=>panel.rendered.axis.W));
 let y=0;
 const text=(label,x,top,size,weight=400)=>
  `<text x="${x}" y="${top}" font-family="Georgia, serif" font-size="${size}" font-weight="${weight}" fill="#17383b">${escape(label)}</text>`;
 const body=panels.map(({title,source,chart,rendered},index)=>{
  const heading=wrappedLabel(title,68).map(line=>{y+=21;return text(line,20,y,16,650);}).join('');
  const subtitle=source?wrappedLabel(source,82).map(line=>{y+=16;return text(line,20,y,12);}).join(''):'';
  y+=5;
  const {W,H}=rendered.axis;
  const plot=scopedSvg(rendered.svg,`pinned-${index+1}`)
   .replace('<svg ',`<svg x="0" y="${y}" width="${W}" height="${H}" `);
  y+=H;
  const legend=chart.series.map((curve,i)=>{
   if(curve.hideLegend)return '';
   const color=escape(curve.legendColor??curve.color??chartColors[i%chartColors.length]);
   const symbol=(curve.scatter??chart.scatter)?`<circle cx="33" cy="${y+4}" r="3" fill="${color}"/>`:
    `<line x1="20" x2="46" y1="${y+4}" y2="${y+4}" stroke="${color}" stroke-width="2"${curve.dash?` stroke-dasharray="${escape(curve.dash)}"`:''}/>`;
   return symbol+wrappedLabel(curve.name,80).map(line=>{y+=15;return text(line,54,y-7,11);}).join('');
  }).join('');
  y+=18;
  return `<g data-pinned-panel="${index+1}">${heading}${subtitle}${plot}${legend}</g>`+
   `<line x1="20" x2="${width-20}" y1="${y-7}" y2="${y-7}" stroke="#e1e9e7"/>`;
 }).join('');
 const height=Math.max(1,y);
 return {width,height,svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Pinned charts"><title>Pinned charts</title><rect width="${width}" height="${height}" fill="#fff"/>${body}</svg>`};
}
