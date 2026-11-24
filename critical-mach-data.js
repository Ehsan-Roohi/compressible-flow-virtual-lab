const aspireRoot = 'https://raw.githubusercontent.com/hwlee924/Large-Airfoil-Model/5353a862ec8c453788efef4e8aa8040148efbe6c/ASPIRE/Airfoils';
const figshareFile = 'https://api.figshare.com/v2/file/download/';
const pinkertonReport = 'https://ntrs.nasa.gov/citations/19930091689';
const pinkertonPdf = 'https://ntrs.nasa.gov/api/citations/19930091689/downloads/19930091689.pdf';

// Cp and x/c are the minimum measured tap and its position in Table I. Use the effective
// midspan angle from Table II for lookup and keep the geometric angle for the result credit.
// Estimate Mach from the test Re (= effective Re / 2.64), tank pressure and room-temperature air.
function pinkertonTable(table, page, mach, reynolds, minima) {
 return {label: `NACA TR-613 · Pinkerton, Table I${table}`, url: pinkertonReport,
  dataUrl: `${pinkertonPdf}#page=${page}`, mach, reynolds, approximateMach: true,
  effectiveReynolds: true, minima};
}

const sources = {
 '0011': [{
  format: 'aspire', machTag: '0.14', reynolds: 2.2e6, reynoldsTag: '2.2e6', angles: ['0', '5', '10'],
  label: 'Myose, Heron & Papadakis · clean airfoil (ASPIRE)',
  url: 'https://doi.org/10.2514/6.1996-59',
 }],
 '0012': [{
  // The upper-surface tap data represent both sides by symmetry at 0°.
  format: 'gregory', angles: [0], mach: .16, reynolds: 2.88e6,
  label: 'Turbulence Modeling Resource · Gregory & O’Reilly (digitized)',
  url: 'https://tmbwg.github.io/turbmodels/naca0012_val.html',
  dataUrl: 'https://tmbwg.github.io/turbmodels/NACA0012_validation/CP_Gregory_expdata.dat',
 }, {
  label: 'Hadjipantelis, Massoudi & Azarpeyvand · University of Bristol / NWTF',
  url: 'https://www.nwtf.ac.uk/dataset/aerodynamics-and-aeroacoustics-of-stationary-and-pitching-naca-0012-and-naca-16-506-aerofoils/',
  // Stationary mean pressures on both surfaces. M∞ is estimated from 20 m/s.
  // The 1–3° cases have an isolated minimum at the same tap, x/c = 0.15.
  mach: .058, reynolds: 4.2e5, approximateMach: true,
  minima: {
   4: {x: .02333, cp: -1.11383, dataUrl: figshareFile + '71156013'},
   5: {x: .01, cp: -1.43708, dataUrl: figshareFile + '71156016'},
   6: {x: .01, cp: -1.80672, dataUrl: figshareFile + '71156019'},
   7: {x: .01, cp: -2.26092, dataUrl: figshareFile + '71156022'},
   8: {x: .00667, cp: -2.66417, dataUrl: figshareFile + '71156025'},
   9: {x: .00667, cp: -3.11831, dataUrl: figshareFile + '71156028'},
   10: {x: .00333, cp: -3.55866, dataUrl: figshareFile + '71155953'},
  },
 }],
 '0015': [{
  // NASA TP-3151, Fig. 18(a), endplate installed for the 2D configuration.
  format: 'aspire', machTag: '0.13', reynolds: 1.5e6, reynoldsTag: '1.5e6', angles: ['0', '6', '12'],
  label: 'NASA TP-3151 · McAlister & Takahashi, 2D (ASPIRE)',
  url: 'https://ntrs.nasa.gov/citations/19920001763',
 }],
 '0018': [{
  label: 'Gerakopulos · University of Waterloo, Fig. 3.5(b) (digitized)',
  url: 'https://uwspace.uwaterloo.ca/items/c2fe070d-59fc-4f8f-9461-f428aab01c24',
  dataUrl: 'https://uwspace.uwaterloo.ca/bitstreams/834a9e7c-61e5-41c2-8633-343c5caca7fc/download#page=93',
  // Upper-surface marker centers in Fig. 3.5(b), Re = 100,000, before the reported suction-peak collapse.
  // Estimate Mach from Re, a 0.2 m chord and room-temperature air properties.
  mach: .022, reynolds: 1e5, approximateMach: true, digitized: true, surfaceCoverage: 'upper',
  minima: {
   0: {x: .129, cp: -.67, side: 'both'},
   2: {x: .089, cp: -.90},
   4: {x: .045, cp: -1.34},
   6: {x: .035, cp: -1.86},
   8: {x: .019, cp: -2.29},
   10: {x: .020, cp: -2.69},
  },
 }],
 '23012': [{
  // NACA TR-614, Fig. 3, plain main airfoil with the flap removed.
  format: 'aspire', machTag: '0.12', reynolds: 1.46e6, reynoldsTag: '1.46e6',
  angles: ['m6.320', 'm0.270', '2.70', '5.740', '8.830', '12.050'],
  label: 'NACA TR-614 · Wenzinger, plain airfoil (ASPIRE)',
  url: 'https://ntrs.nasa.gov/citations/19930091690',
 }],
 '2412': [{
  label: 'NASA CR-197497 · Seetharam, Rodgers & Wentz (digitized)',
  url: 'https://ntrs.nasa.gov/citations/19950002355',
  dataUrl: 'https://ntrs.nasa.gov/api/citations/19950002355/downloads/19950002355.pdf#page=27',
  // Experimental suction peaks from Fig. 7(a) and 7(b), with tripped transition.
  mach: .13, reynolds: 2.2e6, digitized: true,
  minima: {
   '-3.9': {x: .02, cp: -1.72, side: 'lower'},
   .2: {x: .15, cp: -.52},
   4.3: {x: .01, cp: -1.16},
   8.3: {x: .006, cp: -3.12},
   12.4: {x: .008, cp: -6.07, dataUrl: 'https://ntrs.nasa.gov/api/citations/19950002355/downloads/19950002355.pdf#page=28'},
  },
 }],
 '2415': [{
  format: 'aspire', machTag: '0.04', reynolds: 2e5, reynoldsTag: '2.0e5', angles: ['0', '4', '8', '12'],
  label: 'Genç et al. · low-Reynolds-number wind tunnel (ASPIRE)',
  url: 'https://doi.org/10.1016/j.expthermflusci.2012.01.029',
 }],
 '4412': [{
  // The digitized 12° file duplicates 8° in this source.
  format: 'pinkerton', angles: [0, 2, 4, 8], mach: .059, reynolds: 1.8e6, effectiveReynolds: true,
  // TR-613 Table IIe: geometric tunnel angles mapped to effective midspan angles.
  effectiveAngles: {0: -.6, 2: 1.2, 4: 2.9, 8: 6.4},
  label: 'NACA TR-613 · Pinkerton (digitized)',
  url: pinkertonReport,
  dataUrl: 'https://ehsan-roohi.github.io/Aerospace-Structures/wing-panel-stress-analyzer/ml-airfoil/experiment-reference.json',
 }, {
  format: 'aspire', report: 'NACA TR-563', machTag: '0.05', reynolds: 3.1e6, reynoldsTag: '3.1e6',
  angles: ['m8.0', 'm6.0', 'm4.0', 'm2.0', '0.0', '2.0', '4.0'],
  // The ASPIRE files use the geometric angles from TR-563 Table I. Table II gives the effective angles.
  effectiveAngles: {'m8.0': -7.4, 'm6.0': -5.7, 'm4.0': -4, 'm2.0': -2.2, '0.0': -.5, '2.0': 1.2, '4.0': 2.9},
  label: 'NACA TR-563 · Pinkerton (ASPIRE)',
  url: 'https://ntrs.nasa.gov/citations/19930091638',
 }, pinkertonTable('e', 15, .059, 1.8e6, {
  '-11': {x: .0036, cp: -5.360, side: 'lower', tunnelAlpha: -12},
  '-7.4': {x: .0036, cp: -4.018, side: 'lower', tunnelAlpha: -8},
  '-5.7': {x: .0092, cp: -2.606, side: 'lower', tunnelAlpha: -6},
  '-4': {x: .0092, cp: -1.783, side: 'lower', tunnelAlpha: -4},
  '-2.3': {x: .0166, cp: -1.024, side: 'lower', tunnelAlpha: -2},
  10: {x: .0094, cp: -3.867, tunnelAlpha: 12},
  13.8: {x: .0044, cp: -5.403, tunnelAlpha: 16},
 }), pinkertonTable('f', 16, .056, 3.4e6, {
  '-10.8': {x: .0036, cp: -7.407, side: 'lower', tunnelAlpha: -12},
 }), pinkertonTable('g', 17, .055, 6.3e6, {
  '-10.9': {x: .0036, cp: -7.400, side: 'lower', tunnelAlpha: -12},
  9.9: {x: .0044, cp: -3.762, tunnelAlpha: 12},
 }), pinkertonTable('c', 13, .059, 4.5e5, {
  '-7.5': {x: .0036, cp: -2.239, side: 'lower', tunnelAlpha: -8},
 }), pinkertonTable('b', 12, .063, 2.4e5, {
  '-7.3': {x: .0036, cp: -1.797, side: 'lower', tunnelAlpha: -8},
  '-5.6': {x: .0036, cp: -2.199, side: 'lower', tunnelAlpha: -6},
  '-3.9': {x: .0092, cp: -1.621, side: 'lower', tunnelAlpha: -4},
 }), pinkertonTable('a', 11, .052, 1e5, {
  '-7.2': {x: .0036, cp: -1.787, side: 'lower', tunnelAlpha: -8},
  '-5.4': {x: .0036, cp: -2.186, side: 'lower', tunnelAlpha: -6},
  '-3.7': {x: .0092, cp: -1.822, side: 'lower', tunnelAlpha: -4},
  '-2': {x: .0166, cp: -1.125, side: 'lower', tunnelAlpha: -2},
  6.3: {x: .017, cp: -1.972, tunnelAlpha: 8},
 })],
 '4415': [{
  label: 'NREL/TP-442-7815 · DOE/NREL, Ohio State 3×5 tunnel (NLR archive)',
  url: 'https://www.nlr.gov/wind/nwtc/airfoils-osu-data',
  dataUrl: 'https://www.nlr.gov/docs/libraries/wind-docs/zip/n4415.zip?sfvrsn=96f27bf7_1',
  // Hoffmann, Reuss Ramsay & Gregorek. Clean, steady N4415c125.txt runs 8–16.
  // Match the corrected AOA and take the minimum across the reported taps of both surfaces.
  // Calculate M∞ from the corrected velocity with a reference sound speed of 343 m/s.
  approximateMach: true,
  minima: {
   '-8.1': {x: .014, cp: -3.691, side: 'lower', mach: .107, reynolds: 1.26e6},
   '-6': {x: .014, cp: -2.613, side: 'lower', mach: .107, reynolds: 1.27e6},
   '-4': {x: .014, cp: -1.665, side: 'lower', mach: .106, reynolds: 1.25e6},
   '-2.1': {x: .014, cp: -.853, side: 'lower', mach: .105, reynolds: 1.25e6},
   0: {x: .225, cp: -.867, mach: .106, reynolds: 1.26e6},
   2.1: {x: .198, cp: -1.094, mach: .106, reynolds: 1.26e6},
   4: {x: .124, cp: -1.358, mach: .106, reynolds: 1.26e6},
   6.2: {x: .026, cp: -1.704, mach: .106, reynolds: 1.26e6},
   8.1: {x: .012, cp: -2.285, mach: .106, reynolds: 1.26e6},
  },
 }],
};

