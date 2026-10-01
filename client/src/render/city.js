// Adanın ortasındaki şehir: nüfusa ve merkez seviyelerine göre binalar, simgeler ve arabalar
import { CENTERS, CITY_LEVELS, cityLevelIndex } from '@shared/data/centers.js';
import { TOWER_FLOORS } from './models/city.js';

const BLOCK_RANGES = [
  [0, 2],
  [4, 5],
  [7, 9],
];
const CENTER_BLOCK = {
  residential: [0, 0],
  commerce: [1, 0],
  park: [2, 0],
  industry: [0, 1],
  health: [2, 1],
  education: [0, 2],
  entertainment: [1, 2],
  transport: [2, 2],
};
const ROAD_COORDS = [-1.5, 1.5]; // şehir merkezine göre yol çizgileri (karo 3 ve 6)

function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// 2x2 simge alanı: blok içinde merkeze en yakın karolar
function landmarkTiles(bx, by) {
  const pick = (b) => (b === 0 ? [1, 2] : b === 1 ? [4, 5] : [7, 8]);
  return { xs: pick(bx), ys: pick(by) };
}

// Tüm blokların lot (karo) listesi
function computeLayout() {
  const blocks = [];
  for (let by = 0; by < 3; by++) {
    for (let bx = 0; bx < 3; bx++) {
      if (bx === 1 && by === 1) continue; // belediye meydanı
      const center = Object.keys(CENTER_BLOCK).find((id) => CENTER_BLOCK[id][0] === bx && CENTER_BLOCK[id][1] === by);
      const lm = landmarkTiles(bx, by);
      const tiles = [];
      for (let ty = BLOCK_RANGES[by][0]; ty <= BLOCK_RANGES[by][1]; ty++) {
        for (let tx = BLOCK_RANGES[bx][0]; tx <= BLOCK_RANGES[bx][1]; tx++) {
          tiles.push({ tx, ty, inLandmark: lm.xs.includes(tx) && lm.ys.includes(ty), x: tx - 4.5, z: ty - 4.5 });
        }
      }
      blocks.push({
        center,
        tiles,
        lmX: (lm.xs[0] + lm.xs[1]) / 2 - 4.5,
        lmZ: (lm.ys[0] + lm.ys[1]) / 2 - 4.5,
      });
    }
  }
  return blocks;
}

const LAYOUT = computeLayout();

const STYLE = [
  { min: 1, max: 1, office: 0 }, // Köy (evler)
  { min: 1, max: 2, office: 0 }, // Kasaba
  { min: 2, max: 4, office: 0.1 },
  { min: 3, max: 8, office: 0.2 },
  { min: 6, max: 12, office: 0.35 },
  { min: 8, max: 16, office: 0.5 },
  { min: 12, max: 24, office: 0.6 },
  { min: 16, max: 32, office: 0.65 },
  { min: 24, max: 32, office: 0.7 },
];

function nearestFloors(f) {
  let best = TOWER_FLOORS[0];
  for (const v of TOWER_FLOORS) if (Math.abs(v - f) < Math.abs(best - f)) best = v;
  return best;
}

export class City {
  constructor(world, parent, seed) {
    this.world = world;
    this.parent = parent;
    this.seed = seed;
    this.items = []; // { root, anims, casters }
    this.cars = [];
    this.signature = '';
  }

  update(pop, centers) {
    const level = cityLevelIndex(pop);
    const cur = CITY_LEVELS[level].pop || 10;
    const next = CITY_LEVELS[level + 1]?.pop ?? cur * 10;
    const frac = Math.max(0, Math.min(1, Math.log(Math.max(pop, 1) / Math.max(cur, 1)) / Math.log(next / Math.max(cur, 1))));
    const fill = Math.min(1, 0.14 + 0.1 * level + 0.1 * Math.round(frac * 4) / 4);
    const sig = `${level}|${fill}|${CENTERS.map((c) => centers[c.id] || 0).join(',')}`;
    if (sig === this.signature) return;
    this.signature = sig;
    this.rebuild(level, fill, centers);
  }

  clear() {
    for (const it of this.items) this.world.disposeInstance(it);
    for (const car of this.cars) this.world.disposeInstance(car.inst);
    this.items = [];
    this.cars = [];
  }

  place(key, x, z, opts = {}) {
    const inst = this.world.templates.get(key).instantiate(this.parent);
    inst.root.position.set(x, opts.y ?? 0, z);
    if (opts.scale) inst.root.scaling.set(opts.scale[0], opts.scale[1], opts.scale[2]);
    if (opts.rot) inst.root.rotation.y = opts.rot;
    this.world.registerInstance(inst, { freeze: true });
    this.items.push(inst);
    return inst;
  }

