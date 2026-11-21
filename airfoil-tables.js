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

export function airfoilTables(r,fmt) {
  const number=v=>Number.isFinite(v)?fmt(v,6):'—';
  const models=r.models.filter(model=>r[model].status==='ok');
  const hasSE=models.includes('nonlinear'),hasLinear=models.includes('linear');
  const both=hasSE&&hasLinear;
  const methodHeaders=models.map(model=>model==='linear'?'Linearized':'Shock–Expansion');
  if(both)methodHeaders.push('SE − linear');

  function coefficientRow(label,getValue) {
    const values=models.map(model=>getValue(r[model]));
    const row=[label,...values.map(number)];
    if(both)row.push(values.every(Number.isFinite)?number(getValue(r.nonlinear)-getValue(r.linear)):'—');
    return row;
  }

  const content=['<section class="card"><div class="card-head"><h2>Aerodynamic coefficients</h2></div>'];
  const plate=r.geometry.connectedPlate;
  if(plate)content.push(`<p class="airfoil-empty">Panel lengths are used as entered. The coefficient reference length is the horizontal end-to-end extent, ${number(plate.reference)} m.</p>`);
  if(models.length){
    content.push(table('Aerodynamic coefficient comparison',['Quantity',...methodHeaders],[
      coefficientRow('Lift coefficient C<sub>L</sub>',z=>z.CL),
      coefficientRow('Wave-drag coefficient C<sub>D,w</sub>',z=>z.CD),
      coefficientRow('Quarter-chord moment C<sub>M,c/4</sub>',z=>z.CM),
      coefficientRow('Lift-to-drag ratio L/D',z=>Math.abs(z.CD)>1e-12?z.CL/z.CD:null)
    ]));
  }
  if(r.models.includes('nonlinear')&&!hasSE)
    content.push(`<p class="airfoil-empty">Shock–Expansion unavailable. ${r.nonlinear.reason}</p>`);
  if(hasSE&&r.trailingEdge?.status!=='ok')
    content.push(`<p class="airfoil-empty"><strong>Trailing-edge matching</strong> · Not resolved: ${r.trailingEdge?.reason??'No accepted trailing-edge state.'}</p>`);

  if(models.length){
    const cpRows=r.geometry.panels.map(p=>coefficientRow(airfoilRegionLabel(r,p.id),z=>z.panels.find(panel=>panel.id===p.id)?.Cp));
    const cpHeaders=methodHeaders.map(name=>`C<sub>p</sub> · ${name}`);
    let surface=table('Surface pressure coefficients',['Region',...cpHeaders],cpRows);
    if(hasSE){
      const rows=r.nonlinear.panels.map(p=>[airfoilRegionLabel(r,p.id),
        number(p.M),number(p.p/1000),number(p.T),number(p.rho),number(p.u),number(p.p0/1000),number(p.T0),p.wave
      ]);
      surface+=table('Flow properties by surface region',['Region','M','p (kPa)','T (K)','ρ (kg/m³)','u (m/s)','p₀ (kPa)','T₀ (K)','Wave'],rows);
    }
    content.push(detail('surface',hasSE?'Surface pressures and flow properties':'Surface pressure coefficients',surface));
  }
  if(hasLinear){
    const rows=r.linear.potential.map(p=>[airfoilRegionLabel(r,p.id),`${number(p.x0)} – ${number(p.x1)}`,
      `${number(p.derivative)} ξ ${p.intercept<0?'−':'+'} ${number(Math.abs(p.intercept))}`]);
    content.push(detail('potential','Surface potential · linearized',
      '<p class="airfoil-empty">ξ = x/c · ψ = φ/(U∞c) · ψ(0) = 0 on each side</p>'+table('Linearized surface potential',['Region','ξ interval','ψ(ξ)'],rows)));
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

export function diamondRegionStates(r) {
  const surface=r.models.includes('nonlinear')&&r.nonlinear.status==='ok'?r.nonlinear.panels:[];
  const trailing=surface.length&&r.trailingEdge?.status==='ok'?r.trailingEdge:null;
  const definitions=[
    ['inlet','1',r.freestream],
    ...['U1','U2','L1','L2'].map(id=>[id,airfoilRegionLabel(r,id),surface.find(p=>p.id===id)]),
    ['upper-exit',airfoilRegionLabel(r,'TE-U+'),trailing?.upper.after],
    ['lower-exit',airfoilRegionLabel(r,'TE-L+'),trailing?.lower.after]
  ];
  return definitions.map(([key,region,z])=>({key,region,properties:z?{
    'Mach number':z.M,
    'Static pressure (kPa)':z.p/1000,
    'Static temperature (K)':z.T,
    'Density (kg/m³)':z.rho,
    'Speed (m/s)':z.u,
    'Flow angle (°)':z.theta*180/Math.PI,
    'Stagnation pressure (kPa)':z.p0/1000,
    'Stagnation temperature (K)':z.T0
  }:null}));
}

export function diamondRegionDetails(regions,fmt) {
  return regions.map(({key,region,properties})=>
    detail('diamond-'+key,`Region ${region}`,properties
      ?table(`Region ${region} flow conditions`,['Property','Value'],
        Object.entries(properties).map(([label,value])=>[label,fmt(value,6)]))
      :'<p class="control-hint">Shock–Expansion state unavailable.</p>')
  ).join('');
}