export function pressureAirfoilCode(code) {
 return String(code ?? '').trim().replace(/^NACA\s*/i, '');
}

const angleValue = angle => Number(String(angle).replace(/^m/, '-'));
const comparisonAngle = (angle, effectiveAngles) => effectiveAngles?.[angle] ?? angleValue(angle);
const sourceAngles = ({angles, minima, effectiveAngles}) => (angles ?? Object.keys(minima))
 .map(angle => comparisonAngle(angle, effectiveAngles));

export function publishedPressureAngles(code) {
 return Object.hasOwn(sources, code) ? [...new Set(sources[code].flatMap(sourceAngles))].sort((a, b) => a - b) : [];
}

export function publishedPressureSources(code, alpha) {
 if (!Object.hasOwn(sources, code)) return [];
 return sources[code].flatMap(({angles, effectiveAngles, minima, ...source}) => {
  if (minima) {
   if (!Object.hasOwn(minima, alpha)) return [];
   const {x, cp, side = 'upper', ...conditions} = minima[alpha];
   return [{...source, ...conditions, minimum: {x, cp, side}}];
  }
  const angle = angles.find(candidate => comparisonAngle(candidate, effectiveAngles) === alpha);
  if (angle === undefined) return [];
  if (effectiveAngles) source.tunnelAlpha = angleValue(angle);
  if (source.format !== 'aspire') return [source];

  const section = `NACA ${code}`;
  const reportSuffix = source.report ? `_${source.report}` : '';
  const file = `${section}_A${angle}_M${source.machTag}_Re${source.reynoldsTag}_A${reportSuffix}.csv`;
  const path = [section, ...(source.report ? [source.report] : []), file];
  return [{...source, dataUrl: `${aspireRoot}/${path.map(encodeURIComponent).join('/')}`}];
 });
}
