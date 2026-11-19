import {gasPresets} from './gas-properties.js';

const air = gasPresets.Air;
const seaLevelPressure = 101325;
const seaLevelDensity = 1.225;
const seaLevelSoundSpeed = Math.sqrt(air.gamma * seaLevelPressure / seaLevelDensity);
const airStateInputs = {
  fluid: 'Air', ...air,
  inletPressureType: 'Static pressure', temperatureInput: 'Static temperature'
};

export const foundationExampleEntries = [
  {
    value: '1-1', label: 'Example 1–1 · Wing pressure',
    note: 'Chapter 1 applies constant-density Bernoulli flow to air accelerating from 44.7 to 67 m/s. Its reference density is 1.225 kg/m³ and upstream static pressure is 101.325 kPa. Use this approximation when both local Mach numbers stay at or below 0.3.',
    inputs: {
      ...airStateInputs, bookExample: '1-1', M: 44.7 / seaLevelSoundSpeed,
      p1: seaLevelPressure / 1000, T1: seaLevelPressure / (seaLevelDensity * air.R), wingSpeed: 67
    }
  },
  {
    value: '2-1', label: 'Example 2–1 · Euler state and flux',
    note: 'Chapter 2 asks for the conserved variables, inviscid fluxes per unit area and three characteristic speeds of a one-dimensional Euler state. The book gives M = 2, p = 100 kPa, ρ = 1 kg/m³ and γ = 1.4.',
    inputs: {...airStateInputs, bookExample: '2-1', M: 2, p1: 100, T1: 100000 / air.R}
  }
];

export function foundationExerciseNotice(inputs, result) {
  if (inputs.bookExample !== '1-1') return '';
  if (!Number.isFinite(inputs.wingSpeed) || inputs.wingSpeed < 0) {
    return 'Enter a finite, nonnegative speed at the wing to calculate the Bernoulli pressure drop.';
  }
  if (Math.max(Math.abs(result.u), inputs.wingSpeed) > 0.3 * result.a) {
    return 'The constant-density wing estimate requires upstream and wing speeds at or below Mach 0.3 using the upstream sound speed.';
  }
  return '';
}

const row = (label, value, unit) => ({label, value, unit});

export function foundationExerciseRows(inputs, result) {
  const {p, rho, u, a} = result;
  if (inputs.bookExample === '1-1') {
    if (foundationExerciseNotice(inputs, result)) return [];
    const pressureDrop = 0.5 * rho * (inputs.wingSpeed ** 2 - u ** 2);
    return [
      row('Wing static pressure', (p - pressureDrop) / 1000, 'kPa'),
      row('Pressure drop (upstream − wing)', pressureDrop, 'Pa'),
      row('Pressure drop / upstream pressure', 100 * pressureDrop / p, '%')
    ];
  }
  if (inputs.bookExample !== '2-1') return [];
  const momentum = rho * u;
  const energy = p / ((inputs.gamma ?? air.gamma) - 1) + 0.5 * momentum * u;
  return [
    row('Conserved density ρ', rho, 'kg/m³'),
    row('Conserved momentum ρu', momentum, 'kg/(m²·s)'),
    row('Conserved total energy ρE', energy, 'J/m³'),
    row('Mass flux ρu', momentum, 'kg/(m²·s)'),
    row('Momentum flux ρu² + p', momentum * u + p, 'Pa'),
    row('Energy flux u(ρE + p)', u * (energy + p), 'W/m²'),
    row('Characteristic speed u − a', u - a, 'm/s'),
    row('Characteristic speed u', u, 'm/s'),
    row('Characteristic speed u + a', u + a, 'm/s')
  ];
}
