// Tekrar kullanılan model parçaları (gerçekçi malzemeler: metal, cam, su, pencere dokulu cephe)
import { C, G } from './palette.js';

const PI = Math.PI;
const CELLS = 8; // materials.js FACADE_CELLS

// Zemin plakası (ayak izi boyunca)
export function pad(k, s, hex = C.gravel, h = 0.06) {
  k.box(s - 0.1, h, s - 0.1, hex, { y: h / 2, ao: false });
  // ince bordür
  k.box(s - 0.06, 0.02, s - 0.06, '#8f8a80', { y: 0.01, ao: false });
}

export function water(k, w, d, x = 0, z = 0, y = 0.07, hex = C.water) {
  k.box(w, 0.06, d, hex, { x, y, z, mat: 'water', ao: false });
}

// Tek güneş paneli: direk + metal çerçeve + hücre ızgaralı cam yüzey
export function solarPanel(k, x, z, w, d, h, tilt = 0.5) {
  k.pole(x, z, 0, h, 0.045, '#9aa3ad');
  k.box(w + 0.04, 0.025, d + 0.04, '#c5ccd3', { x, y: h - 0.02, z, rx: tilt, mat: 'metal' });
  k.box(w, 0.03, d, '#1f3a6b', { x, y: h, z, rx: tilt, mat: 'glass' });
  // hücre çizgileri (yüzeyin hemen üstünde)
  const cols = Math.max(2, Math.round(w / 0.12));
  for (let i = 1; i < cols; i++) {
    k.box(0.006, 0.032, d, '#8fa6c6', { x: x - w / 2 + (i * w) / cols, y: h + 0.002, z, rx: tilt });
  }
  k.box(w, 0.032, 0.006, '#8fa6c6', { x, y: h + 0.002, z, rx: tilt });
}

// Pervane: sivrilen kanatlar + burun konisi. Grup z ekseninde döner; kanatlar XY düzleminde.
export function rotor(k, x, y, z, n, len, width, hex = C.white, speed = 2.5) {
  const g = k.group(x, y, z, { type: 'spin', axis: 'z', speed, driver: 'wind' });
  g.cyl(0, width * 2.4, width * 2.2, hex, { rx: -PI / 2, z: -width * 1.1, tess: 12 });
  g.sphere(width * 2.4, hex, { seg: 12 });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    // kanat: kökte geniş, uçta ince; hafif burulmalı yassı koni
    g.cyl(width * 0.25, width * 1.1, len, hex, {
      x: (Math.sin(a) * len) / 2,
      y: (Math.cos(a) * len) / 2,
      rz: -a,
      sz: 0.28,
      tess: 8,
    });
  }
  return g;
}

// Modern rüzgar türbini: incelen kule, yuvarlak gövde (nacelle), pervane
export function windTurbine(k, h, bladeLen, towerD, speed, opts = {}) {
  const { x = 0, z = 0, color = C.white, blades = 3 } = opts;
  k.cyl(towerD * 0.5, towerD, h, color, { x, y: h / 2, z, tess: 16, mat: 'metal' });
  k.cyl(towerD * 1.15, towerD * 1.15, 0.05, '#c9ced4', { x, y: 0.03, z, tess: 16 });
  const nl = towerD * 2.4;
  k.box(towerD * 0.85, towerD * 0.8, nl, color, { x, y: h + towerD * 0.1, z: z + towerD * 0.35, mat: 'metal' });
  k.cyl(towerD * 0.8, towerD * 0.85, towerD * 0.4, color, { x, y: h + towerD * 0.1, z: z + towerD * 0.35 + nl / 2, rx: PI / 2, tess: 12 });
  rotor(k, x, h + towerD * 0.1, z - towerD * 0.95, blades, bladeLen, towerD * 0.3, color, speed);
}

