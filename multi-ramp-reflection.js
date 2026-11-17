import {solveWaveTracker} from './wave-tracker.js';
import {requireValue} from './numerics.js';

// March actual wall corners and reflections; never insert a terminal normal shock.
export function solveInletReflections(x,geometry){
 const {L,H,lower,wedgeLength,upperWall,lowerWall}=geometry;
 const end=Math.min(lower.at(-1).b[0],upperWall.b[0],lowerWall.b[0]);
 requireValue(end>0,'The common inlet-wall length must be positive.');
 const segments=[];for(const p of lower){if(p.a[0]>=end-1e-10)break;const dx=Math.min(end,p.b[0])-p.a[0];segments.push({angle:p.theta*180/Math.PI,length:dx/Math.cos(p.theta)});}
 // Solve in a normalized coordinate system so small dimensional lengths are valid.
 const scale=segments.reduce((s,p)=>s+p.length,0),h=H/scale;
 requireValue(h>=.01&&h<=100,'The inlet height/wedge length ratio is outside the wall-wave solver range (0.01–100).');
 const field=solveWaveTracker({...x,channelHeight:h,wallSegments:segments.map(p=>({...p,length:p.length/scale})),upperWallSegments:[{angle:0,length:end/scale}],trackingStep:.5,trackingStation:1,trackingRefine:'Off'});
 const t=field.tracking;
 const point=p=>({x:p.x*scale,y:p.y*scale});
 // Store dimensional display cells and traces; retain partial results if a later event is unsupported.
 const states=Object.values(t.allStates).sort((a,b)=>Number(a.stateId)-Number(b.stateId)),number=new Map(states.map((s,i)=>[s.stateId,String(i+1)])),regions=Object.fromEntries(states.map(s=>[number.get(s.stateId),s]));
 const cells=t.slabs.flatMap(s=>s.states.map((z,i)=>({region:number.get(z.stateId),state:z,poly:[[s.left*scale,s.bottoms[i]*scale],[s.right*scale,s.tops[i]*scale],[s.right*scale,s.tops[i+1]*scale],[s.left*scale,s.bottoms[i+1]*scale]]})));
 const traces=t.traces.map(w=>({...w,origin:point(w.origin),end:point(w.end)}));
 const waves=t.events.flatMap(e=>e.waves.map(w=>({...w,id:number.get(w.after.stateId),parentId:number.get(w.before.stateId),origin:[e.x*scale,e.y*scale],turn:w.after.theta-w.before.theta,rays:w.kind==='Oblique shock'?[w.before.theta+w.side*w.beta]:[]})));
 const reflection=t.events.find(e=>e.type==='Wall reflection'),final=waves.at(-1)?.after??field.s1;
 return {multiRamp:true,wallReflections:true,geometry,regions,s1:field.s1,gamma:x.gamma??1.4,R:x.R??287,waves,pre:final,final,normal:null,terminalRegion:null,overlap:false,
 reflectionField:{cells,traces,end:t.endX*scale,sharedEnd:end,partial:field.status!=='ok',reason:field.reason,hasFans:t.hasFanApproximation},reflectionLocation:reflection?reflection.x*scale:null,
 checks:{stagnationTemperature:Math.abs(final.T0/field.s1.T0-1),pressureMatch:t.maxPressureResidual},
 note:field.reason?`The accepted field is retained up to x = ${(t.endX*scale).toPrecision(5)} m. ${field.reason}`:reflection?'Regular wall reflections are computed. The last-wave state need not be uniform over the outlet.':'The wall ends before a reflected wave is formed; the incident-wave field is still solved. Lengthen the upper wall to include its reflection.'};
}
