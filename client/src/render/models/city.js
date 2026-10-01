// Şehir binaları, merkez simgeleri (landmark), belediye binası ve arabalar
import { C, G } from './palette.js';
import { PI, building, tree, chimney, beacon } from './helpers.js';

export const FLOOR_H = 0.2;
export const TOWER_FLOORS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32];

const RES_COLORS = ['#f2e3c9', '#e8cfc0', '#d9e4ea', '#f0d9a8', '#e6e0f0', '#cfe3cf'];
const OFFICE_COLORS = ['#a9c7df', '#8fb3cf', '#b7c4d6', '#9fd0d8'];

// Kule gövdesi: kat sayısı kadar pencere şeridi. style: 'res' | 'office'
export function towerModel(floors, style, variant) {
  return (k) => {
    const h = floors * FLOOR_H;
    const body = style === 'office' ? OFFICE_COLORS[variant % OFFICE_COLORS.length] : RES_COLORS[variant % RES_COLORS.length];
    k.box(1, h, 1, body, { y: h / 2 });
    for (let f = 0; f < floors; f++) {
      const y = f * FLOOR_H + FLOOR_H * 0.55;
      k.box(1.01, FLOOR_H * 0.42, style === 'office' ? 1.01 : 0.7, G.window, { y, glow: true });
      if (style !== 'office') k.box(0.7, FLOOR_H * 0.42, 1.01, G.window, { y, glow: true });
    }
    k.box(1.04, 0.05, 1.04, style === 'office' ? C.steel : C.grey, { y: h + 0.025 });
    if (floors >= 6) k.box(0.4, 0.12, 0.3, C.grey, { y: h + 0.1, x: 0.15 });
  };
}

export function houseModel(variant) {
  return (k) => {
    const wall = RES_COLORS[variant % RES_COLORS.length];
    const roof = [C.red, C.brick, C.blue, C.darkLeaf][variant % 4];
    k.box(0.8, 0.32, 0.65, wall, { y: 0.16 });
    k.box(0.5, 0.08, 0.66, G.window, { y: 0.18, glow: true });
    // üçgen çatı: döndürülmüş 3 kenarlı silindir
    k.cyl(0.62, 0.62, 0.9, roof, { tess: 3, rz: PI / 2, y: 0.43, sz: 1.25, sx: 0.7 });
    k.box(0.08, 0.18, 0.08, C.brick, { x: 0.22, y: 0.55, z: 0.1 });
  };
}

export function shopModel(variant) {
  return (k) => {
    const wall = RES_COLORS[(variant + 2) % RES_COLORS.length];
    k.box(0.85, 0.44, 0.8, wall, { y: 0.22 });
    k.box(0.86, 0.14, 0.81, G.window, { y: 0.12, glow: true });
    k.box(0.9, 0.04, 0.3, [C.red, C.teal, C.orange, C.purple][variant % 4], { y: 0.24, z: -0.5, rx: 0.3 });
    k.box(0.88, 0.05, 0.83, C.grey, { y: 0.46 });
  };
}

export function spireModel(k) {
  k.cyl(0.05, 0.25, 1.2, C.steel, { y: 0.6, tess: 6 });
  beacon(k, 0, 1.25, 0, G.red, 0.1);
}

export function carModel(variant) {
  const body = [C.red, C.blue, C.yellow, C.white, C.teal, C.orange][variant % 6];
  return (k) => {
    k.box(0.28, 0.08, 0.14, body, { y: 0.07 });
    k.box(0.15, 0.07, 0.12, body, { y: 0.14, x: -0.02 });
    k.box(0.16, 0.05, 0.125, G.window, { y: 0.14, x: -0.02, glow: true });
  };
}

export function cityHallModel(k) {
  k.box(1.7, 0.08, 1.7, C.concrete, { y: 0.04 });
  k.box(1.2, 0.55, 0.9, C.white, { y: 0.35 });
  for (let i = 0; i < 6; i++) k.cyl(0.08, 0.08, 0.5, C.offwhite, { x: -0.5 + i * 0.2, y: 0.33, z: -0.5, tess: 6 });
  k.box(1.3, 0.08, 1.0, C.offwhite, { y: 0.66 });
  k.cyl(0.55, 0.6, 0.25, C.white, { y: 0.82, tess: 12 });
  k.dome(0.6, C.gold, { y: 0.94 });
  k.pole(0, 0, 1.2, 1.55, 0.03, C.steel);
  k.box(0.22, 0.13, 0.01, C.red, { x: 0.12, y: 1.47 });
  k.box(1.2, 0.06, 0.88, G.window, { y: 0.45, glow: true });
}

