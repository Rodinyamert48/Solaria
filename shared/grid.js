import { BALANCE } from './balance.js';
import { GENERATOR_BY_ID } from './data/generators.js';

// Ada 30x30 karo. Ortadaki 10x10 şehir bölgesi.
export const ISLAND_SIZE = 30;
export const CITY_MIN = 10;
export const CITY_MAX = 19; // dahil
export const CENTER = ISLAND_SIZE / 2;
export const MAX_LAND_LEVEL = BALANCE.landRadii.length - 1;

// Karo merkezinin ada merkezine Chebyshev uzaklığı
export function tileDistance(x, y) {
  return Math.max(Math.abs(x + 0.5 - CENTER), Math.abs(y + 0.5 - CENTER));
}

export function isCityTile(x, y) {
  return x >= CITY_MIN && x <= CITY_MAX && y >= CITY_MIN && y <= CITY_MAX;
}

export function isInsideIsland(x, y) {
  return x >= 0 && y >= 0 && x < ISLAND_SIZE && y < ISLAND_SIZE;
}

export function isUnlocked(x, y, landLevel) {
  return isInsideIsland(x, y) && tileDistance(x, y) <= BALANCE.landRadii[landLevel];
}

export function buildableTileCount(landLevel) {
  let n = 0;
  for (let y = 0; y < ISLAND_SIZE; y++)
    for (let x = 0; x < ISLAND_SIZE; x++)
      if (isUnlocked(x, y, landLevel) && !isCityTile(x, y)) n++;
  return n;
}

// generators: [{ gid, type, x, y }] -> Map("x,y" -> gid)
export function occupancy(generators) {
  const map = new Map();
  for (const g of generators) {
    const def = GENERATOR_BY_ID[g.type];
    if (!def) continue;
    for (let dy = 0; dy < def.size; dy++)
      for (let dx = 0; dx < def.size; dx++) map.set(`${g.x + dx},${g.y + dy}`, g.gid);
  }
  return map;
}

// Yerleştirme geçerli mi? Geçerli değilse sebebini döndürür.
// occ: önceden hesaplanmış occupancy() (döngülerde hız için, isteğe bağlı)
export function placementError(generators, landLevel, type, x, y, ignoreGid = null, occ = null) {
  const def = GENERATOR_BY_ID[type];
  if (!def) return 'Bilinmeyen jeneratör';
  if (!Number.isInteger(x) || !Number.isInteger(y)) return 'Geçersiz konum';
  occ ??= occupancy(generators);
  for (let dy = 0; dy < def.size; dy++) {
    for (let dx = 0; dx < def.size; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!isInsideIsland(tx, ty)) return 'Adanın dışına taşıyor';
      if (isCityTile(tx, ty)) return 'Şehir bölgesine kurulamaz';
      if (!isUnlocked(tx, ty, landLevel)) return 'Bu arazi henüz satın alınmadı';
      const other = occ.get(`${tx},${ty}`);
      if (other != null && other !== ignoreGid) return 'Burada başka bir yapı var';
    }
  }
  return null;
}

// Boyuta göre merkeze yakınlık sıralı aday konumlar (bir kez hesaplanır)
const spotCache = new Map();
function spotsForSize(size) {
  if (!spotCache.has(size)) {
    const spots = [];
    for (let y = 0; y <= ISLAND_SIZE - size; y++)
      for (let x = 0; x <= ISLAND_SIZE - size; x++)
        spots.push([x, y, tileDistance(x + (size - 1) / 2, y + (size - 1) / 2)]);
    spots.sort((a, b) => a[2] - b[2]);
    spotCache.set(size, spots);
  }
  return spotCache.get(size);
}

// Verilen jeneratör için uygun ilk boş yeri bul (merkeze yakın olandan başlayarak)
export function findFreeSpot(generators, landLevel, type) {
  const def = GENERATOR_BY_ID[type];
  if (!def) return null;
  const occ = occupancy(generators);
  for (const [x, y, d] of spotsForSize(def.size)) {
    if (d + (def.size - 1) / 2 > BALANCE.landRadii[landLevel]) break;
    if (!placementError(generators, landLevel, type, x, y, null, occ)) return { x, y };
  }
  return null;
}
