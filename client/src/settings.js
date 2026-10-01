// Oyuncu ayarları: tarayıcıda saklanır, değişince dinleyicilere bildirilir.
const KEY = 'solaria.settings';

// Grafik kalite ön ayarları
export const QUALITY = {
  dusuk: { name: 'Düşük', renderScale: 75, shadows: 'kapali', shadowSize: 1024, glow: false, bloom: false, ssao: false, msaa: false, particles: 0.35, clouds: false },
  orta: { name: 'Orta', renderScale: 100, shadows: 'normal', shadowSize: 1024, glow: true, bloom: false, ssao: false, msaa: false, particles: 0.7, clouds: true },
  yuksek: { name: 'Yüksek', renderScale: 100, shadows: 'yumusak', shadowSize: 2048, glow: true, bloom: true, ssao: false, msaa: true, particles: 1, clouds: true },
  ultra: { name: 'Ultra', renderScale: 100, shadows: 'yumusak', shadowSize: 4096, glow: true, bloom: true, ssao: true, msaa: true, particles: 1.3, clouds: true },
};

function defaultQuality() {
  if (typeof window === 'undefined') return 'yuksek';
  const mobile = window.matchMedia?.('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 820;
  return mobile ? 'orta' : 'yuksek';
}

export const DEFAULTS = {
  quality: defaultQuality(),
  ...QUALITY[defaultQuality()],
  flow: true,
  fps: false,
  cameraAngle: 'izometrik', // izometrik | yukaridan | alcak
  grid: 'insa', // insa | her-zaman
  continuousBuild: true,
  confirmSell: false,
  notifications: true,
  sfxVolume: 70,
  ambientVolume: 35,
  uiScale: 100,
};

class Settings {
  constructor() {
    this.values = { ...DEFAULTS };
    this.listeners = new Set();
    try {
      Object.assign(this.values, JSON.parse(localStorage.getItem(KEY)) || {});
    } catch {
      /* yok say */
    }
  }

  get(key) {
    return this.values[key];
  }

  set(patch) {
    Object.assign(this.values, patch);
    try {
      localStorage.setItem(KEY, JSON.stringify(this.values));
    } catch {
      /* yok say */
    }
    for (const fn of this.listeners) fn(this.values, patch);
  }

  applyQuality(level) {
    const { name, ...preset } = QUALITY[level];
    void name;
    this.set({ quality: level, ...preset });
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset() {
    this.set({ ...DEFAULTS });
  }
}

export const settings = new Settings();
