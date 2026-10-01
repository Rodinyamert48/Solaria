// Çevre koşulları: zaman (ms) -> gün ışığı ve rüzgar. Saf fonksiyonlar, sunucu ve istemci aynı sonucu bulur.

export const DAY_LENGTH_MS = 6 * 60 * 1000;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// 0..1 arası günün evresi. 0 = gün doğumu, 0.25 = öğle, 0.5 = gün batımı, 0.75 = gece yarısı
export function dayPhase(timeMs) {
  return (timeMs % DAY_LENGTH_MS) / DAY_LENGTH_MS;
}

// Güneşin yüksekliği: -1 (gece yarısı) .. 1 (öğle)
export function sunHeight(timeMs) {
  return Math.sin(dayPhase(timeMs) * Math.PI * 2);
}

// Gündüz miktarı 0..1 (alacakaranlıkta yumuşak geçiş)
export function daylight(timeMs) {
  return smooth(-0.18, 0.22, sunHeight(timeMs));
}

// Güneş paneli verimi 0.03..1
export function solarFactor(timeMs) {
  const h = Math.max(0, sunHeight(timeMs));
  return Math.max(0.03, daylight(timeMs) * (0.55 + 0.45 * h));
}

// Rüzgar şiddeti ~0.4..1.6, ortalama 1. Birbiriyle uyumsuz periyotlu sinüslerden sahte gürültü.
export function windFactor(timeMs) {
  const t = timeMs / 1000;
  const w =
    1 +
    0.34 * Math.sin(t / 47.3) +
    0.17 * Math.sin(t / 13.7 + 1.3) +
    0.09 * Math.sin(t / 5.3 + 2.1);
  return Math.min(1.6, Math.max(0.4, w));
}

// Oyun saati 0..24 (0 evre = 06:00)
export function hourOfDay(timeMs) {
  return (dayPhase(timeMs) * 24 + 6) % 24;
}

const bump = (h, center, width) => {
  let d = Math.abs(h - center);
  d = Math.min(d, 24 - d);
  return Math.exp(-(d * d) / (2 * width * width));
};

// Gerçek şehirlerdeki gibi günlük talep eğrisi: gece düşük, sabah hafif artış, akşam (19-20) zirve
export function demandFactor(timeMs) {
  const h = hourOfDay(timeMs);
  return 1 + 0.14 * bump(h, 19.5, 2.2) + 0.05 * bump(h, 8, 1.5) - 0.24 * bump(h, 3.5, 2.6);
}

export function envAt(timeMs) {
  return {
    time: timeMs,
    phase: dayPhase(timeMs),
    daylight: daylight(timeMs),
    sun: solarFactor(timeMs),
    wind: windFactor(timeMs),
    demand: demandFactor(timeMs),
  };
}

// Bir oyun saati kaç gerçek saniye (gün 6 dakika -> 15 sn)
export const GAME_HOUR_S = DAY_LENGTH_MS / 1000 / 24;

export function envFactor(kind, env) {
  if (kind === 'sun') return env.sun;
  if (kind === 'wind') return env.wind;
  return 1;
}

// Gün içindeki saati "SS:DD" olarak ver (oyun saati; 0 evre = 06:00)
export function clockString(timeMs) {
  const minutes = Math.floor(((dayPhase(timeMs) * 24 + 6) % 24) * 60);
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}
