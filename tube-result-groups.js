// Present the existing solver rows without changing their names or export data.
const waveEvents=/^(Incident shock reaches|Expansion head reaches|Reflected shock meets|First shock reaches|Launch shocks merge|Time from second speed increase|Catch-up |Time after second speed increase|First acoustic arrival)/;
const groups=[
 ['Initial state', /^Initial (gas velocity|pressure ratio|sound speed)|^Required driver pressure/],
 ['Incident shock', /^Incident (shock |pressure ratio|temperature ratio|density ratio)|^Shock (speed|pressure ratio|temperature ratio)/],
 ['Gas behind the incident shock', /^(Mach|Gas velocity|Temperature|Pressure|Gas speed) behind (?!reflected)|^Gas Mach behind|^Static temperature ratio|^(Upstream|Downstream) Mach · shock frame|^Driven post-shock/],
 ['Contact surface', /^Contact (surface speed|velocity|pressure)/],
 ['Reflected shock', /^(Reflected (shock|pressure)|Pressure behind reflected|Temperature behind reflected)/],
 ['Expansion fan', /^Expansion (pressure|temperature|density) ratio|^Expanded driver/],
 ['Moving-shock sonic limit', /^Critical shock Mach/],
 ['First launch shock', /^(First shock launch|Shock 1 )/],
 ['Second launch shock', /^(Second shock launch|Second-shock launch|Shock 2 )/],
 ['Piston motion and wave scales', /^(Second piston speed|Peak piston velocity|Period$|Piston stops|Maximum piston displacement|Linear wavelength)/],
 ['Small-amplitude comparison', /^(Comparison time|Velocity RMS error|Pressure RMS error)/],
 ['Intermediate state', /^Intermediate /],
 ['Acoustic waves', /^(Left|Right) wave speed/],
 ['Final state', /^Final /],
 ['Stagnation enthalpy',/ · (?:h₀|Δh₀)/,true],
 ['Simulation', /^(Initial gas mass|Simulated time|Numerical time steps|Piston work)/,true]
];

export function groupTubeResults(rows){
 const sidebar=new Map(),belowPlot=new Map();
 const eventGroup='Wave arrival and interaction',sampleGroup='Test sample';
 for(const row of rows){
  const label=row.label;
  const plotGroup=/sample/i.test(label)?sampleGroup:waveEvents.test(label)?eventGroup:null;
  const target=plotGroup?belowPlot:sidebar;
  const title=plotGroup??groups.findLast(([,pattern])=>pattern.test(label))?.[0]??'Other results';
  if(!target.has(title))target.set(title,[]);
  target.get(title).push(row);
 }
 return {
  sidebar:[...groups,['Other results']].filter(([title])=>sidebar.has(title))
   .map(([title,,collapsed])=>({title,collapsed,rows:sidebar.get(title)})),
  belowPlot:[eventGroup,sampleGroup].filter(title=>belowPlot.has(title))
   .map(title=>({title,rows:belowPlot.get(title)}))
 };
}
