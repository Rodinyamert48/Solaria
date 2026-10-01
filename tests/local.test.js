import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalServer, SAVE_KEY } from '../client/src/local/localServer.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('yerel mod: tek ada, eylem, kayıt ve yeniden yükleme', async () => {
  const storage = memoryStorage();
  const a = new LocalServer(storage);
  assert.equal((await a.join({ name: 'x' })).ok, false);
  const res = await a.join({ name: 'Deneme', color: '#ff0000' });
  assert.ok(res.ok);
  assert.ok(res.firstTime);
  assert.equal(res.plots.length, 1); // yapay zekâ ada yok
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
  assert.equal(res2.firstTime, false);
  assert.equal(res2.plots[0].generators.length, 4);
  b.reset();
  assert.equal(storage.getItem(SAVE_KEY), null);
});

test('yerel mod: zorluk seçimi kaydedilir', async () => {
  const storage = memoryStorage();
  const a = new LocalServer(storage);
  await a.join({ name: 'Deneme' });
  a.stop();
  assert.equal(a.difficulty, 'normal');
  assert.equal(a.setDifficulty('hile'), false);
  assert.ok(a.setDifficulty('kolay'));
  const b = new LocalServer(storage);
  await b.join({ name: 'Deneme' });
  b.stop();
  assert.equal(b.difficulty, 'kolay');
});

test('yerel mod: eski kayıttaki yapay zekâ komşular yüklenmez', async () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ v: 1, player: null, bots: [{ id: 'bot', name: 'Ece' }] }));
  const a = new LocalServer(storage);
  const res = await a.join({ name: 'Deneme' });
  a.stop();
  assert.equal(res.plots.length, 1);
});
