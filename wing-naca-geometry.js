/* NACA definitions and cosine panel spacing reused from Wing AeroStruct.
 * https://github.com/Ehsan-Roohi/Aerospace-Structures/tree/526af464eccf53803dc48cc4079b73971591ac93/docs/wing-panel-stress-analyzer/index.html
 * Uses the same analytic camber, thickness and unit-chord sharp trailing edge.
 */
function series(spec) {
  const raw=typeof spec==='string'?spec:spec.code;
  const m=String(raw||'').trim().match(/^(?:NACA\s*)?(\d{4}|\d{5})$/i);
  if(!m)throw new Error('Use a four-digit NACA code, or a supported non-reflex five-digit code (e.g. 23012).');
  const code=m[1],kind=code.length===4?'naca4':'naca5';
  if(typeof spec==='object'&&spec.kind!==kind)throw new Error('Airfoil family and NACA code do not agree.');
  if(+code.slice(-2)===0)throw new Error('Airfoil thickness must be positive.');
  if(kind==='naca4'&&+code[0]&&+code[1]===0)throw new Error('A cambered NACA section needs a nonzero camber position.');
  if(kind==='naca5'&&!/^[1-9][1-5]0\d{2}$/.test(code))throw new Error('Use a non-reflex five-digit NACA code with a 210–250 mean-line family.');
  return Object.freeze({kind,code});
}
function camber(p,x) {
  if(p.kind==='naca4'){
    const m=+p.code[0]/100,pos=+p.code[1]/10;if(m===0)return {yc:0,slope:0};
    if(x<pos)return {yc:m/(pos*pos)*(2*pos*x-x*x),slope:2*m/(pos*pos)*(pos-x)};
    const q=(1-pos)*(1-pos);return {yc:m/q*(1-2*pos+2*pos*x-x*x),slope:2*m/q*(pos-x)};
  }
  const i=+p.code[1]-1,r=[.058,.126,.2025,.29,.391][i],k=[361.4,51.64,15.957,6.643,3.23][i]*(+p.code[0]/2);
  return x<r?{yc:k/6*(x**3-3*r*x*x+r*r*(3-r)*x),slope:k/6*(3*x*x-6*r*x+r*r*(3-r))}:{yc:k*r**3/6*(1-x),slope:-k*r**3/6};
}
function halfThickness(p,x,chord,te) {
  const t=+p.code.slice(-2)/100,natural=5*t*(.2969-.126-.3516+.2843-.1015);
  const yt=5*t*(.2969*Math.sqrt(x)-.126*x-.3516*x*x+.2843*x**3-.1015*x**4);
  return te==null?yt:yt+(te/(2*chord)-natural)*x**4;
}
function contour(profile,panelsPerSide) {
  const xs=Array.from({length:panelsPerSide+1},(_,i)=>.5*(1-Math.cos(Math.PI*i/panelsPerSide)));
  const xu=[],zu=[],xl=[],zl=[];
  for(const x of xs){const {yc,slope}=camber(profile,x),th=Math.atan(slope),yt=halfThickness(profile,x,1,0);xu.push((x-yt*Math.sin(th)));zu.push((yc+yt*Math.cos(th)));xl.push((x+yt*Math.sin(th)));zl.push((yc-yt*Math.cos(th)));}
  const points=[];
  for(let i=panelsPerSide;i>=0;i--)points.push([xl[i],zl[i]]);
  for(let i=1;i<=panelsPerSide;i++)points.push([xu[i],zu[i]]);
  return points;
}

export {series as normalizeNacaSection, contour as nacaPanelContour};
