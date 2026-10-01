import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalServer, SAVE_KEY } from '../client/src/local/localServer.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('yerel mod: giriş, eylem, kayıt ve yeniden yükleme', async () => {
  const storage = memoryStorage();
  const a = new LocalServer(storage);
  assert.equal((await a.join({ name: 'x' })).ok, false);
  const res = await a.join({ name: 'Deneme', color: '#ff0000' });
  assert.ok(res.ok);
  assert.equal(res.plots.length, 4); // oyuncu + 3 yapay zekâ komşu
  const plots = [];
  a.on('plot', (p) => plots.push(p));
  const built = await a.action('build', { type: 'wind_mini', x: 12, y: 8 });
  assert.ok(built.ok);
  assert.equal(plots.at(-1).generators.length, 4);
  assert.equal((await a.action('hack', {})).ok, false);
  a.tick();
  a.persist();
  a.stop();
  assert.ok(storage.getItem(SAVE_KEY));

  const b = new LocalServer(storage);
  const res2 = await b.join({ name: 'Deneme', color: '#ff0000' });
  b.stop();
  assert.equal(res2.plots.find((p) => p.slot === res2.slot).generators.length, 4);
  b.reset();
  assert.equal(storage.getItem(SAVE_KEY), null);
});

test('yerel mod: yapay zekâ komşular oynar', async () => {
  const a = new LocalServer(memoryStorage());
  await a.join({ name: 'Deneme' });
  a.stop();
  for (const bot of a.bots) bot.p.money = 1e6;
  for (let i = 0; i < 40; i++) {
    a.lastTick = Date.now() - 500;
    a.tick();
  }
  assert.ok(a.bots.every((b) => b.p.generators.length > 3));
});
