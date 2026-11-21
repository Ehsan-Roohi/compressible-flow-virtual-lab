import {airfoilRegionLabel} from './airfoil-region-labels.js?v=20261115-plate-regions';

function table(label,headers,rows) {
  const head=headers.map(h=>`<th scope="col">${h}</th>`).join('');
  const body=rows.map(([key,...values])=>
    `<tr><th scope="row">${key}</th>${values.map(v=>`<td>${v}</td>`).join('')}</tr>`
  ).join('');
  return `<div class="airfoil-scroll"><table aria-label="${label}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function detail(key,title,content) {
  return `<details class="airfoil-detail" data-airfoil-detail="${key}"><summary>${title}</summary>${content}</details>`;
}

export function airfoilTables(r,fmt,{coefficientsOnly=false}={}) {
  const number=v=>Number.isFinite(v)?fmt(v,6):'—';
  const models=r.models.filter(model=>r[model].status==='ok');
  const hasSE=models.includes('nonlinear'),hasLinear=models.includes('linear');
  const tableModels=coefficientsOnly?r.models:models;
  const both=tableModels.includes('nonlinear')&&tableModels.includes('linear');
  const methodHeaders=tableModels.map(model=>model==='linear'?'Linearized':'Shock–Expansion');
  if(both)methodHeaders.push('SE − linear');

  function coefficientRow(label,getValue) {
    const values=tableModels.map(model=>models.includes(model)?getValue(r[model],model):null);
    const row=[label,...values.map(number)];
    if(both)row.push(values.every(Number.isFinite)?number(getValue(r.nonlinear,'nonlinear')-getValue(r.linear,'linear')):'—');
    return row;
  }

  const content=['<section class="card"><div class="card-head"><h2>Aerodynamic coefficients and forces</h2></div>'];
  const plate=r.geometry.connectedPlate;
  if(plate&&!coefficientsOnly)content.push(`<p class="airfoil-empty">Panel lengths are used as entered. The coefficient reference length is the horizontal end-to-end extent, ${number(plate.reference)} m.</p>`);
  if(models.length){
    const rows=[
      coefficientRow('Lift coefficient C<sub>L</sub>',z=>z.CL),
      coefficientRow('Wave-drag coefficient C<sub>D,w</sub>',z=>z.CD),
      coefficientRow('Quarter-chord moment C<sub>M,c/4</sub>',z=>z.CM),
      coefficientRow('Lift-to-drag ratio L/D',z=>Math.abs(z.CD)>1e-12?z.CL/z.CD:null)
    ];
    if(r.forces){
      for(const [label,field] of [['Lift (kN)','lift'],['Wave drag (kN)','waveDrag'],
        ['Lift per unit span (kN/m)','liftPerSpan'],['Wave drag per unit span (kN/m)','waveDragPerSpan']]){
        rows.push(coefficientRow(label,(_,model)=>r.forces[model][field]/1000));
      }
      const {referenceChord,referenceSpan,referenceArea}=r.forces;
      content.push(`<p class="control-hint">Reference chord ${number(referenceChord)} m × span ${number(referenceSpan)} m = ${number(referenceArea)} m²</p>`);
    }
    if(coefficientsOnly)for(const p of r.geometry.panels){
      rows.push(coefficientRow(`C<sub>p</sub> · Region ${airfoilRegionLabel(r,p.id)}`,
        z=>z.panels.find(panel=>panel.id===p.id)?.Cp));
    }
    content.push(table('Aerodynamic coefficient comparison',['Quantity',...methodHeaders],rows));
  }
  if(coefficientsOnly)return content.join('')+'</section>';
  if(r.models.includes('nonlinear')&&!hasSE)
    content.push(`<p class="airfoil-empty">Shock–Expansion unavailable. ${r.nonlinear.reason}</p>`);
  if(hasSE&&r.trailingEdge?.status!=='ok')
    content.push(`<p class="airfoil-empty"><strong>Trailing-edge matching</strong> · Not resolved: ${r.trailingEdge?.reason??'No accepted trailing-edge state.'}</p>`);

  if(models.length){
    const cpRows=r.geometry.panels.map(p=>coefficientRow(airfoilRegionLabel(r,p.id),z=>z.panels.find(panel=>panel.id===p.id)?.Cp));
    const cpHeaders=methodHeaders.map(name=>`C<sub>p</sub> · ${name}`);
    let surface=table('Surface pressure coefficients',['Region',...cpHeaders],cpRows);
    if(hasSE){
      const rows=[['1',r.freestream,'—'],...r.nonlinear.panels.map(p=>[airfoilRegionLabel(r,p.id),p,p.wave])]
        .map(([region,z,wave])=>[region,...[z.M,z.p/1000,z.T,z.rho,z.u,z.p0/1000,z.T0].map(number),wave]);
      surface+=table('Flow properties by surface region',['Region','M','p (kPa)','T (K)','ρ (kg/m³)','u (m/s)','p₀ (kPa)','T₀ (K)','Wave'],rows);
    }
    content.push(detail('surface',hasSE?'Surface pressures and flow properties':'Surface pressure coefficients',surface));
  }
  if(hasLinear){
    const rows=r.linear.potential.map(p=>[airfoilRegionLabel(r,p.id),`${number(p.x0)} – ${number(p.x1)}`,
      `${number(p.derivative)} ξ ${p.intercept<0?'−':'+'} ${number(Math.abs(p.intercept))}`]);
    const key=`<dl class="airfoil-potential-key">
      <div><dt>ξ = x/c</dt><dd>Position along the chord. Divide the distance x from the leading edge by the chord length c. The leading edge is at ξ = 0 and the trailing edge is at ξ = 1.</dd></div>
      <div><dt>ψ = φ/(U<sub>∞</sub> c)</dt><dd>Dimensionless perturbation potential. Divide the velocity potential perturbation φ by the product of freestream speed and chord length.</dd></div>
      <div><dt>ψ(0) = 0</dt><dd>The leading edge is the zero reference for the potential on both surfaces.</dd></div>
    </dl>`;
    content.push(detail('potential','Surface potential · linearized',
      key+table('Linearized surface potential',['Region','Chord interval, ξ','Potential, ψ(ξ)'],rows)));
  }
  if(hasSE&&r.trailingEdge?.status==='ok'){
    const t=r.trailingEdge;
    const states=[['TE-U−',t.upper.before,'Incoming upper stream'],['TE-L−',t.lower.before,'Incoming lower stream'],
      ['TE-U+',t.upper.after,t.upper.kind],['TE-L+',t.lower.after,t.lower.kind]];
    const rows=states.map(([key,z,wave])=>[airfoilRegionLabel(r,key),
      ...[z.M,z.p/1000,z.T,z.rho,z.u,z.theta*180/Math.PI,z.p0/1000,z.T0].map(number),wave]);
    const headers=['Region','M','p (kPa)','T (K)','ρ (kg/m³)','u (m/s)','Flow angle (°)','p₀ (kPa)','T₀ (K)','Wave'];
    content.push(detail('trailing','Trailing-edge matching',
      `<p class="airfoil-empty">${t.interfaceKind} · φ = ${number(t.slipAngle)}° · p = ${number(t.pressure/1000)} kPa</p>`+
      table('Trailing-edge flow properties',headers,rows)));
  }
  return content.join('')+'</section>';
}

export function airfoilWaveChanges(r) {
  if(!r.models.includes('nonlinear')||r.nonlinear.status!=='ok')return [];
  const upstream={Upper:'1',Lower:'1'},transitions=new Map();
  for(const w of r.nonlinear.waves){
    transitions.set(w.id,[upstream[w.side],w.id]);
    upstream[w.side]=w.id;
  }
  for(const w of r.trailingEdge?.waves??[])transitions.set(w.id,[upstream[w.side],w.id+'+']);
  const properties=[
    ['Mach number',z=>z.M],['Static pressure (kPa)',z=>z.p/1000],
    ['Static temperature (K)',z=>z.T],['Density (kg/m³)',z=>z.rho],
    ['Speed (m/s)',z=>z.u],['Flow angle (°)',z=>z.theta*180/Math.PI],
    ['Stagnation pressure (kPa)',z=>z.p0/1000],['Stagnation temperature (K)',z=>z.T0]
  ];
  return [...r.nonlinear.waves,...(r.trailingEdge?.waves??[])]
    .filter(w=>w.kind!=='No wave')
    .map(w=>{
      const [from,to]=transitions.get(w.id).map(key=>airfoilRegionLabel(r,key));
      const rows=properties.map(([property,read])=>{
        const before=read(w.before),after=read(w.after),delta=after-before;
        const change=Math.abs(delta)<=8*Number.EPSILON*Math.max(1,Math.abs(before),Math.abs(after))?0:delta;
        return {property,before,after,change};
      });
      const beta=Number.isFinite(w.beta)?w.beta*180/Math.PI:null;
      return {key:w.id,from,to,kind:w.kind,beta,rows};
    });
}

export function airfoilWaveDetails(waves,fmt) {
  return waves.map(({key,from,to,kind,beta,rows})=>{
    const name=`${from} → ${to} · ${kind}`;
    const note=beta===null?'':`<p class="control-hint">Shock angle β = ${fmt(beta,6)}°</p>`;
    return detail('wave-'+key,name,note+table(name,['Property','Before','After','Δ'],
      rows.map(({property,before,after,change})=>[property,fmt(before,5),fmt(after,5),fmt(change,4)])));
  }).join('');
}
