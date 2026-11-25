// Restrict the existing closed-domain result to the interval before an
// end designated open begins to respond. No open-boundary solver or
// post-exit continuation is implied.
export const closedEnd = 'Closed end';
export const openEnd = 'Open end';
export const tubeEndFields = [
 {key:'tubeLeftBoundary',label:'Left boundary',value:closedEnd,options:[closedEnd,openEnd]},
 {key:'tubeRightBoundary',label:'Right boundary',value:closedEnd,options:[closedEnd,openEnd]}
];
export const tubeEndKeys = tubeEndFields.map(f=>f.key);
const isPiston = x => ['Single-stage piston','Two-stage piston','Sinusoidal piston'].includes(x.unsteadyExperiment);
const isValve = x => x.unsteadyExperiment === 'Sudden valve closure';
export function endSelection(x){
 return {
  left:!isPiston(x)&&x.tubeLeftBoundary===openEnd?openEnd:closedEnd,
  right:!isValve(x)&&x.tubeRightBoundary===openEnd?openEnd:closedEnd
 };
}
export function hasOpenEnd(x){
 const {left,right}=endSelection(x);return left===openEnd||right===openEnd;
}
export function tubeEndField(field,x){
 if(field.key==='tubeLeftBoundary'&&isPiston(x))return {...field,options:[closedEnd],selection:closedEnd,optionLabels:{[closedEnd]:'Moving piston (closed)'}};
 if(field.key==='tubeRightBoundary'&&isValve(x))return {...field,options:[closedEnd],selection:closedEnd,optionLabels:{[closedEnd]:'Closed valve'}};
 if(field.key==='tubeLeftBoundary'&&isValve(x))return {...field,optionLabels:{[closedEnd]:'Upstream piston (closed)',[openEnd]:'Open end (preview only)'}};
 return field;
}
function response(frame,initial,edge){
 // Detect a change in any of the already-computed boundary-adjacent
 // averages. A conservative cut avoids treating a closed-wall response
 // as an open-end prediction.
 return ['pressure','density','velocity'].some(key=>{
  const first=initial[key].at(edge),value=frame[key].at(edge);
  return !Number.isFinite(first)||!Number.isFinite(value)||Math.abs(value-first)>1e-6*Math.max(1,Math.abs(first));
 });
}
function clipSeries(series,left,right,limit,ends){
 return series.map(s=>{
  if(s.name==='Domain')return {...s,points:[[left,0],[right,limit]]};
  if(ends.left===openEnd&&s.name==='Moving piston')return {...s,name:'Upstream reference',points:clipPoints(s.points,limit)};
  if(ends.right===openEnd&&s.name==='Fixed wall')return {...s,name:'Open end',points:clipPoints(s.points,limit)};
  return {...s,points:clipPoints(s.points,limit)};
 }).filter(s=>s.points.length>=2);
}
function clipPoints(points,end){
 const result=[];
 for(let i=0;i<points.length;i++){
  const point=points[i];
  if(point[1]<=end){result.push(point);continue;}
  if(i>0&&points[i-1][1]<end){
   const prev=points[i-1],frac=(end-prev[1])/(point[1]-prev[1]);
   result.push([prev[0]+(point[0]-prev[0])*frac,end]);
  }
  break;
 }
 return result;
}
export function beforeOpenEnd(solved,x){
 const ends=endSelection(x);
 if(!hasOpenEnd(x))return solved;
 const source=solved.result,initial=source.frames[0];
 const edges=[...(ends.left===openEnd?[0]:[]),...(ends.right===openEnd?[-1]:[])];
 const first=source.frames.findIndex((f,i)=>i>0&&edges.some(edge=>response(f,initial,edge)));
 const frames=first<0?source.frames:source.frames.slice(0,first);
 if(frames.length<2){const error=Error('No nonzero before-interaction interval is resolved at the selected open end. The existing closed-domain history cannot represent this boundary choice.');error.code='boundary-preview-limit';throw error;}
 const end=frames.at(-1).time,limit=end*1000;
 const result={...source,frames,end,endPreview:ends,boundaryPreviewTruncated:first>=0,
  chart:{...source.chart,title:'Wave history · before open-end interaction',series:clipSeries(source.chart.series,source.left,source.right,limit,ends)},
  checks:{}};
 // Closed-run end-state and conservation diagnostics do not describe a
 // clipped preview. Do not present them as open-end results.
 const rows=solved.rows.filter(([label])=>!/reflected|wall|sample|final|simulation|simulated time|numerical|piston work|at piston|merge|catch-up|merger|comparison time|RMS error|reaches|time between|mass per unit area/i.test(label));
 rows.push(['Displayed time',limit,'ms']);
 return {...solved,result,rows};
}
