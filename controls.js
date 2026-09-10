// Prefer the printed key when available; some embedded browsers omit `code`.
// Arrow keys customize parts in the workshop and steer during the procession.
export function controlCode(event, isWorkshop) {
  const target = event.target;
  if (target?.closest?.('input, textarea, select, [contenteditable="true"], .audio-controls'))
    return null;
  const letter = event.key?.toLowerCase();
  const code =
    event.key === ' '
      ? 'Space'
      : ['w', 'p', 'r'].includes(letter)
        ? `Key${letter.toUpperCase()}`
        : event.code || event.key;
  if (['Enter', 'Space'].includes(code)) {
    if (!isWorkshop && target?.dataset?.steer) return target.dataset.steer;
    if (target?.closest?.('button, a[href]')) return null;
  }
  return code;
}
export function bindControls({ select, change, start, rebuild, pause, isWorkshop, blocked }) {
  const keys = new Set(),
    relevant = [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Space',
      'KeyW',
      'KeyP',
      'KeyR',
      'Enter',
    ];
  window.addEventListener(
    'keydown',
    (e) => {
      if (blocked()) return;
      const code = controlCode(e, isWorkshop());
      if (!relevant.includes(code)) return;
      e.preventDefault();
      e.stopPropagation();
      keys.add(code);
      if (e.repeat) return;
      if (code === 'KeyR') rebuild();
      if (isWorkshop()) {
        if (code === 'ArrowUp') select(-1);
        if (code === 'ArrowDown') select(1);
        if (code === 'ArrowLeft') change(-1);
        if (code === 'ArrowRight') change(1);
        if (code === 'Enter') start();
      } else if (code === 'KeyP') pause();
    },
    { capture: true },
  );
  window.addEventListener(
    'keyup',
    (e) => {
      keys.delete(controlCode(e, isWorkshop()));
      keys.delete(e.code);
    },
    { capture: true },
  );
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => keys.clear());
  return keys;
}

export function bindSteeringButtons(keys, enabled) {
  for (const button of document.querySelectorAll('[data-steer]')) {
    button.addEventListener('pointerdown', (event) => {
      if (!enabled()) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      keys.add(button.dataset.steer);
    });
    const release = () => keys.delete(button.dataset.steer);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }
}
