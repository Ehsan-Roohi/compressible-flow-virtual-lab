export const plotCoordinateAxis=({chart})=>'coordinate:'+encodeURIComponent(chart.xlabel);
const quantityAxis=plot=>plot.chart.heatmap?
 'map:'+encodeURIComponent(plot.chart.xlabel)+':'+encodeURIComponent(plot.chart.ylabel):
 'quantity:'+plot.key;

function hasVaryingOrdinate({chart}){
 let first;
 for(const series of chart.series)for(const [,y] of series.points)if(Number.isFinite(y)){
  if(first===undefined)first=y;
  else if(Math.abs(y-first)>1e-12*Math.max(1,Math.abs(y),Math.abs(first)))return true;
 }
 return false;
}

export function experimentXAxisOptions(plots){
 const axes=new Map();
 for(const plot of plots)axes.set(plotCoordinateAxis(plot),{key:plotCoordinateAxis(plot),label:plot.chart.xlabel});
 const quantities=new Map();
 for(const plot of plots)if(plot.chart.heatmap||hasVaryingOrdinate(plot)){
  const key=quantityAxis(plot);
  quantities.set(key,{key,label:plot.chart.ylabel,source:plot.label,map:!!plot.chart.heatmap});
 }
 const counts=new Map();
 for(const {label} of quantities.values())counts.set(label,(counts.get(label)??0)+1);
 return [...axes.values(),...Array.from(quantities.values(),({key,label,source,map})=>({
  key,label:map?`${label} · wave maps`:counts.get(label)>1?`${label} · ${source}`:label,
 }))];
}

const swapPoint=point=>({...point,x:point.y,y:point.x});
function transposedPlot(plot){
 const c=plot.chart,heatmap=c.heatmap&&{...c.heatmap,transposed:true};
 const reference=c.xReference&&{...swapPoint(c.xReference),name:c.xReference.label??'Slip line'};
 return {...plot,label:heatmap?plot.label:c.xlabel,
  note:heatmap?plot.note?.replace('horizontal cursor','vertical cursor'):plot.note,
  chart:{...c,title:heatmap?plot.label:`${c.xlabel} vs ${c.ylabel}`,xlabel:c.ylabel,ylabel:c.xlabel,
   invertXAxis:c.invertYAxis,invertYAxis:c.invertXAxis,xRange:c.yRange,yRange:c.xRange,
   zeroBaseline:false,heatmap,xReference:undefined,
   markers:[...(c.markers??[]).map(swapPoint),...(reference?[reference]:[])],
   series:c.series.map(s=>({...s,points:s.points.map(([x,y])=>[y,x])})),
  },
 };
}

const sameValue=(a,b)=>Math.abs(a-b)<=2e-12*Math.max(1,Math.abs(a),Math.abs(b));
const sameStations=(a,b)=>a.points.length===b.points.length&&a.points.every(([x],i)=>sameValue(x,b.points[i][0]));

function crossPlot(horizontal,vertical){
 if(horizontal===vertical||!horizontal.sampleFamily||horizontal.sampleFamily!==vertical.sampleFamily)return null;
 const xChart=horizontal.chart,yChart=vertical.chart;
 if(xChart.xlabel!==yChart.xlabel||xChart.heatmap||yChart.heatmap)return null;
 const series=[],markers=new Map();
 for(const y of yChart.series){
  const x=xChart.series.find(s=>sameStations(s,y)&&(s.sampleBranch||y.sampleBranch?
   s.sampleBranch===y.sampleBranch:
   s.name===y.name||xChart.series.length===1&&yChart.series.length===1));
  if(!x)continue;
  const points=y.points.map(([,value],i)=>[x.points[i][1],value]);
  if(points.some(p=>!p.every(Number.isFinite)))continue;
  series.push({...y,points});
  for(const marker of yChart.markers??[]){
   const i=y.points.findIndex(([a,b])=>sameValue(a,marker.x)&&sameValue(b,marker.y));
   if(i>=0)markers.set(marker,{...marker,x:points[i][0]});
  }
 }
 if(!series.some(s=>s.points.length>1))return null;
 const label=vertical.label.replace(/\s+vs x\/L$/,'');
 return {...vertical,label,chart:{title:label,xlabel:xChart.ylabel,ylabel:yChart.ylabel,series,
  zeroBaseline:false,scatter:yChart.scatter,markers:[...markers.values()],regionMarkers:yChart.regionMarkers,
 }};
}

export function experimentPlotsOnAxis(plots,axis){
 const native=plots.filter(p=>plotCoordinateAxis(p)===axis);
 if(native.length)return native;
 const sources=plots.filter(p=>quantityAxis(p)===axis);
 if(!sources.length)return [];
 const [horizontal]=sources;
 if(horizontal.chart.heatmap)return sources.map(transposedPlot);
 return [...plots.map(p=>crossPlot(horizontal,p)).filter(Boolean),transposedPlot(horizontal)];
}
