import {finiteTubeMode,finiteTubeFrame,closedPistonMode,sinusoidalExperiment} from './finite-tube.js?v=20261118-restore-sample';
import {valveExperiment} from './valve-closure.js';
import {multiRampMode,multiRampPreset,multiRampProblemPreset} from './multi-ramp-inlet.js?v=20261118-wave-density';
import {probeAirfoilField} from './airfoil-field.js?v=20261117-multi-inlet';
import {shockFanMode,shockFanPreset} from './shock-fan-example.js?v=20261118-wave-density';
import {compactTypedInputs} from './typed-inputs.js?v=20261114-compact-inputs';
import {probeWedgeWall} from './wedge-wall.js?v=20261114-region-markers';
import {ramjetMode,ramjetPreset,ramjetDescription,ramjetLimit} from './ramjet-inlet.js?v=20261114-restored-inlet-text';
import {probeInlet} from './ramjet-inlet-graphics.js?v=20261118-wave-density';
import {fannoExamples} from './fanno-examples.js?v=20261114-conditional-duct';
import {fannoSystemMode,fannoSolves,fannoConditions,fannoPressurePlan,migrateFannoInputs} from './fanno-system.js?v=20261114-conditional-duct';
import {rayleighDistributionNote,fannoDistributionNote} from './duct-contours.js?v=20261113-rainbow-physical';
import {uniformDiagramText} from './diagram-typography.js?v=20261112-diagram-labels';
import {rayleighHeatBounds} from './rayleigh-input.js?v=20261110-rayleigh-audit';
import {reservoirExamples} from './reservoir-examples.js?v=20261110-moving-upstream';
import {chartWorkbook} from './chart-export.js';
import {probeBody} from './body-probe.js?v=20261110-simple-examples';
import {comparisonHTML} from './channel-comparison.js';
import {fittedInspectionHTML,fittedPointHTML,selectedFittedPoint,fittedExportRows} from './channel-moc-shocks-tables.js';
import {probeFittedMOC} from './channel-moc-shocks-graphics.js?v=20261118-wave-density';
import {channelSolverName} from './channel-solver.js?v=20261114-custom-final';
import {trackingPreset} from './wave-tracker.js?v=20261109-wedge-cone';
import {trackingInspectionHTML,drawableTrackingEvents,defaultTrackingEvent,selectTrackingEvent,trackingExportRows,trackingSummaryRows} from './wave-tracker-tables.js?v=20261117-example-numbers';
import {probeTracking} from './wave-tracker-graphics.js?v=20261118-wave-density';
import {chapter6Example} from './regular-channel.js?v=20261109-wedge-cone';
import {wallPresets} from './wave-wall.js?v=20261109-wedge-cone';
import {airfoilTables} from './airfoil-tables.js?v=20261117-multi-inlet';
import {airfoilGeometry,migrateAirfoilGeometry,diamondModes,diamondInputValues,segmentSurface,constrainedSurface,automaticSurface,connectedSurface,surfaceSegments,presetSegments} from './airfoil.js?v=20261117-multi-inlet';
import {nearestChartPoint} from './chart-probe.js?v=20261109-wedge-cone';
import {probeCone} from './cone-probe.js?v=20261109-wedge-cone';
import {plotOptions} from './plot-options.js?v=20261119-rayleigh-heat-arrow';
import {selectGas,gasInfo} from './gas-properties.js?v=20261109-wedge-cone';
import {controlVolumePreset} from './control-volume.js?v=20261109-wedge-cone';
import {pressureSweepPlan,advancePressure} from './sweep.js?v=20261109-wedge-cone';
import {labs,chapters,defaults as experimentDefaults,inputDefinitions,nozzleInfo,trackingShockDetails} from './labs.js?v=20261119-rayleigh-heat-tooltip';
import {sceneSVG,chartSVG,fmt,finiteTubeFlowView} from './graphics.js?v=20261119-rayleigh-heat-arrow';
const coneBookPreset={
 bodyGeometry:'Cone',fluid:'Air',M:2,thetaCone:9,p1:7,T1:217,
 temperatureInput:'Static temperature',inletPressureType:'Static pressure',
};
const coneExampleChanged=()=>id==='cone'&&inputs.bookExample==='10-1'&&
 Object.entries(coneBookPreset).some(([key,value])=>inputs[key]!==value);
