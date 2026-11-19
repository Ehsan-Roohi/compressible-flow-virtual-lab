const phone = matchMedia('(max-width: 800px)');
const grid = document.querySelector('.work-grid');
const visual = grid.querySelector('.visual-column');
const controls = grid.querySelector('.controls');
const scene = document.getElementById('scene');
const sweep = document.getElementById('nozzleSweep');
const sweepDetails = document.getElementById('sweepDetails');
const chapters = document.getElementById('chapters');
const chapterMenu = document.getElementById('nozzleChapterMenu');
let nozzleActive = false;
let mobileLayout = false;

function updateLayout() {
  const mobile = nozzleActive && phone.matches;
  if (mobile === mobileLayout) return;
  mobileLayout = mobile;

  // Move existing controls so their handlers, values and keyboard order stay together.
  if (mobile) {
    controls.before(visual);
    scene.after(sweep);
  } else {
    controls.after(visual);
    scene.closest('.scene-card').append(sweep);
  }
  sweepDetails.open = !mobile;
  chapterMenu.hidden = !mobile;
  chapterMenu.setAttribute('aria-expanded', 'false');
  chapters.hidden = mobile;
}

chapterMenu.addEventListener('click', () => {
  chapters.hidden = !chapters.hidden;
  chapterMenu.setAttribute('aria-expanded', String(!chapters.hidden));
});

phone.addEventListener('change', updateLayout);

export function setNozzleLayout(active) {
  nozzleActive = active;
  updateLayout();
}
