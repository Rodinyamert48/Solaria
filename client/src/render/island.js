// Bir oyuncunun adası: zemin, jeneratörler, şehir, isim etiketi ve efektler
import {
  TransformNode, StandardMaterial, DynamicTexture, Color3, Vector3, Mesh, CreateGround, CreatePlane,
} from './babylon.js';
import { GENERATOR_BY_ID } from '@shared/data/generators.js';
import { CATEGORY_BY_ID } from '@shared/data/categories.js';
import { cityLevelName } from '@shared/economy.js';
import {
  ISLAND_SIZE, CITY_MIN, CITY_MAX, isCityTile, isUnlocked, tileDistance, MAX_LAND_LEVEL,
} from '@shared/grid.js';
import { BALANCE } from '@shared/balance.js';
import { City } from './city.js';
import { IslandEffects } from './effects.js';

export const SPACING = 48;
const TILE_PX = 32;
const HALF = ISLAND_SIZE / 2;

export function slotPosition(slot) {
  const col = slot % 3;
  const row = Math.floor(slot / 3);
  return new Vector3((col - 1) * SPACING, 0, (0.5 - row) * SPACING);
}

function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Island {
  constructor(world, slot) {
    this.world = world;
    this.slot = slot;
    this.scene = world.scene;
    this.root = new TransformNode(`island${slot}`, this.scene);
    this.root.position.copyFrom(slotPosition(slot));
    this.gens = new Map(); // gid -> { g, def, inst }
    this.decor = [];
    this.plot = null;
    this.pop = 0;
    this.land = -1;
    this.seed = slot * 7919 + 13;

    this.body = world.templates.get('island').instantiate(this.root);
    world.registerInstance(this.body, { receive: true });

    // Zemin: dinamik doku ile çizilir (çim, kilitli arazi, şehir yolları)
    this.ground = CreateGround(`ground${slot}`, { width: ISLAND_SIZE, height: ISLAND_SIZE }, this.scene);
    this.ground.parent = this.root;
    this.ground.position.y = 0.001;
    this.ground.receiveShadows = true;
    this.ground.isPickable = false;
    this.texture = new DynamicTexture(
      `groundTex${slot}`,
      { width: ISLAND_SIZE * TILE_PX, height: ISLAND_SIZE * TILE_PX },
      this.scene,
      true,
    );
    this.texture.anisotropicFilteringLevel = 8;
    const mat = new StandardMaterial(`groundMat${slot}`, this.scene);
    mat.diffuseTexture = this.texture;
    mat.specularColor = new Color3(0.02, 0.02, 0.02);
    this.ground.material = mat;

    this.cityNode = new TransformNode(`city${slot}`, this.scene);
    this.cityNode.parent = this.root;
    this.cityNode.position.set((CITY_MIN + CITY_MAX + 1) / 2 - HALF, 0, (CITY_MIN + CITY_MAX + 1) / 2 - HALF);
    this.city = new City(world, this.cityNode, this.seed);
    this.effects = new IslandEffects(world, this);

    this.makeLabel();
  }

  // Karo (x, y) -> adaya göre yerel konum (ayak izinin merkezi)
  tileCenter(x, y, size = 1) {
    return new Vector3(x + size / 2 - HALF, 0, y + size / 2 - HALF);
  }

  // Dünya noktası -> karo; ada dışıysa null
  worldToTile(p) {
    const lx = p.x - this.root.position.x + HALF;
    const lz = p.z - this.root.position.z + HALF;
    const x = Math.floor(lx);
    const y = Math.floor(lz);
    if (x < 0 || y < 0 || x >= ISLAND_SIZE || y >= ISLAND_SIZE) return null;
    return { x, y, fx: lx, fy: lz };
  }

  applyPlot(plot) {
    this.plot = plot;
    if (plot.land !== this.land) {
      this.land = plot.land;
      this.drawGround();
      this.rebuildDecor();
    }
    // Jeneratör farkları
    const seen = new Set();
    for (const g of plot.generators) {
      seen.add(g.gid);
      const cur = this.gens.get(g.gid);
      if (!cur || cur.g.type !== g.type) {
        if (cur) this.removeGen(g.gid);
        this.addGen(g);
      } else {
        if (cur.g.x !== g.x || cur.g.y !== g.y || cur.g.level !== g.level) this.placeGen(cur, g);
        cur.g = g;
      }
    }
    for (const gid of [...this.gens.keys()]) if (!seen.has(gid)) this.removeGen(gid);
    this.effects.rebuild();
    this.setPop(plot.pop);
    this.updateLabel();
  }

  setPop(pop) {
    this.pop = pop;
    if (this.plot) this.city.update(pop, this.plot.centers);
    this.updateLabel();
  }

  addGen(g) {
    const def = GENERATOR_BY_ID[g.type];
    if (!def) return;
    const inst = this.world.templates.generator(g.type).instantiate(this.root, `gen${g.gid}`);
    this.world.registerInstance(inst, { gen: true, cat: def.cat });
    const entry = { g, def, inst, born: performance.now() };
    this.gens.set(g.gid, entry);
    this.placeGen(entry, g);
    this.world.onGenAdded?.(this, entry);
  }

  placeGen(entry, g) {
    const p = this.tileCenter(g.x, g.y, entry.def.size);
    entry.inst.root.position.copyFrom(p);
    const s = 1 + 0.05 * (g.level - 1);
    entry.inst.root.scaling.setAll(s);
  }

  removeGen(gid) {
    const e = this.gens.get(gid);
    if (!e) return;
    this.world.disposeInstance(e.inst);
    this.gens.delete(gid);
  }

  genAtTile(x, y) {
    for (const e of this.gens.values()) {
      const { g, def } = e;
      if (x >= g.x && y >= g.y && x < g.x + def.size && y < g.y + def.size) return e;
    }
    return null;
  }

  drawGround() {
    const ctx = this.texture.getContext();
    const T = TILE_PX;
    const N = ISLAND_SIZE;
    const land = this.land;
    // Kanvas satırı: karo y=0 dokunun altında (z-) olmalı
    const rect = (x, y, w = 1, h = 1) => [x * T, (N - y - h) * T, w * T, h * T];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const checker = (x + y) % 2 === 0;
        let color;
        if (isCityTile(x, y)) {
          const cx = x - CITY_MIN;
          const cy = y - CITY_MIN;
          const road = cx === 3 || cx === 6 || cy === 3 || cy === 6;
          const plaza = cx >= 4 && cx <= 5 && cy >= 4 && cy <= 5;
          color = road ? '#5d6270' : plaza ? '#e9e1cf' : checker ? '#d6d3cb' : '#d1cec5';
        } else if (isUnlocked(x, y, land)) {
          color = checker ? '#8fd16f' : '#87c968';
        } else {
          const n = MAX_LAND_LEVEL;
          const nextRing = land < n && isUnlocked(x, y, land + 1);
          color = nextRing ? (checker ? '#a9c08e' : '#a2b988') : checker ? '#9fb184' : '#99ab7f';
        }
        ctx.fillStyle = color;
        ctx.fillRect(...rect(x, y));
      }
    }
    // Yol şeritleri
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    for (const c of [3, 6]) {
      const v = (CITY_MIN + c + 0.5) * T;
      const vy = (N - (CITY_MIN + c + 0.5)) * T;
      ctx.beginPath();
      ctx.moveTo(v, (N - CITY_MAX - 1) * T);
      ctx.lineTo(v, (N - CITY_MIN) * T);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(CITY_MIN * T, vy);
      ctx.lineTo((CITY_MAX + 1) * T, vy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Şehir bölgesi kenarı (kaldırım)
    ctx.strokeStyle = '#b9b4a8';
    ctx.lineWidth = 4;
    ctx.strokeRect(CITY_MIN * T + 2, (N - CITY_MAX - 1) * T + 2, 10 * T - 4, 10 * T - 4);
    // Açık arazi sınırı
    const r = BALANCE.landRadii[land];
    const a = Math.max(0, Math.ceil(HALF - r - 0.5));
    const b = Math.min(N, Math.floor(HALF + r + 0.5));
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(a * T + 1.5, (N - b) * T + 1.5, (b - a) * T - 3, (b - a) * T - 3);
    ctx.setLineDash([]);
    // İnce ızgara çizgileri (açık arazide)
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    for (let i = a; i <= b; i++) {
      ctx.beginPath();
      ctx.moveTo(i * T, (N - b) * T);
      ctx.lineTo(i * T, (N - a) * T);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a * T, (N - i) * T);
      ctx.lineTo(b * T, (N - i) * T);
      ctx.stroke();
    }
    this.texture.update();
  }

  // Kilitli arazide süs ağaçları ve kayalar
  rebuildDecor() {
    for (const d of this.decor) this.world.disposeInstance(d);
    this.decor = [];
    for (let y = 0; y < ISLAND_SIZE; y++) {
      for (let x = 0; x < ISLAND_SIZE; x++) {
        if (isUnlocked(x, y, this.land) || isCityTile(x, y)) continue;
        const r = hash(x, y, this.seed);
        if (r > 0.16) continue;
        const key = r < 0.03 ? 'rock' : `tree:${Math.floor(r * 100) % 3}`;
        const inst = this.world.templates.get(key).instantiate(this.root);
        inst.root.position.copyFrom(this.tileCenter(x, y));
        inst.root.rotation.y = r * 40;
        this.world.registerInstance(inst);
        this.decor.push(inst);
      }
    }
  }

  makeLabel() {
    const plane = CreatePlane(`label${this.slot}`, { width: 8, height: 2 }, this.scene);
    plane.parent = this.root;
    plane.position.set(0, 10.5, 0);
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;
    this.labelTex = new DynamicTexture(`labelTex${this.slot}`, { width: 640, height: 160 }, this.scene, true);
    this.labelTex.hasAlpha = true;
    const m = new StandardMaterial(`labelMat${this.slot}`, this.scene);
    m.diffuseTexture = this.labelTex;
    m.emissiveTexture = this.labelTex;
    m.disableLighting = true;
    m.useAlphaFromDiffuseTexture = true;
    m.backFaceCulling = false;
    plane.material = m;
    plane.renderingGroupId = 1;
    this.world.glow.addExcludedMesh(plane);
    this.label = plane;
    this.labelKey = '';
  }

  updateLabel() {
    if (!this.plot) return;
    const lvl = cityLevelName(this.pop);
    const key = `${this.plot.name}|${this.plot.color}|${lvl}|${this.plot.rebirths}`;
    if (key === this.labelKey) return;
    this.labelKey = key;
    const ctx = this.labelTex.getContext();
    ctx.clearRect(0, 0, 640, 160);
    ctx.fillStyle = 'rgba(20,24,40,0.72)';
    roundRect(ctx, 40, 18, 560, 124, 40);
    ctx.fill();
    ctx.fillStyle = this.plot.color;
    ctx.beginPath();
    ctx.arc(100, 80, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 50px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const stars = this.plot.rebirths ? ` ${'★'.repeat(Math.min(this.plot.rebirths, 5))}` : '';
    ctx.fillText(`${this.plot.name}${stars}`, 140, 64, 440);
    ctx.font = '34px system-ui, sans-serif';
    ctx.fillStyle = '#ffe39a';
    ctx.fillText(`🏙️ ${lvl}`, 140, 112, 440);
    this.labelTex.update();
  }

  setLabelVisible(v) {
    this.label.setEnabled(v);
  }

  // Bölüm başına güç dağılımı (enerji akışı için)
  producingGenerators() {
    return [...this.gens.values()].filter((e) => CATEGORY_BY_ID[e.def.cat]);
  }

  dispose() {
    for (const gid of [...this.gens.keys()]) this.removeGen(gid);
    for (const d of this.decor) this.world.disposeInstance(d);
    this.city.dispose();
    this.effects.dispose();
    this.world.disposeInstance(this.body);
    this.ground.dispose();
    this.texture.dispose();
    this.label.dispose();
    this.labelTex.dispose();
    this.root.dispose();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export { tileDistance };
