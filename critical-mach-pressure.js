import {requireValue} from './numerics.js';
import {nacaPanelContour, normalizeNacaSection} from './wing-naca-geometry.js';
import {solveAirfoilPanelCoordinates} from './wing-airfoil-panel-2d.js';

export const automaticPressure = 'NACA airfoil · automatic';
export const manualPressure = 'Enter Cp manually';

const panelSource = {
 label: 'Wing AeroStruct · 2D vortex panel method',
 url: 'https://ehsan-roohi.github.io/Aerospace-Structures/wing-panel-stress-analyzer/#wing',
};
const experiments = {
 '4412': {
  // The digitized 12° file duplicates 8° in the source; do not use it.
  angles: [0, 2, 4, 8], mach: .059, reynolds: 1.8e6,
  label: 'NACA TR-613 · Pinkerton (digitized)',
  url: 'https://ntrs.nasa.gov/citations/19930091689',
  dataUrl: 'https://ehsan-roohi.github.io/Aerospace-Structures/wing-panel-stress-analyzer/ml-airfoil/experiment-reference.json',
 },
 '0012': {
  // Upper-surface tap data represent both sides by symmetry only at 0°.
  angles: [0], mach: .16, reynolds: 2.88e6,
  label: 'Turbulence Modeling Resource · Gregory & O’Reilly (digitized)',
  url: 'https://tmbwg.github.io/turbmodels/naca0012_val.html',
  dataUrl: 'https://tmbwg.github.io/turbmodels/NACA0012_validation/CP_Gregory_expdata.dat',
 },
};

function pressureSamples(rows, side) {
 if (!Array.isArray(rows)) return [];
 return rows.filter(pair => Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite) &&
  pair[0] >= 0 && pair[0] <= 1.005).map(([x, cp]) => ({x, cp, side}));
}

function measuredDistribution(text, code, alpha, source) {
 if (code === '4412') {
  const data = JSON.parse(text);
  if (data.source?.type !== 'experiment' || data.mach !== source.mach || data.reynolds !== source.reynolds) return [];
  const match = data.cases?.find(row => row.alphaDeg === alpha);
  const upper = pressureSamples(match?.branch1, 'upper'), lower = pressureSamples(match?.branch2, 'lower');
  return upper.length >= 10 && lower.length >= 10 ? [...upper, ...lower] : [];
 }
 const section = text.split(/^zone\s*,\s*t=/m).find(part => part.startsWith('"alpha=0"'));
 const rows = section?.trim().split(/\r?\n/).slice(1).map(line => line.trim().split(/\s+/).map(Number));
 return pressureSamples(rows, 'both');
}

const downloaded = new Map();
async function fetchPublishedData(url) {
 if (!downloaded.has(url)) {
  const request = (async () => {
   const response = await fetch(url, {signal: AbortSignal.timeout(3500), credentials: 'omit'});
   if (!response.ok) throw Error('Published pressure data could not be loaded.');
   return response.text();
  })();
  downloaded.set(url, request);
  request.catch(() => downloaded.delete(url));
 }
 return downloaded.get(url);
}

function minimumSample(samples) {
 return samples.reduce((min, row) => !min || row.cp < min.cp ? row : min, null);
}

export async function readPublishedPressure(inputs, read = fetchPublishedData) {
 if (inputs.criticalPressureSource !== automaticPressure) return null;
 const code = String(inputs.criticalNacaCode ?? '').trim().replace(/^NACA\s*/i, '');
 const alpha = inputs.criticalAlpha, source = experiments[code];
 if (!source?.angles?.includes(alpha)) return null;
 try {
  const samples = measuredDistribution(await read(source.dataUrl), code, alpha, source);
  const min = samples.length >= 10 ? minimumSample(samples) : null;
  if (!min || min.cp >= 0) return null;
  // Remove the small freestream compressibility correction from the measured baseline.
  const cp = min.cp * Math.sqrt(1 - source.mach ** 2);
  return {...min, cp, measuredCp: min.cp, kind: 'published', source, code, alpha};
 } catch {
  return null;
 }
}

let lastPanelCase;
export function resolveCriticalPressure(inputs, published) {
 if (inputs.criticalPressureSource !== automaticPressure) return null;
 const profile = normalizeNacaSection(String(inputs.criticalNacaCode ?? ''));
 const code = profile.code, alpha = inputs.criticalAlpha;
 requireValue(Number.isFinite(alpha) && Math.abs(alpha) <= 15, 'Enter an angle of attack between −15° and 15°. The 2D panel model assumes attached flow.');
 if (published?.code === code && published.alpha === alpha) return published;
 if (lastPanelCase?.code === code && lastPanelCase.alpha === alpha) return lastPanelCase;

 const panelsPerSide = 160;
 const solution = solveAirfoilPanelCoordinates(nacaPanelContour(profile, panelsPerSide), alpha);
 const {x, cp, side} = minimumSample(solution.panels);
 lastPanelCase = {x, cp, side, kind: 'panel', source: panelSource, code, alpha, panelsPerSide};
 return lastPanelCase;
}
