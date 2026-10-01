// Basit yapay zekâ oyuncu: denge simülasyonu ve tarayıcıdaki yapay zekâ komşular kullanır
import { GENERATORS, GENERATOR_BY_ID } from './data/generators.js';
import { CATEGORY_BY_ID } from './data/categories.js';
import { CENTERS, centerCost, cityLevelIndex } from './data/centers.js';
import { computeStats } from './economy.js';
import { findFreeSpot, MAX_LAND_LEVEL } from './grid.js';
import * as A from './actions.js';

// Kararlar ortalama koşullara göre verilir (gece/gündüz dalgalanmasında panik yapmasın)
export const AVG_ENV = { sun: 0.5, wind: 1, daylight: 0.6 };

function effPower(def) {
  const cat = CATEGORY_BY_ID[def.cat];
  const f = cat.env === 'sun' ? AVG_ENV.sun : 1;
  return def.power * f - def.power * cat.upkeep * 0.5;
}

// favorites: tercih edilen kategoriler (adalar birbirinden farklı görünsün)
function bestGenerator(budget, favorites) {
  let best = null;
  let bestScore = -Infinity;
  for (const def of GENERATORS) {
    if (def.cost > budget) continue;
    const score = (effPower(def) / def.size ** 0.5) * (favorites?.includes(def.cat) ? 2 : 1);
    if (score > bestScore) {
      best = def;
      bestScore = score;
    }
  }
  return best;
}

// Bir tur oyna: parası yettiği kadar en mantıklı alımları yapar. Yapılan eylem sayısını döndürür.
export function botTurn(p, { favorites = null, maxActions = 50 } = {}) {
  let actions = 0;
  for (let guard = 0; guard < maxActions; guard++) {
    const s = computeStats(p, AVG_ENV);
    const capDemand = s.capacity * s.perCapita;

    if (s.supply < capDemand * 0.98) {
      const def = bestGenerator(p.money, favorites);
      if (!def) return actions;
      const spot = findFreeSpot(p.generators, p.land, def.id);
      if (spot) {
        A.build(p, { type: def.id, ...spot });
        actions++;
        continue;
      }
      if (p.land < MAX_LAND_LEVEL) {
        if (A.buyLand(p).ok) {
          actions++;
          continue;
        }
        if (A.landCost(p.land) < p.money * 50) return actions; // arazi için biriktir
      }
      // Yer yok: en zayıfı sat, yerine daha iyisini koy
      const weakest = [...p.generators].sort((a, b) => GENERATOR_BY_ID[a.type].power - GENERATOR_BY_ID[b.type].power)[0];
      if (weakest && def.power > GENERATOR_BY_ID[weakest.type].power * 3) {
        A.sell(p, { gid: weakest.gid });
        const spot2 = findFreeSpot(p.generators, p.land, def.id);
        if (spot2) A.build(p, { type: def.id, ...spot2 });
        actions++;
        continue;
      }
      return actions;
    }

    const prio = {
      residential: 1, commerce: 1.6, park: s.pollutionShare > 0.15 ? 1.2 : 99, industry: 2.2,
      health: 2, education: 1.6, entertainment: 1.6, transport: 2,
    };
    const lvl = cityLevelIndex(p.pop);
    const pick = CENTERS.filter((c) => c.unlock <= Math.max(lvl, p.bestCity || 0))
      .map((c) => ({ c, cost: centerCost(c, p.centers[c.id] || 0) }))
      .sort((a, b) => a.cost * prio[a.c.id] - b.cost * prio[b.c.id])[0];
    if (pick && pick.cost <= p.money) {
      A.upgradeCenter(p, { center: pick.c.id });
      actions++;
      continue;
    }
    return actions;
  }
  return actions;
}
