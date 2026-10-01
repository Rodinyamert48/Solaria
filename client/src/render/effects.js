// Parçacık efektleri (duman/buhar/alev) ve şehre akan enerji parıltıları
import {
  ParticleSystem, DynamicTexture, Vector3, Color4, Matrix, Quaternion, CreateSphere, StandardMaterial, Color3,
} from './babylon.js';

const IDENTITY_Q = Quaternion.Identity();
const ORB_SCALE = new Vector3();
const ORB_POS = new Vector3();

let sharedTexture = null;
function particleTexture(scene) {
  if (sharedTexture) return sharedTexture;
  const tex = new DynamicTexture('puff', { width: 64, height: 64 }, scene, false);
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  tex.hasAlpha = true;
  tex.update();
  sharedTexture = tex;
  return tex;
}

const KINDS = {
  smoke: {
    c1: [0.32, 0.32, 0.35, 0.55], c2: [0.45, 0.44, 0.44, 0.45], dead: [0.6, 0.6, 0.6, 0],
    size: [0.35, 0.8], life: [2.2, 4], rate: 4, power: [0.4, 0.7], grow: 1.6, blend: ParticleSystem.BLENDMODE_STANDARD,
  },
  lightsmoke: {
    c1: [0.7, 0.7, 0.72, 0.35], c2: [0.8, 0.8, 0.8, 0.3], dead: [0.9, 0.9, 0.9, 0],
    size: [0.3, 0.6], life: [1.6, 3], rate: 3, power: [0.4, 0.7], grow: 1.4, blend: ParticleSystem.BLENDMODE_STANDARD,
  },
  steam: {
    c1: [1, 1, 1, 0.55], c2: [0.95, 0.97, 1, 0.45], dead: [1, 1, 1, 0],
    size: [0.5, 1.1], life: [2, 3.4], rate: 4, power: [0.35, 0.6], grow: 1.5, blend: ParticleSystem.BLENDMODE_STANDARD,
  },
  fire: {
    c1: [1, 0.75, 0.25, 1], c2: [1, 0.4, 0.1, 1], dead: [0.4, 0.1, 0, 0],
    size: [0.15, 0.35], life: [0.35, 0.7], rate: 14, power: [0.6, 1.1], grow: 0.4, blend: ParticleSystem.BLENDMODE_ADD,
  },
};

function makeSystem(scene, kind, capacity) {
  const k = KINDS[kind];
  const ps = new ParticleSystem(`fx-${kind}`, capacity, scene);
  ps.particleTexture = particleTexture(scene);
  ps.emitter = Vector3.Zero();
  ps.color1 = new Color4(...k.c1);
  ps.color2 = new Color4(...k.c2);
  ps.colorDead = new Color4(...k.dead);
  ps.minSize = k.size[0];
  ps.maxSize = k.size[1];
  ps.minLifeTime = k.life[0];
  ps.maxLifeTime = k.life[1];
  ps.minEmitPower = k.power[0];
  ps.maxEmitPower = k.power[1];
  ps.direction1 = new Vector3(-0.15, 1, -0.15);
  ps.direction2 = new Vector3(0.15, 1.3, 0.15);
  ps.gravity = new Vector3(0.25, 0.15, 0.1);
  ps.blendMode = k.blend;
  ps.addSizeGradient(0, 0.6);
  ps.addSizeGradient(1, k.grow);
  ps.minAngularSpeed = -0.6;
  ps.maxAngularSpeed = 0.6;
  ps.updateSpeed = 0.016;
  ps.preWarmCycles = 60;
  ps.points = [];
  ps.startPositionFunction = (_m, pos) => {
    const pts = ps.points;
    if (!pts.length) return pos.set(0, -1000, 0);
    const p = pts[(Math.random() * pts.length) | 0];
    pos.set(p.x + (Math.random() - 0.5) * 0.08, p.y, p.z + (Math.random() - 0.5) * 0.08);
  };
  return ps;
}

