// 63 jeneratörün prosedürel modelleri. Her model ayak izi (s×s karo) ortalı, zemin y=0.
import { C, G } from './palette.js';
import {
  PI, pad, water, solarPanel, rotor, windTurbine, coolingTower, chimney, tank, sphereTank,
  building, lattice, tree, pile, beacon, fan, fence, containment,
} from './helpers.js';

export const MODELS = {
  // ─────────────── ☀️ GÜNEŞ ───────────────
  solar_panel(k) {
    pad(k, 1, C.green);
    solarPanel(k, 0, 0, 0.72, 0.5, 0.38, 0.55);
  },

  solar_array(k) {
    pad(k, 1);
    for (const x of [-0.21, 0.21]) for (const z of [-0.2, 0.2]) solarPanel(k, x, z, 0.38, 0.32, 0.28, 0.5);
  },

  solar_farm(k) {
    pad(k, 2, C.green);
    for (let r = 0; r < 3; r++) {
      const z = -0.6 + r * 0.6;
      k.box(1.78, 0.025, 0.46, C.white, { y: 0.3, z, rx: 0.5 });
      k.box(1.74, 0.03, 0.42, C.panel, { y: 0.32, z, rx: 0.5, shade: 0.4 });
      for (const x of [-0.75, 0, 0.75]) k.pole(x, z, 0, 0.3, 0.05, C.steel);
    }
  },

  solar_trough(k) {
    pad(k, 2);
    for (let r = 0; r < 3; r++) {
      const z = -0.62 + r * 0.62;
      const g = k.group(0, 0.38, z, { type: 'track', axis: 'x', amp: 0.6 });
      g.cyl(0.46, 0.46, 1.75, C.mirror, { rz: PI / 2, rx: PI, arc: 0.5, tess: 12, smooth: true });
      g.cyl(0.04, 0.04, 1.8, G.hot, { rz: PI / 2, y: 0.14, glow: true, tess: 6 });
      k.pole(-0.8, z, 0, 0.36, 0.06, C.steel);
      k.pole(0.8, z, 0, 0.36, 0.06, C.steel);
    }
  },

  solar_dish(k) {
    pad(k, 2);
    for (const [x, z] of [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]]) {
      k.pole(x, z, 0, 0.5, 0.08, C.steel);
      const g = k.group(x, 0.55, z, { type: 'track', axis: 'x', amp: 0.5 });
      g.cyl(0.78, 0.08, 0.16, C.mirror, { rx: -0.6, tess: 12 });
      g.pole(0, 0.18, 0.05, 0.3, 0.03, C.grey);
      g.sphere(0.1, G.sun, { y: 0.32, z: -0.15, glow: true });
    }
  },

  solar_tower(k) {
    pad(k, 3, C.gravel);
    k.cyl(0.32, 0.5, 3.6, C.concrete, { y: 1.8, tess: 10 });
    k.cyl(0.6, 0.6, 0.4, C.dark, { y: 3.65, tess: 10 });
    k.cyl(0.52, 0.52, 0.34, G.sun, { y: 3.65, glow: true, tess: 10 });
    k.cyl(0.3, 0.3, 0.3, C.concrete, { y: 4, tess: 10 });
    beacon(k, 0, 4.2, 0);
    building(k, 0.9, 0.9, 0.5, 0.4, 0.35, C.offwhite);
    for (const [ring, n] of [[0.85, 10], [1.25, 16]]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * PI * 2 + ring;
        const x = Math.cos(a) * ring;
        const z = Math.sin(a) * ring;
        if (x > 0.6 && z > 0.6) continue;
        k.pole(x, z, 0, 0.18, 0.04, C.steel);
        k.box(0.26, 0.02, 0.22, C.mirror, { x, y: 0.2, z, ry: -a + PI / 2, rx: 0.5 });
      }
    }
  },

  solar_orbital(k) {
    pad(k, 3, C.green);
    // rectenna ızgarası
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        if (Math.abs(i) < 1 && Math.abs(j) < 1) continue;
        k.box(0.4, 0.02, 0.4, C.dark, { x: i * 0.52, y: 0.22, z: j * 0.52, rx: 0.15 });
        k.pole(i * 0.52, j * 0.52, 0, 0.21, 0.03, C.steel);
      }
    }
    k.cyl(1.1, 0.5, 0.35, C.white, { y: 0.4, tess: 14 });
    k.cyl(0.4, 0.4, 0.2, G.sun, { y: 0.62, glow: true, tess: 12 });
    k.cyl(0.32, 0.32, 26, G.sun, { y: 13.6, glow: true, alpha: 0.28, tess: 10 });
    const g = k.group(0, 0.9, 0, { type: 'spin', axis: 'y', speed: 0.8 });
    g.torus(0.9, 0.04, G.cyan, { glow: true });
  },

  // ─────────────── 🌬️ RÜZGAR ───────────────
  wind_mini(k) {
    pad(k, 1, C.green);
    windTurbine(k, 1.4, 0.55, 0.12, 4.5);
  },

  wind_vertical(k) {
    pad(k, 1, C.gravel);
    k.cyl(0.3, 0.36, 0.12, C.grey, { y: 0.06, tess: 8 });
    k.pole(0, 0, 0.1, 1.6, 0.06, C.steel);
    const g = k.group(0, 0.95, 0, { type: 'spin', axis: 'y', speed: 2.5, driver: 'wind' });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      g.box(0.06, 1.0, 0.2, C.white, { x: Math.cos(a) * 0.28, z: Math.sin(a) * 0.28, ry: -a + 0.5 });
      g.box(0.56, 0.03, 0.03, C.steel, { x: Math.cos(a) * 0.14, z: Math.sin(a) * 0.14, ry: -a, y: 0.4 });
      g.box(0.56, 0.03, 0.03, C.steel, { x: Math.cos(a) * 0.14, z: Math.sin(a) * 0.14, ry: -a, y: -0.4 });
    }
  },

  wind_turbine(k) {
    pad(k, 1, C.green);
    windTurbine(k, 2.7, 1.0, 0.18, 2.6);
    beacon(k, 0, 2.86, 0.05);
  },

  wind_large(k) {
    pad(k, 2, C.green);
    k.cyl(0.9, 0.9, 0.12, C.concrete, { y: 0.1, tess: 10 });
    windTurbine(k, 4.4, 1.75, 0.3, 1.8);
    beacon(k, 0, 4.65, 0.1);
    tree(k, 0.65, 0.6, 1.1);
    tree(k, -0.7, 0.5, 0.9);
  },

  wind_offshore(k) {
    water(k, 1.9, 1.9, 0, 0, 0.05, C.deepWater);
    k.cyl(0.36, 0.42, 0.5, C.hazard, { y: 0.3, tess: 10 });
    k.cyl(1.0, 1.0, 0.06, C.grey, { y: 0.55, tess: 10 });
    k.box(0.3, 0.25, 0.3, C.white, { x: 0.32, y: 0.7, z: 0.2 });
    k.group(0, 0.07, 0, { type: 'bob', amp: 0.02, speed: 1.2 }).torus(0.9, 0.05, C.white, { tess: 12 });
    k.cyl(0.18, 0.3, 3.8, C.white, { y: 2.45, tess: 10 });
    k.box(0.28, 0.24, 0.62, C.white, { y: 4.35, z: 0.1 });
    rotor(k, 0, 4.35, -0.26, 3, 1.65, 0.1, C.white, 1.9);
    beacon(k, 0, 4.52, 0.12);
  },

  wind_mega(k) {
    pad(k, 3, C.green);
    k.cyl(1.4, 1.5, 0.18, C.concrete, { y: 0.1, tess: 12 });
    k.cyl(0.3, 0.55, 6.8, C.white, { y: 3.5, tess: 12 });
    k.cyl(0.6, 0.6, 0.1, C.red, { y: 1.2, tess: 12 });
    k.box(0.48, 0.42, 1.1, C.white, { y: 6.95, z: 0.15 });
    rotor(k, 0, 6.95, -0.48, 3, 2.9, 0.18, C.white, 1.1);
    beacon(k, 0, 7.25, 0.2, G.red, 0.12);
    building(k, 1.0, 1.0, 0.5, 0.4, 0.3, C.offwhite);
  },

  // ─────────────── 💧 HİDRO ───────────────
  hydro_wheel(k) {
    pad(k, 1, C.green);
    k.box(0.32, 0.12, 1.0, C.rock, { x: 0.15, y: 0.06 });
    water(k, 0.26, 1.0, 0.15, 0, 0.1);
    k.box(0.38, 0.4, 0.42, C.wood, { x: -0.25, y: 0.2, z: 0.1 });
    k.box(0.44, 0.06, 0.48, C.red, { x: -0.25, y: 0.42, z: 0.1, rz: 0.12 });
    k.pipe(-0.05, 0, 0.32, 0, 0.42, 0.05, C.dark);
    const g = k.group(0.15, 0.42, 0, { type: 'spin', axis: 'x', speed: 1.5 });
    g.torus(0.68, 0.05, C.wood, { rz: PI / 2, tess: 12 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      g.box(0.18, 0.04, 0.16, C.wood, { y: Math.sin(a) * 0.3, z: Math.cos(a) * 0.3, rx: -a });
    }
  },

  hydro_micro(k) {
    pad(k, 1, C.green);
    k.cyl(0.6, 0.9, 0.5, C.leaf, { x: 0.15, z: 0.2, y: 0.25, tess: 7 });
    k.pipe(0.15, 0.2, -0.2, -0.25, 0.28, 0.08, C.steel, { rx: PI / 2 - 0.4 });
    building(k, -0.22, -0.22, 0.4, 0.36, 0.3, C.offwhite, C.blue);
    water(k, 0.24, 0.5, 0.25, -0.25, 0.08);
  },

  hydro_river(k) {
    pad(k, 2, C.green);
    k.box(1.9, 0.1, 0.7, C.rock, { y: 0.05 });
    water(k, 1.9, 0.6, 0, 0, 0.11);
    building(k, 0, 0, 0.8, 0.95, 0.55, C.concrete, C.dark, { windows: G.window });
    k.box(0.9, 0.12, 1.0, C.grey, { y: 0.62 });
    lattice(k, 0.65, 0.65, 1.2, 0.3, 0.1);
    k.group(-0.65, 0.12, 0, { type: 'bob', amp: 0.01, speed: 2 }).box(0.2, 0.02, 0.5, G.cyan, { glow: true, alpha: 0.5 });
  },

  hydro_wave(k) {
    pad(k, 2, C.rock);
    water(k, 1.8, 1.8, 0, 0, 0.08, C.deepWater);
    for (let i = 0; i < 5; i++) {
      const x = -0.6 + (i % 3) * 0.6;
      const z = i < 3 ? -0.4 : 0.4;
      const g = k.group(x + (i >= 3 ? 0.3 : 0), 0.12, z, { type: 'bob', amp: 0.06, speed: 1.6 });
      g.cyl(0.32, 0.32, 0.14, C.hazard, { tess: 10 });
      g.cyl(0.1, 0.1, 0.18, C.dark, { y: 0.12, tess: 6 });
    }
    k.box(0.5, 0.3, 0.3, C.offwhite, { x: 0.65, y: 0.2, z: 0.75 });
    beacon(k, -0.8, 0.4, 0.8, G.cyan);
    k.pole(-0.8, 0.8, 0, 0.36, 0.04, C.steel);
  },

  hydro_tidal(k) {
    pad(k, 3, C.rock);
    water(k, 2.9, 1.3, 0, -0.75, 0.12, C.deepWater);
    water(k, 2.9, 1.3, 0, 0.75, 0.06, C.water);
    k.box(2.9, 0.42, 0.36, C.concrete, { y: 0.21 });
    k.box(2.9, 0.06, 0.5, C.grey, { y: 0.44 });
    for (let i = 0; i < 4; i++) {
      const x = -1.05 + i * 0.7;
      k.box(0.3, 0.3, 0.3, C.offwhite, { x, y: 0.6, z: 0 });
      rotor(k, x, 0.2, -0.22, 3, 0.32, 0.05, C.hazard, 3);
    }
    building(k, 1.05, 1.05, 0.6, 0.5, 0.5, C.offwhite, C.blue, { windows: G.window });
  },

  hydro_dam(k) {
    pad(k, 3, C.rock);
    // baraj gölü (yüksek), duvar, alt akış
    k.box(2.9, 1.1, 1.3, C.rock, { y: 0.55, z: -0.8 });
    water(k, 2.8, 1.2, 0, -0.8, 1.12, C.deepWater);
    k.box(2.9, 1.3, 0.3, C.concrete, { y: 0.65, z: -0.05 });
    k.box(2.9, 0.08, 0.38, C.grey, { y: 1.33, z: -0.05 });
    // savak suyu
    k.box(0.5, 1.1, 0.04, G.cyan, { y: 0.6, z: 0.13, glow: true, alpha: 0.55 });
    water(k, 2.9, 1.3, 0, 0.8, 0.07, C.water);
    building(k, -0.9, 0.55, 0.8, 0.4, 0.4, C.offwhite, C.dark, { windows: G.window });
    building(k, 0.9, 0.55, 0.8, 0.4, 0.4, C.offwhite, C.dark, { windows: G.window });
    lattice(k, 1.2, 1.2, 1.1, 0.26, 0.08);
  },

  // ─────────────── 🌿 BİYOKÜTLE ───────────────
  bio_tank(k) {
    pad(k, 1, C.green);
    k.cyl(0.66, 0.66, 0.3, C.leaf, { y: 0.15, tess: 12 });
    k.dome(0.66, C.green, { y: 0.3 });
    k.pipe(0.3, 0, 0.45, 0, 0.15, 0.05, C.steel);
    k.pole(0.38, -0.3, 0, 0.6, 0.04, C.steel);
    k.sphere(0.07, G.fire, { x: 0.38, y: 0.64, z: -0.3, glow: true });
  },

  bio_compost(k) {
    pad(k, 1, C.dirt);
    for (const x of [-0.28, 0, 0.28]) k.box(0.24, 0.2, 0.36, C.wood, { x, y: 0.1, z: -0.2 });
    for (const x of [-0.28, 0, 0.28]) pile(k, x, -0.2, 0.22, 0.12, C.dirt);
    k.box(0.4, 0.28, 0.28, C.darkLeaf, { x: 0.1, y: 0.14, z: 0.25 });
    k.cyl(0.06, 0.06, 0.2, C.dark, { x: 0.25, y: 0.38, z: 0.25, tess: 6 });
    k.emit('steam', 0.25, 0.5, 0.25);
    tree(k, -0.32, 0.3, 0.8);
  },

  bio_pellet(k) {
    pad(k, 2);
    building(k, -0.3, 0.2, 1.0, 0.8, 0.6, C.offwhite, C.darkLeaf, { windows: G.window });
    tank(k, 0.55, -0.45, 0.5, 0.9, C.green, { band: C.darkLeaf });
    k.pipe(0.55, -0.45, 0.1, -0.1, 0.8, 0.07, C.steel);
    chimney(k, 0.55, 0.5, 1.4, 0.18, { smoke: 'lightsmoke' });
    pile(k, -0.6, -0.6, 0.45, 0.25, C.wood);
  },

  bio_waste(k) {
    pad(k, 2);
    building(k, 0, 0.15, 1.3, 0.9, 0.7, C.concrete, C.teal, { windows: G.window });
    k.box(0.6, 0.2, 0.5, C.teal, { x: -0.2, y: 0.8, z: 0.15 });
    chimney(k, 0.6, -0.55, 1.8, 0.2, { smoke: 'lightsmoke' });
    pile(k, -0.55, -0.6, 0.5, 0.25, C.brown);
    k.box(0.35, 0.18, 0.18, C.green, { x: 0.1, y: 0.12, z: -0.65 });
    k.box(0.12, 0.14, 0.18, C.white, { x: -0.1, y: 0.1, z: -0.65 });
  },

  bio_algae(k) {
    pad(k, 3, C.gravel);
    for (let r = 0; r < 5; r++) {
      const z = -1.1 + r * 0.42;
      k.pipe(-1.25, z, 0.6, z, 0.2, 0.12, G.algae, { glow: true, alpha: 0.85 });
      k.box(1.85, 0.04, 0.05, C.steel, { x: -0.32, y: 0.12, z });
    }
    tank(k, 1.0, -0.8, 0.5, 0.8, C.white, { band: C.green });
    tank(k, 1.0, -0.15, 0.5, 0.8, C.white, { band: C.green });
    building(k, 0.95, 0.85, 0.8, 0.6, 0.5, C.offwhite, C.green, { windows: G.window });
  },

  bio_complex(k) {
    pad(k, 3);
    for (const x of [-1.0, -0.45]) tank(k, x, -0.9, 0.5, 1.4, C.green, { band: C.darkLeaf });
    k.cyl(0.9, 0.9, 0.35, C.concrete, { x: 0.6, z: -0.7, y: 0.17, tess: 14 });
    k.dome(0.9, C.leaf, { x: 0.6, z: -0.7, y: 0.35 });
    building(k, -0.3, 0.6, 1.6, 1.0, 0.8, C.offwhite, C.darkLeaf, { windows: G.window });
    chimney(k, 1.0, 0.7, 2.2, 0.24, { smoke: 'lightsmoke' });
    k.pipe(-0.45, -0.9, 0.6, -0.7, 0.9, 0.08, C.steel);
    tree(k, 1.2, -1.2, 1);
    tree(k, -1.25, 1.2, 1);
  },

  // ─────────────── ⛏️ KÖMÜR ───────────────
  coal_boiler(k) {
    pad(k, 1, C.dirt);
    k.box(0.45, 0.4, 0.45, C.brick, { x: -0.12, y: 0.2, z: 0.1 });
    k.box(0.5, 0.05, 0.5, C.dark, { x: -0.12, y: 0.42, z: 0.1 });
    chimney(k, 0.25, 0.25, 1.0, 0.13, { bands: false, hex: C.brick });
    pile(k, 0.22, -0.28, 0.35, 0.18);
  },

  coal_generator(k) {
    pad(k, 1, C.dirt);
    building(k, -0.15, 0.12, 0.55, 0.6, 0.45, C.grey, C.dark);
    chimney(k, 0.3, 0.25, 1.3, 0.14);
    pile(k, 0.22, -0.28, 0.38, 0.2);
    k.box(0.06, 0.04, 0.4, C.dark, { x: 0.05, y: 0.25, z: -0.15, rx: 0.4 });
  },

  coal_plant(k) {
    pad(k, 2, C.dirt);
    building(k, -0.35, 0.3, 1.0, 0.9, 0.7, C.grey, C.dark, { windows: G.window });
    k.box(0.5, 1.1, 0.5, C.dark, { x: 0.3, y: 0.55, z: 0.45 });
    chimney(k, 0.65, -0.35, 2.4, 0.24);
    pile(k, -0.45, -0.6, 0.6, 0.3);
    k.box(0.08, 0.06, 0.8, C.dark, { x: -0.2, y: 0.45, z: -0.2, rx: 0.5 });
  },

  coal_fluid(k) {
    pad(k, 2, C.dirt);
    building(k, -0.3, 0.35, 1.1, 0.8, 0.6, C.concrete, C.dark, { windows: G.window });
    k.box(0.55, 1.4, 0.55, C.steel, { x: 0.45, y: 0.7, z: 0.3 });
    tank(k, -0.55, -0.5, 0.4, 0.9, C.grey);
    chimney(k, 0.25, -0.5, 2.6, 0.22);
    chimney(k, 0.7, -0.5, 2.2, 0.18);
    pile(k, -0.1, -0.6, 0.35, 0.2);
  },

  coal_supercritical(k) {
    pad(k, 3, C.dirt);
    building(k, -0.6, 0.6, 1.6, 1.1, 0.9, C.grey, C.dark, { windows: G.window });
    k.box(0.8, 1.8, 0.8, C.steel, { x: 0.15, y: 0.9, z: 0.7 });
    coolingTower(k, 0.85, -0.7, 2.1, 0.62);
    chimney(k, -0.2, -0.75, 3.4, 0.3);
    pile(k, -1.0, -0.8, 0.7, 0.35);
    pile(k, 1.15, 0.9, 0.5, 0.25);
  },

  coal_ultra(k) {
    pad(k, 3, C.dirt);
    coolingTower(k, -0.75, -0.75, 2.4, 0.66);
    coolingTower(k, 0.7, -0.75, 2.4, 0.66);
    building(k, -0.3, 0.75, 2.0, 1.0, 1.0, C.grey, C.dark, { windows: G.window });
    k.box(0.7, 2.0, 0.7, C.steel, { x: 0.95, y: 1.0, z: 0.75 });
    chimney(k, 0.95, 0.2, 3.8, 0.3);
    chimney(k, -1.2, 0.15, 3.4, 0.26);
  },

  // ─────────────── 🛢️ PETROL ───────────────
  oil_diesel(k) {
    pad(k, 1);
    k.box(0.75, 0.36, 0.4, C.hazard, { y: 0.2, z: 0.1 });
    k.box(0.77, 0.05, 0.42, C.dark, { y: 0.4, z: 0.1 });
    for (let i = 0; i < 4; i++) k.box(0.02, 0.22, 0.42, C.dark, { x: -0.25 + i * 0.07, y: 0.2, z: 0.1 });
    k.pole(0.28, 0.2, 0.4, 0.75, 0.06, C.dark);
    k.emit('smoke', 0.28, 0.8, 0.2);
    tank(k, -0.2, -0.3, 0.26, 0.28, C.red, { dome: false });
  },

  oil_pumpjack(k) {
    pad(k, 1, C.dirt);
    k.box(0.85, 0.08, 0.26, C.dark, { y: 0.04 });
    // samson direği
    k.box(0.06, 0.62, 0.06, C.steel, { x: 0.02, y: 0.31, z: -0.08, rz: 0.12 });
    k.box(0.06, 0.62, 0.06, C.steel, { x: 0.02, y: 0.31, z: 0.08, rz: 0.12 });
    k.box(0.06, 0.62, 0.06, C.steel, { x: -0.06, y: 0.31, z: 0, rz: -0.12 });
    // sallanan kol
    const g = k.group(0, 0.62, 0, { type: 'nod', axis: 'z', amp: 0.28, speed: 1.6 });
    g.box(0.9, 0.08, 0.08, C.orange);
    g.box(0.12, 0.26, 0.1, C.orange, { x: 0.46, y: -0.06 });
    // krank ağırlığı
    const c = k.group(-0.32, 0.26, 0, { type: 'spin', axis: 'z', speed: 1.6 });
    c.box(0.26, 0.12, 0.12, C.dark, { x: 0.08 });
    k.box(0.16, 0.16, 0.16, C.grey, { x: -0.32, y: 0.12 });
    k.pole(0.46, 0, 0, 0.3, 0.03, C.dark);
  },

  oil_derrick(k) {
    pad(k, 2, C.dirt);
    k.box(0.9, 0.2, 0.9, C.grey, { y: 0.1, x: -0.2, z: -0.2 });
    lattice(k, -0.2, -0.2, 2.6, 0.8, 0.18);
    k.box(0.28, 0.12, 0.28, C.hazard, { x: -0.2, y: 2.65, z: -0.2 });
    tank(k, 0.6, 0.45, 0.38, 0.5, C.white, { band: C.red });
    tank(k, 0.6, -0.15, 0.38, 0.5, C.white, { band: C.red });
    k.box(0.5, 0.3, 0.3, C.hazard, { x: -0.35, y: 0.15, z: 0.65 });
  },

  oil_plant(k) {
    pad(k, 2);
    for (const [x, z] of [[-0.5, -0.5], [0.05, -0.5], [-0.5, 0.05]]) tank(k, x, z, 0.48, 0.5, C.white, { dome: false, band: C.grey });
    building(k, 0.45, 0.35, 0.7, 0.9, 0.6, C.grey, C.dark, { windows: G.window });
    chimney(k, 0.6, -0.5, 1.8, 0.2);
    k.pipe(-0.5, 0.05, 0.1, 0.3, 0.3, 0.05, C.dark);
  },

  oil_refinery(k) {
    pad(k, 3);
    for (const [x, h] of [[-1.0, 2.4], [-0.6, 1.9], [-0.25, 2.8]]) {
      k.cyl(0.26, 0.3, h, C.offwhite, { x, z: -0.8, y: h / 2, tess: 8 });
      for (let y = 0.5; y < h; y += 0.5) k.cyl(0.34, 0.34, 0.04, C.steel, { x, z: -0.8, y, tess: 8 });
    }
    for (const [x, z] of [[0.55, -0.8], [1.05, -0.8], [0.55, -0.25], [1.05, -0.25]]) tank(k, x, z, 0.44, 0.4, C.white, { dome: false, band: C.red });
    building(k, -0.6, 0.6, 1.2, 0.7, 0.5, C.grey, C.dark, { windows: G.window });
    k.pole(0.9, 0.9, 0, 3.0, 0.1, C.steel);
    k.sphere(0.22, G.fire, { x: 0.9, y: 3.12, z: 0.9, glow: true });
    k.emit('fire', 0.9, 3.15, 0.9);
    k.pipe(-1.0, -0.4, 1.05, -0.4, 0.25, 0.06, C.dark);
    k.pipe(-0.1, -0.4, -0.1, 0.25, 0.25, 0.06, C.dark);
  },

  oil_platform(k) {
    water(k, 2.9, 2.9, 0, 0, 0.06, C.deepWater);
    for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]]) k.cyl(0.2, 0.26, 1.2, C.hazard, { x, z, y: 0.6, tess: 8 });
    k.box(2.3, 0.2, 2.3, C.grey, { y: 1.25 });
    k.box(2.35, 0.06, 2.35, C.dark, { y: 1.38 });
    building(k, 0.45, 0.45, 1.0, 0.9, 0.6, C.offwhite, C.red, { windows: G.window });
    k.box(0.9, 0.04, 0.9, C.dark, { x: 0.45, y: 1.98 + 0.06, z: 0.45 });
    k.cyl(0.7, 0.7, 0.01, C.hazard, { x: 0.45, y: 2.07, z: 0.45, tess: 12 });
    // sondaj kulesi platformun üzerinde
    const d = k.group(-0.5, 1.4, -0.5, null);
    lattice(d, 0, 0, 2.0, 0.7, 0.16);
    // alev bacası
    k.box(1.0, 0.06, 0.08, C.steel, { x: 1.4, y: 1.6, z: -0.8, rz: 0.5 });
    k.sphere(0.2, G.fire, { x: 1.85, y: 1.9, z: -0.8, glow: true });
    k.emit('fire', 1.85, 1.95, -0.8);
  },

  // ─────────────── 🔥 DOĞALGAZ ───────────────
  gas_generator(k) {
    pad(k, 1);
    k.box(0.7, 0.34, 0.42, C.blue, { y: 0.19, z: 0.1 });
    k.box(0.72, 0.04, 0.44, C.dark, { y: 0.37, z: 0.1 });
    k.pole(0.25, 0.2, 0.37, 0.65, 0.05, C.steel);
    k.emit('lightsmoke', 0.25, 0.7, 0.2);
    k.box(0.06, 0.06, 0.4, C.hazard, { x: -0.25, y: 0.06, z: -0.25 });
    k.cyl(0.16, 0.16, 0.22, C.hazard, { x: -0.25, y: 0.11, z: -0.35, tess: 8 });
  },

  gas_turbine(k) {
    pad(k, 1);
    k.cyl(0.36, 0.42, 0.75, C.offwhite, { rz: PI / 2, y: 0.26, tess: 10 });
    k.box(0.22, 0.4, 0.4, C.steel, { x: -0.4, y: 0.25 });
    k.cyl(0.22, 0.24, 0.9, C.grey, { x: 0.3, z: 0.25, y: 0.45, tess: 8 });
    k.emit('lightsmoke', 0.3, 0.95, 0.25);
    const g = k.group(-0.52, 0.26, 0, { type: 'spin', axis: 'x', speed: 10 });
    for (let i = 0; i < 6; i++) g.box(0.02, 0.3, 0.06, C.dark, { rx: (i / 6) * PI });
  },

  gas_combined(k) {
    pad(k, 2);
    building(k, -0.35, 0.3, 1.1, 0.9, 0.6, C.offwhite, C.blue, { windows: G.window });
    k.box(0.5, 0.9, 0.6, C.steel, { x: 0.5, y: 0.45, z: 0.35 });
    k.box(0.5, 0.9, 0.6, C.steel, { x: 0.5, y: 0.45, z: -0.35 });
    chimney(k, 0.65, 0.35, 1.7, 0.2, { smoke: 'lightsmoke', bands: false, hex: C.grey });
    chimney(k, 0.65, -0.35, 1.7, 0.2, { smoke: 'lightsmoke', bands: false, hex: C.grey });
    tank(k, -0.6, -0.55, 0.3, 0.4, C.white);
  },

  gas_lng(k) {
    pad(k, 2);
    sphereTank(k, -0.45, -0.4, 0.75, C.white);
    sphereTank(k, 0.45, -0.4, 0.75, C.white);
    building(k, 0, 0.55, 1.2, 0.5, 0.4, C.offwhite, C.blue);
    k.pipe(-0.45, -0.4, 0.45, -0.4, 0.2, 0.06, C.hazard);
    k.pipe(0, -0.4, 0, 0.3, 0.2, 0.06, C.hazard);
    k.pole(0.85, 0.85, 0, 1.2, 0.05, C.steel);
    k.sphere(0.1, G.fire, { x: 0.85, y: 1.25, z: 0.85, glow: true });
  },

  gas_cogen(k) {
    pad(k, 3);
    building(k, -0.35, 0.25, 1.8, 1.4, 0.9, C.offwhite, C.blue, { windows: G.window });
    for (const x of [-0.95, -0.35, 0.25]) fan(k, x, 0.95, 0.25, 0.4, 7);
    for (const x of [0.8, 1.15]) chimney(k, x, -0.9, 2.2, 0.2, { smoke: 'lightsmoke', bands: false, hex: C.grey });
    chimney(k, 1.15, 0.6, 2.2, 0.2, { smoke: 'lightsmoke', bands: false, hex: C.grey });
    k.pipe(-1.2, -1.0, 0.6, -1.0, 0.3, 0.12, C.red);
    k.pipe(-1.2, -1.2, 0.6, -1.2, 0.3, 0.12, C.blue);
  },

  gas_mega(k) {
    pad(k, 3);
    building(k, 0, 0.55, 2.6, 1.2, 1.1, C.offwhite, C.dark, { windows: G.window });
    k.box(2.6, 0.08, 1.24, C.blue, { y: 0.6, z: 0.55 });
    for (let i = 0; i < 4; i++) chimney(k, -1.05 + i * 0.7, -0.75, 2.8, 0.22, { smoke: 'lightsmoke', bands: false, hex: C.grey });
    for (const x of [-0.8, 0, 0.8]) fan(k, x, 1.15, 0.55, 0.45, 6);
    k.pipe(-1.3, -0.3, 1.3, -0.3, 0.35, 0.1, C.hazard);
  },

  // ─────────────── 🌋 JEOTERMAL ───────────────
  geo_heatpump(k) {
    pad(k, 1, C.green);
    k.box(0.6, 0.5, 0.5, C.offwhite, { y: 0.25 });
    k.box(0.62, 0.04, 0.52, C.grey, { y: 0.51 });
    fan(k, 0, 0.53, 0, 0.36, 8);
    k.pipe(-0.3, 0.3, -0.45, 0.3, 0.08, 0.06, C.red);
    k.pipe(-0.3, -0.3, -0.45, -0.3, 0.08, 0.06, C.blue);
  },

  geo_well(k) {
    pad(k, 1, C.rock);
    k.cyl(0.4, 0.44, 0.1, C.concrete, { y: 0.05, tess: 8 });
    k.pole(0, 0, 0.1, 0.55, 0.12, C.steel);
    k.cyl(0.24, 0.24, 0.06, C.red, { y: 0.4, tess: 8 });
    k.pipe(0, 0, 0.4, 0.3, 0.45, 0.06, C.steel);
    k.box(0.3, 0.3, 0.3, C.offwhite, { x: -0.25, y: 0.15, z: 0.25 });
    k.emit('steam', 0, 0.62, 0);
  },

  geo_drysteam(k) {
    pad(k, 2, C.rock);
    building(k, 0.35, 0.35, 0.9, 0.8, 0.55, C.offwhite, C.red, { windows: G.window });
    for (const [x, z] of [[-0.6, -0.6], [-0.6, 0.2], [0.2, -0.6]]) {
      k.pole(x, z, 0, 0.45, 0.1, C.steel);
      k.emit('steam', x, 0.5, z);
    }
    k.pipe(-0.6, -0.6, -0.6, 0.2, 0.3, 0.07, C.offwhite);
    k.pipe(-0.6, -0.6, 0.2, -0.6, 0.3, 0.07, C.offwhite);
    k.pipe(0.2, -0.6, 0.2, 0.0, 0.3, 0.07, C.offwhite);
  },

  geo_flash(k) {
    pad(k, 2, C.rock);
    tank(k, -0.5, -0.45, 0.4, 0.8, C.white, { band: C.orange });
    tank(k, 0.0, -0.55, 0.32, 0.6, C.white, { band: C.orange });
    coolingTower(k, 0.5, -0.45, 1.0, 0.36);
    building(k, -0.15, 0.5, 1.3, 0.6, 0.5, C.offwhite, C.orange, { windows: G.window });
    k.pipe(-0.5, -0.45, 0.0, -0.55, 0.5, 0.06, C.steel);
    k.emit('steam', -0.5, 0.95, -0.45);
  },

  geo_binary(k) {
    pad(k, 3, C.rock);
    k.cyl(1.0, 1.1, 0.06, C.rock, { x: -0.8, z: -0.8, y: 0.06, tess: 10 });
    k.cyl(0.85, 0.85, 0.04, G.hot, { x: -0.8, z: -0.8, y: 0.1, tess: 10, glow: true, alpha: 0.6 });
    k.emit('steam', -0.8, 0.2, -0.8);
    building(k, 0.4, 0.6, 1.8, 1.0, 0.6, C.offwhite, C.orange, { windows: G.window });
    for (let i = 0; i < 4; i++) {
      const x = -0.3 + i * 0.45;
      k.box(0.4, 0.4, 0.5, C.grey, { x, y: 0.2, z: -0.8 });
      fan(k, x, 0.42, -0.8, 0.32, 7);
    }
    k.pipe(-0.8, -0.8, -0.8, 0.6, 0.15, 0.07, C.red);
    k.pipe(-0.8, 0.6, -0.5, 0.6, 0.15, 0.07, C.red);
  },

  geo_magma(k) {
    pad(k, 3, C.black);
    k.cyl(1.6, 2.0, 0.35, C.rock, { x: -0.3, z: -0.3, y: 0.17, tess: 7 });
    k.cyl(1.2, 1.2, 0.05, G.lava, { x: -0.3, z: -0.3, y: 0.34, tess: 7, glow: true });
    k.emit('fire', -0.3, 0.4, -0.3);
    k.emit('smoke', -0.6, 0.4, -0.1);
    lattice(k, -0.3, -0.3, 2.4, 0.7, 0.2, C.dark);
    k.pole(-0.3, -0.3, 0.3, 2.4, 0.12, C.steel);
    building(k, 0.8, 0.85, 1.0, 1.0, 0.9, C.dark, C.orange, { windows: G.hot });
    k.pipe(-0.3, -0.3, 0.6, 0.6, 0.6, 0.12, C.steel);
    beacon(k, -0.3, 2.5, -0.3, G.fire, 0.12);
  },

  // ─────────────── ☢️ NÜKLEER ───────────────
  nuke_rtg(k) {
    pad(k, 1, C.concrete);
    k.cyl(0.5, 0.56, 0.12, C.grey, { y: 0.06, tess: 8 });
    k.cyl(0.22, 0.22, 0.55, C.dark, { y: 0.38, tess: 8 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      k.box(0.03, 0.5, 0.16, C.steel, { x: Math.cos(a) * 0.17, z: Math.sin(a) * 0.17, y: 0.38, ry: -a });
    }
    const g = k.group(0, 0.72, 0, { type: 'pulse', amp: 0.12, speed: 2.5 });
    g.sphere(0.18, G.nuclear, { glow: true, seg: 6 });
    k.box(0.12, 0.12, 0.02, C.hazard, { x: 0.3, y: 0.2, z: -0.3 });
  },

  nuke_micro(k) {
    pad(k, 1, C.concrete);
    k.box(0.78, 0.4, 0.42, C.offwhite, { y: 0.2, z: -0.12 });
    k.box(0.8, 0.04, 0.44, C.hazard, { y: 0.41, z: -0.12 });
    for (let i = 0; i < 3; i++) k.box(0.12, 0.2, 0.01, G.nuclear, { x: -0.22 + i * 0.22, y: 0.22, z: -0.34, glow: true });
    k.dome(0.36, C.white, { x: 0.15, z: 0.28, y: 0.02 });
    k.box(0.14, 0.14, 0.02, C.hazard, { x: -0.25, y: 0.2, z: 0.3 });
  },

  nuke_smr(k) {
    pad(k, 2, C.concrete);
    fence(k, 2);
    containment(k, -0.35, -0.3, 0.8, 0.55);
    building(k, 0.45, -0.3, 0.6, 0.8, 0.5, C.offwhite, C.hazard, { windows: G.window });
    coolingTower(k, -0.35, 0.5, 0.9, 0.3);
    k.box(0.5, 0.25, 0.4, C.grey, { x: 0.5, y: 0.13, z: 0.55 });
  },

  nuke_pwr(k) {
    pad(k, 3, C.concrete);
    containment(k, -0.75, -0.75, 1.1, 0.8);
    building(k, 0.3, -0.75, 1.0, 1.0, 0.7, C.offwhite, C.dark, { windows: G.window });
    coolingTower(k, 0.55, 0.6, 2.6, 0.72);
    building(k, -0.8, 0.55, 0.9, 0.9, 0.4, C.grey, C.dark);
    chimney(k, -0.35, -0.05, 1.6, 0.12, { smoke: null, bands: true });
  },

  nuke_breeder(k) {
    pad(k, 3, C.concrete);
    containment(k, -0.7, -0.7, 0.95, 0.7, C.white);
    containment(k, 0.4, -0.7, 0.95, 0.7, C.white);
    k.torus(1.6, 0.07, G.blue, { x: -0.15, y: 0.3, z: -0.7, glow: true, tess: 20 });
    building(k, -0.1, 0.6, 2.2, 1.0, 0.65, C.offwhite, C.blue, { windows: G.window });
    chimney(k, 1.15, 0.0, 2.0, 0.14, { smoke: null });
  },

  nuke_thorium(k) {
    pad(k, 3, C.concrete);
    building(k, -0.5, -0.4, 1.5, 1.4, 0.9, C.offwhite, C.hazard, { windows: G.window });
    const g = k.group(-0.5, 1.15, -0.4, { type: 'spin', axis: 'y', speed: 0.6 });
    g.torus(1.0, 0.09, G.pink, { glow: true, tess: 20 });
    k.cyl(0.5, 0.5, 0.25, C.dark, { x: -0.5, y: 1.0, z: -0.4, tess: 12 });
    k.sphere(0.3, G.pink, { x: -0.5, y: 1.15, z: -0.4, glow: true });
    for (const z of [-0.9, -0.3, 0.3]) tank(k, 0.9, z, 0.36, 0.6, C.white, { band: C.pink });
    coolingTower(k, -0.6, 0.85, 1.1, 0.42);
  },

  nuke_complex(k) {
    pad(k, 4, C.concrete);
    fence(k, 4);
    containment(k, -1.2, -1.15, 1.0, 0.8);
    containment(k, -0.05, -1.15, 1.0, 0.8);
    building(k, 1.15, -1.15, 1.2, 1.1, 0.8, C.offwhite, C.dark, { windows: G.window });
    coolingTower(k, -0.9, 0.85, 2.9, 0.78);
    coolingTower(k, 0.8, 0.85, 2.9, 0.78);
    chimney(k, 1.55, 0.0, 2.0, 0.14, { smoke: null });
  },

  // ─────────────── 🚀 FÜZYON & GELECEK ───────────────
  fusion_proto(k) {
    pad(k, 2, C.concrete);
    building(k, 0.45, 0.4, 0.8, 0.9, 0.6, C.offwhite, C.purple, { windows: G.window });
    k.cyl(1.1, 1.1, 0.12, C.grey, { x: -0.3, z: -0.3, y: 0.06, tess: 16 });
    k.torus(0.9, 0.24, C.steel, { x: -0.3, z: -0.3, y: 0.32, tess: 18 });
    const g = k.group(-0.3, 0.32, -0.3, { type: 'spin', axis: 'y', speed: 3 });
    g.torus(0.9, 0.1, G.plasma, { glow: true, tess: 18, y: 0.12 });
    tank(k, 0.6, -0.55, 0.3, 0.5, C.white, { band: C.purple });
  },

  fusion_tokamak(k) {
    pad(k, 3, C.concrete);
    k.cyl(2.3, 2.4, 0.2, C.grey, { y: 0.1, tess: 18 });
    k.torus(1.7, 0.5, C.steel, { y: 0.65, tess: 20 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI * 2;
      k.box(0.12, 0.85, 0.6, C.purple, { x: Math.cos(a) * 0.85, z: Math.sin(a) * 0.85, y: 0.65, ry: -a });
    }
    k.cyl(0.42, 0.42, 1.4, C.dark, { y: 0.7, tess: 12 });
    const g = k.group(0, 0.92, 0, { type: 'spin', axis: 'y', speed: 4 });
    g.torus(1.7, 0.12, G.plasma, { glow: true, tess: 24 });
    beacon(k, 0, 1.45, 0, G.plasma, 0.16);
  },

  fusion_stellarator(k) {
    pad(k, 3, C.concrete);
    k.cyl(2.4, 2.5, 0.18, C.grey, { y: 0.09, tess: 18 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      k.box(0.2, 0.7, 0.2, C.steel, { x: Math.cos(a) * 0.95, z: Math.sin(a) * 0.95, y: 0.4 });
    }
    const g = k.group(0, 0.85, 0, { type: 'spin', axis: 'y', speed: 0.8 });
    g.knot(0.8, 0.13, C.purple, { p: 2, q: 5, sy: 0.45 });
    const p = k.group(0, 0.85, 0, { type: 'spin', axis: 'y', speed: -2.4 });
    p.torus(1.6, 0.06, G.plasma, { glow: true, tess: 24, sy: 0.5 });
  },

  future_antimatter(k) {
    pad(k, 3, C.dark);
    k.cyl(2.4, 2.5, 0.15, C.black, { y: 0.08, tess: 6 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      const x = Math.cos(a) * 1.05;
      const z = Math.sin(a) * 1.05;
      k.cyl(0.14, 0.24, 1.8, C.steel, { x, z, y: 0.9, tess: 6 });
      k.sphere(0.16, G.cyan, { x, z, y: 1.85, glow: true });
    }
    const ring = k.group(0, 1.25, 0, { type: 'spin', axis: 'x', speed: 1.2 });
    ring.torus(1.5, 0.08, C.steel, { tess: 24 });
    ring.torus(1.5, 0.03, G.cyan, { glow: true, tess: 24, sx: 1.04, sz: 1.04 });
    const core = k.group(0, 1.25, 0, { type: 'pulse', amp: 0.2, speed: 3 });
    core.sphere(0.55, G.pink, { glow: true, ico: true, sub: 1 });
  },

  future_zeropoint(k) {
    pad(k, 3, C.dark);
    k.cyl(1.6, 2.2, 0.4, C.black, { y: 0.2, tess: 8 });
    k.cyl(0.5, 0.7, 0.6, C.steel, { y: 0.6, tess: 8 });
    const r1 = k.group(0, 1.55, 0, { type: 'spin', axis: 'y', speed: 1.5 });
    r1.torus(2.0, 0.06, G.white, { glow: true, tess: 28 });
    const r2 = k.group(0, 1.55, 0, { type: 'spin', axis: 'x', speed: 1.1 });
    r2.torus(1.6, 0.06, G.cyan, { glow: true, tess: 28 });
    const r3 = k.group(0, 1.55, 0, { type: 'spin', axis: 'z', speed: 0.8 });
    r3.torus(1.2, 0.06, G.plasma, { glow: true, tess: 28 });
    const core = k.group(0, 1.55, 0, { type: 'pulse', amp: 0.25, speed: 4 });
    core.sphere(0.45, G.white, { glow: true, ico: true, sub: 1 });
  },

  future_dyson(k) {
    pad(k, 4, C.dark);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      k.box(0.25, 1.4, 0.25, C.steel, { x: Math.cos(a) * 1.2, z: Math.sin(a) * 1.2, y: 0.7, ry: -a });
    }
    k.cyl(3.6, 0.6, 0.6, C.mirror, { y: 1.5, tess: 18 });
    k.cyl(0.5, 0.5, 0.4, G.sun, { y: 1.95, glow: true, tess: 12 });
    k.cyl(0.55, 0.55, 30, G.sun, { y: 17, glow: true, alpha: 0.3, tess: 12 });
    const g = k.group(0, 2.1, 0, { type: 'spin', axis: 'y', speed: 1 });
    g.torus(1.4, 0.05, G.hot, { glow: true, tess: 24 });
    building(k, 1.4, 1.4, 0.8, 0.8, 0.5, C.dark, C.purple, { windows: G.cyan });
  },

  future_blackhole(k) {
    pad(k, 4, C.black);
    k.cyl(3.4, 3.7, 0.2, C.dark, { y: 0.1, tess: 8 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2;
      const x = Math.cos(a) * 1.55;
      const z = Math.sin(a) * 1.55;
      k.cyl(0.12, 0.3, 2.4, C.steel, { x, z, y: 1.2, tess: 6 });
      k.sphere(0.2, G.plasma, { x, z, y: 2.45, glow: true });
    }
    const disc = k.group(0, 1.7, 0, { type: 'spin', axis: 'y', speed: 2.2 });
    disc.torus(1.9, 0.32, G.fire, { glow: true, tess: 30, sy: 0.18 });
    disc.torus(1.25, 0.18, G.hot, { glow: true, tess: 30, sy: 0.2 });
    const lens = k.group(0, 1.7, 0, { type: 'spin', axis: 'x', speed: 0.5 });
    lens.torus(1.15, 0.03, G.white, { glow: true, tess: 30 });
    k.sphere(0.9, '#050507', { y: 1.7, seg: 12, smooth: true });
  },
};
