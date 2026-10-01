// Malzeme kütüphanesi: köşe renkli temel malzemeler + prosedürel dokulu özel malzemeler.
// Kit, parçaları malzeme anahtarına göre gruplar (solid, metal, glass, water, facade:res, facade:office, lamp, glow:#hex|alfa).
import { StandardMaterial, DynamicTexture, Texture, Color3, FresnelParameters } from './babylon.js';

const cache = new Map();
let scene = null;
const animated = { facades: [], lamps: [], water: [], glass: [] };

export const FACADE_CELLS = 8; // dokuda 8x8 pencere hücresi

function hex(h) {
  return Color3.FromHexString(h);
}

function base(name, opts = {}) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = new Color3(1, 1, 1);
  m.specularColor = new Color3(opts.spec ?? 0.05, opts.spec ?? 0.05, opts.spec ?? 0.05);
  m.specularPower = opts.power ?? 24;
  return m;
}

// Pencere ızgarası dokusu (gündüz görünümü) ve yanan pencere maskesi (gece ışıkları)
function facadeTextures(style) {
  const N = FACADE_CELLS;
  const C = 32;
  const size = N * C;
  const diffuse = new DynamicTexture(`facade-${style}`, { width: size, height: size }, scene, true);
  const lit = new DynamicTexture(`facade-${style}-lit`, { width: size, height: size }, scene, true);
  const d = diffuse.getContext();
  const e = lit.getContext();
  d.fillStyle = '#ffffff';
  d.fillRect(0, 0, size, size);
  e.fillStyle = '#000000';
  e.fillRect(0, 0, size, size);
  let seed = style === 'office' ? 7 : 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const px = x * C;
      const py = y * C;
      if (style === 'office') {
        // cam giydirme cephe: geniş camlar, ince dikmeler
        d.fillStyle = '#5d7690';
        d.fillRect(px + 2, py + 3, C - 4, C - 7);
        d.fillStyle = 'rgba(255,255,255,0.18)';
        d.fillRect(px + 2, py + 3, (C - 4) * 0.35, C - 7);
        d.fillStyle = '#c9d3dc';
        d.fillRect(px, py + C - 4, C, 4);
      } else {
        // konut: pencere + denizlik + perde tonu
        d.fillStyle = '#c8c2b6';
        d.fillRect(px, py + C - 6, C, 2);
        d.fillStyle = '#4c5f73';
        d.fillRect(px + 8, py + 7, C - 16, C - 16);
        d.fillStyle = '#e9e4da';
        d.fillRect(px + 6, py + C - 9, C - 12, 2);
        d.fillStyle = 'rgba(255,255,255,0.22)';
        d.fillRect(px + 8, py + 7, 5, C - 16);
      }
      const on = rnd() < (style === 'office' ? 0.45 : 0.6);
      if (on) {
        const warm = rnd();
        e.fillStyle = warm < 0.7 ? `rgb(255,${200 + Math.floor(rnd() * 40)},${110 + Math.floor(rnd() * 60)})` : 'rgb(200,225,255)';
        if (style === 'office') e.fillRect(px + 2, py + 3, C - 4, C - 7);
        else e.fillRect(px + 8, py + 7, C - 16, C - 16);
      }
    }
  }
  diffuse.update();
  lit.update();
  for (const t of [diffuse, lit]) {
    t.wrapU = Texture.WRAP_ADDRESSMODE;
    t.wrapV = Texture.WRAP_ADDRESSMODE;
    t.anisotropicFilteringLevel = 4;
  }
  return { diffuse, lit };
}

