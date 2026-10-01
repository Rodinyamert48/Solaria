// Solaria oyun sunucusu: Express (statik dosyalar) + Socket.IO (gerçek zamanlı oyun)
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { Store } from './store.js';
import { Room, privateState } from './room.js';
import { ACTIONS, newPlayerState, migratePlayer } from '../shared/actions.js';
import { BALANCE } from '../shared/balance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const DIST = path.join(ROOT, 'dist');
const SAVE_EVERY_MS = 30_000;

const store = new Store(DATA_DIR);
const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 64 * 1024 });

/** @type {Room[]} */
const rooms = [];
/** playerId -> { room, socket, player } */
const online = new Map();

app.get('/api/status', (_req, res) => {
  res.json({ online: online.size, rooms: rooms.map((r) => ({ id: r.id, players: r.count })) });
});

app.get('/api/leaderboard', (_req, res) => {
  res.json(store.topPlayers(20).map(({ id, ...rest }) => rest));
});

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
} else {
  app.get('/', (_req, res) =>
    res.type('text').send('Solaria sunucusu çalışıyor. İstemci için: npm run dev (veya önce npm run build).'),
  );
}

// ---- Yardımcılar ----------------------------------------------------------

function cleanName(raw) {
  const name = String(raw ?? '')
    .replace(/[<>&"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return name.length >= 2 ? name : null;
}

function cleanColor(raw) {
  return /^#[0-9a-f]{6}$/i.test(String(raw)) ? String(raw).toLowerCase() : '#4fb3ff';
}

function pickRoom() {
  // En kalabalık ama dolu olmayan oda (oyuncular yalnız kalmasın)
  const open = rooms.filter((r) => !r.full).sort((a, b) => b.count - a.count);
  if (open.length) return open[0];
  const room = new Room(io);
  rooms.push(room);
  console.log(`[oda] yeni oda: ${room.id}`);
  return room;
}

function cleanupRooms() {
  for (let i = rooms.length - 1; i >= 0; i--) {
    if (rooms[i].count === 0 && rooms.length > 1) {
      rooms[i].destroy();
      rooms.splice(i, 1);
    }
  }
}

function applyOfflineEarnings(p) {
  const away = (Date.now() - (p.lastSeen || Date.now())) / 1000;
  if (away < 60 || !(p.lastNet > 0)) return 0;
  const seconds = Math.min(away, BALANCE.offlineMaxSeconds);
  const gain = p.lastNet * seconds * BALANCE.offlineRate;
  p.money += gain;
  return { gain, seconds };
}

async function persist(p) {
  p.lastSeen = Date.now();
  try {
    await store.save(p);
  } catch (err) {
    console.error(`[kayıt] ${p.id} kaydedilemedi:`, err.message);
  }
}

// ---- Socket.IO ------------------------------------------------------------

io.on('connection', (socket) => {
  let session = null; // { room, player }
  let lastChat = 0;
  let actionBudget = 20;
  const refill = setInterval(() => (actionBudget = Math.min(20, actionBudget + 10)), 1000);

  socket.on('join', (data, ack) => {
    if (typeof ack !== 'function') return;
    if (session) return ack({ ok: false, error: 'Zaten oyundasın' });
    data = data || {};

    let player = null;
    let secret = null;
    if (data.id) {
      const saved = store.load(data.id);
      if (saved && saved.secretHash === Store.hash(data.secret)) player = migratePlayer(saved);
    }

    if (!player) {
      const name = cleanName(data.name);
      if (!name) return ack({ ok: false, error: 'Takma ad 2-16 karakter olmalı' });
      const id = Store.newId();
      secret = Store.newSecret();
      player = newPlayerState({ id, name, color: cleanColor(data.color) });
      player.secretHash = Store.hash(secret);
    } else {
      // Kayıtlı oyuncu: ad/renk güncellenebilir
      const name = cleanName(data.name);
      if (name) player.name = name;
      if (data.color) player.color = cleanColor(data.color);
    }

    // Aynı hesap başka sekmede açıksa onu at
    const existing = online.get(player.id);
    if (existing) {
      existing.socket.emit('kicked', 'Bu hesapla başka bir yerden giriş yapıldı.');
      existing.room.remove(player.id);
      existing.socket.disconnect(true);
      player = existing.player;
    }

    const offline = applyOfflineEarnings(player);
    const room = pickRoom();
    const slot = room.add(player, socket);
    session = { room, player };
    online.set(player.id, { room, socket, player });
    persist(player);

    ack({
      ok: true,
      id: player.id,
      secret, // sadece yeni hesapta dolu; istemci saklar
      slot,
      roomId: room.id,
      serverTime: Date.now(),
      me: privateState(player),
      plots: room.plots(),
      chat: room.chat,
      offline,
      top: store.topPlayers(10).map(({ id, ...rest }) => rest),
    });
    console.log(`[giriş] ${player.name} -> ${room.id} #${slot} (çevrimiçi: ${online.size})`);
  });

  // Oyun eylemleri: build, sell, upgrade, move, upgradeCenter, buyLand, rebirth
  socket.on('action', (msg, ack) => {
    if (typeof ack !== 'function') return;
    if (!session) return ack({ ok: false, error: 'Önce giriş yap' });
    if (actionBudget-- <= 0) return ack({ ok: false, error: 'Çok hızlısın, biraz yavaşla' });
    const fn = ACTIONS[msg?.type];
    if (!fn) return ack({ ok: false, error: 'Bilinmeyen eylem' });
    const payload = msg.payload && typeof msg.payload === 'object' ? msg.payload : {};
    if ('x' in payload) payload.x = Number(payload.x);
    if ('y' in payload) payload.y = Number(payload.y);
    if ('gid' in payload) payload.gid = Number(payload.gid);

    const { room, player } = session;
    const result = fn(player, payload);
    if (result.ok) {
      room.broadcastPlot(player.id);
      if (msg.type === 'rebirth') room.system(`${player.name} yeniden doğdu! ⭐ ×${player.rebirths}`);
    }
    ack({ ...result, me: privateState(player) });
  });

  socket.on('chat', (text) => {
    if (!session) return;
    const now = Date.now();
    if (now - lastChat < 800) return;
    lastChat = now;
    const clean = String(text ?? '')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, 140);
    if (!clean) return;
    const { room, player } = session;
    room.pushChat({ name: player.name, color: player.color, text: clean, t: now });
  });

  socket.on('ping:time', (ack) => typeof ack === 'function' && ack(Date.now()));

  socket.on('disconnect', () => {
    clearInterval(refill);
    if (!session) return;
    const { room, player } = session;
    const current = online.get(player.id);
    if (current?.socket === socket) {
      online.delete(player.id);
      room.remove(player.id);
      persist(player);
      cleanupRooms();
      console.log(`[çıkış] ${player.name} (çevrimiçi: ${online.size})`);
    }
    session = null;
  });
});

// Düzenli kayıt + küresel liderlik
setInterval(() => {
  for (const { player } of online.values()) persist(player);
  const top = store.topPlayers(10).map(({ id, ...rest }) => rest);
  io.emit('top', top);
}, SAVE_EVERY_MS);

function shutdown() {
  console.log('\n[sunucu] kapanıyor, oyuncular kaydediliyor...');
  for (const { player } of online.values()) {
    player.lastSeen = Date.now();
    try {
      store.saveSync(player);
    } catch (err) {
      console.error(err);
    }
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => {
  console.log(`☀️  Solaria sunucusu http://localhost:${PORT} adresinde (veri: ${DATA_DIR})`);
});
