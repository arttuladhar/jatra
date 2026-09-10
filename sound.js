// Stream the supplied recordings through native media elements rather than
// decoding the long procession tracks into memory. Vite bundles these URLs.
const playlist = [
  new URL('./audio/jatra1.mp3', import.meta.url).href,
  new URL('./audio/jatra2.mp3', import.meta.url).href,
];
const pullUrl = new URL('./audio/jatra_pull.mp3', import.meta.url).href;
export function createProcessionAudio(onBlocked = () => {}) {
  const Audio = globalThis.Audio;
  let revision = 0;
  let music,
    pull,
    track = 0,
    muted = false,
    volume = 0.45,
    unlocked = false,
    unlocking;
  let state = { phase: 'workshop', paused: false, pulling: false };
  const pending = new Set();
  function applyVolume() {
    if (!music) return;
    music.muted = pull.muted = muted;
    // Leave room for the pulling recording without masking it with the music.
    music.volume = volume * (state.pulling ? 0.55 : 0.8);
    pull.volume = volume;
  }
  function play(element) {
    if (!element.paused || pending.has(element)) return;
    pending.add(element);
    const startedRevision = revision;
    element
      .play()
      .catch((error) => {
        // pause()/reset() can legitimately interrupt an in-flight play().
        if (error.name !== 'AbortError' && startedRevision === revision) {
          unlocked = false;
          stop();
          onBlocked();
        }
      })
      .finally(() => pending.delete(element));
  }
  function apply() {
    if (!music || unlocking) return;
    applyVolume();
    if (!state.pulling) {
      pull.pause();
      if (pull.currentTime !== 0) pull.currentTime = 0;
    }
    if (!unlocked || muted || volume === 0 || state.paused || state.phase !== 'procession') {
      music.pause();
      pull.pause();
      return;
    }
    play(music);
    if (state.pulling) play(pull);
  }
  async function unlock() {
    if (!Audio) return false;
    if (unlocking) return unlocking;
    if (unlocked) {
      apply();
      return true;
    }
    if (!music) {
      music = new Audio(playlist[0]);
      pull = new Audio(pullUrl);
      pull.loop = true;
      music.preload = pull.preload = 'metadata';
      music.addEventListener('ended', () => {
        track = (track + 1) % playlist.length;
        music.src = playlist[track];
        apply();
      });
    }
    // Authorize both elements in the initiating click/key gesture, including
    // the pull clip that may not be needed until much later in the procession.
    const position = [music.currentTime, pull.currentTime],
      source = music.src,
      startedRevision = revision;
    music.muted = pull.muted = true;
    unlocking = Promise.allSettled([music.play(), pull.play()]).then((results) => {
      music.pause();
      pull.pause();
      unlocked = results.every((result) => result.status === 'fulfilled');
      if (
        unlocked &&
        startedRevision === revision &&
        state.phase !== 'workshop' &&
        music.src === source
      ) {
        music.currentTime = position[0];
        pull.currentTime = position[1];
      }
      unlocking = null;
      apply();
      return unlocked;
    });
    return unlocking;
  }
  function stop() {
    state = { ...state, paused: true };
    music?.pause();
    pull?.pause();
  }
  function reset() {
    revision++;
    stop();
    state = { phase: 'workshop', paused: false, pulling: false };
    track = 0;
    if (music) {
      music.src = playlist[0];
      music.currentTime = 0;
      pull.currentTime = 0;
    }
  }
  return {
    unlock,
    stop,
    reset,
    get supported() {
      return !!Audio;
    },
    get muted() {
      return muted;
    },
    update(next) {
      state = next;
      apply();
    },
    setMuted(value) {
      muted = !!value;
      apply();
    },
    setVolume(value) {
      if (!Number.isFinite(value)) return;
      volume = Math.max(0, Math.min(1, value));
      apply();
    },
  };
}
