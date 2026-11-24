const phone = matchMedia('(max-width: 800px)');
const calculatorSidebar = matchMedia('(min-width: 1250px)');
const byId = id => document.getElementById(id);
const grid = document.querySelector('.work-grid');
const controls = grid.querySelector('.controls');
const visual = grid.querySelector('.visual-column');
const scene = byId('scene');
const sceneCard = scene.closest('.scene-card');
const chartCard = byId('chart').closest('.chart-card');
const results = byId('resultsTitle').closest('.results');
const examples = byId('examplesPanel');
const calculatorTable = byId('calculatorTablePanel');
const sweep = byId('nozzleSweep');
const sweepDetails = byId('sweepDetails');
const wallSetup = byId('wallSetupPanel');
const chapters = byId('chapters');
const menu = byId('chapterMenu');
const primary = byId('chapterPrimary');
const shortcuts = byId('chapterShortcuts');
const fields = {
  balances: ['M2'], normal: ['M1'], rayleigh: ['q'],
  fanno: ['lambda'], wall: ['M1'], collision: ['M1'],
  tube: ['shockRatio', 'driverRatio', 'inducedSpeed', 'unsteadyExperiment'],
  airfoil: ['M'], cone: ['M']
};

let lab = '';
let source = null;

function closeMenu() {
  menu.hidden = !phone.matches;
  menu.setAttribute('aria-expanded', 'false');
  chapters.hidden = phone.matches;
}

menu.addEventListener('click', () => {
  chapters.hidden = !chapters.hidden;
  menu.setAttribute('aria-expanded', String(!chapters.hidden));
});

shortcuts.addEventListener('click', event => {
  const requested = event.target.closest('button')?.dataset.target;
  const target = requested === 'resultsTitle' && lab === 'airfoil' ? byId('airfoilPanel')
    : requested === 'resultsTitle' && ['wall','collision'].includes(lab) && !byId('regionTablePanel').hidden
      ? byId('regionTableTitle') : byId(requested || '');
  if (!target) return;
  target.tabIndex = -1;
  target.focus({preventScroll: true});
  target.scrollIntoView({block: 'start'});
});

// Return the actual input to its source before the form or its mode is rebuilt.
export function restoreChapterControls() {
  if (!source) return;
  const group = primary.firstElementChild;
  for (const input of group.querySelectorAll('[form="inputs"]')) input.removeAttribute('form');
  source.replaceWith(group);
  source = null;
  primary.hidden = true;
}

function placePrimaryControl() {
  if (source || !phone.matches || sceneCard.hidden) return;
  for (const key of fields[lab] ?? []) {
    const input = byId('value-' + key);
    const group = input?.closest('.input-group');
    if (!group || input.disabled || input.readOnly || group.parentElement !== byId('inputs') || group.classList.contains('typed-input-group')) continue;
    source = document.createComment('primary control');
    group.before(source);
    for (const control of group.querySelectorAll('input, select')) control.setAttribute('form', 'inputs');
    primary.append(group);
    primary.hidden = false;
    return;
  }
}

export function refreshChapterLayout() {
  placePrimaryControl();
  // Let a student see the Rayleigh pressure profiles before the station tables.
  if (phone.matches && lab === 'rayleigh' && sceneCard.nextElementSibling !== chartCard) sceneCard.after(chartCard);
}

function updateLayout() {
  const mobile = phone.matches;
  const active = document.activeElement;
  restoreChapterControls();
  closeMenu();
  if (lab === 'foundations') {
    if (results.nextElementSibling !== chartCard) chartCard.before(results);
    if (calculatorSidebar.matches) {
      if (calculatorTable.previousElementSibling !== examples) examples.after(calculatorTable);
    } else if (calculatorTable.nextElementSibling !== chartCard) {
      chartCard.before(calculatorTable);
    }
  } else if (results.previousElementSibling !== examples) {
    examples.after(results);
  }
  if (mobile) {
    if (lab === 'foundations') {
      if (controls.nextElementSibling !== visual) controls.after(visual);
    } else if (grid.firstElementChild !== visual) {
      controls.before(visual);
    }
    if (wallSetup.parentElement !== controls) controls.querySelector('.card-head').after(wallSetup);
  } else {
    if (controls.nextElementSibling !== visual) controls.after(visual);
    if (wallSetup.parentElement === controls) grid.before(wallSetup);
  }

  if (mobile && lab === 'nozzle') {
    if (scene.nextElementSibling !== sweep) scene.after(sweep);
  } else if (sweep.nextElementSibling !== shortcuts) {
    shortcuts.before(sweep);
  }
  sweepDetails.open = !(mobile && lab === 'nozzle');
  shortcuts.hidden = !mobile;
  if (!mobile && lab === 'rayleigh') byId('regionTablePanel').after(chartCard);
  if (active?.isConnected && active !== document.body && !active.closest('[hidden]')) active.focus({preventScroll: true});
}

phone.addEventListener('change', () => {
  updateLayout();
  refreshChapterLayout();
});
calculatorSidebar.addEventListener('change', () => {
  if (lab === 'foundations') updateLayout();
});

export function setChapterLayout(id) {
  lab = id;
  updateLayout();
}