// Kaydırılabilir su normal haritası (sinüs dalgalarından)
function waterNormals() {
  const S = 128;
  const tex = new DynamicTexture('waterNormals', { width: S, height: S }, scene, true);
  const ctx = tex.getContext();
  const img = ctx.createImageData(S, S);
  const h = (x, y) => {
    const u = (x / S) * Math.PI * 2;
    const v = (y / S) * Math.PI * 2;
    return Math.sin(u * 3 + v) * 0.5 + Math.sin(v * 4 - u * 2) * 0.35 + Math.sin(u * 7 + v * 5) * 0.15;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const len = Math.hypot(dx, dy, 0.6);
      const i = (y * S + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((0.6 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.update();
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.uScale = 3;
  tex.vScale = 3;
  return tex;
}

function create(key) {
  if (key === 'solid') return base('solid');
  if (key === 'metal') return base('metal', { spec: 0.55, power: 90 });
  if (key === 'glass') {
    const m = base('glass', { spec: 0.9, power: 160 });
    // Fresnel, emissiveColor ile çarpılır: kenarlarda gökyüzü yansıması hissi
    m.emissiveColor = new Color3(0.45, 0.45, 0.45);
    animated.glass.push(m);
    m.emissiveFresnelParameters = new FresnelParameters({
      leftColor: hex('#bfe3ff'),
      rightColor: Color3.Black(),
      bias: 0.15,
      power: 2.2,
    });
    return m;
  }
  if (key === 'water') {
    const m = base('water', { spec: 0.85, power: 96 });
    m.bumpTexture = waterNormals();
    m.bumpTexture.level = 0.45;
    m.emissiveColor = new Color3(0.35, 0.35, 0.35);
    m.emissiveFresnelParameters = new FresnelParameters({ leftColor: hex('#a8d8ff'), rightColor: Color3.Black(), bias: 0.1, power: 3 });
    animated.water.push(m);
    return m;
  }
  if (key.startsWith('facade:')) {
    const style = key.split(':')[1];
    const { diffuse, lit } = facadeTextures(style);
    const m = base(key, { spec: style === 'office' ? 0.45 : 0.08, power: style === 'office' ? 110 : 24 });
    m.diffuseTexture = diffuse;
    m.emissiveTexture = lit;
    m.emissiveColor = Color3.Black();
    animated.facades.push(m);
    return m;
  }
  if (key === 'lamp') {
    const m = base('lamp');
    m.diffuseColor = hex('#fff3d6');
    m.emissiveColor = Color3.Black();
    animated.lamps.push(m);
    return m;
  }
  if (key.startsWith('glow:')) {
    const [hexColor, alpha = '1'] = key.slice(5).split('|');
    const m = new StandardMaterial(key, scene);
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.emissiveColor = hex(hexColor);
    m.disableLighting = true;
    if (Number(alpha) < 1) {
      m.alpha = Number(alpha);
      m.backFaceCulling = false;
    }
    return m;
  }
  throw new Error(`Bilinmeyen malzeme: ${key}`);
}

export function getMaterial(sc, key) {
  scene = sc;
  if (!cache.has(key)) cache.set(key, create(key));
  return cache.get(key);
}

// Her karede: gece ışıkları ve su dalgaları
export function updateMaterials(night, time) {
  const f = night * 0.55;
  for (const m of animated.facades) m.emissiveColor.set(f, f * 0.93, f * 0.8);
  const l = Math.min(1, night * 1.4);
  for (const m of animated.lamps) m.emissiveColor.set(l, l * 0.86, l * 0.6);
  // gece suyun ve camın gökyüzü yansıması kararır
  const sky = 0.35 * (1 - night * 0.85);
  for (const m of animated.water) {
    m.bumpTexture.uOffset = time * 0.02;
    m.bumpTexture.vOffset = time * 0.013;
    m.emissiveColor.set(sky, sky, sky);
  }
  for (const m of animated.glass) m.emissiveColor.set(sky * 1.3, sky * 1.3, sky * 1.3);
}

// GlowLayer'a girmemesi gereken (yalnızca yansıma amaçlı emissive kullanan) malzemeler
export function isNoGlowKey(key) {
  return key === 'water' || key === 'glass';
}

export function isTransparentKey(key) {
  return key.startsWith('glow:') && Number(key.split('|')[1] ?? 1) < 1;
}
