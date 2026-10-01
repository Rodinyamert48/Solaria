// Sentezlenmiş ses efektleri ve ortam sesi (harici ses dosyası yok)
import { settings } from './settings.js';

let ctx = null;
let master = null;
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
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const sfxVolume = () => (settings.get('sfxVolume') ?? 70) / 70;

function tone(freq, dur = 0.12, { type = 'sine', vol = 0.07, slide = 0, delay = 0 } = {}) {
  if (muted) return;
  const v = vol * sfxVolume();
  if (v <= 0.0001) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(v, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  click: () => tone(660, 0.05, { type: 'triangle', vol: 0.04 }),
  build: () => {
    tone(320, 0.09, { type: 'square', vol: 0.035, slide: 200 });
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
    if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
    return muted;
  },
  // Tarayıcılar sesi ancak kullanıcı etkileşiminden sonra başlatır
  unlock() {
    audio();
  },
};

// Ortam sesi: rüzgar uğultusu, gündüz kuşlar, gece cırcır böcekleri, şehir uğultusu
export class Ambience {
  constructor() {
    this.started = false;
    this.nextBird = 0;
    this.nextCricket = 0;
  }

  start() {
    if (this.started) return;
    const a = audio();
    if (!a) return;
    this.started = true;
    const noise = a.createBuffer(1, a.sampleRate * 3, a.sampleRate);
    const data = noise.getChannelData(0);
    // kahverengi gürültü (yumuşak uğultu)
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const mk = (cutoff) => {
      const src = a.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const filter = a.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = a.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(master);
      src.start();
      return { filter, gain };
    };
    this.wind = mk(500);
    this.city = mk(160);
  }

  // Her ~0.25 sn: çevreye göre ses seviyelerini ayarla
  update(env, cityLevel) {
    if (!this.started || !env) return;
    const vol = (settings.get('ambientVolume') ?? 35) / 100;
    const a = ctx;
    const t = a.currentTime;
    this.wind.gain.gain.setTargetAtTime(vol * 0.05 * (0.4 + 0.6 * (env.wind / 1.6)), t, 0.5);
    this.wind.filter.frequency.setTargetAtTime(300 + env.wind * 350, t, 0.5);
    this.city.gain.gain.setTargetAtTime(vol * 0.06 * Math.min(1, cityLevel / 5), t, 0.8);
    if (vol <= 0 || muted) return;
    const now = performance.now();
    // gündüz kuş cıvıltısı
    if (env.daylight > 0.6 && now > this.nextBird) {
      this.nextBird = now + 2500 + Math.random() * 6000;
      const base = 2200 + Math.random() * 1600;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.chirp(base + Math.random() * 400, t + i * 0.13, vol * 0.025);
    }
    // gece cırcır böceği
    if (env.daylight < 0.3 && now > this.nextCricket) {
      this.nextCricket = now + 900 + Math.random() * 1500;
      for (let i = 0; i < 3; i++) this.chirp(4300, t + i * 0.07, vol * 0.012, 0.04);
    }
  }

  chirp(freq, at, vol, dur = 0.09) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, at + dur);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }
}