function defaults(id){
 const inputs=experimentDefaults(id);
 if(id==='normal')return {...inputs,bookExample:''};
 return id==='tube'?{...inputs,tubeDomain:finiteTubeMode,pistonDomain:closedPistonMode,pistonDelay:.001}:inputs;
}
const $=id=>document.getElementById(id);let id='rayleigh',inputs={},request=0,current=null,pinned=null,timer,animation=false,frame,lastFrame=0,sceneTime=.001,fieldQuantity='pressure';
let pendingWaveShape=null,pendingBookCase=null,pendingCustomChannel=false,pendingLegacyCorner=null;
let displayedChart=null,chartChoices=[],plotSelection={};
const worker=new Worker(new URL('./worker.js?v=20261119-cone-limit-help',import.meta.url),{type:'module'});
function renderNav(){ $('chapters').innerHTML=chapters.map(([n,title,,ids])=>`<a href="#${ids[0]}" class="${ids.includes(id)?'active':''}" ${ids.includes(id)?'aria-current="page"':''}><span><span class="nav-title">${title}</span></span></a>`).join('');}
function openLab(){stopSweep();clearTimeout(timer);sweepPositioned=false;sweepFinished=false;const [section,query]=location.hash.slice(1).split('?',2);let next=section||'rayleigh';if(['oblique','expansion'].includes(next)){pendingLegacyCorner=next;pendingWaveShape=next==='oblique'?'Compression ramp':'Expansion corner';location.hash='wall';return;}if(next==='balances'){location.hash='foundations';return;}if(next==='linear'){location.hash='airfoil';return;}if(!labs[next]){location.hash='rayleigh';return;}id=next;current=null;stopAnimation();inputs=defaults(id);try{let saved=JSON.parse(localStorage.getItem('gdvl-inputs-'+id+(id==='balances'?'-cv2':'')));if(saved&&typeof saved==='object'){for(let k in inputs)if(k in saved)inputs[k]=saved[k];if(id==='wall'&&saved.customInteraction===multiRampMode&&saved.inletSolutionVersion!==2){inputs.inletTerminal='Wall reflections';inputs.inletSolutionVersion=2;}if(id==='wall'&&saved.theta===undefined&&saved.wallSegments?.length)inputs.theta=Math.abs(saved.wallSegments[0].angle);if(id==='airfoil'&&!saved.geometryInput){const old=airfoilGeometry({...inputs,geometryInput:inputs.airfoilShape==='Custom panels'?'Coordinates':'Dimensions'});inputs.upperSegments=surfaceSegments(old.upper,inputs.airfoilShape==='Custom panels');inputs.lowerSegments=surfaceSegments(old.lower,inputs.airfoilShape==='Custom panels');inputs.geometryInput='Angles & lengths';}if(['oblique','expansion'].includes(id)&&saved.cornerColorVersion!==1)inputs.cornerView='Analytical contours';}}catch{}inputs.fluid=gasInfo(inputs).name;if(pendingWaveShape){if(id==='wall'){if(pendingWaveShape===ramjetMode)inputs={...inputs,...ramjetPreset};inputs.wallShape=pendingWaveShape;if(pendingWaveShape!=='Custom wall'&&pendingWaveShape!==ramjetMode&&pendingWaveShape!==shockFanMode){inputs.boundaryMode='Single wall';inputs.theta=Math.abs(wallPresets[pendingWaveShape][0].angle);}if(pendingWaveShape===shockFanMode)inputs={...inputs,...shockFanPreset};if(pendingWaveShape!==ramjetMode&&pendingWaveShape!==shockFanMode)inputs.wallSegments=wallPresets[pendingWaveShape].map(p=>({...p,angle:p.angle*(inputs.wallSide==='Gas below wall'?-1:1)}));}if(id==='collision'){inputs.interactionType=pendingWaveShape;inputs.geometryMode='Custom geometry';}pendingWaveShape=null;}if(pendingBookCase){inputs={...inputs,...chapter6Example(pendingBookCase)};pendingBookCase=null;}if(pendingLegacyCorner&&id==='wall'){let legacy=defaults(pendingLegacyCorner);try{legacy={...legacy,...JSON.parse(localStorage.getItem('gdvl-inputs-'+pendingLegacyCorner)||'{}')};}catch{}for(const key of ['M1','T1','p1','gamma','R','fluid','branch','cornerView','theta'])if(legacy[key]!==undefined)inputs[key]=legacy[key];inputs.wallSide='Gas above wall';pendingLegacyCorner=null;}if(pendingMultiInlet&&id==='wall'){Object.assign(inputs,multiRampPreset);pendingMultiInlet=false;}if(pendingCustomChannel&&id==='wall'){inputs.wallShape='Custom wall';inputs.boundaryMode='Channel';inputs.channelSolver='Shock–Expansion';pendingCustomChannel=false;}if(id==='collision')inputs.geometryMode='Custom geometry';if(id==='wall')inputs.channelSolver=channelSolverName(inputs.channelSolver);let l=labs[id];$('labTitle').textContent=l.chapter===6?'Supersonic Wave Lab':l.title;$('description').textContent=l.description;$('model').textContent=l.model;$('limitations').textContent=l.limitations;let chapter=chapters.find(x=>x[0]===l.chapter);$('labTabs').hidden=l.chapter===6||chapter[3].length<2;$('labTabs').innerHTML=l.chapter===6||chapter[3].length<2?'':chapter[3].map(k=>`<button type="button" data-lab="${k}" class="${id===k?'active':''}">${labs[k].title}</button>`).join('');$('labTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>location.hash=b.dataset.lab);renderNav();renderInputs();const example=new URLSearchParams(query).get('example'),select=$('exampleSelect');if(example&&select&&Array.from(select.options).some(option=>option.value===example)){select.value=example;select.onchange({target:select});return;}solve();}
let pendingMultiInlet=false;
const waveShapes=['Compression ramp','Expansion corner','Custom wall',ramjetMode];
function waveGeometrySelector(){
 if(labs[id].chapter!==6)return '';
 const value=id==='wall'?inputs.wallShape:'',interaction=id==='collision'?inputs.interactionType:inputs.customInteraction===multiRampMode?multiRampMode:'';
 const interactionControl=id==='collision'||value==='Custom wall'?`<div class="input-group"><div class="input-top"><label for="waveInteractionSelect">Wave Interaction</label></div><select id="waveInteractionSelect"><option value="" disabled ${!interaction?'selected':''}>Select interaction…</option>${['Opposing shocks','Same-direction shocks',multiRampMode].map(v=>`<option ${v===interaction?'selected':''}>${v}</option>`).join('')}</select></div>`:'';
 return `<div class="input-group"><div class="input-top"><label for="waveGeometrySelect">Geometry</label></div><select id="waveGeometrySelect"><option value="" disabled ${!value?'selected':''}>Select geometry…</option>${waveShapes.map(v=>`<option ${v===value?'selected':''}>${v}</option>`).join('')}</select></div>`+interactionControl;
}
function bindWaveGeometrySelector(){
 const select=$('waveGeometrySelect');if(!select)return;
 select.onchange=()=>{inputs.customInteraction='';try{localStorage.setItem('gdvl-inputs-wall',JSON.stringify(inputs));}catch{}pendingWaveShape=select.value;if(id==='wall')openLab();else location.hash='wall';};
 if($('waveInteractionSelect'))$('waveInteractionSelect').onchange=()=>{if($('waveInteractionSelect').value===multiRampMode){if(id==='wall'){Object.assign(inputs,multiRampPreset);renderInputs();request++;schedule();}else{pendingWaveShape='Custom wall';pendingMultiInlet=true;location.hash='wall';}return;}inputs.customInteraction='';pendingWaveShape=$('waveInteractionSelect').value;if(id==='collision')openLab();else location.hash='collision';};
}
function wallSegmentEditor(f){
 const key=f.key,segments=inputs[key],relative=key.startsWith('inlet'),side=key==='inletUpperSegments'?'Upper inlet wall':key==='inletBottomSegments'?'Lower wedge':key==='inletLowerSegments'?'Upper wedge':key==='upperWallSegments'?'Upper wall':inputs.boundaryMode==='Channel'&&inputs.wallShape==='Custom wall'?'Lower wall':'Wall';
 return `<div id="editor-${key}" class="segment-editor"><table><thead><tr><th>#</th><th>${relative?'Angle to horizontal (°)':'Angle (°)'}</th><th>${relative?'Lᵢ/Lref':'Length (m)'}</th><th></th></tr></thead><tbody>${segments.map((p,i)=>`<tr><th>${i+1}</th><td><input type="number" step="any" value="${fmt(p.angle,6)}" data-index="${i}" data-property="angle" aria-label="${side} segment ${i+1} angle"></td><td><input type="number" step="any" value="${fmt(p.length,6)}" data-index="${i}" data-property="length" aria-label="${side} segment ${i+1} length"></td><td><button type="button" data-remove="${i}" aria-label="Remove ${side.toLowerCase()} segment ${i+1}" ${segments.length===1?'disabled':''}>×</button></td></tr>`).join('')}</tbody></table><button type="button" class="segment-add" aria-label="Add ${side.toLowerCase()} segment" ${segments.length>=8?'disabled':''}>+ Add segment</button></div>`;
}
function bindWallSegments(f){
 const key=f.key,box=$('editor-'+key);
 for(const n of box.querySelectorAll('input')){const wasPreset=inputs.wallShape!=='Custom wall';n.oninput=()=>{inputs.wallShape='Custom wall';if($('waveGeometrySelect'))$('waveGeometrySelect').value='Custom wall';inputs[key]=inputs[key].map((p,i)=>i===Number(n.dataset.index)?{...p,[n.dataset.property]:n.value.trim()===''?NaN:Number(n.value)}:p);request++;schedule();if(wasPreset){renderInputs();$('editor-'+key).querySelector(`[data-index="${n.dataset.index}"][data-property="${n.dataset.property}"]`)?.focus();}};}
 for(const b of box.querySelectorAll('[data-remove]'))b.onclick=()=>{inputs[key]=inputs[key].filter((_,i)=>i!==Number(b.dataset.remove));renderInputs();request++;schedule();};
 box.querySelector('.segment-add').onclick=()=>{if(inputs[key].length>=8)return;inputs[key]=[...inputs[key],{angle:inputs[key].at(-1).angle,length:1}];inputs.wallShape='Custom wall';renderInputs();request++;schedule();};
}
function segmentEditor(f){
 const values=inputs[f.key]??[],chain=inputs.airfoilShape==='Connected flat plates',max=['Custom panels','Bent flat plate','Connected flat plates'].includes(inputs.airfoilShape)?20:1,side=['Bent flat plate','Connected flat plates'].includes(inputs.airfoilShape)?'Plate':f.key==='upperSegments'?'Upper':'Lower',constrained=['Custom panels','Bent flat plate'].includes(inputs.airfoilShape)&&values.length>=2,adjustAll=inputs.airfoilShape==='Bent flat plate'&&inputs.plateLengthMode!=='Keep earlier lengths';
 return `<div id="value-${f.key}" class="segment-editor" role="group" aria-label="${side} segment geometry"><table><thead><tr><th>#</th><th>Angle (°)</th><th>${chain?'Length (m)':adjustAll?'Target L/c':'L/c'}</th>${adjustAll?'<th>Adjusted L/c</th>':''}<th></th></tr></thead><tbody>${values.map((p,i)=>`<tr><th>${i+1}</th><td><input type="number" step="any" inputmode="decimal" data-index="${i}" data-property="angle" value="${Number.isFinite(p.angle)?fmt(p.angle,6):''}" aria-label="${side} segment ${i+1} angle"></td><td><input type="number" step="any" inputmode="decimal" data-index="${i}" data-property="length" ${!chain&&!adjustAll&&(constrained||values.length===1&&Math.abs(p.angle)<1e-12)&&i>=values.length-2?'readonly title="Calculated to close at the trailing edge"':''} value="${Number.isFinite(p.length)?fmt(p.length,6):''}" aria-label="${side} segment ${i+1} length"></td>${adjustAll?`<td data-adjusted-length="${i}">—</td>`:''}<td><button type="button" data-remove="${i}" aria-label="Remove ${side.toLowerCase()} segment ${i+1}">×</button></td></tr>`).join('')}<tr class="segment-auto" data-closing-row><th>Closing</th><td data-closing-angle>—</td><td data-closing-length>—</td><td></td></tr></tbody></table><button type="button" class="segment-add" ${values.length>=max?'disabled':''}>+ Add segment</button><p class="control-hint" data-closure-message></p></div>`;
}
function updateClosingSegment(key){
 const box=$('value-'+key);if(!box)return;
 const chain=inputs.airfoilShape==='Connected flat plates',constrained=['Custom panels','Bent flat plate'].includes(inputs.airfoilShape)&&inputs[key].length>=2,adjustAll=inputs.airfoilShape==='Bent flat plate'&&inputs.plateLengthMode!=='Keep earlier lengths';
 let z,error;try{z=(chain?connectedSurface:adjustAll?automaticSurface:constrained?constrainedSurface:segmentSurface)(inputs[key],key==='upperSegments'?'Upper surface':'Lower surface',['Custom panels','Bent flat plate','Connected flat plates'].includes(inputs.airfoilShape)?20:1);}catch(e){error=e.message;}
 box.querySelector('[data-closing-row]').hidden=chain||adjustAll||constrained||!!z&&!z.closing;
 box.querySelector('[data-closing-angle]').textContent=z?.closing?fmt(z.closing.angle,6):'—';
 box.querySelector('[data-closing-length]').textContent=z?.closing?fmt(z.closing.length,6):'—';
 for(const input of box.querySelectorAll('input[data-property="length"]'))if(input.readOnly){
  const i=Number(input.dataset.index),value=z?.lengths?.[i];input.value=Number.isFinite(value)?fmt(value,8):'';
  if(Number.isFinite(value))inputs[key][i]={...inputs[key][i],length:value};
 }
 for(const cell of box.querySelectorAll('[data-adjusted-length]')){const v=z?.lengths?.[Number(cell.dataset.adjustedLength)];cell.textContent=Number.isFinite(v)?fmt(v,8):'—';}
 box.querySelector('[data-closure-message]').textContent=error??(chain?'Angles are measured from horizontal; lengths are in metres. Panels connect exactly as entered. No automatic closure or length adjustment.':adjustAll?'All target lengths are editable. Adjusted lengths satisfy trailing-edge closure while retaining the target proportions as closely as possible.':constrained?'The final two lengths are calculated from the angles to meet at x/c = 1, y/c = 0. No extra panel is added.':z?.closing?'The closing panel reaches x/c = 1, y/c = 0. Its angle and length are calculated.':'Surface ends at the trailing edge; no extra panel is added.');
}

function bindSegmentEditor(f){
 const box=$('value-'+f.key),changed=()=>{request++;updateClosingSegment(f.key);schedule();};updateClosingSegment(f.key);
 for(const n of box.querySelectorAll('input'))n.oninput=()=>{const index=Number(n.dataset.index),property=n.dataset.property;inputs[f.key]=inputs[f.key].map((p,i)=>i===index?{...p,[property]:n.value.trim()===''?NaN:Number(n.value)}:p);changed();};
 for(const button of box.querySelectorAll('[data-remove]'))button.onclick=()=>{inputs[f.key]=inputs[f.key].filter((_,i)=>i!==Number(button.dataset.remove));renderInputs();changed();};
 box.querySelector('.segment-add').onclick=()=>{
  const values=inputs[f.key];if(values.length>=(['Custom panels','Bent flat plate','Connected flat plates'].includes(inputs.airfoilShape)?20:1))return;
  if(inputs.airfoilShape==='Connected flat plates'){const p=values.at(-1)??{angle:0,length:1};inputs[f.key]=[...values,{...p}];}
  else if(values.length>=2){const i=values.length-2,p=values[i];inputs[f.key]=[...values.slice(0,i),{...p,length:p.length/2},{...p,length:p.length/2},...values.slice(i+1)];}
  else if(values.length===1)inputs[f.key]=[...values,{angle:-values[0].angle,length:values[0].length}];
  else inputs[f.key]=[{angle:0,length:1}];
  renderInputs();changed();
 };

}
function changeAirfoilGeometry(key,value){
 let previous;try{previous=airfoilGeometry(inputs);}catch{}
 inputs[key]=value;
 if(key==='plateLengthMode'&&previous)inputs.upperSegments=surfaceSegments(previous.upper,true);
 if(key==='plateDefinition'&&value==='Multiple panels'&&previous){inputs.upperSegments=surfaceSegments(previous.upper,true);inputs.geometryInput='Angles & lengths';}
 if(key==='geometryInput'&&previous){
  if(inputs.airfoilShape==='Diamond'&&diamondModes.includes(value))Object.assign(inputs,diamondInputValues(previous));
  if(value==='Angles & lengths'){inputs.upperSegments=surfaceSegments(previous.upper,inputs.airfoilShape==='Custom panels');inputs.lowerSegments=surfaceSegments(previous.lower,inputs.airfoilShape==='Custom panels');}
  else{const encode=points=>points.map(p=>`${Number(p.x.toPrecision(13))},${Number(p.y.toPrecision(13))}`).join('; ');inputs.upperProfile=encode(previous.upper);inputs.lowerProfile=encode(previous.lower);}
 }
 if(key==='airfoilShape'){
  inputs.geometryInput='Angles & lengths';
  if(value==='Connected flat plates'&&previous)inputs.upperSegments=surfaceSegments(previous.upper,true);
  if(value==='Bent flat plate'&&inputs.plateDefinition==='Multiple panels'&&previous)inputs.upperSegments=surfaceSegments(previous.upper,true);
  if(value==='Custom panels'&&previous){inputs.upperSegments=surfaceSegments(previous.upper,inputs.airfoilShape==='Custom panels');inputs.lowerSegments=surfaceSegments(previous.lower,inputs.airfoilShape==='Custom panels');}
  else if(!['Flat plate','Bent flat plate','Connected flat plates'].includes(value)){const preset=presetSegments({...inputs,camber:value==='Asymmetric double wedge'?(inputs.camber||.01):0});inputs.upperSegments=preset.upper;inputs.lowerSegments=preset.lower;if(value==='Diamond'){Object.assign(inputs,diamondInputValues(airfoilGeometry(inputs)));inputs.geometryInput='Angle & length ratio';}}
 }
 renderInputs();request++;schedule();
}
function arrangeWallInputs(){
 const panel=$('wallSetupPanel'),active=['wall','collision','airfoil','cone'].includes(id);
 $('profileStationControls').innerHTML='';$('profileStationControls').hidden=true;
 panel.classList.toggle('cone-setup',id==='cone'&&inputs.bodyGeometry==='Cone');
 panel.hidden=!active;panel.classList.toggle('collision-setup',id==='collision'||id==='wall'&&inputs.customInteraction===multiRampMode);if(!active){panel.innerHTML='';return;}
 const editorsOpen=panel.querySelector('#wallEditors')?.open??false,settingsOpen=panel.querySelector('#wallSolverSettings')?.open??false;
 panel.innerHTML=`<div class="card-head"><h2>Geometry & solution</h2></div><div id="wallSetupControls" class="wall-setup-grid"></div><div class="wall-setup-details"><details id="wallEditors" ${editorsOpen?'open':''}><summary>${id==='airfoil'?'Edit surface geometry':'Edit wall segments'}</summary><div id="wallEditorControls" class="wall-editor-grid"></div></details><details id="wallSolverSettings" ${settingsOpen?'open':''}><summary>Solver settings</summary><div id="wallSolverControls" class="wall-setup-grid"></div></details></div>`;
 for(const key of ['bodyGeometry','nearbyWall','wallDistance','thetaCone','wedgeAlpha','waveGeometrySelect','waveInteractionSelect','theta','branch','cornerView','boundaryMode','channelSolver','channelHeight','ramjetOrientation','inletFlowSide','inletLowerDefinition','inletLowerHeightRatio','inletLowerWallLengthRatio','inletLowerStartRatio','inletLowerCowlRatio','inletReference','inletHeightRatio','inletCowlRatio','inletUpperWallRatio','inletUpperStartRatio','inletTerminal','wallSide','thetaUpper','thetaLower','fanShockAngle','fanExpansionAngle','cornerSpacing','airfoilShape','geometryInput','airfoilMethod','alpha','thickness','peak','camber','diamondFrontAngle','diamondRearAngle','diamondFrontLength','diamondRearLength','bendHeight','bendPosition','plateDefinition','plateLengthMode']){
  const control=$(key.startsWith('wave')?key:'value-'+key);if(control)$('wallSetupControls').append(control.closest('.input-group'));
 }
 if(id==='wall'&&inputs.customInteraction===multiRampMode){
  for(const [title,keys] of [['Upper wall geometry',['inletHeightRatio','inletUpperWallRatio','inletUpperStartRatio','inletCowlRatio']],['Lower wall geometry',['inletLowerHeightRatio','inletLowerWallLengthRatio','inletLowerStartRatio','inletLowerCowlRatio']]]){
   const controls=keys.map(k=>$('value-'+k)?.closest('.input-group')).filter(Boolean);if(!controls.length)continue;
   const group=document.createElement('fieldset');group.className='inlet-wall-geometry';group.style.cssText='grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;border:1px solid #dce7e5;border-radius:6px;padding:12px;min-width:0';
   const legend=document.createElement('legend');legend.textContent=title+(inputs.inletFlowSide==='Flow below wedge'&&inputs.inletLowerDefinition!=='Independent lower side'?' · mirrored reference':'');group.append(legend,...controls);$('wallSetupControls').append(group);
  }
 }
 for(const key of ['wallSegments','upperWallSegments','inletLowerSegments','inletUpperSegments','inletBottomSegments']){const editor=$('editor-'+key);if(editor)$('wallEditorControls').append(editor.closest('.input-group'));}
 for(const key of ['upperSegments','lowerSegments','upperProfile','lowerProfile']){const control=$('value-'+key);if(control)$('wallEditorControls').append(control.closest('.input-group'));}
 for(const key of ['trackingStep','trackingRefine','mocResolution','mocLines']){const control=$('value-'+key);if(control)$('wallSolverControls').append(control.closest('.input-group'));}
 if(id==='wall'&&inputs.customInteraction===multiRampMode){const hint=document.createElement('p');hint.className='control-hint';hint.style.gridColumn='1 / -1';hint.textContent='Both sides use the same definitions: H is the positive distance from the wedge tip to the horizontal wall; Lw is the total segment length of that side. Lwall/Lw = 0.5 means half its wedge length; xstart/Lw = 0 starts at the tip. Lref is shared; segment lengths are Li/Lref. Angles are signed to horizontal: +8° above and −8° below are mirrored compression faces. For 7° + 8° compression, enter 7° then 15° above (−7° then −15° below). Wall reflections computes supported wave interactions. Normal shock adds the optional terminal shock. The display fits the computed domain; streams behind the two trailing edges are not matched';$('wallSetupControls').append(hint);}
 if(id==='airfoil'&&inputs.airfoilShape==='Connected flat plates'){const hint=document.createElement('p');hint.className='control-hint';hint.style.gridColumn='1 / -1';hint.textContent='Enter each absolute panel angle to horizontal and its length in metres. Panels connect end-to-end with zero thickness; the final point is free. No lengths are changed.';$('wallSetupControls').append(hint);}
 if(id==='airfoil'&&inputs.airfoilShape==='Bent flat plate'){const hint=document.createElement('p');hint.className='control-hint';hint.style.gridColumn='1 / -1';hint.textContent=inputs.plateDefinition==='Multiple panels'?'Zero thickness: both sides share the same plate. Add/remove up to 20 panels and set their absolute angles. Target lengths can be adjusted automatically to meet the trailing edge.':'Zero thickness: both sides follow the same two-panel path. h/c is camber height, not thickness. Panel angles and lengths are calculated; the trailing edge remains at x/c = 1, y/c = 0.';$('wallSetupControls').append(hint);}
 if(id==='airfoil'&&inputs.airfoilShape==='Diamond'){const hint=document.createElement('p');hint.className='control-hint';hint.style.gridColumn='1 / -1';hint.textContent='Upper and lower surfaces are mirrored. Angles are magnitudes relative to the chord; L/c is the actual inclined panel length divided by chord.';$('wallSetupControls').append(hint);}
 $('wallSolverSettings').hidden=!$('wallSolverControls').children.length;
 $('wallEditors').hidden=!$('wallEditorControls').children.length;
 panel.querySelector('.wall-setup-details').hidden=$('wallSolverSettings').hidden&&$('wallEditors').hidden;
 for(const key of ['mocStation','comparisonStation']){const control=$('value-'+key);if(control){$('profileStationControls').append(control.closest('.input-group'));$('profileStationControls').hidden=false;}}
 const hints={comparisonStation:'Shared cross-channel section for both methods; clipped to the common accepted domain.',trackingStep:'Maximum turning angle per expansion front; not the total fan angle. Smaller values give finer resolution and require more computation.',trackingRefine:'Repeat with half the fan step to check result sensitivity; this is not an absolute error estimate.',mocResolution:'Points across each smooth region. Increase to check sensitivity; fitted shocks retain separate states on each side.',mocLines:'Show or hide characteristic lines on the flow diagram.',trackingStation:'Position of the cross-channel plot: 0 = inlet, 1 = outlet.',mocStation:'Position of the cross-channel plot: 0 = inlet, 1 = outlet.'};
 for(const [key,note] of Object.entries(hints)){const control=$('value-'+key);if(!control)continue;const hint=document.createElement('p');hint.id='hint-'+key;hint.className='control-hint';hint.textContent=note;control.closest('.input-group').append(hint);control.setAttribute('aria-describedby',hint.id);$('range-'+key)?.setAttribute('aria-describedby',hint.id);}

}
function arrangeFannoGeometry(fields,open){
 if(id!=='fanno'||inputs.ductProblem!==fannoSystemMode)return;
 const details=document.createElement('details');details.id='fannoGeometrySettings';details.className='fanno-geometry-settings';details.open=open;
 const summary=document.createElement('summary');summary.textContent='Nozzle geometry';details.append(summary);
 for(const field of fields.filter(f=>f.geometrySetting)){const control=$('value-'+field.key);if(control)details.append(control.closest('.input-group'));}
 $('inputs').append(details);
}
function arrangeCollisionOutput(){
 const notice=$('notice'),actions=$('exportJson').closest('.result-actions'),results=$('results').closest('.results');
 if(id==='collision'||inputs.wallShape===shockFanMode||id==='wall'&&inputs.wallShape==='Custom wall'&&inputs.boundaryMode==='Channel'&&channelSolverName(inputs.channelSolver)==='Shock–Expansion'){$('scene').after(notice);if(id==='wall'){$('regionTablePanel').append(actions);actions.classList.remove('card');actions.classList.add('collision-file-actions');}else{$('shockResults').parentElement.append(actions);actions.classList.add('card','collision-file-actions');}}
 else{results.querySelector('.card-head').after(notice);$('pin').before(actions);actions.classList.remove('card','collision-file-actions');}
}
function arrangePropertyPanels(){
 arrangeCollisionOutput();
 const table=$('regionTablePanel'),chart=$('chart').closest('.chart-card');
 const results=$('results').closest('.results'), examples=$('examplesPanel');
 const unsteady=id==='tube';
 results.classList.toggle('unsteady-results',unsteady);
 if(unsteady){
  $('inputs').before(examples);
  chart.after(results);
 }else{
  $('shockResults').parentElement.prepend(examples);
  examples.after(results);
 }

 if(id==='fanno'){if(chart.nextElementSibling!==table)table.before(chart);}
 else if(table.nextElementSibling!==chart)chart.before(table);
}
function renderInputs(){if(id==='wall'&&inputs.customInteraction===multiRampMode&&inputs.inletTerminal==='None')inputs.inletTerminal='Compression only';if(id==='tube'){inputs.tubeDomain=finiteTubeMode;inputs.pistonDomain=closedPistonMode;
 if(inputs.bookExample==='closed-piston-demo')inputs.bookExample='';
 const sinusoidal=inputs.unsteadyExperiment===sinusoidalExperiment;const piston=inputs.unsteadyExperiment==='Two-stage piston'||sinusoidal;const valve=inputs.unsteadyExperiment===valveExperiment;const finite=!piston&&!valve&&inputs.tubeDomain===finiteTubeMode,closed=piston&&inputs.pistonDomain===closedPistonMode;$('labTitle').textContent=sinusoidal?'Sinusoidal piston':closed?'Two-stage piston · closed tube':finite?'Finite shock tube':valve?valveExperiment:piston?'Two-stage piston':'Shock tube';$('description').textContent=sinusoidal?'Drive a finite tube with a sinusoidal piston and compare small-amplitude waves with Example 10.':closed?'Follow waves reflected by the fixed end and the advancing piston.':finite?'Follow shocks, expansion waves and contact surfaces through repeated reflections at both closed ends.':valve?'Close the valve and follow the resulting shock and reflections between the valve and upstream piston.':piston?'Generate two moving shocks by increasing the piston speed twice; find where and when the second shock catches the first.':labs.tube.description;$('model').textContent=closed?'One-dimensional Euler equations · moving gas boundary and fixed end wall':finite?'One-dimensional Euler equations · uniform initial chamber velocities · reflecting walls':valve?'One-dimensional Euler equations · moving piston and closed valve':piston?'Initially stationary gas · two sudden piston speed increases · constant heat capacities':labs.tube.model;$('limitations').textContent=closed?'Initially stationary ideal gas. The numerical solve stops at a gas gap of 10% of the initial tube length, or at the selected end time, whichever comes first.':finite?'Inviscid constant-area tube with constant heat capacities. Numerical fronts spread across several cells.':valve?'The upstream piston continues at the gas inlet speed. The solve stops at the selected end time or when 10% of the initial gas gap remains.':piston?'Requires 0 < first speed < second speed and a positive delay. Ends at shock catch-up; post-interaction waves and end-wall reflections are not solved.':labs.tube.limitations;}if(id==='airfoil')inputs=migrateAirfoilGeometry(inputs);if(id==='airfoil'&&inputs.airfoilShape==='Diamond'&&!diamondModes.includes(inputs.geometryInput)){try{Object.assign(inputs,diamondInputValues(airfoilGeometry(inputs)));inputs.geometryInput='Angle & length ratio';}catch{}}arrangePropertyPanels();const geometryOpen=$('fannoGeometrySettings')?.open??false;if(id==='fanno')inputs=migrateFannoInputs(inputs);if(id==='rayleigh'&&inputs.rayleighInput==='Inlet Mach + outlet stagnation temperature'){const cp=inputs.gamma*inputs.R/(inputs.gamma-1),T0=inputs.temperatureInput==='Stagnation temperature'?inputs.inletT0:inputs.T1*(1+(inputs.gamma-1)*inputs.M1*inputs.M1/2);inputs.q=cp*(inputs.outletT0-T0)/1000;inputs.rayleighInput='Heat transfer + Inlet Mach';}if(id==='rayleigh'&&inputs.ductProblem==='Reservoir-fed duct'&&!['Sonic outlet','Specified back pressure','Heat + outlet Mach','Outlet Mach + outlet pressure','Upstream reference + sonic outlet'].includes(inputs.ductSolve))inputs.ductSolve='Sonic outlet';if(id==='rayleigh'&&inputs.ductProblem==='Upstream adjustment to sonic outlet'){inputs.ductProblem='Reservoir-fed duct';inputs.ductSolve='Upstream reference + sonic outlet';}if(id==='rayleigh'&&inputs.ductProblem==='Two-stage heating to sonic outlet'){Object.assign(inputs,{ductProblem:'Single duct',rayleighInput:'Heat transfer + Inlet Mach',velocityInput:'Flow speed',temperatureInput:'Static temperature'});}if(id==='rayleigh'&&inputs.rayleighInput==='Heat transfer')inputs.rayleighInput='Heat transfer + Inlet Mach';if(id==='rayleigh'&&inputs.rayleighInput==='Outlet Mach + stagnation temperatures'){inputs.q=inputs.gamma*inputs.R/(inputs.gamma-1)*(inputs.outletT0-inputs.inletT0)/1000;inputs.rayleighInput='Heat transfer + Outlet Mach';}if(id==='collision')inputs.geometryMode='Custom geometry';if(id==='wall'){inputs.channelSolver=channelSolverName(inputs.channelSolver);if(inputs.wallShape!=='Custom wall')inputs.boundaryMode='Single wall';}$('cvPresets').hidden=true;$('balancePanel').hidden=id!=='balances';$('isentropicPanel').hidden=true;if(id==='nozzle'){const info=nozzleInfo(inputs);$('description').textContent=info.description;$('model').textContent=info.model;$('limitations').textContent=info.limitations;}if(id==='cone')$('limitations').textContent=inputs.bodyGeometry==='Wedge'&&inputs.nearbyWall&&inputs.nearbyWall!=='None'?'Two attached wedge shocks and one regular wall reflection. The view ends before a further shock/body encounter. Trailing-edge waves, Mach reflection and expansion-side configurations are excluded.':inputs.bodyGeometry==='Cone'?labs.cone.limitations:'Weak attached shocks and centred expansions on the two wedge faces. Detached fields are omitted. The cone, when selected for comparison, remains at zero incidence.';if(id==='wall'&&inputs.customInteraction===multiRampMode){$('description').textContent='Select flow above, below, or on both sides of a segmented wedge, with mirrored or independent reflecting walls. Choose wall reflections, compression only, or an optional terminal normal shock.';}else if(id==='wall'&&inputs.wallShape!==ramjetMode&&inputs.wallShape!==shockFanMode&&inputs.wallShape!=='Custom wall'){$('description').textContent=labs[inputs.wallShape==='Compression ramp'?'oblique':'expansion'].description;}else if(id==='wall')$('description').textContent=inputs.wallShape===shockFanMode?'Match the final streams after an incident shock and an expansion fan; inspect the slip angle measured from the horizontal.':inputs.wallShape===ramjetMode?ramjetDescription:labs.wall.description;if(id==='wall')$('limitations').textContent=inputs.wallShape===ramjetMode?ramjetLimit:inputs.channelSolver==='Method of characteristics'&&inputs.boundaryMode==='Channel'?'Numerical characteristics; regular fitted shocks and smooth shock–fan interactions are supported. Shock/shock/contact topology, Mach reflection and subsonic continuation stop the field. Refine resolution to assess sensitivity.':labs.wall.limitations;const fields=inputDefinitions(id,inputs).filter(field=>id!=='tube'||!['tubeDomain','pistonDomain'].includes(field.key)).filter(f=>f.key!=='plotProperty'&&!(id==='fanno'&&f.key==='fannoUnknown'&&inputs.fannoCondition===fannoConditions[0])&&!(id==='collision'&&f.key==='interactionType')&&(!['gamma','R'].includes(f.key)||!f.readOnly)).sort((a,b)=>id==='collision'?Number(b.key==='interactionType')-Number(a.key==='interactionType'):0);$('inputs').innerHTML=waveGeometrySelector()+fields.map(x=>`${x.section?`<h3 class="input-section">${x.section}</h3>`:''}<div class="input-group"><div class="input-top"><label for="value-${x.key}">${x.label}</label><span class="unit">${x.unit??''}</span></div>${x.key==='ductSolve'?`<p class="control-hint">${knownRayleighData(inputs.ductSolve)}</p>`:''}${x.type==='wall-segments'?wallSegmentEditor(x):x.type==='segments'?segmentEditor(x):x.type==='textarea'?`<textarea id="value-${x.key}" name="${x.key}" rows="4" spellcheck="false">${String(inputs[x.key]??'').replaceAll('&','&amp;').replaceAll('<','&lt;')}</textarea>`:x.options?`<select id="value-${x.key}" name="${x.key}">${x.options.map(v=>`<option value="${v}" ${inputs[x.key]===v?'selected':''}>${id==='fanno'&&x.key==='fannoCondition'&&v===fannoConditions[0]?'Shock location (vary back pressure)':id==='rayleigh'&&x.key==='rayleighInput'&&v==='Outlet Mach'?'Inlet Mach + Outlet Mach':v}</option>`).join('')}</select>`:`<div class="number-wrap"><input id="value-${x.key}" name="${x.key}" type="number" value="${(x.displayScale??1)*inputs[x.key]+(x.displayOffset??0)}" min="${x.min}" max="${x.max}" step="any" inputmode="decimal" ${x.readOnly?'readonly':''} aria-label="${x.label} ${x.unit}" required></div><input id="range-${x.key}" type="range" ${x.readOnly?'disabled':''} min="${x.sliderMin??x.min}" max="${x.sliderMax??x.max}" step="${x.step}" value="${(x.displayScale??1)*inputs[x.key]+(x.displayOffset??0)}" aria-label="${x.label} slider"><div class="range-labels"><span>${x.sliderMin??x.min}</span><span>${x.sliderMax??x.max}</span></div>`}</div>`).join('');compactTypedInputs(fields);
const gridField=fields.find(field=>field.key==='finiteCells');
if(gridField){
 const control=$('value-finiteCells'),hint=document.createElement('p');
 hint.id='hint-finiteCells';hint.className='control-hint';hint.textContent=gridField.help;
 control.closest('.input-group').append(hint);
 control.setAttribute('aria-describedby',hint.id);
 $('range-finiteCells').setAttribute('aria-describedby',hint.id);
}
arrangeWallInputs();arrangeFannoGeometry(fields,geometryOpen);if(id==='rayleigh'){const heatInput=$('value-q');if(heatInput)heatInput.closest('.input-group').title='Positive q means heat is added to the flow. Negative q means heat is removed. The limits depend on the known inputs.';const notes={supplyReferenceMach:'Moving upstream reference. Entry preserves total pressure and temperature; the required entry area ratio is reported.',reservoirT0:'Temperature at the supply reference section. The selected static or stagnation type applies at that section.'};for(const [key,note] of Object.entries(notes)){const control=$('value-'+key);if(control){const hint=document.createElement('p');hint.className='control-hint';hint.textContent=note;control.closest('.input-group').append(hint);}}}$('inputs').onsubmit=e=>e.preventDefault();renderExamples();bindWaveGeometrySelector();for(let x of fields){if(x.type==='wall-segments'){bindWallSegments(x);continue;}if(x.type==='segments'){bindSegmentEditor(x);continue;}let n=$('value-'+x.key),r=$('range-'+x.key);n.oninput=()=>{if(id==='airfoil'&&['airfoilShape','geometryInput','plateDefinition','plateLengthMode'].includes(x.key)){changeAirfoilGeometry(x.key,n.value);return;}stopSweep();sweepFinished=false;sweepPositioned=x.key==='backRatio';request++;if(id==='rayleigh'&&x.key==='referenceTemperatureType'){const factor=1+(inputs.gamma-1)*inputs.M1*inputs.M1/2;if(n.value==='Static temperature')inputs.T1=inputs.inletT0/factor;else inputs.inletT0=inputs.T1*factor;}const previousFirst=inputs.thetaUpper;inputs[x.key]=x.options||x.type==='textarea'?n.value:n.value.trim()===''?NaN:(x.displayScale??1)*(Number(n.value)-(x.displayOffset??0));if(id==='collision'&&inputs.interactionType==='Same-direction shocks'&&x.key==='thetaUpper')inputs.thetaLower+=previousFirst-inputs.thetaUpper;if(id==='fanno'&&x.key==='fannoUnknown'&&n.value!=='Back pressure'&&current?.result.fullSystem)inputs.backPressure=current.result.backPressure/1000;if(x.key==='ductProblem'){if(n.value===fannoSystemMode){Object.assign(inputs,{fannoInterfaceVersion:2,fannoUnknown:'Back pressure',fannoSystemSolve:fannoSolves[0],fannoCondition:fannoConditions[4],lambda:.2,systemAreaRatio:2,nozzleContraction:3,nozzleLength:1,ductLength:1,reservoirP0:500,reservoirT0:400,frictionInput:'Dimensionless'});}if(n.value==='Heat + shock + converging nozzle'){Object.assign(inputs,{systemInletType:'Static duct inlet',M1:1.6,T1:200,p1:56,backPressure:120,inletPressureType:'Static pressure',reservoirPressureType:'Stagnation pressure',bookExample:'4–7'});}if(n.value==='Two-stage heating to sonic outlet'){Object.assign(inputs,{inletSpeed:122.5,T1:222.2,p1:68.95,q:116.3,inletPressureType:'Static pressure',reservoirPressureType:'Stagnation pressure',bookExample:'4–6'});}if(n.value==='Duct shock location'){inputs.M1=2;inputs.lambda=.2;inputs.backPressure=300;}if(n.value==='Reservoir-fed duct'){inputs.ductSolve='Sonic outlet';inputs.q=100;}}if(r)r.value=n.value;if(id==='tube'&&['tubeInput','unsteadyExperiment'].includes(x.key)){
 if(x.key==='unsteadyExperiment'){
  const limit=['Two-stage piston',sinusoidalExperiment].includes(n.value)?100000:n.value===valveExperiment?10000:100;
  if(inputs.finiteEndTime>limit)inputs.finiteEndTime=defaults('tube').finiteEndTime;
 }
 stopAnimation();renderInputs();$('value-'+x.key)?.focus();
}if(x.key==='fluid'){inputs=selectGas(inputs,n.value);renderInputs();$('value-fluid').focus();}if(id==='nozzle'&&(x.key==='nozzleType'||x.key==='nozzleView'||x.key==='outletCondition'||x.key==='MIn'&&(inputs.MIn===1||!!$('value-sonicBranch')))){renderInputs();$('value-'+x.key)?.focus();}if(['temperatureInput','inletPressureType','nozzlePressureType','nozzleTemperatureType','driverPressureType','driverTemperatureType','supplyTemperatureType','reservoirPressureType','inverseTemperatureType','outletTemperatureType','outletPressureType'].includes(x.key))renderInputs();if(['rayleigh','fanno'].includes(id)&&['rayleighInput','fannoInput','targetMach','ductProblem','ductSolve','shockCase','fannoSystemSolve','fannoCondition','fannoUnknown','systemInletType','referenceTemperatureType','referencePressureType','reservoirPressureType','inletPressureType','velocityInput','temperatureInput','frictionInput','ductSection','frictionConvention'].includes(x.key)){renderInputs();}if(id==='cone'&&['bodyGeometry','nearbyWall'].includes(x.key)){renderInputs();$('value-bodyGeometry')?.focus();}if(id==='wall'&&['inletTerminal','inletFlowSide','inletLowerDefinition'].includes(x.key)){renderInputs();}if(id==='wall'&&x.key==='channelSolver'){renderInputs();}if(id==='wall'&&x.key==='boundaryMode'){if(inputs.boundaryMode==='Channel')inputs.wallShape='Custom wall';renderInputs();}if(id==='wall'&&x.key==='wallSide'){renderInputs();}if(id==='balances'&&x.key==='balanceMode'||id==='collision'&&['interactionType','geometryMode','thetaUpper'].includes(x.key)||id==='airfoil'&&['airfoilShape','airfoilMethod'].includes(x.key))renderInputs();syncRayleighHeat();schedule(x.key==='backRatio');};if(r)r.oninput=()=>{stopSweep();sweepFinished=false;sweepPositioned=x.key==='backRatio';request++;const previousFirst=inputs.thetaUpper;inputs[x.key]=(x.displayScale??1)*(Number(r.value)-(x.displayOffset??0));if(id==='collision'&&inputs.interactionType==='Same-direction shocks'&&x.key==='thetaUpper'){inputs.thetaLower+=previousFirst-inputs.thetaUpper;renderInputs();}n.value=r.value;if(id==='nozzle'&&x.key==='MIn'&&(inputs.MIn===1||!!$('value-sonicBranch'))){renderInputs();}syncRayleighHeat();schedule(x.key==='backRatio');};}syncSweep();syncRayleighHeat();}
function schedule(stream=false){if(coneExampleChanged())renderExamples();clearTimeout(timer);timer=setTimeout(()=>solve({stream}),id==='cone'?240:70);}
function pendingAirfoilScene(){
 if(id!=='airfoil')return '<div class="error-display" style="color:#7f927d">Solving the physical model…</div>';
 try{return sceneSVG({kind:'airfoil',geometry:airfoilGeometry(inputs),models:[],alpha:(inputs.alpha??0)*Math.PI/180},inputs).svg;}
 catch{return '<div class="error-display">Check airfoil geometry.</div>';}
}
function solve({stream=false}={}){
 if(id==='fanno'&&inputs.ductProblem===fannoSystemMode&&inputs.fannoCondition===fannoConditions[0]){
  const plan=getSweepPlan();if(plan.enabled&&Number.isFinite(inputs.backRatio)){
   inputs.backRatio=Math.max(plan.min,Math.min(plan.max,inputs.backRatio));
   for(const key of ['value-backRatio','range-backRatio']){const control=$(key);if(control)control.value=inputs.backRatio;}
  }
 }
 // Keep the accepted view mounted while a pressure-sweep frame is calculated.
 // Hiding tables/notes here collapses the page and triggers browser scroll anchoring.
 const keepView=stream&&current?.id===id;
 $('fieldProbe').hidden=true;$('chartProbe').hidden=true;request++;solvePending=true;
 if(!keepView){
  current=null;
  for(const key of ['ductImageNote','ductChartNote','flowRelationsPanel','regionTablePanel','trackingEventPanel'])$(key).hidden=true;
  $('status').textContent='Solving…';$('status').className='status';$('comparison').hidden=true;
  for(const key of ['exportJson','exportCsv','pin','exportSvg'])$(key).disabled=true;
  $('isentropicPanel').hidden=true;$('results').innerHTML='<div class="result-row"><span class="result-label">Computing a new state…</span></div>';
  $('notice').hidden=true;$('scene').innerHTML=pendingAirfoilScene();$('chart').innerHTML='';$('legend').textContent='';$('chartTitle').textContent='Property map';
 }
 stopAnimation();worker.postMessage({request,id,inputs});
}

worker.onmessage=({data})=>{if(data.request!==request)return;solvePending=false;if(!data.ok){current=null;$('scene').classList.remove('finite-tube-scene');stopSweep();syncSweep();$('sweepState').textContent='No accepted state for these inputs.';$('status').textContent=data.code==='detached'?'Detached':'Check inputs';$('status').className='status error';$('notice').hidden=false;$('notice').textContent=data.error;if(id==='collision'&&data.code==='geometry-limit'){const link=document.createElement('button');link.type='button';link.className='text-btn';link.textContent='Open Custom wall / Channel';link.style.display='block';link.style.marginTop='12px';link.onclick=()=>{pendingCustomChannel=true;location.hash='wall';};$('notice').appendChild(link);}$('scene').innerHTML='<div class="error-display">No field is displayed for these inputs.<br>The selected physical model has no accepted solution.</div>';$('waveKey').hidden=true;$('results').innerHTML='';renderShockDetails([]);$('fieldControls').hidden=true;$('fieldLabel').textContent='No accepted flow field';$('sceneMeta').textContent='';$('chart').innerHTML='';$('legend').textContent='';$('plotQuantity').innerHTML='';$('plotNote').textContent='';return;}current=data.data;if(id==='fanno'&&inputs.fannoInterfaceVersion===2&&current.result.fullSystem){if(inputs.fannoCondition===fannoConditions[5]||inputs.fannoSystemSolve===fannoSolves[2]){inputs.lambda=current.result.lambda;inputs.frictionInput='Dimensionless';}if(inputs.fannoSystemSolve===fannoSolves[1])inputs.reservoirP0=current.result.supplyPressure/1000;}try{localStorage.setItem('gdvl-inputs-'+id+(id==='balances'?'-cv2':''),JSON.stringify(inputs));}catch{}renderResult();syncSweep();continueSweep();};
worker.onerror=()=>{solvePending=false;stopSweep();syncSweep();$('status').textContent='Worker error';$('notice').hidden=false;$('notice').textContent='The calculation worker could not start. Serve this folder over HTTP(S) with module support.';};
function renderShockDetails(groups=[]){const box=$('shockResults');if(!groups.length){box.hidden=true;box.innerHTML='';return;}const compact=id==='collision';box.hidden=false;box.innerHTML=`<h3>${compact?'WAVE ANGLES & ENTROPY':'SHOCK STATES · ONE-SIDED VALUES'}</h3>${groups.map(g=>`<section class="shock-state"><h4>${g.title}</h4>${compact?'':`<p>${g.location}</p><div class="shock-table-wrap"><table><thead><tr><th>Parameter</th><th>Before</th><th>After</th><th>After / before</th></tr></thead><tbody>${g.rows.map(r=>`<tr><th>${r.label}</th><td>${fmt(r.before)} ${r.unit}</td><td>${fmt(r.after)} ${r.unit}</td><td>${fmt(r.ratio)}</td></tr>`).join('')}</tbody></table></div>`}<dl>${g.extra.map(e=>`<div><dt>${e.label}</dt><dd>${fmt(e.value)} ${e.unit}</dd></div>`).join('')}</dl></section>`).join('')}`;}

function renderIsentropicRelations(d){
 const panel=$('isentropicPanel');panel.hidden=d.id!=='foundations';if(panel.hidden)return;
 const rows=d.rows.filter(r=>r.panel==='isentropic');
 const [mach,machAngle,prandtlMeyer]=rows.filter(r=>!/[₀*]/.test(r.label));
 const soundSpeed={label:'Speed of sound a',display:fmt(d.result.a),unit:'m/s'};
 const groups=[
  ['Flow properties',[mach,soundSpeed,machAngle,prandtlMeyer]],
  ['Stagnation ratios',rows.filter(r=>r.label.endsWith('₀'))],
  ['Sonic ratios',rows.filter(r=>r.label.endsWith('*'))]
 ];
 const [angles,...ratios]=groups.map(([title,items])=>`<section aria-label="${title}"><h3 class="isentropic-group-title">${title}</h3><dl class="isentropic-grid">${items.map(r=>`<div><dt>${r.label}</dt><dd>${r.display??fmt(r.value,8)}${r.unit?` <small>${r.unit}</small>`:''}</dd></div>`).join('')}</dl></section>`);
 panel.innerHTML=`<div class="card-head"><h2>Isentropic Flow Calculator</h2><span class="status">γ = ${fmt(d.inputs.gamma)}</span></div>${angles}<div class="isentropic-ratio-columns">${ratios.join('')}</div><p class="isentropic-note">Subscript 0: stagnation state. Asterisk *: sonic reference at the same stagnation state; A* is the corresponding critical area for the same mass flow. Angles are in degrees.</p>`;
}
function renderBalanceDetails(){
 const panel=$('balancePanel');panel.hidden=current.id!=='balances';if(panel.hidden)return;
 const r=current.result;$('status').textContent=r.entropyViolation?'Entropy decreases':r.balanced?'Balances satisfied':'Not balanced';$('status').className='status'+(r.balanced&&!r.entropyViolation?'':' error');
 panel.innerHTML=`<div class="cv-summary"><strong>${r.entropyViolation?'Balances may close, but entropy decreases':r.balanced?'All integral balances close':'Proposed steady states do not balance'}</strong><p>Signed terms below sum to the residual. A positive residual means net excess input under the displayed convention. Closure tolerance: relative residual &lt; 10⁻⁷. The interior is schematic.</p></div><div class="cv-equations">${Object.entries(r.terms).map(([k,t])=>{const scale=k==='energy'?1000:1,unit=k==='energy'?'kW':t.unit;return `<article class="cv-equation ${t.passed?'closed':'open'}"><h3>${k==='mass'?'Mass':k==='momentum'?'Axial momentum':'Energy'} <span>${t.passed?'Balanced':'Mismatch'}</span></h3><table><thead><tr><th>Signed contribution</th><th>${unit}</th></tr></thead><tbody>${t.terms.map(([name,value])=>`<tr><td>${name}</td><td>${value>0?'+':''}${fmt(value/scale,6)}</td></tr>`).join('')}<tr class="cv-residual"><th>Σ terms · residual</th><td>${t.residual>0?'+':''}${fmt(t.residual/scale,6)}</td></tr></tbody></table></article>`;}).join('')}</div><p class="cv-note">${inputs.balanceMode==='Solve outlet speed'?'Outlet speed is calculated from mass conservation; pressure, temperature, heat, work and axial force must still satisfy momentum and energy.':'Both endpoint states are prescribed; the program checks the balances without altering the outlet.'} ${r.entropyChecked?`Adiabatic entropy check: Δs = ${fmt(r.ds,6)} J/(kg·K). ${r.entropyViolation?'Entropy decrease is inadmissible.':'No entropy decrease detected.'}`:Math.abs(r.Q)<1e-10?'Entropy comparison is withheld until mass conservation closes.':'Heat-transfer entropy balance requires the heat-transfer boundary temperature and is not assessed here.'}</p>`;
}
function loadCVPreset(kind){if(id!=='balances')return;clearTimeout(timer);inputs={...defaults('balances'),...controlVolumePreset(kind,{gamma:inputs.gamma,R:inputs.R}),fluid:inputs.fluid};renderInputs();solve();}
$('cvNozzle').onclick=()=>loadCVPreset('nozzle');$('cvShock').onclick=()=>loadCVPreset('shock');$('cvPerturb').onclick=()=>{if(id!=='balances')return;inputs.p2*=1.1;renderInputs();solve();};
function csvDataRows(d){if(d.result.tracking||d.result.shockFan){const regions=(d.inspectTrackingEvent?null:d.result.finalStreamMatch)?.regions??d.result.regions;return Object.entries(regions).flatMap(([n,z])=>[['Mach number',z.M,''],['Static pressure',z.p/1000,'kPa'],['Static temperature',z.T,'K'],['Density',z.rho,'kg/m³'],['Flow speed',z.u,'m/s'],['Flow angle',z.theta*180/Math.PI,'°'],['Stagnation pressure',z.p0/1000,'kPa'],['Stagnation temperature',z.T0,'K']].map(([label,value,unit])=>({label:`Region ${n.replace(/^Region /,'')} · ${label}`,value,unit})));}return [...d.rows,...trackingExportRows(d.result),...fittedExportRows(d.result),...(d.gas?[{label:'Working gas',value:d.gas.name,unit:''},{label:'Specific gas constant',value:d.gas.R,unit:'J/(kg·K)'},{label:'Specific heat ratio',value:d.gas.gamma,unit:''},{label:'Specific heat cp',value:d.gas.cp,unit:'J/(kg·K)'}]:[]),...(d.id==='balances'?Object.entries(d.result.terms).flatMap(([k,t])=>[...t.terms.map(([label,value])=>({label:k+' · '+label,value,unit:t.unit})),{label:k+' · relative residual',value:t.relative,unit:''}]):[]),...(d.shockDetails??[]).flatMap(g=>[...g.rows.flatMap(r=>[{label:`${g.title} · ${r.label} · upstream`,value:r.before,unit:r.unit},{label:`${g.title} · ${r.label} · downstream`,value:r.after,unit:r.unit},{label:`${g.title} · ${r.label} · downstream/upstream`,value:r.ratio,unit:''}]),...g.extra.map(e=>({label:`${g.title} · ${e.label}`,value:e.value,unit:e.unit}))])]}
function renderTrackingPanel(d){
 if(!d.result.tracking){$('trackingViewControls')?.remove();$('chart').closest('.chart-card').hidden=false;}
 if(d.result.moc?.fitted){
  const panel=$('trackingEventPanel');panel.innerHTML=fittedInspectionHTML(d.result,fmt);panel.hidden=!panel.innerHTML;if(panel.hidden)return;
  const update=()=>{$('fittedShockValues').innerHTML=fittedPointHTML(selectedFittedPoint(d.result,$('fittedShockSelect').value,$('fittedShockPosition').value),fmt,d.result.R);};
  $('fittedShockSelect').onchange=()=>{$('fittedShockPosition').value=0;update();};$('fittedShockPosition').oninput=update;update();return;
 }
 const panel=$('trackingEventPanel'),chartCard=$('chart').closest('.chart-card');panel.hidden=!d.result.tracking;
 if(panel.hidden){panel.innerHTML='';$('trackingViewControls')?.remove();chartCard.hidden=false;return;}
 const final=d.result.finalStreamMatch;if(!final)d.inspectTrackingEvent=true;
 let views=$('trackingViewControls');if(!views){views=document.createElement('div');views.id='trackingViewControls';views.className='tracking-view-controls';$('scene').before(views);}
 views.innerHTML=`<label for="trackingSolutionView">Solution view</label><select id="trackingSolutionView">${final?`<option value="matching" ${!d.inspectTrackingEvent?'selected':''}>Final-stream matching · schematic</option>`:''}<option value="events" ${d.inspectTrackingEvent?'selected':''}>Event-driven solution · computed field</option></select><p>${d.inspectTrackingEvent?'Follows successive wave interactions in the actual channel. Expansion fans are discretized; the displayed field may stop before the channel exit.':'Matches pressure and direction of the fully turned uniform streams. This is a separate reference calculation, not a continuation of the event-driven field; its geometry is schematic.'}</p>`;
 $('trackingSolutionView').onchange=()=>{d.inspectTrackingEvent=$('trackingSolutionView').value==='events';renderResult();};
 chartCard.hidden=!!final&&!!d.inspectTrackingEvent;
 if(!d.inspectTrackingEvent){panel.innerHTML=`<div class="final-result-summary"><strong>Final-stream matching · schematic</strong><span>φ = ${fmt(final.slipAngle,6)}° to horizontal · p₄ = p₅ = ${fmt(final.regions[4].p/1000,6)} kPa</span><p>The table and pressure–deflection diagram below belong to this matching reference. Internal shock–fan interactions are not resolved.</p></div>`;return;}
 const events=d.result.tracking.events,drawable=drawableTrackingEvents(d.result);
 panel.innerHTML=`<div class="tracking-event-picker"><label for="trackingEventSelect">Inspect event</label><select id="trackingEventSelect">${events.map(e=>`<option value="${e.index}" ${!drawable.has(e.index)?'disabled':''} ${e.index===d.result.selectedTrackingEvent?'selected':''}>E${e.index} · ${e.type}${e.side?' · '+e.side+' wall':''} · x = ${fmt(e.x,5)} m${!drawable.has(e.index)?' · downstream field not drawn':''}</option>`).join('')}</select><p class="control-hint">Diagram and table: selected computed event. All angles are measured from the horizontal. Events without drawn downstream regions are unavailable.${d.result.status==='partial'?' The tracked field is incomplete; the stop message applies only to this event-driven calculation.':''}</p></div>`;
 $('trackingEventSelect').onchange=()=>{selectTrackingEvent(d.result,$('trackingEventSelect').value);d.scene={kind:'wall',...d.result,inspectEvent:true};d.shockDetails=trackingShockDetails(d.result);d.rows=[...d.rows.filter(r=>r.panel),...trackingSummaryRows(d.result)];renderResult();};
}
function renderRegionTable(d){
 if(d.result.ductSystem||d.result.twoStagePiston||d.result.valveClosure){const t=d.result.referenceTable;$('regionTablePanel').hidden=false;$('regionTableTitle').textContent=d.result.valveClosure?'Gas properties across the shock':d.result.twoStagePiston?'Gas properties before catch-up':'Properties at every station';$('regionTable').innerHTML=`<div class="region-table-scroll"><table class="region-table"><thead><tr><th>Property</th>${t.columns.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr><th>${r.label}</th>${r.values.map(v=>`<td>${fmt(v,6)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${t.note?`<p class="control-hint">${t.note}</p>`:''}`;return;}

 if(['normal','rayleigh','fanno'].includes(d.id)&&!d.result.ductSystem){const rows=[['Mach number','',z=>z.M],['Static pressure','kPa',z=>z.p/1000],['Static temperature','K',z=>z.T],['Density','kg/m³',z=>z.rho],['Flow speed','m/s',z=>z.u],['Stagnation pressure','kPa',z=>z.p0/1000],['Stagnation temperature','K',z=>z.T0]];$('regionTablePanel').hidden=false;$('regionTableTitle').textContent=['rayleigh','fanno'].includes(d.id)?'Inlet and outlet properties':'Upstream and downstream properties';$('regionTable').innerHTML=`<div class="region-table-scroll"><table class="region-table"><thead><tr><th>Property</th><th>${['rayleigh','fanno'].includes(d.id)?'Inlet':'Upstream'}</th><th>${['rayleigh','fanno'].includes(d.id)?'Outlet':'Downstream'}</th></tr></thead><tbody>${rows.map(([name,unit,get])=>`<tr><th>${name}<span>${unit}</span></th><td>${fmt(get(d.scene.s1),6)}</td><td>${fmt(d.scene.s2?get(d.scene.s2):NaN,6)}</td></tr>`).join('')}</tbody></table></div>`;return;}

 if(d.result.bodyTable){const t=d.result.bodyTable;$('regionTablePanel').hidden=false;$('regionTableTitle').textContent='Surface properties · freestream reference';$('regionTable').innerHTML=`<div class="region-table-scroll"><table class="region-table"><thead><tr><th>Property</th>${t.columns.map((c,i)=>`<th>${c}<br>${t.statuses[i]}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr><th>${r.label} ${r.unit}</th>${r.values.map(v=>`<td>${fmt(v,6)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;return;}

 if(d.result.comparison){$('regionTablePanel').hidden=false;$('regionTableTitle').textContent='Method comparison';$('regionTable').innerHTML=comparisonHTML(d.result,inputs.comparisonStation,fmt);return;}
 const panel=$('regionTablePanel');panel.hidden=!['collision','wall'].includes(d.id)||!d.result.regions;
 if(panel.hidden){$('regionTable').innerHTML='';return;}
 $('regionTableTitle').textContent=d.inspectTrackingEvent?'Selected event region properties':d.result.finalStreamMatch?'Final-stream region properties':d.result.tracking?(d.result.tracking.events.find(e=>e.index===d.result.selectedTrackingEvent)?.bookCase?'Book-example regions':(d.result.status==='partial'?'Last accepted region properties':'Final accepted region properties')):d.result.moc?'Inlet and outlet samples':'Flow properties by region';
 const regions=Object.entries((d.inspectTrackingEvent?null:d.result.finalStreamMatch)?.regions??d.result.regions);if(d.id==='collision'&&!d.result.same)regions.sort(([a],[b])=>({1:0,2:1,3:2,5:3,4:4}[a])-({1:0,2:1,3:2,5:3,4:4}[b]));
 const properties=[['Mach number','M','',z=>z.M],['Static pressure','p','kPa',z=>z.p/1000],['Static temperature','T','K',z=>z.T],['Density','ρ','kg/m³',z=>z.rho],['Flow speed','u','m/s',z=>z.u],['Flow angle','θ','°',z=>z.theta*180/Math.PI],['Stagnation pressure','p₀','kPa',z=>z.p0/1000],['Stagnation temperature','T₀','K',z=>z.T0]];
 if(d.result.interaction||d.result.tracking)properties.push(['Entropy rise from inlet','Δs','J/(kg·K)',z=>-(d.result.R??d.inputs.R??287)*Math.log(z.p0/d.result.s1.p0)]);
 $('regionTable').innerHTML=`<div class="region-table-scroll" tabindex="0" role="region" aria-label="Flow properties for all regions; scroll horizontally on smaller screens"><table class="region-table"><caption>${d.inspectTrackingEvent?'Selected event states':d.result.finalStreamMatch?'Final-stream matching reference':d.result.tracking?(d.result.status==='partial'?'Last accepted states · incomplete field':'Final accepted states'):d.result.moc?'Inlet and outlet samples':'Analytical states · '+regions.length+' regions'}</caption><thead><tr><th scope="col">Property</th>${regions.map(([n])=>`<th scope="col">${d.result.moc||d.result.tracking?n:'Region '+(d.result.regionLabels?.[n]??n)}</th>`).join('')}</tr></thead><tbody>${properties.map(([name,symbol,unit,get])=>`<tr><th scope="row">${name} <span>${symbol}${unit?` · ${unit}`:''}</span></th>${regions.map(([,z])=>`<td>${fmt(get(z),6)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderFlowRelations(d){
 const box=$('flowRelationsPanel'),t=d.result.ductSystem||d.result.twoStagePiston||d.result.valveClosure?null:d.result.referenceTable;box.hidden=!t;
 if(!t){box.innerHTML='';return;}
 box.innerHTML=`<h3>${t.title}</h3><div class="flow-relations-scroll"><table><thead><tr><th scope="col">Parameter</th>${t.columns.map(c=>`<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr><th scope="row">${r.label}</th>${r.values.map(v=>`<td>${fmt(v,8)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>${t.note}</p>`;
}
function renderAirfoilPanel(d){const box=$('airfoilPanel');box.hidden=d.id!=='airfoil';box.innerHTML=box.hidden?'':airfoilTables(d.result,fmt);}

const coneLimitHelp=new Map([
 ['Maximum attached cone half-angle','Largest cone half-angle that keeps the shock attached at the current freestream Mach number.'],
 ['Minimum Mach for attached shock','Lowest freestream Mach number that keeps the shock attached at the current cone half-angle.'],
 ['Minimum cone Mach for attached shock','Lowest freestream Mach number that keeps the shock attached at the current cone half-angle.'],
]);
function renderResult(){let d=current;const matchingView=!!d.result.tracking&&!!d.result.finalStreamMatch&&!d.inspectTrackingEvent;if($('engineLabel'))$('engineLabel').textContent=d.result.finiteTube?'FINITE-VOLUME EULER':d.result.bodyLab?(d.result.bodyComparison?'WEDGE vs CONE':'2D WEDGE'):d.result.comparison?'COMPARE BOTH':d.result.tracking?'SHOCK–EXPANSION':d.result.moc?.fitted?'MOC · FITTED SHOCKS':d.result.moc?'NUMERICAL MOC':'ANALYTICAL ENGINE';if(d.result.tracking)$('limitations').textContent='Attached, downstream-supersonic waves only. Expansion fans use finite fronts; check refinement. The field stops at a physical, accuracy or event-budget limit.';else if(d.result.interaction)$('limitations').textContent='The regular shock interaction and slip direction are solved. The view ends before the next wall reflection. General shock–fan interactions and Mach reflections are outside this model.';$('model').textContent=d.model;$('gasResultSummary').textContent=d.gas?`${d.gas.name} · cₚ = ${fmt(d.gas.cp,6)}, cᵥ = ${fmt(d.gas.cv,6)} J/(kg·K)`:'';$('status').textContent=['heat-limit','length-limit'].includes(d.result.status)?'Limit exceeded':d.result.status==='sonic-limit'?'Sonic limit':d.result.status==='detached'?'Detached shock':d.result.status==='unsupported'?'Model limit':d.result.status==='partial'?'Local solution':d.result.tracking&&d.result.tracking.hasFanApproximation?'Mixed solution':'Solved';$('status').className='status'+(['heat-limit','length-limit','detached','unsupported'].includes(d.result.status)?' error':'');if(d.result.external&&!d.result.external.outlet){$('status').textContent=d.result.external.status==='no-flow'?'No flow':'Model limit';$('status').className=d.result.external.status==='no-flow'?'status':'status error';}$('notice').hidden=matchingView||!d.notice;$('notice').textContent=d.result.tracking&&d.notice?'Event-driven solution: '+d.notice:d.notice??'';if(matchingView){$('status').textContent='Matched reference';$('status').className='status';$('model').textContent='Uniform final-stream matching · schematic reference';}renderIsentropicRelations(d);renderTrackingPanel(d);renderRegionTable(d);renderFlowRelations(d);renderAirfoilPanel(d);$('results').innerHTML=d.rows.filter(r=>(d.result.ductSystem||!['rayleigh','fanno'].includes(d.id)||['Maximum heat to sonic state','Remaining heat to sonic state','Required duct length','Maximum duct length','Friction length','Available sonic friction length','Static-pressure ratio','Heat transfer','Total-pressure ratio','Entropy change'].includes(r.label))&&(d.id!=='normal'||['Pressure ratio','Temperature ratio','Density ratio','Total-pressure recovery','Entropy increase'].includes(r.label))&&!['airfoil','foundations'].includes(d.id)&&!d.result.tracking&&!r.panel&&!(d.id==='collision'&&r.label!=='Signed slip-line angle φ')&&!(d.id==='cone'&&['Conical shock angle β','Recovered cone angle','Surface Mach','Surface pressure','Surface temperature'].includes(r.label))).map(r=>`<div class="result-row"${d.id==='cone'&&coneLimitHelp.has(r.label)?` title="${coneLimitHelp.get(r.label)}"`:''}><span class="result-label">${r.label}</span><span class="result-value">${fmt(r.value)}<small>${r.unit}</small></span></div>`).join('');renderShockDetails(d.result.tracking?[]:d.shockDetails);renderBalanceDetails();$('exportJson').disabled=false;$('exportCsv').disabled=false;$('pin').disabled=false;$('exportSvg').disabled=false;renderScene();updatePlotChoices();renderCompare();}
function renderWaveKey(result){
 const key=$('waveKey');
 key.hidden=!result.finiteTube;
 if(key.hidden)return;
 const contact=result.movingPiston?'':' Dashed white line: contact surface.';
 const text='Solid dark line: shock front. White dots: edges of an expansion fan.'+contact+' Arrows show the direction of wave travel.';
 if(key.textContent!==text)key.textContent=text;
}

function renderScene(){if(!current)return;if(current.result.tracking){if(current.inspectTrackingEvent)current.scene={kind:'wall',...current.result,inspectEvent:true};else if(current.result.finalStreamMatch)current.scene={kind:'shockFanReference',...current.result.finalStreamMatch};else current.scene={kind:'wall',...current.result};}updateDuctNotes();let view=current.result.finiteTube?finiteTubeFlowView(current.result,current.inputs??inputs,currentPlotTime()):sceneSVG(current.scene,current.inputs??inputs,sceneTime,fieldQuantity);$('animate').hidden=!['nozzle','tube'].includes(current.id)||!!current.result.twoStagePiston||!!current.result.valveClosure;if(current.result.finiteTube&&!animation)$('animate').textContent='▶ Play';$('scene').classList.toggle('method-comparison',!!(current.result.comparison||current.result.bodyComparison));$('scene').classList.toggle('finite-tube-scene',!!current.result.finiteTube);$('scene').innerHTML=view.svg;renderWaveKey(current.result);$('scene').dataset.kind=current.scene.kind;if(fieldQuantity==='schlieren'&&view.field?.quantity!=='schlieren')fieldQuantity=view.field?.quantity??'pressure';bindFieldProbe();$('fieldLabel').textContent=view.label;$('sceneMeta').textContent=view.meta;$('sceneTitle').textContent=current.scene.kind==='nozzleJet'&&['matched','no-flow'].includes(current.scene.status)?current.result.regime:['jet','nozzleJet'].includes(current.scene.kind)?current.scene.title:current.result.simpleCorner?(current.result.cornerKind==='oblique'?'Compression ramp · oblique shock':'Expansion corner · Prandtl–Meyer fan'):current.scene.kind==='cone'?'Cone · axisymmetric flow':current.result.bodyLab?(current.result.bodyComparison?'Wedge vs cone':'Wedge · flow at incidence'):current.result.comparison?'Shock–Expansion vs MOC':current.id==='wall'&&current.result.tracking?'Wave propagation and reflections':current.id==='wall'&&current.result.interaction?'Wave interaction and slip line':current.id==='wall'&&current.result.moc?'Characteristic field':current.id==='airfoil'?'Surface pressure coefficient':current.scene.kind==='coneDetached'?'Detached shock':current.id==='balances'?'Control volume · endpoint states':current.id==='nozzle'?current.result.regime:['oblique','expansion'].includes(current.id)?(inputs.cornerView==='Analytical contours'?'Analytical contours':'Flow schematic'):'Analytical field';const tools=$('fieldControls');tools.hidden=!view.field||['foundations','normal'].includes(current.id)||(['rayleigh','fanno'].includes(current.id)&&!current.result.longitudinal?.length);$('sceneTitle').hidden=true;$('fieldLabel').parentElement.hidden=current.id!=='foundations';$('fieldLabel').textContent=current.id==='foundations'?`${labs[current.id].model}. ${labs[current.id].limitations}`:'';$('sceneMeta').textContent='';if(view.field){$('fieldControls').querySelector('.field-scale').style.display=view.field.showScale===false?'none':'';fieldQuantity=view.field.quantity;for(const o of $('fieldQuantity').options)o.hidden=!view.field.options.includes(o.value);$('fieldQuantity').value=fieldQuantity;$('fieldQuantity').querySelector('[value="cp"]').textContent=current.id==='airfoil'?'Pressure coefficient Cp':'Surface pressure coefficient Cp';$('fieldMin').textContent=`${fmt(view.field.min,4)} ${view.field.units}`;$('fieldMax').textContent=`${fmt(view.field.max,4)} ${view.field.units}`;$('fieldControls').querySelector('.field-ramp').style.background=view.field.palette?`linear-gradient(to right,${view.field.palette.join(',')})`:'';$('fieldScaleLabel').textContent=`${view.field.label} · ${view.field.note}`;}}
function bindFieldProbe(){
 const box=$('fieldProbe'),scene=$('scene'),svg=scene.querySelector('svg');box.hidden=true;scene.onpointermove=null;scene.onpointerdown=null;scene.onpointerleave=null;if(fieldQuantity==='schlieren')return;
 if((current?.scene.kind==='airfoil'||current?.scene.wallReflection||current?.scene.ramjet||current?.scene.tracking||current?.scene.moc?.fitted)&&svg){
  const hide=()=>box.hidden=true;
  const inspect=e=>{const matrix=svg.getScreenCTM();if(!matrix)return hide();const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const q=pt.matrixTransform(matrix.inverse()),v=(current.scene.kind==='airfoil'?probeAirfoilField:current.scene.wallReflection?probeWedgeWall:current.scene.ramjet?probeInlet:current.scene.moc?.fitted?probeFittedMOC:probeTracking)(current.scene,q.x,q.y);if(!v)return hide();box.innerHTML=current.scene.kind==='airfoil'?`<strong>${v.region==='Expansion fan'?'Expansion fan':'Region '+v.region}</strong>`:'';box.innerHTML+=`<strong>${current.scene.kind==='airfoil'?(v.approximate?'Schematic overlap state · interactions neglected':'Local analytical flow state'):`x = ${fmt(v.x,5)} m · y = ${fmt(v.y,5)} m`}</strong><dl>${[...(current.scene.kind==='airfoil'?[['Cp',(v.p-current.result.freestream.p)/current.result.q]]:[]),['Mach M',v.M],['p (kPa)',v.p/1000],['T (K)',v.T],['ρ (kg/m³)',v.rho],['u (m/s)',v.u],['θ (°)',v.theta*180/Math.PI]].map(([label,value])=>`<div><dt>${label}</dt><dd>${fmt(value,6)}</dd></div>`).join('')}</dl>`;box.hidden=false;const bounds=box.getBoundingClientRect();box.style.left=Math.max(8,Math.min(innerWidth-bounds.width-8,e.clientX+16))+'px';box.style.top=Math.max(8,Math.min(innerHeight-bounds.height-8,e.clientY+16))+'px';};scene.onpointermove=inspect;scene.onpointerdown=inspect;scene.onpointerleave=hide;return;
 }
 if(!['cone','wedge','bodyCompare'].includes(current?.scene.kind)||!svg)return;
 const hide=()=>{box.hidden=true;$('fieldProbePoint')?.setAttribute('visibility','hidden');};
 const inspect=e=>{
  const matrix=svg.getScreenCTM();if(!matrix)return hide();const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const q=pt.matrixTransform(matrix.inverse()),v=probeBody(current.scene,current.inputs,q.x,q.y);if(!v)return hide();
  box.innerHTML=`<strong>θ = ${fmt(v.theta,5)}°</strong><dl>${[['Mach M',v.M],['p (kPa)',v.p*(current.inputs.p1??101)],['T (K)',v.T*(current.inputs.T1??300)],['p/p∞',v.p],['T/T∞',v.T],['ρ/ρ∞',v.rho],['u/u∞',v.u]].map(([label,value])=>`<div><dt>${label}</dt><dd>${fmt(value,6)}</dd></div>`).join('')}</dl>`;
  box.hidden=false;const bounds=box.getBoundingClientRect();box.style.left=Math.max(8,Math.min(innerWidth-bounds.width-8,e.clientX+16))+'px';box.style.top=Math.max(8,Math.min(innerHeight-bounds.height-8,e.clientY+16))+'px';
  const dot=$('fieldProbePoint');if(dot){dot.setAttribute('cx',q.x);dot.setAttribute('cy',q.y);dot.setAttribute('visibility','visible');}
 };
 scene.onpointermove=inspect;scene.onpointerdown=inspect;scene.onpointerleave=hide;
}
$('fieldQuantity').onchange=()=>{fieldQuantity=$('fieldQuantity').value;renderScene();};
const extraPlotSelections={};
function currentPlotTime(){
 const r=current.result;
 if(!r.twoStagePiston&&!r.valveClosure&&!r.finiteTube)return sceneTime;
 const fraction=Number($('unsteadyProfileTime').value);
 return fraction*(r.end??r.catchTime??1);
}
function updatePlotChoices(){
 chartChoices=plotOptions(current,currentPlotTime());$('chartPlay').hidden=!current.result.finiteTube;$('unsteadyProfileTimeLabel').hidden=true;$('chart').closest('.chart-card').hidden=!chartChoices.length||current.id==='airfoil'||!!(current.result.finalStreamMatch&&current.inspectTrackingEvent);if(!chartChoices.length){$('extraPlotPicker')?.setAttribute('hidden','');$('plotQuantity').innerHTML='';$('plotQuantity').hidden=true;$('plotQuantity').previousElementSibling.hidden=true;$('chart').innerHTML='';$('legend').innerHTML='';$('plotNote').textContent='';displayedChart=null;return;}const select=$('plotQuantity');select.innerHTML=chartChoices.map(o=>`<option value="${o.key}">${o.label}</option>`).join('');if(!chartChoices.some(o=>o.key===plotSelection[id]))plotSelection[id]=chartChoices[0].key;select.value=plotSelection[id];const single=chartChoices.length===1;select.hidden=single;select.previousElementSibling.hidden=single;renderSelectedPlot();renderPlotPicker();
}
function renderSelectedPlot(){
 $('chartProbe').hidden=true;
 if(!current)return;
 const profile=id==='tube'&&(plotSelection[id]??'').startsWith('tube-profile-');
 $('unsteadyProfileTimeLabel').hidden=!(current.result.finiteTube||profile&&(current.result.twoStagePiston||current.result.valveClosure));
 $('unsteadyProfileTime').min=current.result.finiteTube?'0':'0.01';
 $('unsteadyProfileTime').step=current.result.finiteTube?'0.001':'0.01';
 if(!current.result.finiteTube)$('unsteadyTimeReadout').textContent='';
 if(profile)chartChoices=plotOptions(current,currentPlotTime());
 const option=chartChoices.find(o=>o.key===plotSelection[id])??chartChoices[0];if(!option){$('chart').innerHTML='';$('legend').innerHTML='';$('chartTitle').textContent=current.id==='airfoil'?'No accepted surface profile':'No attached-flow profile';$('plotNote').textContent='';return;}displayedChart=option.chart;const chart=chartSVG(displayedChart);$('chartTitle').textContent=displayedChart.title;$('chart').innerHTML=chart.svg;$('legend').innerHTML=chart.legend;$('plotNote').textContent=option.note??'Choose a property to set its own units and axis. Curves show the current model and input conditions.';if(option.formula){const formula=document.createElement('div');formula.className='plot-formula';formula.textContent=option.formula;$('plotNote').append(formula);}bindProbe(chart.axis);renderExtraPlots();updateFiniteTimeCursor();
}
function updateFiniteTimeCursor(){
 if(!current?.result.finiteTube)return;
 const r=current.result,time=finiteTubeFrame(r,currentPlotTime()).time;
 const scale=r.end>=1?1:1000,unit=r.end>=1?'s':'ms';
 $('unsteadyTimeReadout').textContent=`${(time*scale).toFixed(2)} / ${(r.end*scale).toFixed(2)} ${unit}`;
 const cursor=$('finiteTimeCursor'),hit=$('chartHit');
 if(!cursor||!hit)return;
 const y=Number(hit.getAttribute('y'))+Number(hit.getAttribute('height'))*(1-time/r.end);
 cursor.setAttribute('y1',y);cursor.setAttribute('y2',y);
}
function showFiniteTime(){
 renderScene();
 if((plotSelection[id]??'').startsWith('tube-profile-'))renderSelectedPlot();
 else updateFiniteTimeCursor();
}
$('unsteadyProfileTime').oninput=()=>{
 if(current?.result.finiteTube){stopAnimation();showFiniteTime();}
 else renderSelectedPlot();
};
$('plotQuantity').onchange=()=>{plotSelection[id]=$('plotQuantity').value;renderSelectedPlot();renderPlotPicker();};
function bindProbe(a,root=$('chart'),data=displayedChart){
 const local=k=>root.querySelector('[id="'+k+'"]');
 const hit=local('chartHit'),svg=hit?.ownerSVGElement,box=$('chartProbe');box.hidden=true;if(!hit||!a)return;
 const hide=()=>{box.hidden=true;local('cursorLine')?.setAttribute('opacity','0');local('cursorPoint')?.setAttribute('opacity','0');};
 const inspect=e=>{
  const matrix=svg.getScreenCTM();if(!matrix)return hide();const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const q=pt.matrixTransform(matrix.inverse()),v=nearestChartPoint(data,a,q.x,q.y);if(!v)return hide();
  box.textContent=(data.series.length>1?v.name+'\n':'')+`${data.xlabel}: ${fmt(v.x,6)}\n${data.ylabel}: ${fmt(v.y,6)}`;box.hidden=false;
  const bounds=box.getBoundingClientRect();box.style.left=Math.max(8,Math.min(innerWidth-bounds.width-8,e.clientX+15))+'px';box.style.top=Math.max(8,Math.min(innerHeight-bounds.height-8,e.clientY+15))+'px';
  const line=local('cursorLine');line.setAttribute('x1',v.cx);line.setAttribute('x2',v.cx);line.setAttribute('opacity','1');const dot=local('cursorPoint');dot.setAttribute('cx',v.cx);dot.setAttribute('cy',v.cy);dot.setAttribute('opacity','1');
 };
 hit.onpointermove=inspect;hit.onpointerdown=inspect;hit.onpointerleave=hide;
}
function download(name,text,type){let blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('exportJson').onclick=()=>{if(current)download(`compressible-flow-${id}.json`,JSON.stringify({...current,exportedAt:new Date().toISOString()},null,2),'application/json');};
$('exportCsv').onclick=()=>{if(!current)return;let q=s=>'"'+String(s).replaceAll('"','""')+'"';download(`compressible-flow-${id}.csv`,'property,value,unit\n'+csvDataRows(current).map(r=>[r.label,r.value??'',r.unit].map(q).join(',')).join('\n'),'text/csv');};
$('exportSvg').onclick=()=>{if(current)download(`compressible-flow-${id}.svg`,$('scene').innerHTML,'image/svg+xml');};
$('reset').onclick=()=>{stopSweep();clearTimeout(timer);sweepPositioned=false;sweepFinished=false;inputs=defaults(id);renderInputs();solve();};
$('pin').onclick=()=>{if(!current)return;pinned={id,inputs:{...inputs},rows:current.rows.map(x=>({...x}))};try{localStorage.setItem('gdvl-pinned',JSON.stringify(pinned));}catch{}renderCompare();};
try{pinned=JSON.parse(localStorage.getItem('gdvl-pinned'));}catch{}
function renderCompare(){let box=$('comparison');if(!current||!pinned||pinned.id!==id){box.hidden=true;return;}box.hidden=false;box.innerHTML='<b>Pinned / current</b><table><tr><th>Property</th><th>Pinned</th><th>Current</th></tr>'+current.rows.map((r,i)=>`<tr><td>${r.label}</td><td>${fmt(pinned.rows.find(v=>v.label===r.label&&v.unit===r.unit)?.value)}</td><td>${fmt(r.value)}</td></tr>`).join('')+'</table><button class="text-btn" id="clearPin">Clear comparison</button>';$('clearPin').onclick=()=>{pinned=null;try{localStorage.removeItem('gdvl-pinned');}catch{}renderCompare();};}
function syncChartPlay(){
 const button=$('chartPlay');
 button.hidden=!current?.result.finiteTube;
 button.textContent=animation?'Ⅱ Pause':'▶ Play';
 button.setAttribute('aria-pressed',String(animation));
}
function stopAnimation(){animation=false;syncChartPlay();cancelAnimationFrame(frame);$('scene').classList.remove('animating');$('animate').textContent=current?.result.finiteTube?'▶ Play':'▶ Animate';$('animate').setAttribute('aria-pressed','false');}
function playFiniteTube(){
 const slider=$('unsteadyProfileTime');
 const from=Number(slider.value)>=1?0:Number(slider.value);
 slider.value=String(from);showFiniteTime();
 let start, previous=from;
 const tick=timestamp=>{
  if(!animation)return;
  start??=timestamp;
  const fraction=Math.min(1,from+(timestamp-start)/6000);
  if(fraction===1||fraction-previous>=1/120){
   slider.value=String(fraction);previous=fraction;showFiniteTime();
  }
  if(fraction<1)frame=requestAnimationFrame(tick);
  else stopAnimation();
 };
 frame=requestAnimationFrame(tick);
}
$('animate').onclick=()=>{if(id==='nozzle'){toggleSweep();return;}if(!current)return;if(animation){stopAnimation();return;}if(matchMedia('(prefers-reduced-motion: reduce)').matches){$('notice').hidden=false;$('notice').textContent='Animation is paused because your system prefers reduced motion.';return;}animation=true;syncChartPlay();$('scene').classList.add('animating');$('animate').textContent='Ⅱ Pause';$('animate').setAttribute('aria-pressed','true');if(current.result.finiteTube){playFiniteTube();return;}if(id==='tube'){const tick=t=>{if(!animation)return;if(t-lastFrame>45){lastFrame=t;sceneTime=.00012+(t%6000)/6000*.00188;renderScene();if((plotSelection[id]??'').startsWith('tube-profile-'))renderSelectedPlot();}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);}else{$('notice').hidden=false;$('notice').textContent='Moving tracers illustrate flow direction only; they are not time-resolved particle trajectories.';}};
$('chartPlay').onclick=()=>{$('animate').onclick();};
let sweepPlaying=false,sweepTimer=null,sweepPositioned=false,sweepAtEnd=false,sweepDelay=100,sweepFinished=false,solvePending=false,sweepPlanCache=null,sweepPlanKey='';
function getSweepPlan(){
 const key=JSON.stringify([id,inputs.ductProblem,inputs.fannoSystemSolve,inputs.systemAreaRatio,inputs.nozzleContraction,inputs.nozzleLength,inputs.ductLength,inputs.ductSection,inputs.ductWidth,inputs.ductHeight,inputs.lambda,inputs.frictionInput,inputs.hydraulicDiameter,inputs.frictionFactor,inputs.frictionConvention,inputs.reservoirT0,inputs.nozzleType,inputs.areaRatio,inputs.contractionRatio,inputs.MIn,inputs.sonicBranch,inputs.outletCondition,inputs.gamma]);
 if(key!==sweepPlanKey||!sweepPlanCache){sweepPlanKey=key;try{sweepPlanCache=id==='fanno'?fannoPressurePlan(inputs):pressureSweepPlan(inputs);}catch(e){sweepPlanCache={enabled:false,min:.001,max:1,milestones:[],message:e.message};}}
 return sweepPlanCache;
}
function syncSweep(){
 const active=id==='nozzle'||id==='fanno'&&inputs.ductProblem===fannoSystemMode&&inputs.fannoCondition===fannoConditions[0];const box=$('nozzleSweep');box.hidden=!active;$('animate').hidden=!['nozzle','tube'].includes(id);if(!active)return;
 const plan=getSweepPlan(),ratio=id==='fanno'&&current?.result.fullSystem&&(inputs.fannoCondition!==fannoConditions[0]||inputs.fannoSystemSolve!==fannoSolves[0])?current.result.backRatio:inputs.backRatio,position=Number.isFinite(ratio)?ratio:plan.min;
 if(id==='fanno'&&plan.enabled){
  for(const key of ['value-backRatio','range-backRatio']){const control=$(key);if(control){control.min=plan.min;control.max=plan.max;}}
  const labels=$('range-backRatio')?.parentElement.querySelector('.range-labels');if(labels){labels.firstElementChild.textContent=fmt(plan.min,6);labels.lastElementChild.textContent=fmt(plan.max,6);}
 }
 $('pressureScrub').min=plan.min;$('pressureScrub').max=plan.max;$('pressureScrub').value=position;$('pressureScrub').disabled=!plan.enabled;
 $('sweepMin').textContent=fmt(plan.min,5);$('sweepMax').textContent=fmt(plan.max,6);
 $('sweepValue').textContent=`pᵦ/p₀ = ${fmt(ratio,7)}`;
 $('sweepPlay').disabled=!plan.enabled;$('sweepPlay').textContent=sweepPlaying?'Ⅱ Pause':'▶ Play sweep';$('sweepPlay').setAttribute('aria-pressed',String(sweepPlaying));$('sweepRestart').disabled=!plan.enabled;
 $('sweepEnable').hidden=!plan.canEnable;$('sweepAvailability').textContent=(sweepFinished?'Sweep complete. ':'')+plan.message;
 const signature=JSON.stringify(plan.milestones);if($('sweepJump').dataset.plan!==signature){$('sweepJump').innerHTML='<option value="">Choose a state…</option>'+plan.milestones.map(m=>`<option value="${m.pressure}">${m.label} · ${fmt(m.pressure,6)}</option>`).join('');$('sweepJump').dataset.plan=signature;}
 $('sweepJump').disabled=!plan.enabled;const mark=plan.milestones.find(m=>Math.abs(m.pressure-position)<1e-12);$('sweepJump').value=mark?String(mark.pressure):'';
 if(current&&current.id==='nozzle'){
  const r=current.result,external=r.external,title=external&&external.status!=='matched'?external.title:r.regime;
  $('sweepState').textContent=`${title}${r.shockX!==null?` · xₛ/L = ${fmt(r.shockX,5)}`:''} · pᵦ = ${fmt(position*inputs.p0,6)} kPa`;
 }else if(id==='fanno'&&current?.result.fullSystem){const r=current.result;$('sweepState').textContent=`${r.regime}${r.shockX!==null?' · xₛ = '+fmt(r.shockX,5)+' m':''} · pᵦ = ${fmt(r.backPressure/1000,6)} kPa`;}else $('sweepState').textContent=plan.enabled?'Ready to vary back pressure.':plan.message;
}
function stopSweep(){sweepPlaying=false;clearTimeout(sweepTimer);sweepTimer=null;sweepAtEnd=false;if($('sweepPlay')){$('sweepPlay').textContent='▶ Play sweep';$('sweepPlay').setAttribute('aria-pressed','false');}}
function setSweepPressure(value){inputs.backRatio=value;if(id==='fanno'&&inputs.fannoCondition!==fannoConditions[0]){inputs.fannoCondition=fannoConditions[0];renderInputs();}const n=$('value-backRatio'),r=$('range-backRatio');if(n)n.value=value;if(r)r.value=value;$('pressureScrub').value=value;syncSweep();}
function requestSweepFrame(){
 if(!sweepPlaying)return;
 if(solvePending){sweepTimer=setTimeout(requestSweepFrame,50);return;}
 const plan=getSweepPlan(),direction=Number($('sweepDirection').value),speed=Number($('sweepSpeed').value);
 if(!plan.enabled){stopSweep();syncSweep();return;}
 const next=advancePressure(inputs.backRatio,plan,direction,(plan.max-plan.min)*.0035*speed);
 sweepAtEnd=next.ended;sweepDelay=next.milestone?Math.max(200,900/speed):100;
 setSweepPressure(next.pressure);solve({stream:true});
}
function continueSweep(){
 if(!sweepPlaying)return;
 if(sweepAtEnd){
  if(!$('sweepRepeat').checked){stopSweep();sweepFinished=true;syncSweep();return;}
  $('sweepDirection').value=String(-Number($('sweepDirection').value));sweepAtEnd=false;
 }
 clearTimeout(sweepTimer);sweepTimer=setTimeout(requestSweepFrame,sweepDelay);
}
function toggleSweep(){
 if(sweepPlaying){stopSweep();syncSweep();return;}
 const plan=getSweepPlan();if(!plan.enabled)return;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){$('sweepAvailability').textContent='Reduced motion is enabled. Use the pressure slider or jump controls to inspect each steady state.';return;}
 clearTimeout(timer);stopAnimation();const direction=Number($('sweepDirection').value),end=direction===1?plan.max:plan.min;
 if(!sweepPositioned||!Number.isFinite(inputs.backRatio)||Math.abs(inputs.backRatio-end)<1e-12)inputs.backRatio=direction===1?plan.min:plan.max;
 inputs.backRatio=Math.max(plan.min,Math.min(plan.max,inputs.backRatio));if(id==='nozzle')inputs.nozzleView='Nozzle + external waves';if(id==='fanno')inputs.fannoCondition=fannoConditions[0];sweepPlaying=true;sweepPositioned=true;sweepFinished=false;sweepDelay=700;sweepAtEnd=false;renderInputs();setSweepPressure(inputs.backRatio);solve({stream:true});
}
$('sweepPlay').onclick=toggleSweep;
$('sweepRestart').onclick=()=>{stopSweep();clearTimeout(timer);sweepPositioned=true;sweepFinished=false;const p=getSweepPlan();if(p.enabled){setSweepPressure(Number($('sweepDirection').value)===1?p.min:p.max);solve({stream:true});}};
$('pressureScrub').oninput=()=>{stopSweep();clearTimeout(timer);sweepPositioned=true;sweepFinished=false;request++;setSweepPressure(Number($('pressureScrub').value));schedule(true);};
$('sweepJump').onchange=()=>{if($('sweepJump').value==='')return;const target=Number($('sweepJump').value);stopSweep();clearTimeout(timer);sweepPositioned=true;sweepFinished=false;setSweepPressure(target);solve({stream:true});};
$('sweepDirection').onchange=()=>{if(sweepPlaying){sweepAtEnd=false;clearTimeout(sweepTimer);if(!solvePending)sweepTimer=setTimeout(requestSweepFrame,100);}};
$('sweepSpeed').onchange=()=>{if(sweepPlaying&&!solvePending){clearTimeout(sweepTimer);sweepTimer=setTimeout(requestSweepFrame,100);}};
$('sweepEnable').onclick=()=>{stopSweep();inputs.outletCondition='Specified back pressure';sweepPositioned=false;sweepFinished=false;const p=getSweepPlan();if(p.enabled)inputs.backRatio=Math.min(p.max,Math.max(p.min,inputs.backRatio));renderInputs();solve();};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&sweepPlaying){stopSweep();syncSweep();}});

$('guideButton').onclick=()=>{$('modelDetails').hidden=!$('modelDetails').hidden;};window.addEventListener('hashchange',openLab);openLab();

$('exportPng').onclick=async()=>{if(!current)return;const button=$('exportPng');button.disabled=true;let url;try{const svg=$('scene').querySelector('svg').cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');const box=svg.viewBox.baseVal;const width=box.width||960,height=box.height||450;svg.setAttribute('width',width);svg.setAttribute('height',height);url=URL.createObjectURL(new Blob([uniformDiagramText(new XMLSerializer().serializeToString(svg))],{type:'image/svg+xml'}));const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG export failed');const link=document.createElement('a'),pngUrl=URL.createObjectURL(blob);link.href=pngUrl;link.download=`compressible-flow-${id}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(pngUrl),1000);}catch(error){alert('Image export failed. Please use SVG or try again.');}finally{if(url)URL.revokeObjectURL(url);button.disabled=false;}};

function renderPlotPicker(){let box=$('extraPlotPicker');if(!box){box=document.createElement('details');box.id='extraPlotPicker';box.innerHTML='<summary>Select curves on this chart</summary><div></div>';$('chart').before(box);}box.hidden=chartChoices.length<2||!!chartChoices.find(o=>o.key===plotSelection[id])?.chart.heatmap;const selected=extraPlotSelections[id]??[];box.querySelector('div').innerHTML=chartChoices.map(o=>`<label><input type="checkbox" value="${o.key}" ${selected.includes(o.key)?'checked':''} ${(o.chart.heatmap||o.chart.xlabel!==chartChoices.find(c=>c.key===plotSelection[id])?.chart.xlabel)?'disabled':''}> ${o.label}</label>`).join('');box.onchange=()=>{extraPlotSelections[id]=[...box.querySelectorAll('input:checked')].map(e=>e.value);renderSelectedPlot();};}
function selectedCharts(){const keys=[plotSelection[id],...(extraPlotSelections[id]??[])];const first=chartChoices.find(o=>o.key===keys[0])??chartChoices[0];return first?[first,...chartChoices.filter(o=>keys.includes(o.key)&&o!==first&&!first.chart.heatmap&&!o.chart.heatmap&&o.chart.xlabel===first.chart.xlabel)]:[];}
function renderExtraPlots(){const options=selectedCharts();if(!options.length)return;const mixed=options.some(o=>o.chart.ylabel!==options[0].chart.ylabel);const series=options.flatMap(o=>o.chart.series.map(curve=>({...curve,name:`${curve.name}${mixed?' ['+o.chart.ylabel+']':''}`,points:curve.points})));displayedChart={...options[0].chart,title:options.length>1?'Selected properties':options[0].chart.title,markers:options.flatMap(o=>o.chart.markers??[]),ylabel:mixed?'Property value (units in legend)':options[0].chart.ylabel,series};const view=chartSVG(displayedChart);$('chart').innerHTML=view.svg;$('legend').innerHTML=view.legend;$('chartTitle').textContent=displayedChart.title;$('plotNote').textContent=options.length>1?'All curves use their original values on one shared vertical scale. Units are shown in the legend.':options[0].note??'';bindProbe(view.axis);renderChartExports();updateDuctNotes();}
function saveChartBlob(name,blob){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function renderChartExports(){let box=$('chartExports');if(!box){box=document.createElement('div');box.id='chartExports';box.className='scene-tools';$('legend').after(box);}box.innerHTML='<button type="button" class="text-btn" data-format="png">PNG ↓</button><button type="button" class="text-btn" data-format="svg">SVG ↓</button><button type="button" class="text-btn" data-format="xlsx">Excel ↓</button>';box.querySelector('[data-format="xlsx"]').hidden=!!displayedChart.heatmap;box.onclick=async e=>{const format=e.target.dataset.format;if(!format)return;const name=`compressible-flow-${id}-chart`;if(format==='xlsx'){saveChartBlob(name+'.xlsx',chartWorkbook(selectedCharts().map(o=>o.chart)));return;}const svg=$('chart').querySelector('svg').cloneNode(true);const width=640,heatNote=current?.id==='rayleigh'&&/x\/L/.test(displayedChart.xlabel),extra=displayedChart.series.length*22+42+(heatNote?40:0);svg.setAttribute('viewBox',`0 0 640 ${266+extra}`);svg.setAttribute('width',640);svg.setAttribute('height',266+extra);const ns='http://www.w3.org/2000/svg';const text=(value,y,size=11)=>{const t=document.createElementNS(ns,'text');t.setAttribute('x',20);t.setAttribute('y',y);t.setAttribute('font-size',size);t.setAttribute('fill','#17383b');t.textContent=value;svg.append(t);};text(displayedChart.title,284,14);displayedChart.series.forEach((s,i)=>text(s.name,306+i*22));if(heatNote){text('Uniform heat transfer along the heated duct:',306+displayedChart.series.length*22);text('equal heat added/removed per metre; temperature need not be uniform.',322+displayedChart.series.length*22);}const blob=new Blob([uniformDiagramText(new XMLSerializer().serializeToString(svg))],{type:'image/svg+xml'});if(format==='svg'){saveChartBlob(name+'.svg',blob);return;}const button=e.target;button.disabled=true;const url=URL.createObjectURL(blob);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=(266+extra)*2;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(png)saveChartBlob(name+'.png',png);}finally{URL.revokeObjectURL(url);button.disabled=false;}};}

function syncRayleighHeat(){if(id!=='rayleigh'||(inputs.ductProblem??'Single duct')!=='Single duct')return;let bounds;try{bounds=rayleighHeatBounds(inputs);}catch{return;}if(!bounds)return;const {min,max}=bounds,number=$('value-q'),slider=$('range-q');if(!number||!slider)return;number.min=min;number.max=max;slider.min=min;slider.max=inputs.rayleighInput==='Heat transfer + Outlet Mach'&&inputs.targetMach<=1?Math.min(max,Math.max(1000,(inputs.q??0)*1.2,Math.abs(min)*2)):max;slider.step=Math.max(1e-9,(slider.max-min)/2000);slider.value=inputs.q;const labels=slider.parentElement.querySelector('.range-labels');if(labels){labels.firstElementChild.textContent=fmt(min,6);labels.lastElementChild.textContent=fmt(Number(slider.max),6);}}


function renderExamples(){
 if(coneExampleChanged())inputs.bookExample='';
 const box=$('examplesPanel');let entries=[];
 const load=(preset,bookExample)=>{
  inputs={...defaults(id),...preset,bookExample};
  if(id==='tube'){
   const slider=$('unsteadyProfileTime');
   slider.min='0';slider.step='0.001';slider.value=bookExample==='sinusoidal-ten-cycles'?'0':bookExample==='7–10'?'0.1875':bookExample==='7–3'?'0.067':'0.133';
  }
 };
 if(id==='tube')entries=[{value:'7–1',label:'Example 1 · Moving normal shock',note:'Air at rest, T₁ = 300 K, p₂/p₁ = 10. p₁ = 100 kPa is a reference pressure; T₄ = 300 K defines an equivalent shock-tube driver. Shock speed, induced gas speed and T₂/T₁ do not depend on these additional driver/reference choices.',apply:()=>{stopAnimation();load({tubeInput:'Shock pressure ratio p₂/p₁',shockRatio:10,p1:100,T1:300,T4:300},'7–1');}}];
 if(id==='tube')entries.push({value:'7–2',label:'Example 2 · Given piston / gas speed',note:'Initially stationary air, gas / piston speed 150 m/s, T₁ = 25°C ≈ 298 K as rounded in the book. p₁ = 100 kPa and T₄ = 298 K define an equivalent driver for the displayed shock tube; they do not change the requested shock speed. For exact Celsius conversion, enter 298.15 K.',apply:()=>{stopAnimation();load({tubeInput:'Induced gas speed',inducedSpeed:150,p1:100,T1:298,T4:298},'7–2');}});
 if(id==='tube')entries.push({value:'7–3',label:'Example 3 · Two successive shocks',note:'Helium: γ = 1.667, R = 2077 J/(kg·K), T₁ = 300 K (book rounding of 27°C). Piston speed 25 → 50 m/s after 1 s. p₁ = 100 kPa is a reference; it does not affect shock speeds or catch-up. The end wall is 40 km away so the shocks merge at 31.325464 s and 32452.402 m before reflections. The 90 s simulation also shows the return of the reflected wave toward the piston.',apply:()=>{stopAnimation();load({unsteadyExperiment:'Two-stage piston',fluid:'Custom gas',gamma:1.667,R:2077,pistonSpeed1:25,pistonSpeed2:50,pistonDelay:1,T1:300,p1:100,pistonTubeLength:40000,finiteEndTime:90000,finiteCells:1200},'7–3');}});
 if(id==='tube')entries.push({value:'7–4',label:'Example 4 · Sudden valve closure',note:'Air flows toward the valve at 60 m/s, 101 kPa and 300 K. A shock moves upstream and brings the gas behind it to rest. The upstream piston keeps moving at 60 m/s. The 6 m tube and 30 ms duration are editable simulation settings.',apply:()=>{stopAnimation();load({unsteadyExperiment:valveExperiment,valveInletSpeed:60,p1:101,T1:300},'7–4');}});
 if(id==='tube')entries.push({value:'7–7',label:'Example 5 · Shock into moving gas',note:'Air approaches the incident shock at 200 m/s (u₁ = −200 m/s), with T₁ = 300 K and p₂/p₁ = 10 as in Example 1. The equivalent driver shares the initial velocity. p₁ = 100 kPa and T₄ = 300 K set reference chamber conditions. The numerical field also includes waves generated at both closed ends at t = 0.',apply:()=>{stopAnimation();load({tubeInput:'Shock pressure ratio p₂/p₁',shockRatio:10,tubeInitialVelocity:-200,p1:100,T1:300,T4:300},'7–7');}});
 if(id==='tube')entries.push({value:'7–10',label:'Example 6 · Sinusoidal piston',note:'The book gives a symbolic small-amplitude solution for one complete cycle. This preset uses air at 100 kPa and 300 K, ε = 0.01, f = 100 Hz and a 6 m closed tube. The preview compares both solutions before reflections; Play continues through reflections to 40 ms.',apply:()=>{stopAnimation();load({unsteadyExperiment:sinusoidalExperiment,pistonEpsilon:.01,pistonFrequency:100,pistonCycles:1,pistonTubeLength:6,finiteEndTime:40,finiteCells:1200,p1:100,T1:300},'7–10');plotSelection.tube='tube-profile-sine-u';}});
 if(id==='tube'){
  entries.push({value:'7–12',label:'Example 7 · Shock reflection at a closed wall',note:'Air at rest, T₁ = 300 K and p₂/p₁ = 10. The book does not specify lengths. The 4 m driver, 6 m driven section, 0.30 m diameter and 30 ms duration are editable demonstration settings. p₁ = 100 kPa and T₄ = 300 K define the equivalent driver.',apply:()=>{stopAnimation();load({tubeDomain:finiteTubeMode,tubeInput:'Shock pressure ratio p₂/p₁',shockRatio:10,p1:100,T1:300,T4:300},'7–12');}});
  entries.push({value:'7–13',label:'Example 8 · Finite shock tube',note:'Air in both chambers. Driver: 4 m, 200 kPa, 20 °C. Driven: 6 m, 5 kPa, 25 °C. Diameter 0.30 m. The sample is 3 m downstream of the diaphragm. Passage times use the initial analytical wave speeds. The simulation initially runs to 30 ms.',apply:()=>{stopAnimation();load({tubeDomain:finiteTubeMode,p4:200,p1:5,T4:293.15,T1:298.15,finiteDriverLength:4,finiteDrivenLength:6,finiteDiameter:.3},'7–13');}});
 }
 if(id==='tube')entries.push({value:'sinusoidal-ten-cycles',label:'Example 9 · Sinusoidal piston · 10 cycles',note:'Air at 100 kPa and 300 K in a 6 m closed tube. The piston completes 10 cycles at 100 Hz with ε = 0.1. Press Play to watch the full 100 ms from the start.',apply:()=>{stopAnimation();load({unsteadyExperiment:sinusoidalExperiment,pistonEpsilon:0.1,pistonFrequency:100,pistonCycles:10,pistonTubeLength:6,finiteEndTime:100,finiteCells:1200,p1:100,T1:300},'sinusoidal-ten-cycles');plotSelection.tube='finite-map-pressure';}});
 if(id==='normal')entries=[
  {value:'3-1',label:'Example 1',note:'Air enters at M₁ = 2, p₁ = 137.9 kPa and T₁ = 277.78 K. Find the downstream state, the stagnation-pressure loss and the entropy increase.',apply:()=>load({M1:2,p1:137.9,T1:277.78},'3-1')},
  {value:'3-2',label:'Example 2',note:'Air enters at M₁ = 1.8. The book supplies Mach only. The preset uses 101 kPa and 300 K as reference values for dimensional results. The shock ratios and entropy increase are independent of those values.',apply:()=>load({M1:1.8,p1:101,T1:300},'3-2')},
 ];
 if(id==='fanno')entries=fannoExamples.map(e=>({value:'5–'+e.number,label:String(e.number),note:e.note,apply:()=>load(e.inputs,'5–'+e.number)}));
 if(id==='rayleigh'){
  const cases=[['4–1',{ductProblem:'Single duct',rayleighInput:'Heat transfer',M1:3,T1:300,p1:101,q:300}],['4–2',{ductProblem:'Single duct',rayleighInput:'Outlet Mach',M1:1.5,targetMach:3,p1:68.95,T1:300}],['4–3',{ductProblem:'Single duct',rayleighInput:'Outlet Mach + stagnation temperatures',targetMach:.93,inletT0:373.15,outletT0:573.15,p1:101}],['4–4',{ductProblem:'Reservoir-fed duct',ductSolve:'Upstream reference + sonic outlet',M1:.41,p1:68.95,inletT0:229.4,outletT0:1666.7}],['4–5',{ductProblem:'Single duct',rayleighInput:'Heat transfer',velocityInput:'Flow speed',inletSpeed:122.5,T1:222.2,p1:68.95,q:116.3}],['4–7',{ductProblem:'Heat + shock + converging nozzle',systemInletType:'Static duct inlet',M1:1.6,T1:200,p1:56,backPressure:120}]];
  cases.push(...reservoirExamples);
  const notes={
   '4–1':'Air enters a constant-area duct at Mach 3. Add 300 kJ/kg of heat and find the outlet Mach number and flow properties.',
   '4–2':'Air enters at Mach 1.5 and leaves at Mach 3. Find the heat that must be removed and the outlet flow properties.',
   '4–3':'The outlet Mach number is 0.93. The stagnation temperature rises from 373.15 K to 573.15 K. Find the inlet Mach number and heat added.',
   '4–4':'The upstream reference Mach number is 0.41. Find the adjusted duct-inlet state and the sonic outlet state when the outlet stagnation temperature reaches 1666.7 K.',
   '4–5':'Air enters at 122.5 m/s, 68.95 kPa and 222.2 K. Add 116.3 kJ/kg of heat and find the outlet Mach number, pressure and temperature.',
   '4–7':'Air enters at Mach 1.6. Find the heat transfer and the states across the normal shock and through the converging nozzle for a back pressure of 120 kPa.',
   'R1 · Sonic outlet':'Add 100 kJ/kg to reach Mach 1 at the outlet. Find the duct-inlet state and the outlet pressure.',
   'R2 · Specified back pressure':'Add 100 kJ/kg with a specified back pressure. Find the inlet and outlet Mach numbers consistent with that pressure.',
   'R3 · Heat + outlet Mach':'Given the heat added and the outlet Mach number, find the duct-inlet state and the outlet pressure.',
   'R4 · Outlet Mach + outlet pressure':'Given the outlet Mach number and pressure, find the heat added and the duct-inlet state.',
  };
  entries=cases.map(([name,preset])=>({value:name,label:'Example '+name.split('–').pop(),note:notes[name],apply:()=>load(preset,name)}));
 }
 if(id==='wall'){
  entries=[4,5].map(n=>({value:'6–'+n,label:'Example '+n,apply:()=>{inputs={...inputs,...chapter6Example(n),bookExample:'6–'+n};}}));
  entries.push({value:'6–7',label:'Example 7 · Shock–expansion interaction',note:'M₁ = 1.95, p₀₁ = 482.65 kPa, both walls at +10° to horizontal. Final uniform-stream reference; inlet temperature sets dimensional density and speed.',apply:()=>{inputs={...inputs,...shockFanPreset};}});
  for(const [code,label,segments] of [['6–P1a','Problem 6–1(a) · Single 15° ramp',[{angle:15,length:1}]],['6–P1b','Problem 6–1(b) · 7° + 8° turns',[{angle:7,length:.5},{angle:15,length:.5}]]])entries.push({value:code,label,note:'M₁ = 2.5, p₁ = 11.6 kPa, T₁ = 216.65 K. Lengths and cowl clearance are illustrative; angles are absolute to horizontal. Sequential oblique shocks followed by a normal shock.',apply:()=>{inputs={...inputs,...multiRampProblemPreset,inletLowerSegments:segments,bookExample:code};}});
  entries.push({value:'6–9',label:'Example 9 · Ramjet inlet',note:'Custom wall inlet: Lref = 0.1 m, M₁ = 2, 8° wedge and a regular reflection from the horizontal upper wall. No terminal normal shock. The same inlet controls also load Problem 6–1.',apply:()=>{inputs={...inputs,...multiRampPreset,inletReference:0.1};}});
  entries.push({value:'expansion',label:'Expansion example',apply:()=>{inputs={...inputs,wallShape:'Custom wall',boundaryMode:'Channel',channelSolver:'Method of characteristics',M1:3,channelHeight:1,wallSegments:[{angle:-8,length:6}],upperWallSegments:[{angle:8,length:6}],mocResolution:81,mocStation:1,mocLines:'Shown',bookExample:'expansion'};}});
  for(const [value,label] of [['reflection','Shock reflections'],['shock-fan','Shock + expansion'],['fans','Two expansion fans']])entries.push({value,label,apply:()=>{inputs={...inputs,...trackingPreset(value),channelSolver:inputs.channelSolver,bookExample:value};}});
 }
 if(id==='airfoil'){const angle=Math.atan(.24)*180/Math.PI,length=Math.hypot(.5,.12);entries=[{value:'6–15',label:'Example 15 · Connected flat plates',note:'M∞ = 2.5, α = 4.2°, h/c = 0.12. Two zero-thickness panels with a mid-chord bend. Reference horizontal extent c = 1 m; dimensions can be scaled. Pressure and temperature are reference values.',apply:()=>load({airfoilShape:'Connected flat plates',airfoilMethod:'Shock–Expansion',M:2.5,alpha:4.2,upperSegments:[{angle,length},{angle:-angle,length}]},'6–15')}];}

 if(id==='cone')entries=[{
  value:'10-1',label:'Example 1 · Conical shock',
  note:'Air at M∞ = 2, static p∞ = 7 kPa and static T∞ = 217 K flows over a cone with an 18° full angle (9° half-angle). Find the flow deflection just behind the shock and compare Mach number, pressure and temperature there and on the cone surface.',
  apply:()=>load(coneBookPreset,'10-1'),
 }];
 if(id==='balances')entries=[['nozzle','Balanced nozzle'],['shock','Normal shock']].map(([value,label])=>({value,label,apply:()=>{inputs={...defaults(id),...controlVolumePreset(value,{gamma:inputs.gamma,R:inputs.R}),fluid:inputs.fluid,bookExample:value};}}));
 if(id==='balances')entries.push({value:'perturb',label:'Increase outlet pressure 10%',apply:()=>{inputs.p2*=1.1;inputs.bookExample='perturb';}});
 box.hidden=!entries.length;box.onclick=null;box.innerHTML='';if(!entries.length)return;
 const selected=entries.find(e=>e.value===inputs.bookExample);
 box.innerHTML=`<div class="input-group"><div class="input-top"><label for="exampleSelect">Examples</label></div><select id="exampleSelect"><option value="" disabled ${selected?'':'selected'}>Select example…</option>${entries.map(e=>`<option value="${e.value}" ${selected===e?'selected':''}>${e.label}</option>`).join('')}</select>${selected?.note?`<p class="control-hint">${selected.note}</p>`:''}</div>`;
 $('exampleSelect').onchange=e=>{const entry=entries.find(x=>x.value===e.target.value);if(!entry)return;stopSweep();sweepFinished=false;sweepPositioned=false;request++;clearTimeout(timer);entry.apply();renderInputs();solve();};
}

function knownRayleighData(mode){return {'Sonic outlet':'Known: supply conditions and heat q, with outlet Mach fixed at 1. Solves: duct inlet and sonic outlet states.','Specified back pressure':'Known: supply conditions, heat q and outlet pressure. Solves: duct inlet and outlet Mach and properties. A low back pressure may produce a choked exit.','Heat + outlet Mach':'Known: supply conditions, heat q and subsonic outlet Mach. Solves: subsonic duct inlet and properties.','Outlet Mach + outlet pressure':'Known: supply conditions, subsonic outlet Mach and outlet pressure (selected type). Solves: subsonic inlet and heat q.','Upstream reference + sonic outlet':'Known: initial upstream reference and sonic outlet stagnation temperature. Solves: a new inlet operating state, heat q and critical exit pressure; inlet mass flux may change.'}[mode]??'Select which independent data are known; the corresponding input fields appear below.';}

function updateDuctNotes(){const valid=['rayleigh','fanno'].includes(current?.id)&&!!current?.result.longitudinal?.length;const image=$('ductImageNote'),chart=$('ductChartNote');image.hidden=!valid;image.textContent=valid?(current.result.fullSystem?'Isentropic nozzle; constant friction factor and hydraulic diameter in the duct. Normal shocks are shown at their computed position.':current.id==='rayleigh'?rayleighDistributionNote:fannoDistributionNote):'';const axial=valid&&/x\/L/.test(displayedChart?.xlabel??'');chart.hidden=!axial;chart.textContent=axial?image.textContent:'';$('plotNote').hidden=axial&&$('plotNote').textContent===image.textContent;}


