import test from 'node:test';
import assert from 'node:assert/strict';
import { controlCode } from '../controls.js';

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
  for (const key of [' ', 'Enter'])
    assert.equal(
      controlCode(
        {
          key,
          code: key === ' ' ? 'Space' : 'Enter',
          target: { dataset: { steer: 'ArrowRight' } },
        },
        false,
      ),
      'ArrowRight',
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
