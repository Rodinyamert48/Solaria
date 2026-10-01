// Şablon önbelleği: her model ilk kullanıldığında bir kez üretilir
import { buildTemplate } from './kit.js';
import { MODELS } from './models/generators.js';
import { tree, PI } from './models/helpers.js';
import { C } from './models/palette.js';

// Havada süzülen ada gövdesi (üst yüzey ayrı bir zemin mesh'i)
function islandModel(k) {
  k.box(30, 0.5, 30, '#76bd58', { y: -0.25 });
  k.box(29.7, 1.5, 29.7, '#9a6b45', { y: -1.25 });
  k.box(29.2, 1.3, 29.2, '#85603f', { y: -2.6 });
  k.cyl(40.5, 6, 12, '#8a8178', { y: -9.25, tess: 4, ry: PI / 4 });
  k.cyl(10, 2, 5, '#7b736b', { y: -16.5, x: 3, z: -2, tess: 5 });
  // kenar taşları
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * PI * 2;
    k.sphere(1.6 + (i % 3) * 0.6, i % 2 ? '#8a8178' : '#978d83', {
      ico: true, sub: 0, x: Math.cos(a) * 12, z: Math.sin(a) * 12, y: -4.2 - (i % 4), sy: 0.8,
    });
  }
}
import {
  towerModel, houseModel, shopModel, spireModel, carModel, cityHallModel, LANDMARKS, crownModel,
} from './models/city.js';

export class Templates {
  constructor(scene) {
    this.scene = scene;
    this.cache = new Map();
  }

  get(key) {
    let t = this.cache.get(key);
    if (!t) {
      t = buildTemplate(this.scene, key, this.builder(key));
      this.cache.set(key, t);
    }
    return t;
  }

  builder(key) {
    const [kind, a, b, c] = key.split(':');
    switch (kind) {
      case 'gen':
        if (!MODELS[a]) throw new Error(`Model yok: ${a}`);
        return MODELS[a];
      case 'tower':
        return towerModel(Number(b), a, Number(c));
      case 'house':
        return houseModel(Number(a));
      case 'shop':
        return shopModel(Number(a));
      case 'car':
        return carModel(Number(a));
      case 'tree':
        return (k) => {
          const n = Number(a) + 1;
          for (let i = 0; i < n; i++) tree(k, (i - (n - 1) / 2) * 0.32, (i % 2) * 0.2 - 0.1, 1 + i * 0.15);
        };
      case 'rock':
        return (k) => {
          k.sphere(0.55, C.rock, { ico: true, sub: 0, sy: 0.6, y: 0.12 });
          k.sphere(0.3, C.grey, { ico: true, sub: 0, x: 0.25, z: 0.15, y: 0.08 });
        };
      case 'island':
        return islandModel;
      case 'spire':
        return spireModel;
      case 'crown':
        return crownModel;
      case 'cityhall':
        return cityHallModel;
      case 'landmark':
        return LANDMARKS[a];
      default:
        throw new Error(`Bilinmeyen şablon: ${key}`);
    }
  }

  generator(type) {
    return this.get(`gen:${type}`);
  }
}
