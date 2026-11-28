import {chartSVG,colors as chartColors} from './graphics.js?v=20261128-pinned-charts';

const colors=['#167c70','#a5531d','#376fa2','#784693','#a93a50','#597127','#9b6e00','#505e76'];
const escape=text=>String(text).replace(/[<>&"']/g,char=>({
 '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;',
})[char]);

function panelKey(chart){
 if(chart.heatmap)return null;
 return JSON.stringify([chart.xlabel,chart.ylabel,!!chart.invertXAxis,!!chart.invertYAxis,
  !!chart.scatter,chart.xReference??null]);
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
  let colorIndex=0;
  const series=group.flatMap(pin=>pin.chart.series.map(curve=>({
   ...curve,name:`Pin ${pin.number} · ${pin.label} · ${curve.name}`,color:colors[colorIndex++%colors.length],
   legendColor:undefined,
  })));
  const markers=group.flatMap(pin=>pin.chart.markers??[]);
  const title=`${original.ylabel} vs ${original.xlabel}`;
  return {title,source:'',chart:{...original,title,series,
   markers:[...new Map(markers.map(marker=>[JSON.stringify(marker),marker])).values()],
   xRange:undefined,yRange:undefined,zeroBaseline:group.every(pin=>pin.chart.zeroBaseline===false)?false:undefined,
  }};
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
 const width=640;
 let y=0;
 const text=(label,x,top,size,weight=400)=>
  `<text x="${x}" y="${top}" font-family="Georgia, serif" font-size="${size}" font-weight="${weight}" fill="#17383b">${escape(label)}</text>`;
 const body=pinnedChartPanels(pins).map(({title,source,chart},index)=>{
  const heading=wrappedLabel(title,68).map(line=>{y+=21;return text(line,20,y,16,650);}).join('');
  const subtitle=source?wrappedLabel(source,82).map(line=>{y+=16;return text(line,20,y,12);}).join(''):'';
  y+=5;
  const rendered=chartSVG(chart);
  const {W,H}=rendered.axis;
  const plot=scopedSvg(rendered.svg,`pinned-${index+1}`)
   .replace('<svg ',`<svg x="0" y="${y}" width="${W}" height="${H}" `);
  y+=H;
  const legend=chart.series.map((curve,i)=>{
   if(curve.hideLegend)return '';
   const color=escape(curve.legendColor??curve.color??chartColors[i%chartColors.length]);
   const symbol=chart.scatter?`<circle cx="33" cy="${y+4}" r="3" fill="${color}"/>`:
    `<line x1="20" x2="46" y1="${y+4}" y2="${y+4}" stroke="${color}" stroke-width="2"${curve.dash?` stroke-dasharray="${escape(curve.dash)}"`:''}/>`;
   return symbol+wrappedLabel(curve.name,80).map(line=>{y+=15;return text(line,54,y-7,11);}).join('');
  }).join('');
  y+=18;
  return `<g data-pinned-panel="${index+1}">${heading}${subtitle}${plot}${legend}</g>`+
   `<line x1="20" x2="620" y1="${y-7}" y2="${y-7}" stroke="#e1e9e7"/>`;
 }).join('');
 const height=Math.max(1,y);
 return {width,height,svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Pinned charts"><title>Pinned charts</title><rect width="${width}" height="${height}" fill="#fff"/>${body}</svg>`};
}
