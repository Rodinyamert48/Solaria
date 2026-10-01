// Küçük sentezlenmiş ses efektleri (harici dosya yok)
let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem('solaria.muted') === '1';
} catch {
  /* yok say */
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur = 0.12, { type = 'sine', vol = 0.07, slide = 0, delay = 0 } = {}) {
  if (muted) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  click: () => tone(660, 0.05, { type: 'triangle', vol: 0.04 }),
  build: () => {
    tone(320, 0.09, { type: 'square', vol: 0.04, slide: 200 });
    tone(640, 0.12, { type: 'triangle', vol: 0.05, delay: 0.06 });
  },
  sell: () => tone(500, 0.18, { type: 'triangle', vol: 0.05, slide: -300 }),
  upgrade: () => [523, 659, 784].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.05, delay: i * 0.06 })),
  center: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.14, { type: 'sine', vol: 0.06, delay: i * 0.05 })),
  error: () => tone(180, 0.18, { type: 'sawtooth', vol: 0.03, slide: -60 }),
  levelUp: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.06, delay: i * 0.09 })),
  coin: () => tone(1046, 0.08, { type: 'square', vol: 0.025 }),
  get muted() {
    return muted;
  },
  toggle() {
    muted = !muted;
    try {
      localStorage.setItem('solaria.muted', muted ? '1' : '0');
    } catch {
      /* yok say */
    }
    return muted;
  },
};
