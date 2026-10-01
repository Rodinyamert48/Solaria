// Denge simülasyonu: basit bir bot oyunu oynar, ilerleme hızını raporlar.
// Kullanım: npm run balance  [-- --hours 6 --rebirths 2]
import { GENERATORS, GENERATOR_BY_ID } from '../shared/data/generators.js';
import { CATEGORY_BY_ID } from '../shared/data/categories.js';
import { CENTERS, centerCost, cityLevelIndex, CITY_LEVELS } from '../shared/data/centers.js';
import { computeStats, stepPlayer, rebirthRequirement } from '../shared/economy.js';
import { envAt } from '../shared/env.js';
import { findFreeSpot, MAX_LAND_LEVEL } from '../shared/grid.js';
import * as A from '../shared/actions.js';
import { formatMoney, formatPower, formatPop, formatDuration } from '../shared/format.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const HOURS = opt('hours', 6);
const MAX_REBIRTHS = opt('rebirths', 2);
const VERBOSE = args.includes('--verbose');

const AVG_ENV = { sun: 0.5, wind: 1, daylight: 0.6 };
const effPower = (p, def) => {
  const cat = CATEGORY_BY_ID[def.cat];
  const f = cat.env === 'sun' ? AVG_ENV.sun : 1;
  return def.power * f - def.power * cat.upkeep * 0.5;
};

function bestGenerator(p, budget) {
  let best = null;
  for (const def of GENERATORS) {
    if (def.cost > budget) continue;
    if (!best || effPower(p, def) / def.size ** 0.5 > effPower(p, best) / best.size ** 0.5) best = def;
  }
  return best;
}

function botTurn(p) {
  for (let guard = 0; guard < 50; guard++) {
    const s = computeStats(p, AVG_ENV);
    const capDemand = s.capacity * s.perCapita;
    const supplyLimited = s.supply < capDemand * 0.98;

    if (supplyLimited) {
      const def = bestGenerator(p, p.money);
      if (!def) return;
      const spot = findFreeSpot(p.generators, p.land, def.id);
      if (spot) {
        A.build(p, { type: def.id, ...spot });
        continue;
      }
      if (p.land < MAX_LAND_LEVEL) {
        if (A.buyLand(p).ok) continue;
        if (A.landCost(p.land) < p.money * 50) return; // biriktir
      }
      // Yer yok: en zayıfı sat, yerine daha iyisini koy
      const weakest = [...p.generators].sort(
        (a, b) => GENERATOR_BY_ID[a.type].power - GENERATOR_BY_ID[b.type].power,
      )[0];
      if (weakest && def.power > GENERATOR_BY_ID[weakest.type].power * 3) {
        A.sell(p, { gid: weakest.gid });
        const spot2 = findFreeSpot(p.generators, p.land, def.id);
        if (spot2) A.build(p, { type: def.id, ...spot2 });
        continue;
      }
      return;
    }

    const prio = {
      residential: 1, commerce: 1.6, park: s.pollutionShare > 0.15 ? 1.2 : 99, industry: 2.2,
      health: 2, education: 1.6, entertainment: 1.6, transport: 2,
    };
    const lvl = cityLevelIndex(p.pop);
    const options = CENTERS.filter((c) => c.unlock <= Math.max(lvl, p.bestCity))
      .map((c) => ({ c, cost: centerCost(c, p.centers[c.id]) }))
      .sort((a, b) => a.cost * prio[a.c.id] - b.cost * prio[b.c.id]);
    const pick = options[0];
    if (pick && pick.cost <= p.money) {
      A.upgradeCenter(p, { center: pick.c.id });
      continue;
    }
    return;
  }
}

const p = A.newPlayerState({ id: 'bot', name: 'Bot', color: '#fff' });
const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);
let reachedLevel = 0;
let rebirths = 0;
const marks = [];
const log = (t, msg) => {
  const s = computeStats(p, AVG_ENV);
  marks.push(
    `${formatDuration(t).padEnd(12)} ${msg.padEnd(28)} nüfus ${formatPop(p.pop).padEnd(8)} ` +
      `arz ${formatPower(s.supply).padEnd(10)} gelir ${formatMoney(s.net).padEnd(9)}/sn ` +
      `jen ${String(p.generators.length).padEnd(4)} arazi ${p.land}`,
  );
};

for (let t = 0; t < HOURS * 3600; t++) {
  stepPlayer(p, envAt(t0 + t * 1000), 1);
  botTurn(p);
  const lvl = cityLevelIndex(p.pop);
  if (lvl > reachedLevel) {
    reachedLevel = lvl;
    log(t, `→ ${CITY_LEVELS[lvl].name}`);
  }
  if (VERBOSE && t % 600 === 0) log(t, '(ara)');
  if (A.canRebirth(p) && rebirths < MAX_REBIRTHS) {
    log(t, `★ YENİDEN DOĞUŞ #${rebirths + 1}`);
    A.rebirth(p);
    rebirths++;
    reachedLevel = 0;
  }
}
log(HOURS * 3600, 'SON');

console.log(marks.join('\n'));
console.log(`\nSonraki yeniden doğuş: ${formatPop(rebirthRequirement(p.rebirths))} nüfus`);
const owned = {};
for (const g of p.generators) owned[g.type] = (owned[g.type] || 0) + 1;
console.log('Sahip olunan:', Object.entries(owned).map(([k, v]) => `${k}×${v}`).join(', '));
console.log('Merkezler:', JSON.stringify(p.centers));
