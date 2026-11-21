// The form owns every field. Keep its original nodes when grouping geometry controls.
export function arrangeCompactGeometry(lab, panel) {
  if (panel.hidden) {
    delete panel.dataset.compactGeometry;
    return;
  }
  panel.dataset.compactGeometry = lab;
  if (!['airfoil', 'wall', 'collision'].includes(lab)) return;

  const main = panel.querySelector('#wallSetupControls');
  const editor = panel.querySelector('#wallEditors');
  const fields = panel.querySelector('#wallEditorControls');
  const secondary = [];
  let geometryDefinition;
  for (const group of main.children) {
    const key = group.querySelector('[id^="value-"]')?.id.slice(6);
    if (lab === 'airfoil') {
      if (key === 'geometryInput') geometryDefinition = group;
      else if (!['airfoilShape', 'airfoilMethod', 'alpha'].includes(key)) secondary.push(group);
    } else if (
      ['channelHeight', 'cornerSpacing', 'inletReference', 'inletLowerDefinition'].includes(key) ||
      group.matches('fieldset.inlet-wall-geometry, p.control-hint')
    ) {
      secondary.push(group);
    }
  }
  if (geometryDefinition) main.append(geometryDefinition);
  if (!secondary.length) return;

  fields.prepend(...secondary);
  editor.querySelector('summary').textContent = lab === 'airfoil' ? 'Surface geometry' : 'Wall geometry';
  editor.hidden = false;
  editor.parentElement.hidden = false;
}
