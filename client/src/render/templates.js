// Şablon önbelleği: her model ilk kullanıldığında bir kez üretilir
import { buildTemplate } from './kit.js';
import { MODELS } from './models/generators.js';
import { treeVariant, bushModel, rockModel, fenceModel, lampModel, islandModel } from './models/nature.js';
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
      // su ve cam yalnızca yansıma için emissive kullanır: parlama katmanına girmesin
      for (const g of t.groups) for (const m of g.meshes) if (m.metadata?.noGlow) this.glow?.addExcludedMesh(m);
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
        return (k) => treeVariant(k, Number(a));
      case 'bush':
        return bushModel;
      case 'rock':
        return rockModel;
      case 'fence':
        return fenceModel;
      case 'lamp':
        return lampModel;
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