  rebuild(level, fill, centers) {
    this.clear();
    const style = STYLE[Math.min(level, STYLE.length - 1)];

    // Belediye binası
    const hallScale = 0.9 + 0.06 * level;
    this.place('cityhall', 0, 0, { scale: [hallScale, hallScale, hallScale] });

    // Lotlar
    const lots = [];
    for (const block of LAYOUT) {
      const lvl = centers[block.center] || 0;
      if (lvl > 0) {
        const s = 0.82 + 0.025 * Math.min(lvl, 16);
        this.place(`landmark:${block.center}`, block.lmX, block.lmZ, { scale: [s, s, s] });
      }
      for (const t of block.tiles) if (!(lvl > 0 && t.inLandmark)) lots.push(t);
    }
    for (const l of lots) {
      l.dist = Math.max(Math.abs(l.x), Math.abs(l.z));
      l.rand = hash(l.tx, l.ty, this.seed);
      l.order = l.dist + l.rand * 2.5;
    }
    lots.sort((a, b) => a.order - b.order);
    const count = Math.round(lots.length * fill);
    const parkLevel = centers.park || 0;

    lots.forEach((lot, i) => {
      const r = lot.rand;
      if (i >= count) {
        if (hash(lot.tx, lot.ty, this.seed + 7) < 0.35 + parkLevel * 0.06)
          this.place(`tree:${Math.floor(r * 50) % 5}`, lot.x, lot.z, { rot: r * 6 });
        return;
      }
      const closeness = 1 - lot.dist / 5;
      const rot = Math.floor(r * 4) * (Math.PI / 2);
      if (level === 0 || (level === 1 && r < 0.65) || (level === 2 && r < 0.2)) {
        this.place(`house:${Math.floor(r * 97) % 6}`, lot.x, lot.z, { rot });
        return;
      }
      if (level <= 2 && r < 0.45) {
        this.place(`shop:${Math.floor(r * 89) % 4}`, lot.x, lot.z, { rot });
        return;
      }
      const t = Math.min(1, closeness * 0.75 + hash(lot.tx, lot.ty, this.seed + 3) * 0.45);
      const floors = nearestFloors(style.min + (style.max - style.min) * t);
      const office = hash(lot.tx, lot.ty, this.seed + 5) < style.office + closeness * 0.2;
      const w = 0.66 + r * 0.16;
      this.place(`tower:${office ? 'office' : 'res'}:${floors}:${Math.floor(r * 31) % 6}`, lot.x, lot.z, {
        scale: [w, 1, w],
      });
      if (level >= 6 && floors >= 24 && r > 0.4) this.place('spire', lot.x, lot.z, { y: floors * 0.2 });
    });

    // Sokak lambaları (kasabadan itibaren): yolların iki yanındaki kaldırımlarda
    if (level >= 1) {
      for (const line of ROAD_COORDS) {
        for (const t of [-4.2, -2.6, 2.6, 4.2]) {
          for (const side of [-1, 1]) {
            const off = side * 0.56;
            const tt = t + side * 0.35;
            // x yönündeki yol (z = line) ve z yönündeki yol (x = line)
            this.place('lamp', tt, line + off, { rot: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
            this.place('lamp', line + off, tt, { rot: side > 0 ? Math.PI : 0 });
          }
        }
      }
    }

    // Arabalar
    const carCount = Math.min(28, 2 + level * 3);
    for (let i = 0; i < carCount; i++) {
      const axis = i % 2 === 0 ? 'x' : 'z';
      const line = ROAD_COORDS[(i >> 1) % 2];
      const dir = hash(i, 1, this.seed) < 0.5 ? 1 : -1;
      const inst = this.world.templates.get(`car:${i % 7}`).instantiate(this.parent);
      this.world.registerInstance(inst);
      this.cars.push({
        inst,
        axis,
        line: line + dir * 0.17,
        dir,
        t: hash(i, 2, this.seed) * 10 - 5,
        speed: 0.9 + hash(i, 3, this.seed) * 0.9,
      });
    }
  }

  animate(dt) {
    for (const c of this.cars) {
      c.t += c.dir * c.speed * dt;
      if (c.t > 5) c.t = -5;
      if (c.t < -5) c.t = 5;
      const p = c.inst.root.position;
      if (c.axis === 'x') {
        p.set(c.t, 0.02, c.line);
        c.inst.root.rotation.y = c.dir > 0 ? 0 : Math.PI;
      } else {
        p.set(c.line, 0.02, c.t);
        c.inst.root.rotation.y = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    }
  }

  dispose() {
    this.clear();
  }
}
