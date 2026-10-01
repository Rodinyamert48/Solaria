// Tekrar kullanılan model parçaları
import { C, G } from './palette.js';

const PI = Math.PI;

// Zemin plakası (ayak izi boyunca)
export function pad(k, s, hex = C.gravel, h = 0.06) {
  k.box(s - 0.1, h, s - 0.1, hex, { y: h / 2 });
}

export function water(k, w, d, x = 0, z = 0, y = 0.07, hex = C.water) {
  k.box(w, 0.06, d, hex, { x, y, z, shade: 0.25 });
}

// Tek güneş paneli: direk + eğimli panel + çerçeve
export function solarPanel(k, x, z, w, d, h, tilt = 0.5) {
  k.pole(x, z, 0, h, 0.05, C.steel);
  k.box(w + 0.04, 0.025, d + 0.04, C.white, { x, y: h - 0.02, z, rx: tilt });
  k.box(w, 0.03, d, C.panel, { x, y: h, z, rx: tilt, shade: 0.4 });
}

// Pervane (kanat sayısı n). Grup z ekseninde döner; kanatlar XY düzleminde.
export function rotor(k, x, y, z, n, len, width, hex = C.white, speed = 2.5) {
  const g = k.group(x, y, z, { type: 'spin', axis: 'z', speed, driver: 'wind' });
  g.sphere(width * 2.2, hex, { seg: 6 });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    g.box(width, len, width * 0.3, hex, {
      x: (Math.sin(a) * len) / 2,
      y: (Math.cos(a) * len) / 2,
      rz: -a,
    });
  }
  return g;
}

// Klasik rüzgar türbini kulesi + gövde + pervane
export function windTurbine(k, h, bladeLen, towerD, speed, opts = {}) {
  const { x = 0, z = 0, color = C.white, blades = 3 } = opts;
  k.cyl(towerD * 0.55, towerD, h, color, { x, y: h / 2, z, tess: 10 });
  k.box(towerD * 0.9, towerD * 0.8, towerD * 2.2, color, { x, y: h, z: z + towerD * 0.3 });
  rotor(k, x, h, z - towerD * 0.85, blades, bladeLen, towerD * 0.32, color, speed);
}

// Hiperbolik soğutma kulesi (buhar çıkarır)
export function coolingTower(k, x, z, h, r, hex = C.concrete) {
  k.lathe(
    [
      [r, 0],
      [r * 0.82, h * 0.35],
      [r * 0.66, h * 0.75],
      [r * 0.7, h],
    ],
    hex,
    { x, z, tess: 14 },
  );
  k.cyl(r * 1.3, r * 1.3, 0.02, C.dark, { x, y: h + 0.005, z, tess: 14 });
  k.cyl(r * 2.05, r * 2.05, 0.05, C.grey, { x, y: 0.05, z, tess: 14 });
  k.emit('steam', x, h + 0.1, z);
}

// Baca: kırmızı-beyaz bantlı (duman çıkarır)
export function chimney(k, x, z, h, d, opts = {}) {
  const { smoke = 'smoke', bands = true, hex = C.concrete } = opts;
  k.cyl(d * 0.75, d, h, hex, { x, y: h / 2, z, tess: 8 });
  if (bands) {
    k.cyl(d * 0.8, d * 0.82, h * 0.07, C.red, { x, y: h * 0.84, z, tess: 8 });
    k.cyl(d * 0.77, d * 0.78, h * 0.06, C.red, { x, y: h * 0.96, z, tess: 8 });
  }
  if (smoke) k.emit(smoke, x, h + 0.05, z);
}

// Dikey tank + kubbe
export function tank(k, x, z, d, h, hex = C.white, opts = {}) {
  k.cyl(d, d, h, hex, { x, y: h / 2, z, tess: opts.tess ?? 12 });
  if (opts.dome !== false) k.dome(d, hex, { x, y: h, z });
  if (opts.band) k.cyl(d * 1.02, d * 1.02, h * 0.12, opts.band, { x, y: h * 0.75, z, tess: opts.tess ?? 12 });
}

