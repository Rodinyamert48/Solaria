// Bir oyuncunun adası: zemin, jeneratörler, şehir, isim etiketi ve efektler
import {
  TransformNode, StandardMaterial, DynamicTexture, Color3, Vector3, Mesh, CreateGround, CreatePlane,
} from './babylon.js';
import { GENERATOR_BY_ID } from '@shared/data/generators.js';
import { cityLevelName } from '@shared/economy.js';
import { ISLAND_SIZE, CITY_MIN, CITY_MAX, isCityTile, isUnlocked } from '@shared/grid.js';
import { City } from './city.js';
import { IslandEffects } from './effects.js';
import { paintGround } from './groundPainter.js';

export const SPACING = 48;
// Karo başına doku pikseli (dokunmatik/küçük cihazlarda daha düşük)
const TILE_PX = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 32 : 48;
const HALF = ISLAND_SIZE / 2;
// Şelalenin adadaki yeri (adanın +x yüzü)
export const WATERFALL = { x: HALF + 0.12, z: 4.5, top: -0.55, bottom: -12.5 };

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
    this.grid = false;
    this.fence = [];
    this.seed = slot * 7919 + 13;
    // Ada kenarındaki şelalenin dibindeki su sisi
    this.staticEmitters = [{ type: 'mist', pos: new Vector3(WATERFALL.x + 0.6, WATERFALL.bottom + 0.6, WATERFALL.z) }];

    this.body = world.templates.get('island').instantiate(this.root);
    world.registerInstance(this.body, { noShadow: true, freeze: true });

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
      this.rebuildFence();
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
        if (cur.g.x !== g.x || cur.g.y !== g.y || cur.g.level !== g.level) this.placeGen(cur, g, true);
        cur.g = g;
      }
    }
    for (const gid of [...this.gens.keys()]) if (!seen.has(gid)) this.removeGen(gid);
    this.ready = true;
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
    const entry = { g, def, inst };
    this.gens.set(g.gid, entry);
    this.placeGen(entry, g, this.plot !== null && this.ready);
  }

  // animate: yeni kurulan santral "büyüyerek" belirir
  placeGen(entry, g, animate = false) {
    const root = entry.inst.root;
    this.world.unfreeze(entry.inst);
    root.position.copyFrom(this.tileCenter(g.x, g.y, entry.def.size));
    const s = 1 + 0.05 * (g.level - 1);
    if (animate) {
      root.scaling.setAll(0.05);
      this.world.tween(root, s, 0.35, () => this.world.freeze(entry.inst));
    } else {
      root.scaling.setAll(s);
      this.world.freeze(entry.inst);
    }
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
    paintGround(this.texture.getContext(), TILE_PX, { land: this.land, grid: this.grid });
    this.texture.update();
  }

  setGridVisible(show) {
    if (show === this.grid) return;
    this.grid = show;
    if (this.land >= 0) this.drawGround();
  }

  // Açık arazinin sınırında ahşap çit
  rebuildFence() {
    for (const f of this.fence) this.world.disposeInstance(f);
    this.fence = [];
    let r = 0;
    while (r < ISLAND_SIZE && isUnlocked(Math.floor(HALF) + r, Math.floor(HALF), this.land)) r++;
    const a = Math.floor(HALF) - r;
    const b = Math.floor(HALF) + r;
    if (a <= 0) return; // tüm ada açık: çit yok
    const tpl = this.world.templates.get('fence');
    const place = (x, z, rot) => {
      const inst = tpl.instantiate(this.root);
      inst.root.position.set(x - HALF, 0, z - HALF);
      inst.root.rotation.y = rot;
      this.world.registerInstance(inst, { freeze: true });
      this.fence.push(inst);
    };
    for (let i = a; i < b; i++) {
      place(i + 0.5, a, 0);
      place(i + 0.5, b, 0);
      place(a, i + 0.5, Math.PI / 2);
      place(b, i + 0.5, Math.PI / 2);
    }
  }

  // Kilitli arazide süs ağaçları ve kayalar
  rebuildDecor() {
    for (const d of this.decor) this.world.disposeInstance(d);
    this.decor = [];
    for (let y = 0; y < ISLAND_SIZE; y++) {
      for (let x = 0; x < ISLAND_SIZE; x++) {
        if (isUnlocked(x, y, this.land) || isCityTile(x, y)) continue;
        const r = hash(x, y, this.seed);
        if (r > 0.22) continue;
        const key = r < 0.03 ? 'rock' : r < 0.06 ? 'bush' : `tree:${Math.floor(r * 1000) % 5}`;
        const inst = this.world.templates.get(key).instantiate(this.root);
        inst.root.position.copyFrom(this.tileCenter(x, y));
        inst.root.rotation.y = r * 40;
        const sc = 0.85 + hash(y, x, this.seed) * 0.4;
        inst.root.scaling.setAll(sc);
        // karo içinde hafif rastgele kaydır (ızgara hissini kır)
        inst.root.position.x += (hash(x, y, 7) - 0.5) * 0.4;
        inst.root.position.z += (hash(x, y, 9) - 0.5) * 0.4;
        this.world.registerInstance(inst, { freeze: true });
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

  dispose() {
    for (const gid of [...this.gens.keys()]) this.removeGen(gid);
    for (const d of this.decor) this.world.disposeInstance(d);
    for (const f of this.fence) this.world.disposeInstance(f);
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
