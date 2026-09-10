import test from 'node:test';
import assert from 'node:assert/strict';
import { controlCode, bindControls } from '../controls.js';

test('arrow steering works with key or code in both phases; A/D are not steering', () => {
  for (const code of ['ArrowLeft', 'ArrowRight'])
    for (const event of [{ code }, { key: code }, { code, key: code }]) {
      assert.equal(controlCode(event, false), code);
      assert.equal(controlCode(event, true), code);
    }
  for (const key of ['a', 'd', 'A', 'D'])
    assert.ok(!['ArrowLeft', 'ArrowRight'].includes(controlCode({ key }, false)));
});

test('focused steering buttons accept Space and Enter without applying brakes', () => {
  for (const hold of ['ArrowLeft', 'ArrowRight', 'KeyW', 'Space'])
    for (const key of [' ', 'Enter'])
      assert.equal(
        controlCode(
          { key, code: key === ' ' ? 'Space' : 'Enter', target: { dataset: { hold } } },
          false,
        ),
        hold,
      );
});

test('braking supports code-less Space and normal controls keep native keyboard actions', () => {
  assert.equal(controlCode({ key: ' ' }, false), 'Space');
  for (const key of [' ', 'Enter'])
    assert.equal(
      controlCode(
        { key, target: { closest: (selector) => (selector === 'button, a[href]' ? {} : null) } },
        false,
      ),
      null,
    );
  for (const key of ['ArrowRight', 'w', 'r'])
    assert.equal(controlCode({ key, target: { closest: () => ({}) } }, false), null);
  assert.equal(
    controlCode(
      { key: 'w', target: { closest: (selector) => (selector === 'button, a[href]' ? {} : null) } },
      false,
    ),
    'KeyW',
  );
});

test('touch holds combine with keyboard input and release safely on interruptions', (t) => {
  const buttons = ['KeyW', 'ArrowLeft', 'ArrowRight', 'Space'].map((hold) =>
    Object.assign(new EventTarget(), {
      dataset: { hold },
      setPointerCapture() {},
      classList: { remove() {} },
    }),
  );
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { querySelectorAll: () => buttons });
  const oldWindow = globalThis.window;
  const oldDocument = globalThis.document;
  globalThis.window = win;
  globalThis.document = doc;
  t.after(() => {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  });
  let allowed = true;
  const input = bindControls({
    isWorkshop: () => false,
    blocked: () => false,
    canHold: () => allowed,
  });
  const send = (target, type, fields = {}) =>
    target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), fields));
  const down = (index, pointerId) => send(buttons[index], 'pointerdown', { pointerId });
  const up = (index, pointerId) => send(buttons[index], 'pointerup', { pointerId });
  down(0, 1);
  down(1, 2);
  down(2, 3);
  assert.deepEqual([...input.keys], ['KeyW', 'ArrowLeft', 'ArrowRight']);
  up(2, 3);
  assert.deepEqual([...input.keys], ['KeyW', 'ArrowLeft']);
  send(win, 'keydown', { key: 'w', code: 'KeyW' });
  up(0, 1);
  assert.ok(input.keys.has('KeyW'), 'releasing touch preserves a held keyboard key');
  send(win, 'keyup', { key: 'w', code: 'KeyW' });
  assert.ok(!input.keys.has('KeyW'));
  down(1, 4);
  up(1, 2);
  assert.ok(input.keys.has('ArrowLeft'), 'a second finger on the same button stays held');
  send(buttons[1], 'pointercancel', { pointerId: 4 });
  assert.equal(input.keys.size, 0);
  down(3, 5);
  assert.ok(input.keys.has('Space'));
  send(buttons[3], 'lostpointercapture', { pointerId: 5 });
  assert.equal(input.keys.size, 0);
  for (const clear of [input.clear, () => send(win, 'blur'), () => send(doc, 'visibilitychange')]) {
    down(0, 6);
    down(1, 7);
    clear();
    assert.equal(input.keys.size, 0);
    down(0, 6);
    assert.ok(input.keys.has('KeyW'), 'clearing resets pointer tracking too');
    up(0, 6);
  }
  send(win, 'keydown', { key: 'W' });
  send(win, 'keyup', { key: 'w' });
  assert.equal(input.keys.size, 0, 'code-less keys release if Shift changes while held');
  allowed = false;
  down(0, 8);
  assert.equal(input.keys.size, 0, 'paused/help/finished input is ignored');
});
