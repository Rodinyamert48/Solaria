// 3D dünya: Babylon motoru, sahne, ışıklar, gece/gündüz, adalar, animasyonlar, seçim ve inşa önizlemesi
import {
  Engine, Scene, Vector3, Color3, Color4, Matrix, HemisphericLight, DirectionalLight, ShadowGenerator,
  GlowLayer, Layer, DynamicTexture, StandardMaterial, TransformNode, CreateBox, CreatePlane,
} from './babylon.js';
import { envAt, sunHeight } from '@shared/env.js';
import { GENERATOR_BY_ID } from '@shared/data/generators.js';
import { Templates } from './templates.js';
import { IsoCamera } from './camera.js';
import { Island, slotPosition } from './island.js';
import { EnergyFlow } from './effects.js';
import { glowMaterial, buildTemplate } from './kit.js';
import { G } from './models/palette.js';

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (c1, c2, t) => new Color3(lerp(c1.r, c2.r, t), lerp(c1.g, c2.g, t), lerp(c1.b, c2.b, t));
const hex = (h) => Color3.FromHexString(h);

const SKY = {
  night: [hex('#0b1230'), hex('#26315e')],
  dusk: [hex('#41508f'), hex('#f3a274')],
  day: [hex('#62aef5'), hex('#d9f0ff')],
};

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, antialias: true }, true);
    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
    const scene = (this.scene = new Scene(this.engine));
    scene.clearColor = new Color4(0, 0, 0, 0);
    scene.skipPointerMovePicking = true;
    scene.autoClear = true;

    this.cam = new IsoCamera(scene, canvas);
    this.templates = new Templates(scene);
    this.islands = new Map();
    this.anims = new Set();
    this.tweens = [];
    this.mySlot = -1;
    this.timeFn = () => Date.now();
    this.time = 0;
    this.listeners = {};

    this.setupLights();
    this.setupSky();
    this.setupClouds();
    this.setupHelpers();
    this.flow = new EnergyFlow(scene);
    this.glow.addExcludedMesh?.(this.flow.mesh);

    this.cam.allowLeftPan = () => true;
    this.bindPointer();

    let last = performance.now();
    this.engine.runRenderLoop(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.frame(dt);
      scene.render();
    });
    window.addEventListener('resize', () => this.engine.resize());
  }

  on(event, fn) {
    (this.listeners[event] ||= []).push(fn);
  }

  emit(event, data) {
    for (const fn of this.listeners[event] || []) fn(data);
  }

  setupLights() {
    const scene = this.scene;
    this.hemi = new HemisphericLight('hemi', new Vector3(0.3, 1, 0.2), scene);
    this.hemi.intensity = 0.7;
    this.sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.4), scene);
    this.sun.intensity = 1;
    this.sun.position = new Vector3(60, 120, 50);
    this.sun.autoUpdateExtends = true;
    this.sun.autoCalcShadowZBounds = true;

    this.shadows = new ShadowGenerator(2048, this.sun);
    this.shadows.usePercentageCloserFiltering = true;
    this.shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    this.shadows.bias = 0.002;
    this.shadows.normalBias = 0.015;
    this.shadows.setDarkness(0.35);

    this.glow = new GlowLayer('glow', scene, { mainTextureRatio: 0.5, blurKernelSize: 40 });
    this.glow.intensity = 0.7;
    this.windowMat = glowMaterial(scene, G.window);
  }

  setupSky() {
    this.skyTex = new DynamicTexture('sky', { width: 4, height: 256 }, this.scene, false);
    this.skyLayer = new Layer('skyLayer', null, this.scene, true);
    this.skyLayer.texture = this.skyTex;
    this.skyKey = '';
    // Yıldızlar ayrı bir katmanda (gece görünür)
    this.starTex = new DynamicTexture('stars', { width: 1024, height: 512 }, this.scene, false);
    const ctx = this.starTex.getContext();
    ctx.clearRect(0, 0, 1024, 512);
    for (let i = 0; i < 260; i++) {
      const r = Math.random();
      ctx.fillStyle = `rgba(255,255,255,${0.3 + r * 0.7})`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 400, r > 0.92 ? 2 : 1, r > 0.92 ? 2 : 1);
    }
    this.starTex.hasAlpha = true;
    this.starTex.update();
    this.starLayer = new Layer('stars', null, this.scene, true);
    this.starLayer.texture = this.starTex;
    this.starLayer.alphaBlendingMode = Engine.ALPHA_ADD;
  }

  drawSky(top, bottom) {
    const key = `${top.toHexString()}${bottom.toHexString()}`;
    if (key === this.skyKey) return;
    this.skyKey = key;
    const ctx = this.skyTex.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top.toHexString());
    g.addColorStop(1, bottom.toHexString());
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    this.skyTex.update();
  }

  setupClouds() {
    const tpl = buildTemplate(this.scene, 'cloud', (k) => {
      const o = { seg: 10, smooth: true };
      k.sphere(2.4, '#ffffff', { ...o, sy: 0.62 });
      k.sphere(1.8, '#ffffff', { ...o, x: 1.4, y: -0.1, sy: 0.62 });
      k.sphere(1.6, '#ffffff', { ...o, x: -1.3, y: -0.15, sy: 0.62 });
      k.sphere(1.4, '#ffffff', { ...o, x: 0.4, y: 0.45, z: 0.5, sy: 0.7 });
    });
    this.cloudMat = new StandardMaterial('cloudMat', this.scene);
    this.cloudMat.diffuseColor = new Color3(1, 1, 1);
    this.cloudMat.specularColor = Color3.Black();
    this.cloudMat.emissiveColor = new Color3(0.55, 0.58, 0.66);
    this.cloudMat.alpha = 0.92;
    for (const g of tpl.groups)
      for (const m of g.meshes) {
        m.material = this.cloudMat;
        this.glow.addExcludedMesh(m);
      }
    this.clouds = [];
    const root = new TransformNode('clouds', this.scene);
    for (let i = 0; i < 22; i++) {
      const inst = tpl.instantiate(root);
      const s = 1 + Math.random() * 2.2;
      inst.root.scaling.set(s, s, s);
      inst.root.position.set(-120 + Math.random() * 240, -14 + Math.random() * 10, -90 + Math.random() * 180);
      this.clouds.push({ node: inst.root, speed: 0.6 + Math.random() * 0.8 });
    }
  }

  setupHelpers() {
    const scene = this.scene;
    // Seçim çerçevesi
    this.selection = new TransformNode('selection', scene);
    const selMat = glowMaterial(scene, '#7ff6ff');
    const edge = (name) => {
      const b = CreateBox(name, { width: 1, height: 0.06, depth: 0.06 }, scene);
      b.material = selMat;
      b.parent = this.selection;
      b.isPickable = false;
      return b;
    };
    this.selEdges = [edge('s0'), edge('s1'), edge('s2'), edge('s3')];
    this.selection.setEnabled(false);

    // İnşa önizlemesi zemini
    this.footprint = CreatePlane('footprint', { size: 1 }, scene);
    this.footprint.rotation.x = Math.PI / 2;
    this.footprintMat = new StandardMaterial('footprintMat', scene);
    this.footprintMat.disableLighting = true;
    this.footprintMat.alpha = 0.45;
    this.footprint.material = this.footprintMat;
    this.footprint.isPickable = false;
    this.footprint.setEnabled(false);

    this.ghostMatOk = new StandardMaterial('ghostOk', scene);
    this.ghostMatOk.emissiveColor = hex('#7dffb0');
    this.ghostMatOk.diffuseColor = Color3.Black();
    this.ghostMatOk.disableLighting = true;
    this.ghostMatOk.alpha = 0.5;
    this.ghostMatBad = this.ghostMatOk.clone('ghostBad');
    this.ghostMatBad.emissiveColor = hex('#ff6b6b');
    this.ghost = null;
  }

  // ---- Örnek (instance) kayıtları ----

  registerInstance(inst, opts = {}) {
    for (const a of inst.anims) this.anims.add(a);
    if (opts.noShadow !== true) for (const c of inst.casters) this.shadows.addShadowCaster(c, false);
    if (opts.freeze) this.freeze(inst);
  }

  disposeInstance(inst) {
    if (!inst) return;
    for (const a of inst.anims) this.anims.delete(a);
    for (const c of inst.casters) this.shadows.removeShadowCaster(c, false);
    inst.root.dispose();
  }

  freeze(inst) {
    const anim = new Set(inst.anims.map((a) => a.node));
    inst.root.computeWorldMatrix(true);
    const walk = (node) => {
      for (const ch of node.getChildren()) {
        if (anim.has(ch)) continue;
        ch.computeWorldMatrix(true);
        ch.freezeWorldMatrix();
        walk(ch);
      }
    };
    walk(inst.root);
    inst.root.freezeWorldMatrix();
  }

  // Ölçek animasyonu (geri yaylanan "pop" efekti)
  tween(node, target, duration, onDone) {
    this.tweens.push({ node, from: node.scaling.x, target, t: 0, duration, onDone });
  }

  updateTweens(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      if (tw.node.isDisposed()) {
        this.tweens.splice(i, 1);
        continue;
      }
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      const x = tw.t;
      const back = 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2; // easeOutBack
      tw.node.scaling.setAll(tw.from + (tw.target - tw.from) * back);
      if (tw.t >= 1) {
        this.tweens.splice(i, 1);
        tw.onDone?.();
      }
    }
  }

  unfreeze(inst) {
    const walk = (node) => {
      node.unfreezeWorldMatrix?.();
      for (const ch of node.getChildren()) walk(ch);
    };
    walk(inst.root);
  }

  // ---- Adalar ----

  setPlots(plots, mySlot) {
    this.mySlot = mySlot;
    const keep = new Set(plots.map((p) => p.slot));
    for (const slot of [...this.islands.keys()]) if (!keep.has(slot)) this.removePlot(slot);
    for (const p of plots) this.updatePlot(p);
  }

  updatePlot(plot) {
    let island = this.islands.get(plot.slot);
    if (!island) {
      island = new Island(this, plot.slot);
      this.islands.set(plot.slot, island);
    }
    island.applyPlot(plot);
    if (plot.slot === this.mySlot) this.refreshFlow();
  }

  removePlot(slot) {
    const island = this.islands.get(slot);
    if (!island) return;
    island.dispose();
    this.islands.delete(slot);
  }

  setPop(slot, pop) {
    this.islands.get(slot)?.setPop(pop);
  }

  focusSlot(slot, zoom) {
    // Dikey (telefon) ekranlarda adanın tamamı sığsın diye uzaklaş
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    if (zoom && aspect < 1) zoom = Math.min(60, zoom * Math.max(1, 0.85 / aspect));
    this.cam.focus(slotPosition(slot), zoom);
  }

  myIsland() {
    return this.islands.get(this.mySlot);
  }

  refreshFlow(coverage = this.lastCoverage ?? 1) {
    const island = this.myIsland();
    if (!island) return;
    const sources = [];
    for (const e of island.gens.values()) {
      const p = e.inst.root.getAbsolutePosition().clone();
      p.y += 0.6 + e.def.size * 0.3;
      sources.push({ pos: p });
    }
    const target = island.cityNode.getAbsolutePosition().clone();
    target.y += 1.2;
    this.flow.setSources(sources, target, Math.min(1, sources.length / 30) * coverage);
  }

  // ---- Seçim / önizleme ----

  showSelection(slot, g) {
    const island = this.islands.get(slot);
    const def = g && GENERATOR_BY_ID[g.type];
    if (!island || !def) {
      this.selection.setEnabled(false);
      return;
    }
    const s = def.size;
    this.selection.parent = island.root;
    this.selection.position.copyFrom(island.tileCenter(g.x, g.y, s));
    this.selection.position.y = 0.08;
    const [a, b, c, d] = this.selEdges;
    a.scaling.x = b.scaling.x = s;
    c.scaling.x = d.scaling.x = s;
    a.position.set(0, 0, -s / 2);
    b.position.set(0, 0, s / 2);
    c.rotation.y = d.rotation.y = Math.PI / 2;
    c.position.set(-s / 2, 0, 0);
    d.position.set(s / 2, 0, 0);
    this.selection.setEnabled(true);
  }

  setGhost(type) {
    if (this.ghost) {
      this.ghost.root.dispose();
      this.ghost = null;
    }
    this.footprint.setEnabled(false);
    if (!type) return;
    const tpl = this.templates.generator(type);
    const root = new TransformNode('ghostRoot', this.scene);
    const ok = tpl.ghost(root, this.ghostMatOk);
    const bad = tpl.ghost(root, this.ghostMatBad);
    bad.setEnabled(false);
    root.setEnabled(false);
    this.ghost = { type, root, ok, bad, size: GENERATOR_BY_ID[type].size };
  }

  updateGhost(slot, x, y, valid) {
    const island = this.islands.get(slot);
    if (!this.ghost || !island) {
      if (this.ghost) this.ghost.root.setEnabled(false);
      this.footprint.setEnabled(false);
      return;
    }
    const s = this.ghost.size;
    const p = island.tileCenter(x, y, s).add(island.root.position);
    this.ghost.root.position.copyFrom(p);
    this.ghost.root.setEnabled(true);
    this.ghost.ok.setEnabled(valid);
    this.ghost.bad.setEnabled(!valid);
    this.footprint.position.set(p.x, 0.05, p.z);
    this.footprint.scaling.set(s, s, 1);
    this.footprintMat.emissiveColor = hex(valid ? '#5dff9c' : '#ff5d5d');
    this.footprint.setEnabled(true);
  }

  // Karo merkezinin ekran koordinatı (testler ve yüzen yazılar için)
  tileToScreen(slot, x, y, size = 1) {
    const island = this.islands.get(slot);
    if (!island) return null;
    const p = island.tileCenter(x, y, size).add(island.root.position);
    const engine = this.engine;
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const v = Vector3.Project(p, Matrix.Identity(), this.scene.getTransformMatrix(), this.cam.camera.viewport.toGlobal(w, h));
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + (v.x / w) * rect.width, y: rect.top + (v.y / h) * rect.height };
  }

  // ---- Fare ile karo seçimi ----

  groundPoint(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ray = this.scene.createPickingRay(clientX - rect.left, clientY - rect.top, Matrix.Identity(), this.cam.camera);
    if (Math.abs(ray.direction.y) < 1e-6) return null;
    const t = -ray.origin.y / ray.direction.y;
    return ray.origin.add(ray.direction.scale(t));
  }

  tileAt(clientX, clientY) {
    const p = this.groundPoint(clientX, clientY);
    if (!p) return null;
    for (const island of this.islands.values()) {
      const tile = island.worldToTile(p);
      if (tile) return { slot: island.slot, island, ...tile };
    }
    return null;
  }

  bindPointer() {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => {
      if (this.cam.pointers.size > 1) return;
      this.hover = this.tileAt(e.clientX, e.clientY);
      this.emit('hover', this.hover);
    });
    c.addEventListener('pointerup', (e) => {
      if (this.cam.dragging) return;
      const info = this.tileAt(e.clientX, e.clientY);
      this.emit('click', { ...info, button: e.button });
    });
    c.addEventListener('pointerleave', () => this.emit('hover', null));
  }

  // ---- Kare güncellemesi ----

  setTimeSource(fn) {
    this.timeFn = fn;
  }

  updateEnvironment() {
    const now = this.timeFn();
    const env = (this.env = envAt(now));
    const h = sunHeight(now);
    const day = env.daylight;
    const night = 1 - day;

    // Güneş / ay yönü
    const ang = env.phase * Math.PI * 2;
    const sunPos = new Vector3(Math.cos(ang) * 0.9, Math.sin(ang), 0.45);
    const isDay = h > -0.06;
    const dir = isDay ? sunPos.scale(-1) : sunPos.clone();
    dir.y = -Math.max(0.35, Math.abs(dir.y));
    this.sun.direction = dir.normalize();
    this.sun.position = this.cam.target.subtract(this.sun.direction.scale(150));
    const warm = smooth(0, 0.45, h);
    this.sun.diffuse = isDay ? mix(hex('#ffb070'), hex('#fff6e6'), warm) : hex('#9db4ff');
    this.sun.intensity = isDay ? 0.25 + 1.0 * day : 0.3;
    this.hemi.intensity = 0.42 + 0.35 * day;
    this.hemi.diffuse = mix(hex('#6d7bc0'), hex('#ffffff'), day);
    this.hemi.groundColor = mix(hex('#1c2140'), hex('#8c8a78'), day);
    this.shadows.setDarkness(lerp(0.55, 0.32, day));

    // Gökyüzü
    const dusk = 1 - smooth(0, 0.35, Math.abs(h));
    const top = mix(mix(SKY.night[0], SKY.day[0], day), SKY.dusk[0], dusk * 0.6);
    const bottom = mix(mix(SKY.night[1], SKY.day[1], day), SKY.dusk[1], dusk * 0.8);
    this.drawSky(top, bottom);
    this.starLayer.color = new Color4(1, 1, 1, smooth(0.5, 1, night));

    // Pencereler gece yanar
    this.windowMat.emissiveColor = mix(hex('#3d5168'), hex('#ffd77a'), smooth(0.25, 0.85, night));
    this.glow.intensity = 0.55 + 0.45 * night;
  }

  frame(dt) {
    this.time += dt;
    this.cam.update(dt);
    this.updateEnvironment();
    const env = this.env;
    const t = this.time;
    for (const a of this.anims) {
      const { node, anim, phase } = a;
      switch (anim.type) {
        case 'spin': {
          const f = anim.driver === 'wind' ? env.wind : 1;
          node.rotation[anim.axis] += anim.speed * f * dt;
          break;
        }
        case 'nod':
          node.rotation[anim.axis] = Math.sin(t * anim.speed + phase) * anim.amp;
          break;
        case 'bob':
          node.position.y = a.base.y + Math.sin(t * anim.speed + phase) * anim.amp;
          break;
        case 'pulse':
          node.scaling.setAll(1 + Math.sin(t * anim.speed + phase) * anim.amp);
          break;
        case 'track': {
          const target = env.daylight > 0.05 ? Math.max(-1, Math.min(1, (env.phase - 0.25) / 0.25)) * anim.amp : 0;
          node.rotation[anim.axis] += (target - node.rotation[anim.axis]) * Math.min(1, dt * 0.8);
          break;
        }
      }
    }
    this.updateTweens(dt);
    for (const island of this.islands.values()) island.city.animate(dt);
    for (const c of this.clouds) {
      c.node.position.x += c.speed * dt;
      if (c.node.position.x > 130) c.node.position.x = -130;
    }
    this.flow.update(dt);
    this.emit('frame', dt);
  }
}
