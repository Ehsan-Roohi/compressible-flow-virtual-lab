import {normalShock, state, conservation} from './physics.js';
import {gas, positive} from './numerics.js';

export const valveExperiment = 'Sudden valve closure';
export const valveInfo = {
 description: 'Close a valve suddenly and calculate the shock that travels upstream and stops the gas behind it.',
 model: 'Moving normal shock · ideal gas with constant heat capacities · stationary gas behind the shock',
 limitations: 'The solution covers the upstream duct before the shock reaches another boundary. The duct and valve in the schematic are illustrative.'
};

export function solveValveClosure(x) {
 const {gamma, R} = x;
 gas(gamma, R);
 for (const [value, label] of [[x.valveInletSpeed, 'Initial gas speed'], [x.p1, 'Initial gas pressure'], [x.T1, 'Initial gas temperature']]) positive(value, label);
 const a1 = Math.sqrt(gamma * R * x.T1);
 const upstream = state(x.valveInletSpeed / a1, x.T1, x.p1 * 1000, gamma, R);
 // In the shock frame both states flow toward the valve. Their velocity difference is the initial gas speed.
 const q = (gamma + 1) * upstream.u / (4 * a1);
 const mach = q + Math.hypot(1, q);
 const ratios = normalShock(mach, gamma);
 const downstream = state(0, upstream.T * ratios.T, upstream.p * ratios.p, gamma, R);
 const upstreamFrame = state(mach, upstream.T, upstream.p, gamma, R);
 const downstreamFrame = state(ratios.M2, downstream.T, downstream.p, gamma, R);
 const speed = downstreamFrame.u;
 const checks = {...conservation(upstreamFrame, downstreamFrame, gamma, R),
  valveVelocity: Math.abs(upstreamFrame.u - speed - upstream.u) / upstreamFrame.u};
 const chart = {
  title: 'Shock trajectory · valve at x = 0', xlabel: 'Position x (m)', ylabel: 'Time t (s)',
  series: [
   {name: 'Upstream-moving shock', color: '#275eab', points: [[0, 0], [-speed, 1]]},
   {name: 'Closed valve', color: '#b36536', points: [[0, 0], [0, 1]]}
  ]
 };
 const referenceTable = {title: 'Gas states · laboratory frame', columns: ['1 · Ahead of shock', '2 · Behind shock'],
  rows: [
   ['Pressure (kPa)', s => s.p / 1000], ['Temperature (K)', s => s.T],
   ['Density (kg/m³)', s => s.rho], ['Gas velocity (m/s)', s => s.u], ['Gas Mach number', s => s.M]
  ].map(([label, value]) => ({label, values: [upstream, downstream].map(value)})),
  note: 'Positive x points toward the valve. The gas behind the shock is stationary in the laboratory frame.'
 };
 return {status: 'ok', valveClosure: true, upstream, downstream, speed, mach, ratios, checks, chart, referenceTable,
  plots: [{key: 'valve-trajectory', label: chart.title, chart, note: 'The valve closes at t = 0. The plot shows the first second of the ideal upstream trajectory.'}]};
}

export function valveClosureDrawing() {
 return {svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 260" role="img" aria-label="A shock moving upstream from a closed valve">
  <text x="320" y="30" text-anchor="middle" font-size="18" fill="#17383b">Sudden valve closure</text>
  <rect x="44" y="84" width="279" height="88" fill="#d5e7f0"/>
  <rect x="323" y="84" width="265" height="88" fill="#a8d3c5"/>
  <path d="M44 84H588V172H44 M323 84V172" fill="none" stroke="#17383b" stroke-width="3"/>
  <path d="M588 77V179" stroke="#b36536" stroke-width="8"/>
  <g fill="#17383b" font-size="15" text-anchor="middle">
   <text x="184" y="125">1 · Incoming gas →</text><text x="455" y="125">2 · Gas at rest</text>
   <text x="323" y="206">← Shock moves upstream</text><text x="563" y="233">Closed valve</text>
  </g>
 </svg>`, label: 'Upstream-moving normal shock', meta: 'Schematic'};
}