// Hiperbolik soğutma kulesi (buhar çıkarır)
export function coolingTower(k, x, z, h, r, hex = C.concrete) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    // hiperboloit: ortası dar, uçlara doğru açılır (boğaz ~%70 yükseklikte)
    const w = 0.66 + 0.34 * Math.pow(Math.abs(t - 0.72) / 0.72, 1.6);
    pts.push([r * w, t * h]);
  }
  k.lathe(pts, hex, { x, z, tess: 28 });
  k.cyl(r * 1.38, r * 1.38, 0.02, '#4a4a4a', { x, y: h + 0.005, z, tess: 28 });
  k.cyl(r * 1.42, r * 1.38, h * 0.06, '#b9b3a8', { x, y: h * 0.97, z, tess: 28 });
  // taban sütunları
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * PI * 2;
    k.box(0.04, 0.12, 0.04, '#9d978c', { x: x + Math.cos(a) * r * 0.98, z: z + Math.sin(a) * r * 0.98, y: 0.06 });
  }
  k.cyl(r * 2.05, r * 2.05, 0.05, '#a3a9b1', { x, y: 0.03, z, tess: 28 });
  k.emit('steam', x, h + 0.1, z);
}

// Baca: kırmızı-beyaz bantlı (duman çıkarır)
export function chimney(k, x, z, h, d, opts = {}) {
  const { smoke = 'smoke', bands = true, hex = C.concrete } = opts;
  k.cyl(d * 0.75, d, h, hex, { x, y: h / 2, z, tess: 14 });
  k.cyl(d * 0.8, d * 0.8, 0.03, '#3a3a3a', { x, y: h + 0.01, z, tess: 14 });
  if (bands) {
    k.cyl(d * 0.8, d * 0.82, h * 0.07, C.red, { x, y: h * 0.84, z, tess: 14 });
    k.cyl(d * 0.77, d * 0.78, h * 0.06, C.red, { x, y: h * 0.96, z, tess: 14 });
    k.cyl(d * 0.95, d * 0.95, 0.02, '#6b7480', { x, y: h * 0.7, z, tess: 14, mat: 'metal' });
  }
  if (smoke) k.emit(smoke, x, h + 0.05, z);
}

// Dikey tank + kubbe (metal)
export function tank(k, x, z, d, h, hex = C.white, opts = {}) {
  const tess = opts.tess ?? 18;
  k.cyl(d, d, h, hex, { x, y: h / 2, z, tess, mat: 'metal' });
  if (opts.dome !== false) k.dome(d, hex, { x, y: h, z, sy: 0.45, mat: 'metal' });
  else k.cyl(d * 1.02, d * 1.02, 0.03, '#9aa3ad', { x, y: h + 0.015, z, tess, mat: 'metal' });
  if (opts.band) k.cyl(d * 1.02, d * 1.02, h * 0.12, opts.band, { x, y: h * 0.75, z, tess });
  // merdiven
  k.box(0.03, h, 0.03, '#6b7480', { x: x + d / 2 + 0.01, y: h / 2, z });
}

// Küresel tank (LNG) ayaklı
export function sphereTank(k, x, z, d, hex = C.white) {
  const legH = d * 0.45;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    k.pole(x + Math.cos(a) * d * 0.4, z + Math.sin(a) * d * 0.4, 0, legH + d * 0.3, 0.05, C.steel);
  }
  k.sphere(d, hex, { x, y: legH + d / 2, z, seg: 16, mat: 'metal' });
  k.cyl(d * 1.02, d * 1.02, 0.04, '#9aa3ad', { x, y: legH + d / 2, z, tess: 18 });
}

// Pencere dokulu cephe UV'si
export function facadeUV(cols, rows, variant = 0) {
  const u0 = ((variant * 3) % CELLS) / CELLS;
  const v0 = ((variant * 5) % CELLS) / CELLS;
  const side = [u0, v0, u0 + cols / CELLS, v0 + rows / CELLS];
  const flat = [0.002, 0.002, 0.006, 0.006];
  return [side, side, side, side, flat, flat];
}

// Bina: gövde + çatı kenarı. windows verilirse gerçek pencere dokulu cephe (gece yanar)
export function building(k, x, z, w, d, h, hex = C.offwhite, roof = C.grey, opts = {}) {
  if (opts.windows) {
    const cols = Math.max(1, Math.round(Math.max(w, d) * 4));
    const rows = Math.max(1, h / 0.22);
    k.box(w, h, d, hex, { x, y: h / 2, z, mat: 'facade:office', uv: facadeUV(cols, rows, Math.round(x * 7 + z * 3)) });
  } else {
    k.box(w, h, d, hex, { x, y: h / 2, z });
  }
  k.box(w + 0.04, 0.05, d + 0.04, roof, { x, y: h + 0.025, z });
  if (w > 0.5 && d > 0.4) k.box(0.14, 0.07, 0.12, '#aeb6bf', { x: x + w * 0.25, y: h + 0.08, z, mat: 'metal' });
}

