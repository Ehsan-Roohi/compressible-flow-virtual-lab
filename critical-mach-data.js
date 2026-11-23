const aspireRoot = 'https://raw.githubusercontent.com/hwlee924/Large-Airfoil-Model/5353a862ec8c453788efef4e8aa8040148efbe6c/ASPIRE/Airfoils';

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
 }],
 '0015': [{
  // NASA TP-3151, Fig. 18(a), endplate installed for the 2D configuration.
  format: 'aspire', machTag: '0.13', reynolds: 1.5e6, reynoldsTag: '1.5e6', angles: ['0', '6', '12'],
  label: 'NASA TP-3151 · McAlister & Takahashi, 2D (ASPIRE)',
  url: 'https://ntrs.nasa.gov/citations/19920001763',
 }],
 '23012': [{
  // NACA TR-614, Fig. 3, plain main airfoil with the flap removed.
  format: 'aspire', machTag: '0.12', reynolds: 1.46e6, reynoldsTag: '1.46e6',
  angles: ['m6.320', 'm0.270', '2.70', '5.740', '8.830', '12.050'],
  label: 'NACA TR-614 · Wenzinger, plain airfoil (ASPIRE)',
  url: 'https://ntrs.nasa.gov/citations/19930091690',
 }],
 '2415': [{
  format: 'aspire', machTag: '0.04', reynolds: 2e5, reynoldsTag: '2.0e5', angles: ['0', '4', '8', '12'],
  label: 'Genç et al. · low-Reynolds-number wind tunnel (ASPIRE)',
  url: 'https://doi.org/10.1016/j.expthermflusci.2012.01.029',
 }],
 '4412': [{
  // The digitized 12° file duplicates 8° in this source.
  format: 'pinkerton', angles: [0, 2, 4, 8], mach: .059, reynolds: 1.8e6,
  label: 'NACA TR-613 · Pinkerton (digitized)',
  url: 'https://ntrs.nasa.gov/citations/19930091689',
  dataUrl: 'https://ehsan-roohi.github.io/Aerospace-Structures/wing-panel-stress-analyzer/ml-airfoil/experiment-reference.json',
 }, {
  format: 'aspire', report: 'NACA TR-563', machTag: '0.05', reynolds: 3.1e6, reynoldsTag: '3.1e6',
  angles: ['m8.0', 'm6.0', 'm4.0', 'm2.0', '0.0', '2.0', '4.0'],
  label: 'NACA TR-563 · Pinkerton (ASPIRE)',
  url: 'https://ntrs.nasa.gov/citations/19930091638',
 }],
};

export function pressureAirfoilCode(code) {
 return String(code ?? '').trim().replace(/^NACA\s*/i, '');
}

const angleValue = angle => Number(String(angle).replace(/^m/, '-'));

export function publishedPressureAngles(code) {
 return [...new Set((Object.hasOwn(sources, code) ? sources[code] : [])
  .flatMap(source => source.angles.map(angleValue)))].sort((a, b) => a - b);
}

export function publishedPressureSources(code, alpha) {
 if (!Object.hasOwn(sources, code)) return [];
 return sources[code].flatMap(({angles, ...source}) => {
  const angle = angles.find(candidate => angleValue(candidate) === alpha);
  if (angle === undefined) return [];
  if (source.format !== 'aspire') return [source];

  const section = `NACA ${code}`;
  const reportSuffix = source.report ? `_${source.report}` : '';
  const file = `${section}_A${angle}_M${source.machTag}_Re${source.reynoldsTag}_A${reportSuffix}.csv`;
  const path = [section, ...(source.report ? [source.report] : []), file];
  return [{...source, dataUrl: `${aspireRoot}/${path.map(encodeURIComponent).join('/')}`}];
 });
}
