// Prosedürel model kiti.
// Basit şekillerden (kutu, silindir, küre, torus, lathe) model kurar ve parçaları malzeme anahtarına göre
// birleştirir: 'solid' (köşe renkli), 'metal', 'glass', 'water', 'facade:res|office' (pencere dokulu cephe),
// 'lamp' (gece yanar) ve parlayan 'glow:#renk|alfa'. Hareketli parçalar ayrı gruplarda (dönen kanat, pompa...).
// Sonuç bir "şablon"dur: her yerleştirmede instance oluşturulur (aynı modelden yüzlercesi tek draw call).
import {
  Mesh, TransformNode, Vector3, Vector4, Color3, VertexBuffer,
  CreateBox, CreateCylinder, CreateSphere, CreateTorus, CreateLathe, CreateIcoSphere, CreateTorusKnot,
} from './babylon.js';
import { getMaterial, isTransparentKey, isNoGlowKey } from './materials.js';

export function color3(hex) {
  return Color3.FromHexString(hex);
}

export function glowMaterial(scene, hex, alpha = 1) {
  return getMaterial(scene, `glow:${hex}|${alpha}`);
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Köşe renkleri: yukarı bakan yüzler hafif açık, zemine yakın dikey yüzler koyu (sahte ortam gölgesi)
function paint(mesh, hex, { shade = 0, ao = false } = {}) {
  const c = color3(hex);
  const n = mesh.getTotalVertices();
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const colors = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const up = normals ? normals[i * 3 + 1] : 0;
    let k = 1 + shade * up;
    if (ao && up < 0.5) k *= 0.7 + 0.3 * smoothstep(0, 0.45, positions[i * 3 + 1]);
    colors[i * 4] = Math.min(1, c.r * k);
    colors[i * 4 + 1] = Math.min(1, c.g * k);
    colors[i * 4 + 2] = Math.min(1, c.b * k);
    colors[i * 4 + 3] = 1;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
}

let uid = 0;

class Group {
  constructor(kit, pivot = Vector3.Zero(), anim = null) {
    this.kit = kit;
    this.pivot = pivot;
    this.anim = anim;
    this.parts = new Map(); // malzeme anahtarı -> mesh[]
  }

  get scene() {
    return this.kit.scene;
  }

  _add(mesh, hex, opts = {}, smoothDefault = false) {
    const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = opts;
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.scaling.set(sx, sy, sz);
    mesh.bakeCurrentTransformIntoVertices();
    const smooth = opts.smooth ?? smoothDefault;
    if (!smooth && opts.flat !== false) mesh.convertToFlatShadedMesh();
    let key;
    if (opts.glow) {
      key = `glow:${hex}|${opts.alpha ?? 1}`;
      paint(mesh, '#ffffff');
    } else {
      key = opts.mat || 'solid';
      const isRoot = this.pivot.lengthSquared() === 0;
      paint(mesh, hex, { shade: key.startsWith('facade') ? 0 : opts.shade ?? 0.08, ao: isRoot && opts.ao !== false });
    }
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(mesh);
    return mesh;
  }

  // Kutu. opts.uv: 6 yüz için [u0, v0, u1, v1] (cephe dokuları için)
  box(w, h, d, hex, opts = {}) {
    const faceUV = opts.uv ? opts.uv.map((u) => new Vector4(...u)) : undefined;
    const m = CreateBox(`p${uid++}`, { width: w, height: h, depth: d, faceUV, wrap: true }, this.scene);
    return this._add(m, hex, { ...opts, flat: false });
  }

  // Silindir; y = merkez yüksekliği. dTop=0 -> koni. 8+ kenarda yumuşak gölgelenir.
  cyl(dTop, dBottom, h, hex, opts = {}) {
    const tess = opts.tess ?? 16;
    const m = CreateCylinder(
      `p${uid++}`,
      { diameterTop: dTop, diameterBottom: dBottom, height: h, tessellation: tess, arc: opts.arc ?? 1 },
      this.scene,
    );
    return this._add(m, hex, opts, tess >= 8);
  }

  sphere(d, hex, opts = {}) {
    const ico = opts.ico;
    const m = ico
      ? CreateIcoSphere(`p${uid++}`, { radius: d / 2, subdivisions: opts.sub ?? 1 }, this.scene)
      : CreateSphere(`p${uid++}`, { diameter: d, segments: opts.seg ?? 10, slice: opts.slice ?? 1 }, this.scene);
    return this._add(m, hex, opts, ico ? (opts.sub ?? 1) >= 3 : (opts.seg ?? 10) >= 8);
  }

  dome(d, hex, opts = {}) {
    return this.sphere(d, hex, { seg: 14, slice: 0.5, ...opts });
  }

  torus(d, thickness, hex, opts = {}) {
    const m = CreateTorus(`p${uid++}`, { diameter: d, thickness, tessellation: opts.tess ?? 24 }, this.scene);
    return this._add(m, hex, opts, true);
  }

  knot(radius, tube, hex, opts = {}) {
    const m = CreateTorusKnot(
      `p${uid++}`,
      { radius, tube, radialSegments: 64, tubularSegments: 8, p: opts.p ?? 2, q: opts.q ?? 3 },
      this.scene,
    );
    return this._add(m, hex, opts, true);
  }

  // Dönel profil: points = [[yarıçap, y], ...]
  lathe(points, hex, opts = {}) {
    const tess = opts.tess ?? 20;
    const m = CreateLathe(
      `p${uid++}`,
      { shape: points.map(([r, y]) => new Vector3(r, y, 0)), tessellation: tess, cap: Mesh.CAP_ALL },
      this.scene,
    );
    return this._add(m, hex, opts, tess >= 8);
  }

  // Yatay boru (iki nokta arası)
  pipe(x1, z1, x2, z2, y, d, hex, opts = {}) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ang = Math.atan2(x2 - x1, z2 - z1);
    return this.cyl(d, d, len, hex, { tess: 10, mat: 'metal', ...opts, x: (x1 + x2) / 2, y, z: (z1 + z2) / 2, rx: Math.PI / 2, ry: ang });
  }

  // Dikey boru/direk
  pole(x, z, y0, y1, d, hex, opts = {}) {
    return this.cyl(d, d, y1 - y0, hex, { tess: 8, mat: 'metal', ...opts, x, z, y: (y0 + y1) / 2 });
  }

  emit(type, x, y, z) {
    this.kit.emitters.push({ type, pos: new Vector3(x + this.pivot.x, y + this.pivot.y, z + this.pivot.z) });
  }

  // Hareketli alt grup. Alt grubun parçaları pivot'a göre yerel koordinatla çizilir.
  // anim: { type: 'spin'|'nod'|'bob'|'pulse'|'track', axis, speed, amp, driver: 'wind' }
  group(x, y, z, anim) {
    const g = new Group(this.kit, new Vector3(x + this.pivot.x, y + this.pivot.y, z + this.pivot.z), anim);
    this.kit.groups.push(g);
    return g;
  }
}

