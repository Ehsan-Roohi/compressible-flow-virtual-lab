export function nozzleMocDrawing({mesh,wall,exitMach}){
 const W=640, H=300, last=wall.at(-1);
 const scale=Math.min(526/last.x,104/last.y);
 const x0=(W-last.x*scale)/2, cy=150;
 const point=({x,y}, side=1)=>[x0+x*scale,cy-side*y*scale].map(v=>v.toFixed(2)).join(',');
 const outline=side=>wall.map(p=>point(p,side)).join(' ');
 const path=(points,side)=>'M'+points.map(p=>point(p,side)).join('L');
 const stride=Math.ceil(mesh.length/22);
 let minus='',plus='';
 for(const side of [1,-1]){
  let reflected='',incident='';
  // Draw full characteristic lines at a readable density on refined grids.
  for(let i=0;i<mesh.length;i++)if(i%stride===0||i===mesh.length-1)
   reflected+=path(mesh[i],side);
  for(let j=0;j<mesh.length;j++)if(j%stride===0||j===mesh.length-1){
   const ray=[wall[0]];
   for(let i=0;i<=j;i++)ray.push(mesh[i][j-i]);
   incident+=path(ray,side);
  }
  minus+=side===1?incident:reflected;
  plus+=side===1?reflected:incident;
 }
 const x1=x0+last.x*scale, close=x1-x0<178;
 const frame=(x,h)=>`<line x1="${x}" y1="${cy-h*scale}" x2="${x}" y2="${cy+h*scale}" stroke="#607773" stroke-dasharray="4 3"/>`;
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Computed minimum-length nozzle contour and characteristic net">
  <title>Minimum-length nozzle and characteristic net</title>
  <rect width="${W}" height="${H}" fill="#fcfefd"/>
  <polygon points="${outline(1)} ${wall.slice().reverse().map(p=>point(p,-1)).join(' ')}" fill="#e9f2ef"/>
  <path d="${minus}" fill="none" stroke="#38778d" stroke-width=".85"/>
  <path d="${plus}" fill="none" stroke="#977b4e" stroke-width=".85"/>
  ${frame(x0,1)}${frame(x1,last.y)}
  <line x1="${x0-12}" y1="${cy}" x2="${x1+12}" y2="${cy}" stroke="#637a73" stroke-dasharray="5 4"/>
  <g fill="none" stroke="#17383b" stroke-width="2.5" stroke-linejoin="round">
   <polyline points="${outline(1)}"/><polyline points="${outline(-1)}"/>
  </g>
  <g font-size="15" fill="#17383b" text-anchor="middle">
   <text x="${x0-(close?8:0)}" y="${cy-scale-13}" text-anchor="${close?'end':'middle'}">Sonic throat</text>
   <text x="${x1+(close?8:0)}" y="${cy-last.y*scale-13}" text-anchor="${close?'start':'middle'}">Exit · M = ${exitMach}</text>
  </g>
  <g font-size="13" fill="#17383b">
   <path d="M175 277h29" stroke="#38778d"/><text x="212" y="281">C− characteristics</text>
   <path d="M341 277h29" stroke="#977b4e"/><text x="378" y="281">C+ characteristics</text>
  </g>
 </svg>`,label:'Computed nozzle contour and characteristic net',meta:'Planar flow · equal axial and transverse scale'};
}
