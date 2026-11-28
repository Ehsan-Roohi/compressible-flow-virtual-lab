export const rayleighBookInputs = Object.freeze({
  ductProblem: 'Single duct',
  rayleighInput: 'Heat transfer + Inlet Mach',
  velocityInput: 'Mach number',
  temperatureInput: 'Static temperature',
  inletPressureType: 'Static pressure',
  fluid: 'Air', gamma: 1.4, R: 287,
  M1: 3, T1: 300, p1: 101, q: 300 // K, kPa and kJ/kg in the input form.
});