// Merkez simgeleri (2x2 karo alanına sığar, ortalı)
export const LANDMARKS = {
  residential(k) {
    k.box(1.7, 0.06, 1.7, C.green, { y: 0.03 });
    for (const [x, z, h] of [[-0.4, -0.4, 1.6], [0.4, -0.4, 1.2], [-0.4, 0.4, 1.0], [0.4, 0.4, 1.4]]) {
      building(k, x, z, 0.62, 0.62, h, '#f2d7b6', C.brick, { windows: G.window });
    }
  },
  commerce(k) {
    k.box(1.7, 0.06, 1.7, C.concrete, { y: 0.03 });
    k.box(1.4, 0.5, 1.4, '#b9dbe9', { y: 0.25 });
    k.box(1.41, 0.12, 1.41, G.window, { y: 0.3, glow: true });
    k.box(0.8, 1.6, 0.8, '#8fc0e0', { y: 1.3 });
    for (let f = 0; f < 6; f++) k.box(0.81, 0.1, 0.81, G.window, { y: 0.65 + f * 0.25, glow: true });
    k.box(0.6, 0.12, 0.62, C.yellow, { y: 0.6, z: -0.72 });
    beacon(k, 0, 2.2, 0, G.cyan, 0.1);
  },
  park(k) {
    k.box(1.8, 0.06, 1.8, C.green, { y: 0.03 });
    k.cyl(0.6, 0.6, 0.06, C.water, { y: 0.07, tess: 12 });
    k.cyl(0.12, 0.16, 0.25, C.concrete, { y: 0.15, tess: 8 });
    for (const [x, z, s] of [[-0.6, -0.6, 1.4], [0.6, -0.6, 1.1], [-0.6, 0.6, 1.2], [0.65, 0.6, 1.5], [0, -0.75, 0.9], [-0.75, 0, 1]]) tree(k, x, z, s);
  },
  industry(k) {
    k.box(1.8, 0.06, 1.8, C.gravel, { y: 0.03 });
    building(k, -0.2, 0.2, 1.2, 1.0, 0.6, C.grey, C.dark);
    for (let i = 0; i < 3; i++) k.box(0.36, 0.2, 1.0, C.steel, { x: -0.6 + i * 0.4, y: 0.7, z: 0.2, rz: 0.4 });
    chimney(k, 0.6, -0.55, 1.6, 0.16, { smoke: 'lightsmoke' });
    k.box(0.4, 0.25, 0.3, C.hazard, { x: -0.5, y: 0.13, z: -0.6 });
  },
  health(k) {
    k.box(1.8, 0.06, 1.8, C.concrete, { y: 0.03 });
    building(k, 0, 0.1, 1.4, 1.0, 1.0, C.white, C.grey, { windows: G.window });
    k.box(0.12, 0.4, 0.04, C.red, { y: 0.75, z: -0.42 });
    k.box(0.4, 0.12, 0.04, C.red, { y: 0.75, z: -0.42 });
    k.cyl(0.5, 0.5, 0.04, C.dark, { y: 1.05, z: 0.1, tess: 10 });
    k.box(0.22, 0.02, 0.06, C.white, { y: 1.08, z: 0.1 });
  },
  education(k) {
    k.box(1.8, 0.06, 1.8, C.green, { y: 0.03 });
    k.box(1.5, 0.6, 0.7, '#e9d9bd', { y: 0.3, z: 0.3 });
    k.box(1.51, 0.12, 0.71, G.window, { y: 0.35, z: 0.3, glow: true });
    k.cyl(0.6, 0.6, 0.35, '#e9d9bd', { y: 0.78, z: 0.3, tess: 12 });
    k.dome(0.6, C.teal, { y: 0.95, z: 0.3 });
    k.box(0.3, 1.3, 0.3, '#e9d9bd', { x: 0.6, y: 0.65, z: -0.5 });
    k.cyl(0.0, 0.34, 0.35, C.teal, { x: 0.6, y: 1.47, z: -0.5, tess: 4, ry: PI / 4 });
    tree(k, -0.55, -0.5, 1);
  },
  entertainment(k) {
    k.box(1.85, 0.06, 1.85, C.concrete, { y: 0.03 });
    k.lathe([[0.85, 0], [0.88, 0.45], [0.62, 0.5], [0.55, 0.06]], C.white, { sz: 0.8, tess: 18, flat: true });
    k.cyl(1.0, 1.0, 0.04, C.green, { y: 0.07, sz: 0.8, tess: 18 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      k.pole(Math.cos(a) * 0.85, Math.sin(a) * 0.68, 0, 0.9, 0.04, C.steel);
      k.box(0.16, 0.1, 0.04, G.white, { x: Math.cos(a) * 0.85, y: 0.92, z: Math.sin(a) * 0.68, glow: true });
    }
  },
  transport(k) {
    k.box(1.85, 0.06, 1.85, C.dark, { y: 0.03 });
    k.box(1.6, 0.02, 0.25, C.white, { y: 0.07, z: -0.55 });
    building(k, -0.2, 0.35, 1.2, 0.7, 0.4, '#d8e6f0', C.steel, { windows: G.window });
    k.cyl(0.18, 0.22, 1.3, C.offwhite, { x: 0.65, y: 0.65, z: 0.4, tess: 8 });
    k.cyl(0.42, 0.3, 0.25, '#9fd3f0', { x: 0.65, y: 1.4, z: 0.4, tess: 8 });
    beacon(k, 0.65, 1.6, 0.4, G.red, 0.08);
    // dönen radar
    const r = k.group(0.65, 1.62, 0.4, { type: 'spin', axis: 'y', speed: 2 });
    r.box(0.4, 0.06, 0.04, C.white);
    // uçak
    k.box(0.7, 0.1, 0.1, C.white, { x: -0.2, y: 0.15, z: -0.3 });
    k.box(0.14, 0.03, 0.7, C.white, { x: -0.18, y: 0.15, z: -0.3 });
    k.box(0.1, 0.18, 0.03, C.red, { x: -0.52, y: 0.22, z: -0.3 });
  },
};

export function crownModel(k) {
  const g = k.group(0, 0, 0, { type: 'spin', axis: 'y', speed: 1.2 });
  g.torus(1.1, 0.04, G.sun, { glow: true, tess: 20 });
}
