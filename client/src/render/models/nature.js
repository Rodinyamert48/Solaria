// Doğa ve çevre modelleri: ağaçlar, çalılar, kayalar, çit, sokak lambası, ada gövdesi
import { C } from './palette.js';
import { PI } from './helpers.js';
import { WATERFALL } from '../island.js';

const LEAVES = ['#4f9d57', '#5aa64c', '#3f8a4a', '#6aae4e', '#478f3f'];

function rnd(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Yaprak döken ağaç: gövde + 3-4 iç içe yaprak kümesi
export function oak(k, x, z, s = 1, seed = 1) {
  const r = rnd(seed);
  k.cyl(0.07 * s, 0.11 * s, 0.42 * s, '#7a5434', { x, z, y: 0.21 * s, tess: 6 });
  const base = LEAVES[seed % LEAVES.length];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + r();
    const d = i === 0 ? 0 : 0.13 * s;
    k.sphere((0.42 + r() * 0.16) * s, i === 0 ? base : LEAVES[(seed + i) % LEAVES.length], {
      ico: true, sub: 1, x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, y: (0.55 + (i === 0 ? 0.12 : r() * 0.08)) * s, sy: 0.9,
    });
  }
}

// Çam: kat kat koniler
export function pine(k, x, z, s = 1, seed = 1) {
  k.cyl(0.05 * s, 0.08 * s, 0.3 * s, '#6b4a2e', { x, z, y: 0.15 * s, tess: 6 });
  const greens = ['#2f6e3f', '#2a6438', '#357a44'];
  for (let i = 0; i < 3; i++) {
    const w = (0.5 - i * 0.12) * s;
    k.cyl(0, w, 0.36 * s, greens[(seed + i) % 3], { x, z, y: (0.38 + i * 0.2) * s, tess: 7 });
  }
}

// Huş: beyaz gövde, açık yeşil tepe
export function birch(k, x, z, s = 1, seed = 1) {
  k.cyl(0.045 * s, 0.06 * s, 0.6 * s, '#ece8df', { x, z, y: 0.3 * s, tess: 6 });
  k.box(0.07 * s, 0.03 * s, 0.07 * s, '#3b3b3b', { x, z, y: 0.22 * s });
  k.box(0.07 * s, 0.025 * s, 0.07 * s, '#3b3b3b', { x, z, y: 0.4 * s });
  k.sphere(0.36 * s, seed % 2 ? '#8cc65a' : '#9ccf63', { ico: true, sub: 1, x, z, y: 0.72 * s, sy: 1.25 });
}

export function bush(k, x, z, s = 1, seed = 1) {
  const r = rnd(seed + 5);
  for (let i = 0; i < 3; i++) {
    k.sphere((0.2 + r() * 0.12) * s, LEAVES[(seed + i) % LEAVES.length], {
      ico: true, sub: 1, x: x + (r() - 0.5) * 0.3 * s, z: z + (r() - 0.5) * 0.3 * s, y: 0.1 * s, sy: 0.75,
    });
  }
}

// tree:0..4 -> farklı türler / kümeler
export function treeVariant(k, variant) {
  switch (variant % 5) {
    case 0:
      oak(k, 0, 0, 1.1, 1);
      break;
    case 1:
      oak(k, -0.18, 0.05, 0.9, 2);
      oak(k, 0.2, -0.1, 1.05, 3);
      break;
    case 2:
      pine(k, -0.15, 0, 1.15, 1);
      pine(k, 0.2, 0.15, 0.85, 2);
      break;
    case 3:
      birch(k, -0.15, 0.1, 1, 1);
      birch(k, 0.18, -0.12, 0.85, 2);
      bush(k, 0.1, 0.25, 0.7, 3);
      break;
    default:
      pine(k, 0, 0, 1.35, 3);
  }
}

export function bushModel(k) {
  bush(k, -0.15, 0, 1, 1);
  bush(k, 0.2, 0.1, 0.8, 4);
}

export function rockModel(k) {
  k.sphere(0.55, C.rock, { ico: true, sub: 0, sy: 0.6, y: 0.12 });
  k.sphere(0.3, C.grey, { ico: true, sub: 0, x: 0.25, z: 0.15, y: 0.08 });
}

// Bir karo uzunluğunda ahşap çit (x ekseninde)
export function fenceModel(k) {
  for (const x of [-0.5, 0]) k.box(0.06, 0.32, 0.06, '#8a6440', { x, y: 0.16 });
  k.box(1.0, 0.04, 0.03, '#a07850', { y: 0.24 });
  k.box(1.0, 0.04, 0.03, '#a07850', { y: 0.12 });
}

// Sokak lambası: gece yanar ('lamp' malzemesi)
export function lampModel(k) {
  k.cyl(0.035, 0.05, 0.75, '#3d434d', { y: 0.375, tess: 8, mat: 'metal' });
  k.box(0.22, 0.03, 0.04, '#3d434d', { x: 0.1, y: 0.75, mat: 'metal' });
  k.box(0.1, 0.04, 0.08, '#fff3d6', { x: 0.19, y: 0.72, mat: 'lamp' });
}

// Havada süzülen ada gövdesi: çim kenarı, toprak katmanları, kaya taban, kökler ve şelale
export function islandModel(k) {
  k.box(30, 0.42, 30, '#5f9e45', { y: -0.21, ao: false });
  k.box(29.9, 0.9, 29.9, '#8b5e3c', { y: -0.85, ao: false });
  k.box(29.75, 0.25, 29.75, '#a8754a', { y: -1.42, ao: false });
  k.box(29.5, 1.2, 29.5, '#7a5236', { y: -2.15, ao: false });
  k.cyl(40.5, 7, 12, '#8a8178', { y: -8.75, tess: 4, ry: PI / 4, ao: false });
  k.cyl(34, 9, 7, '#7b736b', { y: -8, tess: 6, ry: 0.4, ao: false });
  k.cyl(11, 2, 6, '#6f675f', { y: -16.5, x: 3, z: -2, tess: 5, ao: false });
  k.cyl(7, 1.5, 4, '#77706a', { y: -15.2, x: -6, z: 5, tess: 5, ao: false });
  // kenar kayaları
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * PI * 2;
    k.sphere(1.8 + (i % 3) * 0.7, i % 2 ? '#8a8178' : '#978d83', {
      ico: true, sub: 0, x: Math.cos(a) * 12.5, z: Math.sin(a) * 12.5, y: -4.4 - (i % 4), sy: 0.75, ao: false,
    });
  }
  // şelale: kayadan çıkan su perdesi
  const W = WATERFALL;
  k.box(0.5, 0.4, 2.4, '#6f675f', { x: W.x - 0.1, y: W.top - 0.1, z: W.z, ao: false });
  k.box(0.16, W.top - W.bottom, 1.6, '#8fd0f5', { x: W.x + 0.15, y: (W.top + W.bottom) / 2, z: W.z, mat: 'water', ao: false });
  k.box(0.1, W.top - W.bottom, 0.5, '#e8f6ff', { x: W.x + 0.24, y: (W.top + W.bottom) / 2 - 0.4, z: W.z + 0.3, mat: 'water', ao: false });
}
