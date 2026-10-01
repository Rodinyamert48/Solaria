// Prosedürel low-poly model kiti.
// Basit şekillerden (kutu, silindir, küre, torus, lathe) model kurar, hepsini tek bir köşe-renkli mesh'e
// birleştirir. Parlayan parçalar renge göre ayrı mesh'lerde (GlowLayer için), hareketli parçalar ayrı
// gruplarda (dönen kanat, sallanan pompa...). Sonuç bir "şablon"dur: her yerleştirmede instance oluşturulur
// (aynı modelden yüzlerce tane çizmek tek draw call).
import {
  Mesh, TransformNode, Vector3, Color3, Color4, StandardMaterial, VertexBuffer,
  CreateBox, CreateCylinder, CreateSphere, CreateTorus, CreateLathe, CreateIcoSphere, CreateTorusKnot,
} from './babylon.js';

const materialCache = new Map();

export function color3(hex) {
  return Color3.FromHexString(hex);
}

export function solidMaterial(scene) {
  if (!materialCache.has('solid')) {
    const m = new StandardMaterial('solid', scene);
    m.diffuseColor = new Color3(1, 1, 1);
    m.specularColor = new Color3(0.08, 0.08, 0.08);
    m.specularPower = 32;
    materialCache.set('solid', m);
  }
  return materialCache.get('solid');
}

export function glowMaterial(scene, hex, alpha = 1) {
  const key = `glow:${hex}:${alpha}`;
  if (!materialCache.has(key)) {
    const m = new StandardMaterial(key, scene);
    const c = color3(hex);
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.emissiveColor = c;
    m.disableLighting = true;
    if (alpha < 1) {
      m.alpha = alpha;
      m.backFaceCulling = false;
    }
    materialCache.set(key, m);
  }
  return materialCache.get(key);
}

function paint(mesh, hex, shade = 0) {
  const c = color3(hex);
  const n = mesh.getTotalVertices();
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  const colors = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    // Hafif yön gölgelemesi: yukarı bakan yüzler biraz daha açık (low-poly hissi)
    const up = normals ? normals[i * 3 + 1] : 0;
    const k = 1 + shade * up;
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
    this.solid = [];
    this.glow = new Map(); // renk -> mesh[]
  }

  _add(mesh, hex, opts = {}) {
    const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, flat = true } = opts;
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.scaling.set(sx, sy, sz);
    mesh.bakeCurrentTransformIntoVertices();
    if (flat && opts.smooth !== true) mesh.convertToFlatShadedMesh();
    if (opts.glow) {
      const key = `${hex}|${opts.alpha ?? 1}`;
      if (!this.glow.has(key)) this.glow.set(key, []);
      paint(mesh, '#ffffff');
      this.glow.get(key).push(mesh);
    } else {
      paint(mesh, hex, opts.shade ?? 0.08);
      this.solid.push(mesh);
    }
    return mesh;
  }

  get scene() {
    return this.kit.scene;
  }

  box(w, h, d, hex, opts = {}) {
    const m = CreateBox(`p${uid++}`, { width: w, height: h, depth: d }, this.scene);
    return this._add(m, hex, { ...opts, flat: false });
  }

  // Silindir; y = merkez yüksekliği. dTop=0 -> koni
  cyl(dTop, dBottom, h, hex, opts = {}) {
    const m = CreateCylinder(
      `p${uid++}`,
      { diameterTop: dTop, diameterBottom: dBottom, height: h, tessellation: opts.tess ?? 10, arc: opts.arc ?? 1 },
      this.scene,
    );
    return this._add(m, hex, opts);
  }

  sphere(d, hex, opts = {}) {
    const m = opts.ico
      ? CreateIcoSphere(`p${uid++}`, { radius: d / 2, subdivisions: opts.sub ?? 1 }, this.scene)
      : CreateSphere(`p${uid++}`, { diameter: d, segments: opts.seg ?? 6, slice: opts.slice ?? 1 }, this.scene);
    return this._add(m, hex, opts);
  }

  dome(d, hex, opts = {}) {
    return this.sphere(d, hex, { seg: 8, slice: 0.5, ...opts });
  }

  torus(d, thickness, hex, opts = {}) {
    const m = CreateTorus(
      `p${uid++}`,
      { diameter: d, thickness, tessellation: opts.tess ?? 16 },
      this.scene,
    );
    return this._add(m, hex, opts);
  }

  knot(radius, tube, hex, opts = {}) {
    const m = CreateTorusKnot(
      `p${uid++}`,
      { radius, tube, radialSegments: 48, tubularSegments: 6, p: opts.p ?? 2, q: opts.q ?? 3 },
      this.scene,
    );
    return this._add(m, hex, opts);
  }

  // Dönel profil: points = [[yarıçap, y], ...]
  lathe(points, hex, opts = {}) {
    const m = CreateLathe(
      `p${uid++}`,
      { shape: points.map(([r, y]) => new Vector3(r, y, 0)), tessellation: opts.tess ?? 12, cap: Mesh.CAP_ALL },
      this.scene,
    );
    return this._add(m, hex, opts);
  }

  // Yatay boru (iki nokta arası, x veya z ekseninde)
  pipe(x1, z1, x2, z2, y, d, hex, opts = {}) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ang = Math.atan2(x2 - x1, z2 - z1);
    return this.cyl(d, d, len, hex, { tess: 6, ...opts, x: (x1 + x2) / 2, y, z: (z1 + z2) / 2, rx: Math.PI / 2, ry: ang });
  }

  // Dikey boru/direk
  pole(x, z, y0, y1, d, hex, opts = {}) {
    return this.cyl(d, d, y1 - y0, hex, { tess: 6, ...opts, x, z, y: (y0 + y1) / 2 });
  }

  emit(type, x, y, z) {
    this.kit.emitters.push({ type, pos: new Vector3(x + this.pivot.x, y + this.pivot.y, z + this.pivot.z) });
  }

  // Hareketli alt grup. Alt grubun parçaları pivot'a göre yerel koordinatla çizilir.
  // anim: { type: 'spin'|'nod'|'bob'|'pulse', axis, speed, amp, driver: 'wind'|'sun'|undefined }
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
    const solid = merge(g.solid, `${name}:solid`);
    if (solid) {
      solid.material = solidMaterial(scene);
      solid.receiveShadows = true;
      meshes.push(solid);
    }
    for (const [key, list] of g.glow) {
      const [hex, alpha] = key.split('|');
      const m = merge(list, `${name}:glow:${hex}`);
      m.material = glowMaterial(scene, hex, Number(alpha));
      m.metadata = { glow: true, transparent: Number(alpha) < 1 };
      meshes.push(m);
    }
    for (const m of meshes) {
      m.isVisible = false; // kaynak gizli; instance'lar çizilir
      m.isPickable = false;
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

export { Color4 };
