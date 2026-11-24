export function temperatureEntropyPlot({reference, gas, segments, stations, note, fitLabels = false}) {
 const coords = state => {
  const delta = (gas.cp * Math.log(state.T / reference.T) - gas.R * Math.log(state.p / reference.p)) / 1000;
  return [Math.abs(delta) < 1e-12 ? 0 : delta, state.T];
 };
 const label = 'Temperature–entropy diagram';
 return {
  key: 'duct-temperature-entropy', label, note,
  chart: {
   title: label, xlabel: 'Entropy change from inlet Δs (kJ/(kg·K))', ylabel: 'Static temperature T (K)',
   zeroBaseline: false, regionMarkers: fitLabels,
   series: segments.map(({states, ...style}) => ({...style, points: states.map(coords)})),
   markers: stations.map(({name, state}) => {
    const [x, y] = coords(state);
    return {name, x, y, ...(x > 0 ? {anchor: 'end'} : {})};
   }),
  },
 };
}

const fannoLine = {name:'Fanno duct', color:'#166672'};
const rayleighLine = {name:'Rayleigh duct', color:'#a64a2a'};
const nozzleLine = {name:'Isentropic nozzle', color:'#2757a0'};

// A normal shock contributes its two computed one-sided states at one axial location.
function segmentedPath(samples, upstream, downstream = upstream) {
 const shock = samples.findIndex((after, i) => {
  if (!i) return false;
  const before = samples[i - 1];
  return Math.abs(after.x - before.x) < 1e-10 && before.state.M > 1 && after.state.M < 1;
 });
 const segment = (style, list) => ({...style, states: list.map(({state}) => state)});
 if (shock < 0) return [segment(upstream, samples)];
 return [
  segment(upstream, samples.slice(0, shock)),
  segment({name:'Normal shock', color:'#505862', dash:'5 4'}, samples.slice(shock - 1, shock + 1)),
  ...(shock + 1 < samples.length ? [
   segment({...downstream, hideLegend: upstream.name === downstream.name}, samples.slice(shock)),
  ] : []),
 ];
}

export function ductTemperatureEntropyPlot({id, result: r, gas}) {
 const process = r.heatedFriction ? {name:'Heat transfer + wall friction', color:'#166672'} : id === 'rayleigh' ? rayleighLine : fannoLine;
 const reference = r.reservoir ?? r.s1;
 if ((!r.s2 && !r.heatedFriction) || r.massFlow === 0) {
  const name = r.s2 ? 'No flow' : 'Inlet';
  const note = r.s2 ? 'The gas is at rest throughout the system.' : 'The specified inputs yield no steady outlet. The inlet state is shown.';
  return temperatureEntropyPlot({reference, gas, note,
   segments:[{...process, name, states:[reference]}], stations:[{name, state:reference}],
  });
 }
 const profile = r.longitudinal ?? [{x:0, state:r.s1}, {x:1, state:r.s2}];
 const upstream = r.stations?.find(station => station.x < 0);
 const segments = r.fullSystem
  ? [...segmentedPath(r.nozzlePoints, nozzleLine), ...segmentedPath(profile, fannoLine)]
  : segmentedPath(profile, process, id === 'rayleigh' ? {...nozzleLine, name:'Isentropic exit nozzle'} : process);
 if (upstream && !r.fullSystem && !r.initialReference) {
  segments.unshift({...nozzleLine, name:'Isentropic entry', states:[upstream.state, r.s1]});
 }
 const stations = r.stations ?? [{name:'Inlet', state:r.s1}, {name:'Outlet', state:r.s2}];
 // At an interface, the after-shock state can also be the duct inlet.
 const labelled = stations.filter(({state}, i) => !stations.slice(0, i).some(previous =>
  Math.abs(previous.state.T / state.T - 1) < 1e-11 && Math.abs(previous.state.p / state.p - 1) < 1e-11));
 const notes = [r.fullSystem ? 'Entropy is referenced to the reservoir.' : 'Entropy is referenced to the duct inlet.'];
 if (segments.some(segment => segment.dash)) notes.push('The dashed line connects the states immediately before and after the shock.');
 if (r.heatedFriction && !r.s2) notes.push('The curve ends at the last computed station.');
 if (r.initialReference) notes.push('The initial upstream reference marks a separate operating state.');
 return temperatureEntropyPlot({reference, gas, segments, stations:labelled, note:notes.join(' '), fitLabels:labelled.length > 2});
}
