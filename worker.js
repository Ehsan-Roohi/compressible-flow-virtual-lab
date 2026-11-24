import {calculate} from './labs.js?v=20261124-fanno-inverse-ratios';
import {readPublishedPressure} from './critical-mach-pressure.js?v=20261124-effective-pressure-angles';

// Coalesce queued slider changes and discard superseded online lookups.
let solveTimer, latestRequest;
self.onmessage=({data})=>{
 clearTimeout(solveTimer);
 latestRequest=data.request;
 solveTimer=setTimeout(async()=>{
  try{
   const published=data.id==='critical-mach'?await readPublishedPressure(data.inputs):null;
   if(data.request!==latestRequest)return;
   self.postMessage({request:data.request,ok:true,data:calculate(data.id,data.inputs,published)});
  }catch(e){
   if(data.request===latestRequest)self.postMessage({request:data.request,ok:false,error:e.message,code:e.code??'solver-error'});
  }
 },15);
};

