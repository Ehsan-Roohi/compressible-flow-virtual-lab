export const parameterAxis='calculator-parameter';
export const coneFreestreamAxis='cone-freestream-mach';

const axisName=({key,label,chart})=>chart.ylabel==='M'?'Local Mach number M':
 key==='appendix-oblique-beta'?'Shock angle β':label;

export function calculatorXAxisOptions(plots){
 const original=plots[0];
 if(!original)return [];
 return [{key:parameterAxis,label:original.chart.xlabel},...plots
  .filter(({chart})=>chart.series.some(({points})=>points.some(([,y])=>Number.isFinite(y)&&y!==points[0][1])))
  .map(plot=>({key:plot.key,label:axisName(plot)}))];
}

export function calculatorPlotsOnAxis(plots,axis){
 const horizontal=plots.find(p=>p.key===axis);
 if(!horizontal)return plots;
 const {chart:xChart}=horizontal;
 const xValues=xChart.series.map(s=>new Map(s.points));
 const parameter={
  key:parameterAxis,label:xChart.xlabel,
  chart:{title:xChart.xlabel,ylabel:xChart.xlabel,series:xChart.series.map(s=>({
   ...s,name:xChart.series.length===1?xChart.xlabel:s.name,points:s.points.map(([x])=>[x,x]),
  }))},
 };
 const axisLabel=xChart.ylabel==='M'?'Local Mach number M':xChart.ylabel;
 const invertXAxis=xChart.invertXAxis&&xChart.series[0].points[0][1]>xChart.series[0].points.at(-1)[1];
 return [...plots,parameter].filter(p=>p!==horizontal).map(option=>{
  const series=option.chart.series.map((s,i)=>({...s,points:s.points.flatMap(([sample,y])=>{
   const x=xValues[i]?.get(sample);
   return Number.isFinite(x)&&Number.isFinite(y)?[[x,y]]:[];
  })})).filter(s=>s.points.length);
  const label=option.key==='appendix-oblique-beta'?'Shock angle β':option.label;
  return {...option,label,note:xChart.invertXAxis
   ?'The plotted values come from the same conical flow solution between the shock and the cone surface.'
   :option.note,
   chart:{title:label,xlabel:axisLabel,ylabel:option.chart.ylabel,series,invertXAxis,
    zeroBaseline:false,yRange:option.chart.yRange}};
 }).filter(({chart})=>chart.series.some(({points})=>points.length>1));
}
