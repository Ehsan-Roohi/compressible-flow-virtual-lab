import {nozzle} from './physics.js';

export const nozzleBookPlotKey = 'nozzle-book-pressure';
export const nozzleBookInputs = Object.freeze({
  fluid: 'Air',
  gamma: 1.4,
  R: 287,
  nozzleType: 'Converging–diverging',
  nozzleView: 'Internal flow',
  areaRatio: 3,
  backRatio: 0.5,
  p0: 101.32, // The lab input is in kPa.
  nozzlePressureType: 'Stagnation pressure',
  nozzleTemperatureType: 'Stagnation temperature',
  plotProperty: 'Pressure'
});

const pressurePoints = result => result.points.map(({x, p}) => [x, p]);
let bookProfile;

export function nozzleBookPressurePlot(current) {
  if (!bookProfile) {
    const reference = nozzle({...nozzleBookInputs, p0: nozzleBookInputs.p0 * 1000});
    bookProfile = pressurePoints(reference);
  }
  const title = 'Nozzle pressure · example 8–4 and current case';
  const ratio = Number(current.backRatio.toPrecision(6));
  return {
    key: nozzleBookPlotKey,
    label: title,
    chart: {
      title,
      xlabel: 'Axial position x/L',
      ylabel: 'Static pressure p/p₀₁',
      yRange: [0, 1],
      series: [
        {name: `Current · pᵦ/p₀₁ = ${ratio}`, color: '#075c67', width: 3, points: pressurePoints(current)},
        {name: 'Book example 8–4 · pᵦ/p₀₁ = 0.5', color: '#99451c', width: 2.3, dash: '8 5', points: bookProfile}
      ]
    },
    note: 'The dashed curve uses example 8–4 (air, Aₑ/Aₜ = 3). Both profiles use the lab’s schematic nozzle contour and each case’s inlet stagnation pressure. A vertical jump marks a normal shock.'
  };
}
