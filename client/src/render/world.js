// 3D dünya: Babylon motoru, sahne, ışıklar, gece/gündüz, post-processing, adalar, animasyonlar,
// seçim ve inşa önizlemesi. Grafik ayarları applySettings() ile canlı değiştirilir.
import {
  Engine, Scene, Vector3, Color3, Color4, Matrix, HemisphericLight, DirectionalLight, ShadowGenerator,
  GlowLayer, Layer, DynamicTexture, StandardMaterial, TransformNode, CreateBox, CreatePlane,
  DefaultRenderingPipeline, SSAO2RenderingPipeline, ImageProcessingConfiguration, ColorCurves,
} from './babylon.js';
import { envAt, sunHeight } from '@shared/env.js';
import { GENERATOR_BY_ID } from '@shared/data/generators.js';
import { Templates } from './templates.js';
import { IsoCamera } from './camera.js';
import { Island, slotPosition } from './island.js';
import { EnergyFlow } from './effects.js';
import { glowMaterial, buildTemplate } from './kit.js';
import { updateMaterials } from './materials.js';
import { G } from './models/palette.js';

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (c1, c2, t) => new Color3(lerp(c1.r, c2.r, t), lerp(c1.g, c2.g, t), lerp(c1.b, c2.b, t));
const hex = (h) => Color3.FromHexString(h);

const SKY = {
  night: [hex('#0a1130'), hex('#273461')],
  dusk: [hex('#3f4d8c'), hex('#f5a46f')],
  day: [hex('#3f8fe8'), hex('#b4dcfb')],
};

