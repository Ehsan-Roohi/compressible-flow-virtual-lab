const foot = 0.3048;
const inch = 0.0254;
const pound = 0.45359237;
const psi = 6894.757293168;
const rankine = 1.8;
const btu = 1055.05585262;
const poundForce = 4.4482216152605;

const usUnits = {
  Pa: ['psia', 1 / psi],
  kPa: ['psia', 1000 / psi],
  MPa: ['psia', 1e6 / psi],
  bar: ['psia', 1e5 / psi],
  K: ['°R', rankine],
  m: ['ft', 1 / foot],
  cm: ['in', .01 / inch],
  mm: ['in', .001 / inch],
  'm²': ['in²', 1 / inch ** 2],
  'cm²': ['in²', 1e-4 / inch ** 2],
  'mm²': ['in²', 1e-6 / inch ** 2],
  'm³': ['ft³', 1 / foot ** 3],
  'm/s': ['ft/s', 1 / foot],
  'm/s²': ['ft/s²', 1 / foot],
  'kg/m³': ['lbm/ft³', foot ** 3 / pound],
  'kg/s': ['lbm/s', 1 / pound],
  'kg/(m²·s)': ['lbm/(ft²·s)', foot ** 2 / pound],
  'kg/(m²s)': ['lbm/(ft²·s)', foot ** 2 / pound],
  'kg/m²·s': ['lbm/(ft²·s)', foot ** 2 / pound],
  'kg/m²/s': ['lbm/(ft²·s)', foot ** 2 / pound],
  'J/kg': ['Btu/lbm', pound / btu],
  'kJ/kg': ['Btu/lbm', 1000 * pound / btu],
  'kJ/(kg·m)': ['Btu/(lbm·ft)', 1000 * pound * foot / btu],
  'J/(kg·K)': ['Btu/(lbm·°R)', pound / (btu * rankine)],
  'kJ/(kg·K)': ['Btu/(lbm·°R)', 1000 * pound / (btu * rankine)],
  N: ['lbf', 1 / poundForce],
  kN: ['lbf', 1000 / poundForce],
  'N/m': ['lbf/ft', foot / poundForce],
  'kN/m': ['lbf/ft', 1000 * foot / poundForce],
  W: ['Btu/s', 1 / btu],
  kW: ['Btu/s', 1000 / btu],
  'm²/s': ['ft²/s', 1 / foot ** 2],
  'Pa·s': ['lbm/(ft·s)', foot / pound],
};

const escapePattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unitPattern = Object.keys(usUnits).sort((a, b) => b.length - a.length).map(escapePattern).join('|');
const numberPattern = '[−+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
const measurement = new RegExp(
  `(?<![\\w.])(${numberPattern})(?:((?:\\s+[–—]\\s+|\\s*–\\s*| to | to red ))(${numberPattern}))?(\\s*)(${unitPattern})(?![\\w²³/])`, 'gu'
);

export function createUnitView(initial = 'SI') {
  let system = initial === 'US' ? 'US' : 'SI';
  const conversion = unit => system === 'US' && Object.hasOwn(usUnits, unit) ? usUnits[unit] : [unit, 1];
  const label = unit => conversion(unit)[0];
  const value = (number, unit) => typeof number === 'number' ? number * conversion(unit)[1] : number;
  const input = (number, unit) => number / conversion(unit)[1];
  const fieldValue = (number, field) => value((field.displayScale ?? 1) * number + (field.displayOffset ?? 0), field.unit);
  const inputValue = (number, field) => (input(number, field.unit) - (field.displayOffset ?? 0)) / (field.displayScale ?? 1);
  const round = (number, digits = 7) => Number(number.toPrecision(digits));
  const text = source => {
    if (system !== 'US' || typeof source !== 'string') return source;
    return source.replace(measurement, (match, first, join, last, gap, unit) => {
      const converted = v => round(value(Number(v.replace('−', '-')), unit));
      return `${converted(first)}${join ? join + converted(last) : ''}${gap || ' '}${label(unit)}`;
    });
  };
  const axisUnit = name => {
    if (typeof name !== 'string') return '';
    if (Object.hasOwn(usUnits, name)) return name;
    return Object.keys(usUnits).find(unit => name.includes(`(${unit})`) || name.endsWith(` ${unit}`)) ?? '';
  };
  const axisLabel = (name, unit = axisUnit(name)) => {
    if (!unit || label(unit) === unit) return name;
    if (name === unit) return label(unit);
    return name.includes(`(${unit})`) ? name.replace(`(${unit})`, `(${label(unit)})`) :
      name.endsWith(` ${unit}`) ? name.slice(0,-unit.length) + label(unit) : name;
  };
  const chart = c => {
    const xUnit = axisUnit(c.xlabel), yUnit = axisUnit(c.ylabel);
    if (system !== 'US' || (!xUnit && !yUnit)) return c;
    const x = n => value(n, xUnit), y = n => value(n, yUnit);
    const point = p => ({...p, x: x(p.x), y: y(p.y), name: text(p.name), label: text(p.label)});
    return {
      ...c,
      xlabel: axisLabel(c.xlabel, xUnit), ylabel: axisLabel(c.ylabel, yUnit),
      series: c.series.map(s => ({...s, name: text(s.name), points: s.points.map(([a,b]) => [x(a),y(b)])})),
      xRange: c.xRange?.map(x), yRange: c.yRange?.map(y),
      markers: c.markers?.map(point),
      xReference: c.xReference && point(c.xReference),
      heatmap: c.heatmap && {...c.heatmap, left: x(c.heatmap.left), right: x(c.heatmap.right), end: y(c.heatmap.end)},
    };
  };
  const plot = option => system === 'US' ? {...option, chart: chart(option.chart), note: text(option.note)} : option;
  const row = entry => {
    if (system !== 'US' || typeof entry !== 'object' || entry === null) return entry;
    const unit = entry.unit || axisUnit(entry.label ?? entry.property);
    const copy = {...entry};
    if (unit) {
      for (const key of ['value','before','after','upstream','downstream','nonlinear','linear','change'])
        if (Object.hasOwn(copy,key)) copy[key] = value(copy[key], unit);
      if (Array.isArray(copy.values)) copy.values = copy.values.map(v => value(v, unit));
      if (entry.unit) copy.unit = label(unit);
      if (entry.label) copy.label = axisLabel(entry.label);
      if (entry.property) copy.property = axisLabel(entry.property);
    }
    return copy;
  };
  const exportData = data => {
    if (system !== 'US' || data == null) return data;
    if (Array.isArray(data)) return data.map(exportData);
    if (typeof data !== 'object') return text(data);
    return row(Object.fromEntries(Object.entries(data).map(([key, val]) => [axisLabel(key), exportData(val)])));
  };
  return {
    get system(){ return system; },
    setSystem(next){ system = next === 'US' ? 'US' : 'SI'; },
    label, value, input, fieldValue, inputValue, round, text, axisUnit, axisLabel, plot, row, exportData,
  };
}