// Kafes kule (sondaj kulesi, pilon)
export function lattice(k, x, z, h, base, top, hex = C.steel) {
  const legs = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const lean = Math.atan2((base - top) / 2, h);
  for (const [sx, sz] of legs) {
    const mx = x + (sx * (base + top)) / 4;
    const mz = z + (sz * (base + top)) / 4;
    k.box(0.045, h / Math.cos(lean), 0.045, hex, { x: mx, y: h / 2, z: mz, rx: -sz * lean, rz: sx * lean, mat: 'metal' });
  }
  const steps = Math.max(2, Math.round(h / 0.45));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const y = t * h;
    const w = base + (top - base) * t;
    k.box(w, 0.03, 0.03, hex, { x, y, z: z - w / 2, mat: 'metal' });
    k.box(w, 0.03, 0.03, hex, { x, y, z: z + w / 2, mat: 'metal' });
    k.box(0.03, 0.03, w, hex, { x: x - w / 2, y, z, mat: 'metal' });
    k.box(0.03, 0.03, w, hex, { x: x + w / 2, y, z, mat: 'metal' });
  }
}

export function tree(k, x, z, s = 1) {
  k.cyl(0.05 * s, 0.07 * s, 0.25 * s, '#7a5434', { x, y: 0.125 * s, z, tess: 6 });
  k.sphere(0.3 * s, C.leaf, { x, y: 0.38 * s, z, ico: true, sub: 1 });
  k.sphere(0.22 * s, '#5aa64c', { x: x + 0.08 * s, y: 0.48 * s, z: z - 0.05 * s, ico: true, sub: 1 });
}

export function pile(k, x, z, w, h, hex = C.coal) {
  k.cyl(0, w, h, hex, { x, y: h / 2, z, tess: 7 });
}

// Uyarı ışığı (kırmızı parlayan nokta)
export function beacon(k, x, y, z, hex = G.red, d = 0.08) {
  k.sphere(d, hex, { x, y, z, glow: true, seg: 6 });
}

// Dönen soğutma fanı (çatıya), grup y ekseninde döner
export function fan(k, x, y, z, d, speed = 6) {
  k.cyl(d * 1.1, d * 1.1, 0.08, C.steel, { x, y: y - 0.02, z, tess: 16, mat: 'metal' });
  k.cyl(d * 0.95, d * 0.95, 0.01, '#2b2c33', { x, y: y + 0.02, z, tess: 16 });
  const g = k.group(x, y + 0.03, z, { type: 'spin', axis: 'y', speed });
  for (let i = 0; i < 3; i++) g.box(d * 0.9, 0.015, d * 0.18, C.dark, { ry: (i / 3) * PI });
  return g;
}

export function fence(k, s, hex = C.grey) {
  const e = s / 2 - 0.06;
  k.box(s - 0.12, 0.12, 0.02, hex, { y: 0.1, z: -e, mat: 'metal' });
  k.box(s - 0.12, 0.12, 0.02, hex, { y: 0.1, z: e, mat: 'metal' });
  k.box(0.02, 0.12, s - 0.12, hex, { y: 0.1, x: -e, mat: 'metal' });
  k.box(0.02, 0.12, s - 0.12, hex, { y: 0.1, x: e, mat: 'metal' });
}

// Reaktör muhafaza kubbesi
export function containment(k, x, z, d, h, hex = C.offwhite) {
  k.cyl(d, d, h, hex, { x, y: h / 2, z, tess: 24 });
  k.dome(d, hex, { x, y: h, z, seg: 16 });
  k.cyl(d * 1.04, d * 1.04, 0.06, C.grey, { x, y: 0.03, z, tess: 24 });
  k.cyl(d * 1.01, d * 1.01, 0.04, '#b9b3a8', { x, y: h, z, tess: 24 });
}

export { PI };