export class World {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, antialias: true }, true);
    const scene = (this.scene = new Scene(this.engine));
    scene.clearColor = new Color4(0, 0, 0, 0);
    scene.skipPointerMovePicking = true;
    scene.autoClear = true;
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogStart = 275;
    scene.fogEnd = 620;

    this.cam = new IsoCamera(scene, canvas);
    this.templates = new Templates(scene);
    this.islands = new Map();
    this.anims = new Set();
    this.casters = new Set();
    this.tweens = [];
    this.mySlot = -1;
    this.timeFn = () => Date.now();
    this.time = 0;
    this.listeners = {};
    this.particleScale = 1;
    this.gfx = {};
    this.buildMode = false;

    this.setupLights();
    this.templates.glow = this.glow;
    this.setupSky();
    this.setupClouds();
    this.setupHelpers();
    this.flow = new EnergyFlow(scene);
    this.glow.addExcludedMesh?.(this.flow.mesh);

    this.cam.allowLeftPan = () => true;
    this.bindPointer();
    if (settings) this.applySettings(settings);

    let last = performance.now();
    let fpsTimer = 0;
    this.engine.runRenderLoop(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.frame(dt);
      scene.render();
      fpsTimer += dt;
      if (fpsTimer > 0.5) {
        fpsTimer = 0;
        this.emit('fps', this.engine.getFps());
      }
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
    this.sun.autoCalcShadowZBounds = true;
    this.makeShadowGenerator(2048, 'yumusak');

    this.glow = new GlowLayer('glow', scene, { mainTextureRatio: 0.5, blurKernelSize: 40 });
    this.glow.intensity = 0.7;
    this.windowMat = glowMaterial(scene, G.window);
  }

  makeShadowGenerator(size, mode) {
    if (this.shadows) this.shadows.dispose();
    const sg = new ShadowGenerator(size, this.sun);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = mode === 'yumusak' ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_LOW;
    sg.bias = 0.0015;
    sg.normalBias = 0.012;
    sg.setDarkness(0.35);
    for (const c of this.casters) sg.addShadowCaster(c, false);
    this.shadows = sg;
    this.shadowKey = `${size}|${mode}`;
  }

  // ---- Grafik ayarları ----

  applySettings(s) {
    const prev = this.gfx;
    this.gfx = { ...s };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.engine.setHardwareScalingLevel(1 / (dpr * (s.renderScale / 100)));

    // Gölgeler
    const shadowsOn = s.shadows !== 'kapali';
    this.sun.shadowEnabled = shadowsOn;
    if (shadowsOn && this.shadowKey !== `${s.shadowSize}|${s.shadows}`) this.makeShadowGenerator(s.shadowSize, s.shadows);

    this.glow.isEnabled = !!s.glow;
    this.particleScale = s.particles;
    if (prev.particles !== s.particles) for (const island of this.islands.values()) island.effects.rebuild();
    for (const c of this.clouds) c.node.setEnabled(!!s.clouds);
    this.flow.mesh.setEnabled(!!s.flow);
    this.flowEnabled = !!s.flow;
    this.cam.setAngle(s.cameraAngle);
    if (prev.grid !== s.grid) this.refreshGrid();

    const pipeKey = `${!!s.bloom}|${!!s.ssao}|${!!s.msaa}`;
    if (pipeKey !== this.pipeKey) this.rebuildPipelines(s);
  }

  rebuildPipelines(s) {
    this.pipeKey = `${!!s.bloom}|${!!s.ssao}|${!!s.msaa}`;
    const cam = this.cam.camera;
    this.ssao?.dispose();
    this.pipeline?.dispose();
    this.ssao = null;
    if (s.ssao) {
      try {
        const ssao = new SSAO2RenderingPipeline('ssao', this.scene, { ssaoRatio: 0.6, blurRatio: 0.6 }, [cam], true);
        ssao.radius = 0.9;
        ssao.totalStrength = 1.1;
        ssao.base = 0.15;
        ssao.samples = 16;
        ssao.maxZ = 600;
        ssao.expensiveBlur = true;
        this.ssao = ssao;
      } catch (err) {
        console.warn('SSAO desteklenmiyor', err);
      }
    }
    const p = new DefaultRenderingPipeline('post', true, this.scene, [cam]);
    p.samples = s.msaa ? 4 : 1;
    p.fxaaEnabled = !s.msaa;
    p.imageProcessingEnabled = true;
    const ip = p.imageProcessing;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.exposure = 1.08;
    ip.contrast = 1.18;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 1.1;
    ip.vignetteColor = new Color4(0.05, 0.08, 0.18, 0);
    ip.vignetteStretch = 0.4;
    ip.colorCurvesEnabled = true;
    const curves = new ColorCurves();
    curves.globalSaturation = 16;
    curves.highlightsExposure = -8;
    ip.colorCurves = curves;
    p.bloomEnabled = !!s.bloom;
    p.bloomThreshold = 0.82;
    p.bloomWeight = 0.28;
    p.bloomKernel = 48;
    p.bloomScale = 0.5;
    p.sharpenEnabled = true;
    p.sharpen.edgeAmount = 0.18;
    this.pipeline = p;
  }

  setBuildMode(on) {
    this.buildMode = on;
    this.refreshGrid();
  }

  refreshGrid() {
    const show = this.gfx.grid === 'her-zaman' || this.buildMode;
    for (const island of this.islands.values()) island.setGridVisible(show && island.slot === this.mySlot);
  }

  // ---- Gökyüzü ----

  setupSky() {
    this.skyTex = new DynamicTexture('sky', { width: 256, height: 256 }, this.scene, false);
    this.skyLayer = new Layer('skyLayer', null, this.scene, true);
    this.skyLayer.texture = this.skyTex;
    this.skyKey = '';
    // Yıldızlar ayrı bir katmanda (gece görünür)
    this.starTex = new DynamicTexture('stars', { width: 1024, height: 512 }, this.scene, false);
    const ctx = this.starTex.getContext();
    ctx.clearRect(0, 0, 1024, 512);
    for (let i = 0; i < 320; i++) {
      const r = Math.random();
      ctx.fillStyle = `rgba(255,255,255,${0.25 + r * 0.75})`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 420, r > 0.93 ? 2 : 1, r > 0.93 ? 2 : 1);
    }
    this.starTex.hasAlpha = true;
    this.starTex.update();
    this.starLayer = new Layer('stars', null, this.scene, true);
    this.starLayer.texture = this.starTex;
    this.starLayer.alphaBlendingMode = Engine.ALPHA_ADD;
  }

  // Dikey renk geçişi + güneş/ay parıltısı
  drawSky(top, bottom, glow) {
    // doku tüm ekrana gerilir: daireler bozulmasın diye en-boy oranını telafi et
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    const key = `${top.toHexString()}${bottom.toHexString()}${Math.round(glow.x * 60)}|${Math.round(glow.y * 60)}|${Math.round(glow.a * 20)}|${glow.moon}|${aspect.toFixed(2)}`;
    if (key === this.skyKey) return;
    this.skyKey = key;
    const ctx = this.skyTex.getContext();
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top.toHexString());
    g.addColorStop(1, bottom.toHexString());
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    if (glow.a > 0.01) {
      ctx.save();
      ctx.translate(glow.x * 256, glow.y * 256);
      ctx.scale(1, aspect);
      const x = 0;
      const y = 0;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, glow.moon ? 18 : 34);
      const c = glow.moon ? '220,230,255' : '255,236,190';
      halo.addColorStop(0, `rgba(${c},${0.85 * glow.a})`);
      halo.addColorStop(0.2, `rgba(${c},${0.35 * glow.a})`);
      halo.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(-60, -60, 120, 120);
      ctx.fillStyle = glow.moon ? `rgba(240,244,255,${glow.a})` : `rgba(255,250,235,${glow.a})`;
      ctx.beginPath();
      ctx.arc(x, y, glow.moon ? 3 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    this.skyTex.update();
  }

  setupClouds() {
    const tpl = buildTemplate(this.scene, 'cloud', (k) => {
      const o = { seg: 12, smooth: true, ao: false };
      k.sphere(2.4, '#ffffff', { ...o, sy: 0.62 });
      k.sphere(1.8, '#ffffff', { ...o, x: 1.4, y: -0.1, sy: 0.62 });
      k.sphere(1.6, '#ffffff', { ...o, x: -1.3, y: -0.15, sy: 0.62 });
      k.sphere(1.4, '#ffffff', { ...o, x: 0.4, y: 0.45, z: 0.5, sy: 0.7 });
      k.sphere(1.2, '#ffffff', { ...o, x: -0.6, y: 0.35, z: -0.4, sy: 0.7 });
    });
    this.cloudMat = new StandardMaterial('cloudMat', this.scene);
    this.cloudMat.diffuseColor = new Color3(1, 1, 1);
    this.cloudMat.specularColor = Color3.Black();
    this.cloudMat.emissiveColor = new Color3(0.55, 0.58, 0.66);
    this.cloudMat.alpha = 0.9;
    for (const g of tpl.groups)
      for (const m of g.meshes) {
        m.material = this.cloudMat;
        this.glow.addExcludedMesh(m);
      }
    this.clouds = [];
    const root = new TransformNode('clouds', this.scene);
    for (let i = 0; i < 26; i++) {
      const inst = tpl.instantiate(root);
      const s = 1 + Math.random() * 2.4;
      inst.root.scaling.set(s, s * 0.9, s);
      inst.root.position.set(-130 + Math.random() * 260, -16 + Math.random() * 12, -95 + Math.random() * 190);
      this.clouds.push({ node: inst.root, speed: 0.5 + Math.random() * 0.8 });
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
    if (opts.noShadow !== true)
      for (const c of inst.casters) {
        this.casters.add(c);
        this.shadows.addShadowCaster(c, false);
      }
    if (opts.freeze) this.freeze(inst);
  }

  disposeInstance(inst) {
    if (!inst) return;
    for (const a of inst.anims) this.anims.delete(a);
    for (const c of inst.casters) {
      if (this.casters.delete(c)) this.shadows.removeShadowCaster(c, false);
    }
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

  unfreeze(inst) {
    const walk = (node) => {
      node.unfreezeWorldMatrix?.();
      for (const ch of node.getChildren()) walk(ch);
    };
    walk(inst.root);
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
      island.setGridVisible((this.gfx.grid === 'her-zaman' || this.buildMode) && plot.slot === this.mySlot);
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
      if (e.def.storage) continue;
      const p = e.inst.root.getAbsolutePosition().clone();
      p.y += 0.6 + e.def.size * 0.3;
      sources.push({ pos: p });
    }
    const target = island.cityNode.getAbsolutePosition().clone();
    target.y += 1.2;
    this.flow.setSources(this.flowEnabled === false ? [] : sources, target, Math.min(1, sources.length / 30) * coverage);
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

  // Karo merkezinin ekran koordinatı (eğitim, testler ve yüzen yazılar için)
  tileToScreen(slot, x, y, size = 1) {
    const island = this.islands.get(slot);
    if (!island) return null;
    return this.worldToScreen(island.tileCenter(x, y, size).add(island.root.position));
  }

  worldToScreen(p) {
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
    const warm = smooth(0, 0.45, h);
    this.sun.diffuse = isDay ? mix(hex('#ffad66'), hex('#fff4e2'), warm) : hex('#9db4ff');
    this.sun.specular = this.sun.diffuse;
    this.sun.intensity = isDay ? 0.3 + 1.05 * day : 0.32;
    this.hemi.intensity = 0.38 + 0.32 * day;
    this.hemi.diffuse = mix(hex('#6d7bc0'), hex('#dcecff'), day);
    this.hemi.groundColor = mix(hex('#1c2140'), hex('#7d7a68'), day);
    this.shadows.setDarkness(lerp(0.55, 0.25, day));
    this.fitShadows();

    // Gökyüzü
    const dusk = 1 - smooth(0, 0.35, Math.abs(h));
    const top = mix(mix(SKY.night[0], SKY.day[0], day), SKY.dusk[0], dusk * 0.6);
    const bottom = mix(mix(SKY.night[1], SKY.day[1], day), SKY.dusk[1], dusk * 0.8);
    // Güneş gündüz sağdan sola, ay gece yükselir
    const p = env.phase;
    const glow = isDay
      ? { x: 0.88 - (p / 0.5) * 0.76, y: 0.42 - Math.max(0, h) * 0.3, a: smooth(-0.06, 0.15, h), moon: false }
      : { x: 0.88 - ((p - 0.5) / 0.5) * 0.76, y: 0.42 - Math.max(0, -h) * 0.3, a: smooth(0.06, 0.25, -h) * 0.9, moon: true };
    this.drawSky(top, bottom, glow);
    this.scene.fogColor = bottom;
    this.starLayer.color = new Color4(1, 1, 1, smooth(0.5, 1, night));

    // Pencereler ve sokak lambaları gece yanar
    const lights = smooth(0.25, 0.85, night);
    this.windowMat.emissiveColor = mix(hex('#3d5168'), hex('#ffd77a'), lights);
    updateMaterials(lights, this.time);
    this.glow.intensity = 0.55 + 0.2 * night;
    // parçacıklar (buhar/duman) gece kararsın
    if (Math.abs((this.lastFxLight ?? -1) - lights) > 0.05) {
      this.lastFxLight = lights;
      for (const island of this.islands.values()) island.effects.setLight(1 - lights * 0.7);
    }
  }

  // Gölge kamerasını görünen alana oturt: aynı harita çözünürlüğüyle çok daha keskin gölge
  fitShadows() {
    const cam = this.cam;
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    const size = Math.max(2 * cam.zoom * aspect, (2 * cam.zoom) / Math.cos(cam.beta)) * 1.2;
    this.sun.shadowFrustumSize = Math.max(30, size);
    this.sun.position = cam.target.subtract(this.sun.direction.scale(160));
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
      if (c.node.position.x > 135) c.node.position.x = -135;
    }
    if (this.flowEnabled !== false) this.flow.update(dt);
    this.emit('frame', dt);
  }
}
