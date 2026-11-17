// audio.js — fully synthetic WebAudio: chiptune BGM loops per zone plus one-shot
// sfx for hits, heals, captures, level-ups and jingles. No audio files.
let ctx = null;
let master = null;
let musicGain = null;
let currentTrack = null;
let musicTimer = null;
let enabled = true;

function ensure() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
  } catch { enabled = false; }
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function setMuted(m) {
  enabled = !m;
  if (master) master.gain.value = m ? 0 : 0.5;
}

function tone(freq, dur, opts = {}) {
  if (!enabled) return;
  const c = ensure(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = opts.type || 'square';
  o.frequency.setValueAtTime(freq, c.currentTime + (opts.delay || 0));
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slide), c.currentTime + dur + (opts.delay || 0));
  g.gain.setValueAtTime(0.0001, c.currentTime + (opts.delay || 0));
  g.gain.exponentialRampToValueAtTime(opts.vol || 0.25, c.currentTime + (opts.delay || 0) + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (opts.delay || 0) + dur);
  o.connect(g); g.connect(opts.dest || master);
  o.start(c.currentTime + (opts.delay || 0));
  o.stop(c.currentTime + (opts.delay || 0) + dur + 0.02);
}

function noise(dur, vol = 0.2) {
  if (!enabled) return;
  const c = ensure(); if (!c) return;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource(); src.buffer = buf;
  const g = c.createGain(); g.gain.value = vol;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900;
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
}

// ---------------------------------------------------------------- one-shots
export const SFX = {
  hit:      () => { noise(0.12, 0.3); tone(180, 0.09, { type: 'sawtooth', slide: 70, vol: 0.22 }); },
  miss:     () => tone(500, 0.12, { type: 'triangle', slide: 200, vol: 0.15 }),
  heal:     () => { [520, 660, 780].forEach((f, i) => tone(f, 0.14, { type: 'sine', delay: i * 0.07, vol: 0.2 })); },
  focus:    () => tone(240, 0.3, { type: 'sawtooth', slide: 700, vol: 0.16 }),
  throw:    () => tone(900, 0.16, { type: 'triangle', slide: 300, vol: 0.18 }),
  capture:  () => { [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.16, { type: 'square', delay: i * 0.09, vol: 0.2 })); },
  buzzer:   () => tone(140, 0.22, { type: 'square', vol: 0.2 }),
  step:     () => tone(90, 0.03, { type: 'sine', vol: 0.06 }),
  pickup:   () => { tone(880, 0.08, { type: 'square', vol: 0.18 }); tone(1320, 0.1, { type: 'square', delay: 0.08, vol: 0.18 }); },
  xp:       () => tone(440, 0.1, { type: 'triangle', slide: 660, vol: 0.16 }),
  levelup:  () => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.12, { type: 'square', delay: i * 0.08, vol: 0.2 })); },
  encounter:() => { [220, 330, 440].forEach((f, i) => tone(f, 0.09, { type: 'sawtooth', delay: i * 0.06, vol: 0.18 })); },
  flee:     () => tone(700, 0.25, { type: 'sine', slide: 150, vol: 0.15 }),
  victoryHit: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.14, { type: 'square', delay: i * 0.1, vol: 0.2 })); },
  victory:  () => { [523, 523, 659, 784, 1046].forEach((f, i) => tone(f, i === 4 ? 0.4 : 0.14, { type: 'square', delay: i * 0.16, vol: 0.22 })); noise(0.3, 0.08); },
  defeat:   () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, { type: 'triangle', delay: i * 0.16, vol: 0.2 })); },
  menu:     () => tone(600, 0.05, { type: 'square', vol: 0.1 }),
};

export function playSfx(name) { (SFX[name] || SFX.menu)(); }

// ---------------------------------------------------------------- BGM loops
// Each track: melody notes (semitone offsets) over a bass pulse, 8 bars looping.
const TRACKS = {
  moss:   { bpm: 112, root: 220, bass: [0, -5, -7, -5], mel: [0, 4, 7, 4, 12, 7, 4, 0], wave: 'triangle' },
  cliff:  { bpm: 126, root: 196, bass: [-2, -2, 3, -2], mel: [0, 3, 7, 10, 7, 3, 0, -2], wave: 'sawtooth' },
  temple: { bpm: 96,  root: 174, bass: [-5, -5, -12, -7], mel: [0, -2, 3, 0, 7, 3, -2, 0], wave: 'square' },
  title:  { bpm: 100, root: 262, bass: [0, -3, -5, -3], mel: [0, 7, 4, 7, 12, 7, 2, 0], wave: 'triangle' },
};

const semi = (f, s) => f * Math.pow(2, s / 12);

export function playMusic(name) {
  const c = ensure(); if (!c || !enabled) return;
  if (c.state !== 'running') return; // autoplay is blocked until the player starts the game
  if (currentTrack === name) return;
  currentTrack = name;
  stopMusic();
  const tr = TRACKS[name] || TRACKS.moss;
  const beat = 60 / tr.bpm;
  let step = 0;
  const tick = () => {
    if (currentTrack !== name) return;
    const i = step % 8;
    // bass pulse every other beat, melody note each beat, sparkle on the off-beat
    tone(semi(tr.root / 2, tr.bass[Math.floor(i / 2) % 4]), beat * 1.8, { type: 'triangle', vol: 0.35, dest: musicGain });
    if (tr.mel[i] !== undefined) tone(semi(tr.root, tr.mel[i]), beat * 0.7, { type: tr.wave, vol: 0.3, dest: musicGain });
    if (i % 4 === 2) tone(semi(tr.root, tr.mel[(i + 3) % 8] + 12), beat * 0.5, { type: 'square', vol: 0.12, dest: musicGain });
    step += 1;
  };
  tick();
  musicTimer = setInterval(tick, beat * 1000);
}

export function stopMusic() {
  currentTrack = null;
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
