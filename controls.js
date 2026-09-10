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
    if (!isWorkshop && target?.dataset?.hold) return target.dataset.hold;
    if (target?.closest?.('button, a[href]')) return null;
  }
  return code;
}
export function bindControls({
  select,
  change,
  start,
  rebuild,
  pause,
  isWorkshop,
  blocked,
  canHold,
}) {
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
  // Track each finger/key separately so releasing one input cannot cancel another.
  const held = new Map();
  function press(source, code) {
    if (held.has(source)) return;
    held.set(source, code);
    keys.delete(code);
    keys.add(code);
  }
  function release(source) {
    const code = held.get(source);
    held.delete(source);
    if (![...held.values()].includes(code)) keys.delete(code);
  }
  function clear() {
    held.clear();
    keys.clear();
    for (const button of document.querySelectorAll('[data-hold]')) button.classList.remove('held');
  }
  window.addEventListener(
    'keydown',
    (e) => {
      if (blocked()) return;
      const code = controlCode(e, isWorkshop());
      if (!relevant.includes(code)) return;
      e.preventDefault();
      e.stopPropagation();
      press(`key:${e.code || e.key?.toLowerCase()}`, code);
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
      release(`key:${e.code || e.key?.toLowerCase()}`);
    },
    { capture: true },
  );
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);
  for (const button of document.querySelectorAll('[data-hold]')) {
    button.addEventListener('contextmenu', (event) => event.preventDefault());
    button.addEventListener('pointerdown', (event) => {
      if (!canHold() || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      press(`pointer:${event.pointerId}`, button.dataset.hold);
    });
    const end = (event) => release(`pointer:${event.pointerId}`);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('lostpointercapture', end);
  }
  return { keys, clear };
}
