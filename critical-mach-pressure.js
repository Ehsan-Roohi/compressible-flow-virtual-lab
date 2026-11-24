import {requireValue} from './numerics.js';
import {nacaPanelContour, normalizeNacaSection} from './wing-naca-geometry.js';
import {solveAirfoilPanelCoordinates} from './wing-airfoil-panel-2d.js';
import {pressureAirfoilCode, publishedPressureSources} from './critical-mach-data.js?v=20261124-expanded-airfoil-bank';

export const automaticPressure = 'NACA airfoil · automatic';
export const manualPressure = 'Enter Cp manually';

const panelSource = {
 label: 'Wing AeroStruct · 2D vortex panel method',
 url: 'https://ehsan-roohi.github.io/Aerospace-Structures/wing-panel-stress-analyzer/#wing',
};
function pressureSamples(rows, side) {
 if (!Array.isArray(rows)) return [];
 return rows.filter(pair => Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite) &&
  pair[0] >= 0 && pair[0] <= 1.005).map(([x, cp]) => ({x, cp, side}));
}

function readAspireDistribution(text) {
 // ASPIRE rows start at the upper trailing edge, pass the nose and return along the lower surface.
 const [header, ...lines] = text.trim().split(/\r?\n/);
 const [label, machField] = header.split(',');
 const mach = Number.parseFloat(machField);
 if (label !== '' || !Number.isFinite(mach) || mach < 0 || mach > .2) return null;
 const rows = lines.map(line => line.split(',').map(value => value.trim() ? Number(value) : NaN));
 const leading = rows.reduce((i, point, j) => point[0] < rows[i][0] ? j : i, 0);
 const upper = pressureSamples(rows.slice(0, leading + 1), 'upper');
 const lower = pressureSamples(rows.slice(leading), 'lower');
 if (upper.length < 10 || lower.length < 10 || rows[leading][0] > .025 ||
     upper[0].x < .69 || lower.at(-1).x < .69 ||
     upper.some((point, i) => i > 0 && point.x > upper[i - 1].x) ||
     lower.some((point, i) => i > 0 && point.x < lower[i - 1].x)) return null;
 return {samples: [...upper, ...lower], mach};
}

function measuredDistribution(text, alpha, source) {
 if (source.format === 'aspire') return readAspireDistribution(text);
 if (source.format === 'pinkerton') {
  const data = JSON.parse(text);
  if (data.source?.type !== 'experiment' || data.mach !== source.mach || data.reynolds !== source.reynolds) return null;
  const match = data.cases?.find(row => row.alphaDeg === (source.tunnelAlpha ?? alpha));
  const upper = pressureSamples(match?.branch1, 'upper'), lower = pressureSamples(match?.branch2, 'lower');
  return upper.length >= 10 && lower.length >= 10 ? {samples: [...upper, ...lower], mach: source.mach} : null;
 }
 const section = text.split(/^zone\s*,\s*t=/m).find(part => part.startsWith('"alpha=0"'));
 const rows = section?.trim().split(/\r?\n/).slice(1).map(line => line.trim().split(/\s+/).map(Number));
 return {samples: pressureSamples(rows, 'both'), mach: source.mach};
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
 const code = pressureAirfoilCode(inputs.criticalNacaCode), alpha = inputs.criticalAlpha;
 for (const {minimum, ...source} of publishedPressureSources(code, alpha)) {
  try {
   const data = minimum ? null : measuredDistribution(await read(source.dataUrl), alpha, source);
   const min = minimum ?? (data?.samples.length >= 10 ? minimumSample(data.samples) : null);
   if (!min || min.cp >= 0) continue;
   // Remove the small freestream compressibility correction from the measured baseline.
   const mach = data?.mach ?? source.mach;
   const cp = min.cp * Math.sqrt(1 - mach ** 2);
   return {...min, cp, measuredCp: min.cp, kind: 'published', source: {...source, mach}, code, alpha};
  } catch {
   // Continue to the next matching experiment, then use the panel solve if necessary.
  }
 }
 return null;
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
