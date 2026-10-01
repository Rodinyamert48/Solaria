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

export function difficultyOf(p) {
  return BALANCE.difficulty[p.difficulty] || BALANCE.difficulty.normal;
}

// Bir oyuncunun anlık tüm istatistikleri. p: oyuncu durumu, env: envAt(time), dt: depolama hesabı için adım (sn)
export function computeStats(p, env, dt = 0.5) {
  let rated = 0;
  let supply = 0;
  let dirty = 0;
  let upkeep = 0;
  let storePower = 0;
  let storeCap = 0;
  let effWeighted = 0;
  const byCat = {};

  for (const g of p.generators) {
    const def = GENERATOR_BY_ID[g.type];
    if (!def) continue;
    const cat = CATEGORY_BY_ID[def.cat];
    const r = ratedPower(p, g);
    if (def.storage) {
      storePower += r;
      storeCap += def.capacity * (r / def.power);
      effWeighted += r * def.eff;
      continue;
    }
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

  const diff = difficultyOf(p);
  const perCapita = BALANCE.kwPerCitizen * fx(p, 'industry');
  const demandFactor = env.demand ?? 1;
  const demand = p.pop * perCapita * demandFactor;

  // Depolama: fazlayı şarj et, açığı deşarjla kapat
  const eff = storePower > 0 ? effWeighted / storePower : 1;
  const stored = Math.min(p.stored || 0, storeCap);
  let charge = 0;
  let discharge = 0;
  if (supply >= demand) charge = Math.min(supply - demand, storePower, Math.max(0, (storeCap - stored) / (dt * eff)));
  else discharge = Math.min(demand - supply, storePower, stored / dt);
  const available = supply + discharge;
  // Şehrin dayanabileceği güç: üretim + depodan çekilebilecek en fazla güç
  const potential = supply + Math.min(storePower, stored / dt);

  const served = Math.min(available, demand);
  const price = BALANCE.basePrice * fx(p, 'commerce') * rebirthMultiplier(p.rebirths) * diff.income;
  const income = served * price;
  const growth = BALANCE.growthRate * (1 + 0.15 * health) * (1 + 0.1 * transport) * airQuality * diff.growth;

  return {
    rated,
    supply,
    available,
    potential,
    demand,
    demandFactor,
    served,
    coverage: demand > 0 ? Math.min(1, available / demand) : 1,
    wasted: Math.max(0, supply - demand - charge),
    storePower,
    storeCap,
    stored,
    charge,
    discharge,
    storeDelta: (charge * eff - discharge) * dt,
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
  const s = computeStats(p, env, dt);
  p.stored = Math.max(0, Math.min(s.storeCap, s.stored + s.storeDelta));
  // Şehir, ancak (ortalama tüketimle) elektrik verebildiğin kadar büyür; karartmada kimse gelmez
  let target = Math.min(s.capacity, s.potential / s.perCapita);
  if (s.coverage < BALANCE.blackoutGrowthStop) target = Math.min(target, p.pop);
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
