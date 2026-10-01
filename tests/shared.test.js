import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES } from '../shared/data/categories.js';
import { GENERATORS, GENERATOR_BY_ID, sellValue, upgradeCost } from '../shared/data/generators.js';
import { CENTERS, centerCost } from '../shared/data/centers.js';
import { computeStats, stepPlayer } from '../shared/economy.js';
import { placementError, findFreeSpot, buildableTileCount } from '../shared/grid.js';
import * as A from '../shared/actions.js';
import { formatMoney, formatPower } from '../shared/format.js';
import { envAt, solarFactor, windFactor, DAY_LENGTH_MS } from '../shared/env.js';

const DAY = { sun: 1, wind: 1, daylight: 1 };
const NIGHT = { sun: 0.03, wind: 1, daylight: 0 };

const fresh = () => A.newPlayerState({ id: 't', name: 'Test', color: '#fff' });

test('her kategoride 6-7 jeneratör var', () => {
  assert.equal(CATEGORIES.length, 10);
  for (const c of CATEGORIES) {
    const n = GENERATORS.filter((g) => g.cat === c.id).length;
    assert.ok(n >= 6 && n <= 7, `${c.id}: ${n}`);
  }
  assert.equal(new Set(GENERATORS.map((g) => g.id)).size, GENERATORS.length);
});

test('kategori içinde maliyet ve güç artar', () => {
  for (const c of CATEGORIES) {
    const list = GENERATORS.filter((g) => g.cat === c.id);
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i].cost > list[i - 1].cost, list[i].id);
      assert.ok(list[i].power > list[i - 1].power, list[i].id);
    }
  }
});

test('merkez maliyetleri artar', () => {
  for (const c of CENTERS) assert.ok(centerCost(c, 3) > centerCost(c, 2));
});

test('yerleştirme kuralları', () => {
  const p = fresh();
  assert.equal(placementError(p.generators, 0, 'solar_panel', 12, 12), 'Şehir bölgesine kurulamaz');
  assert.equal(placementError(p.generators, 0, 'solar_panel', 0, 0), 'Bu arazi henüz satın alınmadı');
  assert.equal(placementError(p.generators, 3, 'solar_panel', 0, 0), null);
  assert.equal(placementError(p.generators, 0, 'solar_panel', 14, 8), 'Burada başka bir yapı var');
  assert.equal(placementError(p.generators, 0, 'solar_panel', 16, 8), 'Burada başka bir yapı var');
  assert.equal(placementError(p.generators, 3, 'solar_farm', 29, 0), 'Adanın dışına taşıyor');
  assert.equal(placementError(p.generators, 0, 'solar_panel', 1.5, 8), 'Geçersiz konum');
  assert.ok(buildableTileCount(1) > buildableTileCount(0));
  const spot = findFreeSpot(p.generators, 0, 'wind_large');
  assert.ok(spot);
  assert.equal(placementError(p.generators, 0, 'wind_large', spot.x, spot.y), null);
});

test('inşa, yükselt, sat', () => {
  const p = fresh();
  p.money = 1000;
  const r = A.build(p, { type: 'wind_mini', x: 14, y: 9 });
  assert.ok(r.ok);
  assert.equal(p.money, 1000 - GENERATOR_BY_ID.wind_mini.cost);
  assert.equal(A.build(p, { type: 'wind_mini', x: 14, y: 9 }).ok, false);

  const before = p.money;
  const up = A.upgrade(p, { gid: r.gen.gid });
  assert.ok(up.ok);
  assert.equal(p.money, before - upgradeCost(GENERATOR_BY_ID.wind_mini, 1));

  const sold = A.sell(p, { gid: r.gen.gid });
  assert.ok(sold.ok);
  assert.equal(sold.value, sellValue(GENERATOR_BY_ID.wind_mini, 2));
  assert.equal(p.generators.length, 3);
});

test('para yetmezse satın alınamaz', () => {
  const p = fresh();
  p.money = 0;
  assert.equal(A.build(p, { type: 'solar_panel', x: 14, y: 9 }).error, 'Yeterli paran yok');
  assert.equal(A.upgradeCenter(p, { center: 'residential' }).error, 'Yeterli paran yok');
  assert.equal(A.buyLand(p).error, 'Yeterli paran yok');
});

test('kilitli merkez açılmaz', () => {
  const p = fresh();
  p.money = 1e12;
  assert.equal(A.upgradeCenter(p, { center: 'transport' }).ok, false);
  p.pop = 30_000;
  assert.equal(A.upgradeCenter(p, { center: 'transport' }).ok, true);
});

test('gelir = karşılanan talep × fiyat', () => {
  const p = fresh();
  p.pop = 1; // talep 1 kW, başlangıç santralleri gündüz ~5 kW
  const s = computeStats(p, DAY);
  assert.equal(s.served, 1);
  assert.equal(s.income, 1);
  assert.ok(s.wasted > 0);
});

test('gece güneş üretimi düşer, nüfus azalır', () => {
  const p = fresh();
  p.generators = [{ gid: 1, type: 'solar_panel', x: 14, y: 8, level: 1 }];
  p.pop = 1.5;
  const day = computeStats(p, DAY);
  const night = computeStats(p, NIGHT);
  assert.ok(night.supply < day.supply * 0.1);
  stepPlayer(p, NIGHT, 5);
  assert.ok(p.pop < 1.5);
});

test('nüfus kapasiteye doğru büyür, para birikir', () => {
  const p = fresh();
  p.money = 0;
  for (let i = 0; i < 120; i++) stepPlayer(p, DAY, 1);
  const s = computeStats(p, DAY);
  assert.ok(p.pop > 1);
  assert.ok(p.pop <= s.capacity);
  assert.ok(p.money > 0);
});

test('kirlilik hava kalitesini düşürür, park iyileştirir', () => {
  const p = fresh();
  p.generators = [{ gid: 1, type: 'coal_boiler', x: 14, y: 8, level: 1 }];
  const dirty = computeStats(p, DAY);
  assert.ok(dirty.airQuality < 0.5);
  assert.ok(dirty.upkeep > 0);
  p.centers.park = 10;
  assert.ok(computeStats(p, DAY).airQuality > dirty.airQuality);
});

test('yeniden doğuş sıfırlar ve çarpan verir', () => {
  const p = fresh();
  assert.equal(A.rebirth(p).ok, false);
  p.pop = 3e6;
  p.money = 1e9;
  p.land = 2;
  assert.ok(A.rebirth(p).ok);
  assert.equal(p.rebirths, 1);
  assert.equal(p.land, 0);
  assert.ok(p.money < 1e9);
  p.pop = 1;
  assert.equal(computeStats(p, DAY).price, 1.5);
});

test('çevre fonksiyonları sınırlar içinde', () => {
  for (let t = 0; t < DAY_LENGTH_MS * 2; t += 7919) {
    const s = solarFactor(t);
    const w = windFactor(t);
    assert.ok(s >= 0.03 && s <= 1);
    assert.ok(w >= 0.4 && w <= 1.6);
  }
  assert.ok(envAt(DAY_LENGTH_MS / 4).sun > 0.9); // öğle
  assert.ok(envAt(DAY_LENGTH_MS * 0.75).sun < 0.05); // gece yarısı
});

test('biçimlendirme', () => {
  assert.equal(formatMoney(1234), '$1,23K');
  assert.equal(formatMoney(5), '$5');
  assert.equal(formatPower(1500), '1,5 MW');
  assert.equal(formatPower(2.5), '2,5 kW');
});
