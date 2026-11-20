import {ductProfile} from './duct-contours.js';
import {rayleigh} from './physics.js';

export const rayleighBookPlotKey = 'rayleigh-axial-book-pressure';
export const rayleighBookInputs = Object.freeze({
  ductProblem: 'Single duct',
  rayleighInput: 'Heat transfer + Inlet Mach',
  velocityInput: 'Mach number',
  temperatureInput: 'Static temperature',
  inletPressureType: 'Static pressure',
  fluid: 'Air', gamma: 1.4, R: 287,
  M1: 3, T1: 300, p1: 101, q: 300 // K, kPa and kJ/kg in the input form.
});

function pressurePoints(profile) {
  return profile.map(({x, state}) => [x, state.p / 1000]);
}

// Rayleigh momentum gives p(1 + γ M²) = constant. The largest reachable
// pressure is at M = 1 on the supersonic branch, or M → 0 on the subsonic branch.
function branchPressureCeiling(inletMach, inletKPa, gamma) {
  const momentumFlux = inletKPa * (1 + gamma * inletMach ** 2);
  return inletMach > 1 ? momentumFlux / (1 + gamma) : momentumFlux;
}

let bookPoints;
export function rayleighBookPressurePlot(current, gamma) {
  const book = rayleighBookInputs;
  if (!bookPoints) {
    const reference = rayleigh({...book, p1: book.p1 * 1000, q: book.q * 1000});
    reference.heatAdded = book.q; // ductProfile integrates the heat input in kJ/kg.
    bookPoints = pressurePoints(ductProfile('rayleigh', reference, book));
  }

  const live = current.s2 && current.longitudinal ? pressurePoints(current.longitudinal) : [];
  const series = [];
  if (live.length) {
    const heat = Number(current.heatAdded.toPrecision(6));
    series.push({name: `Current · q = ${heat > 0 ? '+' : ''}${heat} kJ/kg`,
      color: '#075c67', width: 3, points: live});
  }
  series.push({name: 'Supersonic heating example · q = +300 kJ/kg', color: '#99451c',
    width: 2.3, dash: '8 5', points: bookPoints});

  const bookCeiling = branchPressureCeiling(book.M1, book.p1, book.gamma);
  const liveCeiling = branchPressureCeiling(current.s1.M, current.s1.p / 1000, gamma);
  const peak = Math.max(bookCeiling, liveCeiling);
  const tick = 10 ** Math.floor(Math.log10(peak));
  const title = 'Duct pressure · supersonic heating comparison';
  const note = 'The dashed curve uses the supersonic heating example. Both profiles assume uniform heat transfer per unit length along the duct.';
  return {
    key: rayleighBookPlotKey, label: title,
    chart: {title, xlabel: 'Relative position x/L', ylabel: 'Static pressure p (kPa)',
      yRange: [0, Math.ceil(peak / tick) * tick], series},
    note: live.length ? note : `${note} Only the example curve is available. ${current.message}`
  };
}