// Küresel tank (LNG) ayaklı
export function sphereTank(k, x, z, d, hex = C.white) {
  const legH = d * 0.45;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + PI / 4;
    k.pole(x + Math.cos(a) * d * 0.35, z + Math.sin(a) * d * 0.35, 0, legH + d * 0.3, 0.06, C.steel);
  }
  k.sphere(d, hex, { x, y: legH + d / 2, z, seg: 8 });
}

// Basit bina: gövde + çatı kenarı
export function building(k, x, z, w, d, h, hex = C.offwhite, roof = C.grey, opts = {}) {
  k.box(w, h, d, hex, { x, y: h / 2, z });
  k.box(w + 0.04, 0.05, d + 0.04, roof, { x, y: h + 0.025, z });
  if (opts.windows) {
    // pencere şeridi (gece parlar)
    const rows = Math.max(1, Math.floor(h / 0.35));
    for (let r = 0; r < rows; r++) {
      const y = 0.22 + r * 0.32;
      if (y > h - 0.1) break;
      k.box(w * 0.8, 0.08, d + 0.01, opts.windows, { x, y, z, glow: true });
    }
  }
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
    k.box(0.05, h / Math.cos(lean), 0.05, hex, { x: mx, y: h / 2, z: mz, rx: -sz * lean, rz: sx * lean });
  }
  const steps = Math.max(2, Math.round(h / 0.6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const y = t * h;
    const w = base + (top - base) * t;
    k.box(w, 0.035, 0.035, hex, { x, y, z: z - w / 2 });
    k.box(w, 0.035, 0.035, hex, { x, y, z: z + w / 2 });
    k.box(0.035, 0.035, w, hex, { x: x - w / 2, y, z });
    k.box(0.035, 0.035, w, hex, { x: x + w / 2, y, z });
  }
}

export function tree(k, x, z, s = 1) {
  k.cyl(0.05 * s, 0.07 * s, 0.25 * s, C.brown, { x, y: 0.125 * s, z, tess: 5 });
  k.sphere(0.36 * s, C.leaf, { x, y: 0.38 * s, z, ico: true, sub: 0 });
}

export function pile(k, x, z, w, h, hex = C.coal) {
  k.cyl(0, w, h, hex, { x, y: h / 2, z, tess: 6 });
}

// Uyarı ışığı (kırmızı parlayan nokta)
export function beacon(k, x, y, z, hex = G.red, d = 0.08) {
  k.sphere(d, hex, { x, y, z, glow: true, seg: 4 });
}

// Dönen soğutma fanı (çatıya), grup y ekseninde döner
export function fan(k, x, y, z, d, speed = 6) {
  k.cyl(d * 1.1, d * 1.1, 0.08, C.steel, { x, y: y - 0.02, z, tess: 10 });
  const g = k.group(x, y + 0.03, z, { type: 'spin', axis: 'y', speed });
  for (let i = 0; i < 3; i++) g.box(d * 0.9, 0.015, d * 0.18, C.dark, { ry: (i / 3) * PI });
  return g;
}

export function fence(k, s, hex = C.grey) {
  const e = s / 2 - 0.06;
  k.box(s - 0.12, 0.12, 0.02, hex, { y: 0.1, z: -e });
  k.box(s - 0.12, 0.12, 0.02, hex, { y: 0.1, z: e });
  k.box(0.02, 0.12, s - 0.12, hex, { y: 0.1, x: -e });
  k.box(0.02, 0.12, s - 0.12, hex, { y: 0.1, x: e });
}

// Reaktör muhafaza kubbesi
export function containment(k, x, z, d, h, hex = C.offwhite) {
  k.cyl(d, d, h, hex, { x, y: h / 2, z, tess: 16 });
  k.dome(d, hex, { x, y: h, z, seg: 10 });
  k.cyl(d * 1.04, d * 1.04, 0.06, C.grey, { x, y: 0.03, z, tess: 16 });
}

export { PI };
