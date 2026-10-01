import { BALANCE } from './balance.js';
import { CATEGORY_BY_ID } from './data/categories.js';
import { GENERATOR_BY_ID, levelPowerMult } from './data/generators.js';
import { CENTER_BY_ID, cityLevelIndex, CITY_LEVELS } from './data/centers.js';
import { envFactor } from './env.js';

const fx = (p, id) => CENTER_BY_ID[id].effect(p.centers[id] || 0);

export function rebirthMultiplier(rebirths) {
  return 1 + BALANCE.rebirthIncomeBonus * rebirths;
}

export function rebirthRequirement(rebirths) {
  return BALANCE.rebirthBasePop * BALANCE.rebirthPopGrowth ** rebirths;
}

// Yerleştirilmiş tek bir jeneratörün anma gücü (çevre etkisi hariç)
export function ratedPower(p, g) {
  const def = GENERATOR_BY_ID[g.type];
  return def.power * levelPowerMult(g.level) * fx(p, 'education');
}

// Bir oyuncunun anlık tüm istatistikleri. p: oyuncu durumu, env: envAt(time)
export function computeStats(p, env) {
  let rated = 0;
  let supply = 0;
  let dirty = 0;
  let upkeep = 0;
  const byCat = {};

  for (const g of p.generators) {
    const def = GENERATOR_BY_ID[g.type];
    if (!def) continue;
    const cat = CATEGORY_BY_ID[def.cat];
    const r = ratedPower(p, g);
    const out = r * envFactor(cat.env, env);
    rated += r;
    supply += out;
    dirty += out * cat.pollution;
    upkeep += r * cat.upkeep * BALANCE.basePrice;
    byCat[def.cat] = (byCat[def.cat] || 0) + out;
  }

  const pollutionShare = supply > 0 ? dirty / supply : 0;
  const parkReduction = fx(p, 'park');
  const airQuality = Math.max(
    BALANCE.minAirQuality,
    1 - BALANCE.pollutionImpact * pollutionShare * (1 - parkReduction),
  );

  const health = fx(p, 'health');
  const transport = fx(p, 'transport');
  const capacity = Math.floor(
    fx(p, 'residential') *
      (1 + 0.08 * health) *
      fx(p, 'entertainment') *
      (1 + 0.1 * transport) *
      airQuality,
  );

  const perCapita = BALANCE.kwPerCitizen * fx(p, 'industry');
  const demand = p.pop * perCapita;
  const served = Math.min(supply, demand);
  const price = BALANCE.basePrice * fx(p, 'commerce') * rebirthMultiplier(p.rebirths);
  const income = served * price;
  const growth = BALANCE.growthRate * (1 + 0.15 * health) * (1 + 0.1 * transport) * airQuality;

  return {
    rated,
    supply,
    demand,
    served,
    coverage: demand > 0 ? Math.min(1, supply / demand) : 1,
    wasted: Math.max(0, supply - demand),
    capacity,
    perCapita,
    price,
    income,
    upkeep,
    net: income - upkeep,
    airQuality,
    pollutionShare,
    growth,
    byCat,
    cityLevel: cityLevelIndex(p.pop),
  };
}

// Simülasyonu dt saniye ilerlet. Hesaplanan istatistikleri döndürür.
export function stepPlayer(p, env, dt) {
  const s = computeStats(p, env);
  // Şehir, ancak elektrik verebildiğin kadar büyür
  const target = Math.min(s.capacity, s.supply / s.perCapita);
  if (p.pop < target) {
    const inc = Math.max(BALANCE.minGrowth, (target - p.pop) * s.growth) * dt;
    p.pop = Math.min(target, p.pop + inc);
  } else if (p.pop > target) {
    const dec = Math.max(0.2, (p.pop - target) * BALANCE.declineRate) * dt;
    p.pop = Math.max(target, p.pop - dec);
  }
  p.money = Math.max(0, p.money + s.net * dt);
  const earned = Math.max(0, s.income * dt);
  p.lifetime += earned;
  p.runEarned += earned;
  p.bestCity = Math.max(p.bestCity || 0, cityLevelIndex(p.pop));
  return s;
}

export function cityLevelName(pop) {
  return CITY_LEVELS[cityLevelIndex(pop)].name;
}