// Bir adanın baca/kule efektleri. Her tür için tek bir parçacık sistemi, çok yayıcı noktası.
export class IslandEffects {
  constructor(world, island) {
    this.world = world;
    this.island = island;
    this.systems = {};
  }

  rebuild() {
    const scene = this.world.scene;
    const byKind = {};
    const origin = this.island.root.position;
    for (const e of this.island.gens.values()) {
      const tpl = this.world.templates.generator(e.g.type);
      if (!tpl.emitters.length) continue;
      // Hedef dönüşümden hesapla (yeni santral henüz büyüme animasyonunda olabilir)
      const base = this.island.tileCenter(e.g.x, e.g.y, e.def.size).addInPlace(origin);
      const s = 1 + 0.05 * (e.g.level - 1);
      for (const em of tpl.emitters) {
        (byKind[em.type] ||= []).push(base.add(em.pos.scale(s)));
      }
    }
    for (const kind of Object.keys(KINDS)) {
      const pts = byKind[kind] || [];
      let ps = this.systems[kind];
      if (!pts.length) {
        if (ps) ps.stop();
        if (ps) ps.points = [];
        continue;
      }
      if (!ps) {
        ps = this.systems[kind] = makeSystem(scene, kind, Math.min(1500, 120 + pts.length * 60));
      }
      ps.points = pts;
      ps.emitRate = Math.min(400, KINDS[kind].rate * pts.length);
      if (!ps.isStarted()) ps.start();
    }
  }

  dispose() {
    for (const ps of Object.values(this.systems)) ps.dispose(false);
    this.systems = {};
  }
}

// Kendi adamızda santrallerden şehre akan enerji parıltıları (thin instance)
export class EnergyFlow {
  constructor(scene, glowColor = '#7ff6ff') {
    this.scene = scene;
    this.max = 90;
    this.mesh = CreateSphere('energyOrb', { diameter: 0.22, segments: 4 }, scene);
    const m = new StandardMaterial('energyOrbMat', scene);
    m.emissiveColor = Color3.FromHexString(glowColor);
    m.diffuseColor = Color3.Black();
    m.disableLighting = true;
    this.mesh.material = m;
    this.mesh.isPickable = false;
    this.matrices = new Float32Array(this.max * 16);
    this.mesh.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
    this.orbs = [];
    this.sources = [];
    this.target = Vector3.Zero();
    this.rate = 0;
    this.acc = 0;
    this.tmp = Matrix.Identity();
  }

  // sources: [{ pos: Vector3 (dünya), weight }], target: şehir merkezi
  setSources(sources, target, intensity) {
    this.sources = sources;
    this.target = target;
    this.rate = sources.length ? Math.min(40, 4 + intensity * 30) : 0;
  }

  update(dt) {
    this.acc += this.rate * dt;
    while (this.acc >= 1 && this.orbs.length < this.max && this.sources.length) {
      this.acc -= 1;
      const s = this.sources[(Math.random() * this.sources.length) | 0];
      this.orbs.push({ from: s.pos, t: 0, speed: 0.5 + Math.random() * 0.4, h: 1.5 + Math.random() * 2 });
    }
    if (this.acc > 3) this.acc = 0;
    let n = 0;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.t += dt * o.speed;
      if (o.t >= 1) this.orbs.splice(i, 1);
    }
    for (const o of this.orbs) {
      const t = o.t;
      const x = o.from.x + (this.target.x - o.from.x) * t;
      const z = o.from.z + (this.target.z - o.from.z) * t;
      const y = o.from.y + (this.target.y - o.from.y) * t + Math.sin(Math.PI * t) * o.h;
      const s = 0.6 + Math.sin(Math.PI * t) * 0.6;
      ORB_SCALE.setAll(s);
      ORB_POS.set(x, y, z);
      Matrix.ComposeToRef(ORB_SCALE, IDENTITY_Q, ORB_POS, this.tmp);
      this.tmp.copyToArray(this.matrices, n * 16);
      n++;
    }
    this.mesh.thinInstanceCount = n;
    this.mesh.isVisible = n > 0;
    if (n > 0) this.mesh.thinInstanceBufferUpdated('matrix');
  }
}
