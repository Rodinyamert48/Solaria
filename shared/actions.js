// Oyuncu eylemleri: doğrula + uygula. Sunucu otoriterdir; istemci sadece önizleme için kullanır.
import { BALANCE } from './balance.js';
import { GENERATOR_BY_ID, upgradeCost, sellValue, MAX_GEN_LEVEL } from './data/generators.js';
import { CENTER_BY_ID, centerCost, cityLevelIndex, emptyCenters } from './data/centers.js';
import { placementError, MAX_LAND_LEVEL } from './grid.js';
import { rebirthRequirement } from './economy.js';

export function newPlayerState({ id, name, color }) {
  const now = Date.now();
  return {
    id,
    name,
    color,
    money: BALANCE.startMoney,
    lifetime: 0,
    runEarned: 0,
    rebirths: 0,
    pop: 3,
    bestCity: 0,
    land: 0,
    centers: emptyCenters(),
    // Başlangıç hediyesi: iki güneş paneli ve bir mini türbin
    generators: [
      { gid: 1, type: 'solar_panel', x: 14, y: 8, level: 1 },
      { gid: 2, type: 'solar_panel', x: 15, y: 8, level: 1 },
      { gid: 3, type: 'wind_mini', x: 16, y: 8, level: 1 },
    ],
    nextGid: 4,
    createdAt: now,
    lastSeen: now,
    lastNet: 0,
  };
}

// Eski kayıtları güncel şemaya taşı
export function migratePlayer(p) {
  p.centers = { ...emptyCenters(), ...(p.centers || {}) };
  p.generators = (p.generators || []).filter((g) => GENERATOR_BY_ID[g.type]);
  p.runEarned ??= 0;
  p.lifetime ??= 0;
  p.rebirths ??= 0;
  p.land ??= 0;
  p.bestCity ??= 0;
  p.lastNet ??= 0;
  p.nextGid ??= p.generators.reduce((m, g) => Math.max(m, g.gid), 0) + 1;
  return p;
}

const fail = (error) => ({ ok: false, error });

export function build(p, { type, x, y }) {
  const def = GENERATOR_BY_ID[type];
  if (!def) return fail('Bilinmeyen jeneratör');
  if (p.money < def.cost) return fail('Yeterli paran yok');
  const err = placementError(p.generators, p.land, type, x, y);
  if (err) return fail(err);
  p.money -= def.cost;
  const g = { gid: p.nextGid++, type, x, y, level: 1 };
  p.generators.push(g);
  return { ok: true, gen: g };
}

function findGen(p, gid) {
  return p.generators.find((g) => g.gid === gid);
}

export function sell(p, { gid }) {
  const g = findGen(p, gid);
  if (!g) return fail('Yapı bulunamadı');
  const value = sellValue(GENERATOR_BY_ID[g.type], g.level);
  p.money += value;
  p.generators = p.generators.filter((o) => o.gid !== gid);
  return { ok: true, value };
}

export function upgrade(p, { gid }) {
  const g = findGen(p, gid);
  if (!g) return fail('Yapı bulunamadı');
  if (g.level >= MAX_GEN_LEVEL) return fail('Zaten en yüksek seviyede');
  const cost = upgradeCost(GENERATOR_BY_ID[g.type], g.level);
  if (p.money < cost) return fail('Yeterli paran yok');
  p.money -= cost;
  g.level++;
  return { ok: true, gen: g };
}

export function move(p, { gid, x, y }) {
  const g = findGen(p, gid);
  if (!g) return fail('Yapı bulunamadı');
  const err = placementError(p.generators, p.land, g.type, x, y, gid);
  if (err) return fail(err);
  g.x = x;
  g.y = y;
  return { ok: true, gen: g };
}

export function upgradeCenter(p, { center }) {
  const def = CENTER_BY_ID[center];
  if (!def) return fail('Bilinmeyen merkez');
  if (cityLevelIndex(p.pop) < def.unlock && (p.bestCity || 0) < def.unlock)
    return fail('Şehrin bu merkez için henüz yeterince büyük değil');
  const level = p.centers[center] || 0;
  const cost = centerCost(def, level);
  if (p.money < cost) return fail('Yeterli paran yok');
  p.money -= cost;
  p.centers[center] = level + 1;
  return { ok: true, level: level + 1 };
}

export function landCost(level) {
  return BALANCE.landCosts[level + 1] ?? null;
}

export function buyLand(p) {
  if (p.land >= MAX_LAND_LEVEL) return fail('Adanın tamamı zaten senin');
  const cost = landCost(p.land);
  if (p.money < cost) return fail('Yeterli paran yok');
  p.money -= cost;
  p.land++;
  return { ok: true, land: p.land };
}

export function canRebirth(p) {
  return p.pop >= rebirthRequirement(p.rebirths);
}

export function rebirth(p) {
  if (!canRebirth(p)) return fail('Yeniden doğuş için nüfus yetersiz');
  const fresh = newPlayerState(p);
  Object.assign(p, {
    money: BALANCE.startMoney * (p.rebirths + 2), // her doğuşta biraz daha fazla başlangıç parası
    runEarned: 0,
    rebirths: p.rebirths + 1,
    pop: fresh.pop,
    bestCity: 0,
    land: 0,
    centers: fresh.centers,
    generators: fresh.generators,
    nextGid: fresh.nextGid,
  });
  return { ok: true, rebirths: p.rebirths };
}

export const ACTIONS = { build, sell, upgrade, move, upgradeCenter, buyLand, rebirth };