class Kit {
  constructor(scene, name) {
    this.scene = scene;
    this.name = name;
    this.root = new Group(this);
    this.groups = [this.root];
    this.emitters = [];
  }
}

function merge(meshes, name) {
  if (!meshes.length) return null;
  const merged = meshes.length === 1 ? meshes[0] : Mesh.MergeMeshes(meshes, true, true);
  merged.name = name;
  return merged;
}

// Model tanımından şablon üret. build(group) kökteki grubu alır.
export function buildTemplate(scene, name, build) {
  const kit = new Kit(scene, name);
  build(kit.root);
  const groups = [];
  for (const g of kit.groups) {
    const meshes = [];
    for (const [key, list] of g.parts) {
      const m = merge(list, `${name}:${key}`);
      m.material = getMaterial(scene, key);
      const glow = key.startsWith('glow:');
      m.metadata = { key, glow, transparent: isTransparentKey(key), noGlow: isNoGlowKey(key) };
      if (!glow) m.receiveShadows = true;
      m.isVisible = false; // kaynak gizli; instance'lar çizilir
      m.isPickable = false;
      meshes.push(m);
    }
    groups.push({ pivot: g.pivot, anim: g.anim, meshes });
  }
  return new Template(name, groups, kit.emitters);
}

export class Template {
  constructor(name, groups, emitters) {
    this.name = name;
    this.groups = groups;
    this.emitters = emitters;
  }

  // parent altında yeni bir kopya oluştur. Dönüş: { root, anims, casters }
  instantiate(parent, name = this.name) {
    const scene = parent.getScene();
    const root = new TransformNode(name, scene);
    root.parent = parent;
    const anims = [];
    const casters = [];
    for (const g of this.groups) {
      let holder = root;
      if (g.anim || g.pivot.lengthSquared() > 0) {
        holder = new TransformNode(`${name}:pivot`, scene);
        holder.parent = root;
        holder.position.copyFrom(g.pivot);
        if (g.anim) anims.push({ node: holder, anim: g.anim, base: holder.position.clone(), phase: Math.random() * 10 });
      }
      for (const m of g.meshes) {
        const inst = m.createInstance(`${m.name}#`);
        inst.parent = holder;
        inst.isPickable = false;
        if (!m.metadata?.glow) casters.push(inst);
      }
    }
    return { root, anims, casters };
  }

  // İnşa önizlemesi: geometriyi paylaşan, yarı saydam tek malzemeli kopya
  ghost(parent, material) {
    const scene = parent.getScene();
    const root = new TransformNode(`${this.name}:ghost`, scene);
    root.parent = parent;
    for (const g of this.groups) {
      let holder = root;
      if (g.pivot.lengthSquared() > 0) {
        holder = new TransformNode('ghostPivot', scene);
        holder.parent = root;
        holder.position.copyFrom(g.pivot);
      }
      for (const m of g.meshes) {
        if (m.metadata?.transparent) continue;
        const c = m.clone(`${m.name}:ghost`, holder);
        c.isVisible = true;
        c.isPickable = false;
        c.material = material;
      }
    }
    return root;
  }
}
