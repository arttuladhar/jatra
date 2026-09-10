import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { createProcessionAudio } from '../sound.js';

class AudioStub {
  static instances = [];
  paused = true;
  currentTime = 0;
  muted = false;
  volume = 1;
  loop = false;
  plays = 0;
  listeners = {};
  constructor(src) {
    this.src = src;
    AudioStub.instances.push(this);
  }
  set src(value) {
    this.url = value;
    this.currentTime = 0;
    this.paused = true;
  }
  get src() {
    return this.url;
  }
  addEventListener(name, callback) {
    this.listeners[name] = callback;
  }
  play() {
    this.paused = false;
    this.plays++;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  end() {
    this.paused = true;
    this.listeners.ended?.();
  }
}
function useAudio(t, Audio = AudioStub) {
  const previous = globalThis.Audio;
  globalThis.Audio = Audio;
  t.after(() => {
    globalThis.Audio = previous;
  });
}
const frame = { phase: 'procession', paused: false, pulling: false };
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('supplied playlist alternates and pull clip only plays while pulling', async (t) => {
  useAudio(t);
  const audio = createProcessionAudio(),
    before = AudioStub.instances.length;
  audio.update(frame);
  assert.equal(AudioStub.instances.length, before, 'No media created before a gesture');
  assert.equal(await audio.unlock(), true);
  await settle();
  const [music, pull] = AudioStub.instances.slice(before);
  for (const path of ['jatra1.mp3', 'jatra2.mp3', 'jatra_pull.mp3'])
    await access(new URL('../audio/' + path, import.meta.url));
  assert.ok(music.src.endsWith('/jatra1.mp3'));
  assert.ok(!music.paused && pull.paused);
  music.end();
  await settle();
  assert.ok(music.src.endsWith('/jatra2.mp3'));
  assert.equal(music.paused, false);
  music.end();
  await settle();
  assert.ok(music.src.endsWith('/jatra1.mp3'));
  audio.update({ ...frame, pulling: true });
  await settle();
  assert.equal(pull.paused, false);
  assert.equal(pull.loop, true);
  const plays = pull.plays;
  pull.currentTime = 3;
  for (let i = 0; i < 100; i++) audio.update({ ...frame, pulling: true });
  assert.equal(pull.plays, plays, 'Do not restart the clip on each frame');
  assert.equal(pull.currentTime, 3);
  assert.ok(music.volume < pull.volume, 'Music leaves room for the pull call');
  audio.update(frame);
  assert.equal(pull.paused, true);
  assert.equal(pull.currentTime, 0);
  audio.reset();
  assert.equal(AudioStub.instances.length, before + 2, 'Reuse exactly two media elements');
});

test('mute, pause, hidden-tab stop and phase changes silence both clips', async (t) => {
  useAudio(t);
  const audio = createProcessionAudio();
  audio.update({ ...frame, pulling: true });
  await audio.unlock();
  await settle();
  const [music, pull] = AudioStub.instances.slice(-2);
  music.currentTime = 42;
  pull.currentTime = 2;
  audio.update({ ...frame, pulling: true, paused: true });
  assert.ok(music.paused && pull.paused);
  audio.update({ ...frame, pulling: true });
  await settle();
  assert.equal(music.currentTime, 42);
  assert.equal(pull.currentTime, 2);
  audio.setMuted(true);
  assert.ok(music.paused && pull.paused);
  audio.setMuted(false);
  await settle();
  assert.equal(music.currentTime, 42);
  audio.setVolume(0);
  assert.ok(music.paused && pull.paused);
  audio.setVolume(0.3);
  await settle();
  assert.equal(pull.volume, 0.3);
  audio.stop();
  assert.ok(music.paused && pull.paused);
  audio.update({ ...frame, pulling: true });
  await settle();
  assert.equal(music.paused, false);
  for (const phase of ['failed', 'won', 'workshop']) {
    audio.update({ ...frame, phase, pulling: true });
    assert.ok(music.paused && pull.paused);
  }
  audio.reset();
  assert.ok(music.src.endsWith('/jatra1.mp3'));
  assert.equal(music.currentTime, 0);
  assert.equal(pull.currentTime, 0);
});

test('a reset during audio loading cannot start playback in the workshop', async (t) => {
  const resolutions = [];
  useAudio(
    t,
    class extends AudioStub {
      play() {
        this.paused = false;
        return new Promise((resolve) => resolutions.push(resolve));
      }
    },
  );
  const audio = createProcessionAudio();
  audio.update(frame);
  const pending = audio.unlock();
  audio.reset();
  resolutions.forEach((resolve) => resolve());
  await pending;
  assert.ok(AudioStub.instances.slice(-2).every((element) => element.paused));
});

test('unsupported or blocked playback is handled and can be retried', async (t) => {
  useAudio(t, undefined); // Explicitly clear the default stub for this branch.
  globalThis.Audio = undefined;
  let audio = createProcessionAudio();
  assert.equal(audio.supported, false);
  assert.equal(await audio.unlock(), false);
  assert.doesNotThrow(() => {
    audio.update(frame);
    audio.reset();
  });
  let blocked = true;
  globalThis.Audio = class extends AudioStub {
    play() {
      if (blocked) return Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
      return super.play();
    }
  };
  audio = createProcessionAudio();
  audio.update(frame);
  assert.equal(await audio.unlock(), false);
  assert.ok(AudioStub.instances.slice(-2).every((element) => element.paused));
  blocked = false;
  assert.equal(await audio.unlock(), true);
  await settle();
  assert.equal(AudioStub.instances.at(-2).paused, false);
  audio.reset();
});

test('restarting during an autoplay retry cannot restore an earlier run position', async (t) => {
  let mode = 'normal';
  const resolutions = [];
  useAudio(
    t,
    class extends AudioStub {
      play() {
        if (mode === 'blocked')
          return Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
        if (mode === 'loading') {
          this.paused = false;
          return new Promise((resolve) => resolutions.push(resolve));
        }
        return super.play();
      }
    },
  );
  const audio = createProcessionAudio();
  audio.update(frame);
  await audio.unlock();
  await settle();
  const music = AudioStub.instances.at(-2);
  music.currentTime = 42;
  audio.update({ ...frame, paused: true });
  mode = 'blocked';
  audio.update(frame);
  await settle();
  mode = 'loading';
  const loading = audio.unlock();
  audio.reset();
  audio.update(frame);
  mode = 'normal';
  resolutions.forEach((resolve) => resolve());
  await loading;
  await settle();
  assert.equal(
    music.currentTime,
    0,
    'The new procession starts at the beginning, not the previous 42-second mark',
  );
  audio.reset();
});
