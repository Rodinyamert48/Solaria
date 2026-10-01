// Tarayıcı içi "sunucu": GitHub Pages gibi statik barındırmada oyunu tek başına çalıştırır.
// Net sınıfıyla aynı arayüzü sunar (on / join / action / chat), simülasyonu ortak kodla tarayıcıda yürütür,
// ilerlemeyi localStorage'a kaydeder ve komşu adalarda yapay zekâ oyuncular çalıştırır.
import { ACTIONS, newPlayerState, migratePlayer } from '../../../shared/actions.js';
import { stepPlayer } from '../../../shared/economy.js';
import { cityLevelIndex, CITY_LEVELS } from '../../../shared/data/centers.js';
import { envAt } from '../../../shared/env.js';
import { BALANCE } from '../../../shared/balance.js';
import { publicPlot, privateState, slimStats, boardRow } from '../../../shared/views.js';
import { botTurn } from '../../../shared/bot.js';

export const SAVE_KEY = 'solaria.local.v1';
const TICK_MS = 500;
const SAVE_EVERY_MS = 10_000;
const MY_SLOT = 1;

// Yapay zekâ komşular: her biri farklı enerji türlerini sever ve farklı hızda oynar
const BOTS = [
  { id: 'botece0000001', slot: 0, name: 'Ece', color: '#4fb3ff', favorites: ['solar', 'wind', 'hydro'], every: 4 },
  { id: 'botkaan000002', slot: 2, name: 'Kaan', color: '#ff6b6b', favorites: ['coal', 'oil', 'gas'], every: 6 },
  { id: 'botzeyne00003', slot: 4, name: 'Zeynep', color: '#d36bff', favorites: ['nuclear', 'geo', 'fusion'], every: 8 },
];

const BOT_LINES = [
  'Selam komşu! 👋',
  'Rüzgar bugün harika esiyor 🌬️',
  'Şehrim büyüdükçe elektrik yetmiyor 😅',
  'Gece olunca güneş panellerim uyuyor 🌙',
  'Biri nükleer mi dedi? ☢️',
  'Parkları unutma, hava kirlenince insanlar gidiyor 🌳',
];

function cleanName(raw) {
  const name = String(raw ?? '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return name.length >= 2 ? name : null;
}

export class LocalServer {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.handlers = {};
    this.joined = false;
    this.connected = true;
    this.local = true;
    this.profile = null;
    this.timers = [];
    setTimeout(() => this.emit('connect'), 0);
  }

  on(event, fn) {
    (this.handlers[event] ||= []).push(fn);
  }

  emit(event, data) {
    for (const fn of this.handlers[event] || []) fn(data);
  }

  load() {
    try {
      return JSON.parse(this.storage?.getItem(SAVE_KEY)) || null;
    } catch {
      return null;
    }
  }

  persist() {
    if (!this.player) return;
    this.player.lastSeen = Date.now();
    const data = { v: 1, player: this.player, bots: this.bots.map((b) => b.p), chat: this.chat.slice(-30) };
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* depolama dolu veya kapalı */
    }
  }

  reset() {
    this.stop();
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch {
      /* yok say */
    }
  }

  async join(profile) {
    const name = cleanName(profile?.name);
    if (!name) return { ok: false, error: 'Takma ad 2-16 karakter olmalı' };
    this.profile = profile;
    const saved = this.load();

    this.player = migratePlayer(saved?.player || newPlayerState({ id: 'yerel', name, color: profile.color }));
    this.player.name = name;
    if (/^#[0-9a-f]{6}$/i.test(profile.color || '')) this.player.color = profile.color.toLowerCase();

    this.bots = BOTS.map((def) => {
      const old = saved?.bots?.find((b) => b.id === def.id);
      const p = migratePlayer(old || newPlayerState({ id: def.id, name: def.name, color: def.color }));
      p.name = `${def.name} 🤖`;
      return { def, p, wait: Math.random() * def.every, level: cityLevelIndex(p.pop) };
    });
    this.chat = saved?.chat || [];

    // Uzaktayken biriken kazanç (sunucudakiyle aynı kural)
    let offline = 0;
    const away = (Date.now() - (this.player.lastSeen || Date.now())) / 1000;
    if (saved && away >= 60 && this.player.lastNet > 0) {
      const seconds = Math.min(away, BALANCE.offlineMaxSeconds);
      const gain = this.player.lastNet * seconds * BALANCE.offlineRate;
      this.player.money += gain;
      offline = { gain, seconds };
    }

    this.joined = true;
    this.lastTick = Date.now();
    this.tickCount = 0;
    this.stop();
    this.timers.push(setInterval(() => this.tick(), TICK_MS));
    this.timers.push(setInterval(() => this.persist(), SAVE_EVERY_MS));
    if (typeof window !== 'undefined') {
      this.onHide = () => this.persist();
      window.addEventListener('pagehide', this.onHide);
      document.addEventListener('visibilitychange', this.onHide);
    }
    this.system(saved ? `${name} adasına geri döndü 🏝️` : `${name} adaya yerleşti 🏝️`);
    this.persist();

    return {
      ok: true,
      id: this.player.id,
      slot: MY_SLOT,
      roomId: 'yerel',
      serverTime: Date.now(),
      me: privateState(this.player),
      plots: this.plots(),
      chat: this.chat,
      offline,
      top: this.top(),
    };
  }

  stop() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    if (this.onHide && typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onHide);
      document.removeEventListener('visibilitychange', this.onHide);
    }
  }

  plots() {
    return [publicPlot(this.player, MY_SLOT), ...this.bots.map((b) => publicPlot(b.p, b.def.slot))];
  }

  top() {
    return [this.player, ...this.bots.map((b) => b.p)]
      .map((p) => ({ name: p.name, color: p.color, lifetime: p.lifetime || 0, rebirths: p.rebirths || 0, pop: Math.floor(p.pop) }))
      .sort((a, b) => b.lifetime - a.lifetime);
  }

  async action(type, payload = {}) {
    if (!this.joined) return { ok: false, error: 'Önce giriş yap' };
    const fn = ACTIONS[type];
    if (!fn) return { ok: false, error: 'Bilinmeyen eylem' };
    const result = fn(this.player, payload && typeof payload === 'object' ? payload : {});
    if (result.ok) {
      this.emit('plot', publicPlot(this.player, MY_SLOT));
      if (type === 'rebirth') this.system(`${this.player.name} yeniden doğdu! ⭐ ×${this.player.rebirths}`);
      if (type !== 'move') this.persist();
    }
    return { ...result, me: privateState(this.player) };
  }

  chat(text) {
    const clean = String(text ?? '').replace(/[<>]/g, '').trim().slice(0, 140);
    if (!clean) return;
    this.pushChat({ name: this.player.name, color: this.player.color, text: clean, t: Date.now() });
    // Komşular bazen cevap verir
    if (Math.random() < 0.6) {
      const bot = this.bots[Math.floor(Math.random() * this.bots.length)];
      setTimeout(() => {
        const line = BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)];
        this.pushChat({ name: bot.p.name, color: bot.p.color, text: line, t: Date.now() });
      }, 1200 + Math.random() * 2500);
    }
  }

  pushChat(msg) {
    this.chat.push(msg);
    if (this.chat.length > 40) this.chat.shift();
    this.emit('chat', msg);
  }

  system(text) {
    this.pushChat({ system: true, text, t: Date.now() });
  }

  async measureOffset() {
    return 0;
  }

  tick() {
    const now = Date.now();
    const elapsed = (now - this.lastTick) / 1000;
    this.lastTick = now;
    // Arka plandaki sekmede zamanlayıcılar yavaşlar: uzun boşluğu çevrimdışı oranla telafi et
    if (elapsed > 5 && this.player.lastNet > 0) {
      const extra = Math.min(elapsed - 0.5, BALANCE.offlineMaxSeconds);
      this.player.money += this.player.lastNet * extra * BALANCE.offlineRate;
      this.player.lifetime += this.player.lastNet * extra * BALANCE.offlineRate;
    }
    const dt = Math.min(elapsed, TICK_MS / 1000 * 2);
    const env = envAt(now);
    this.tickCount++;

    const stats = stepPlayer(this.player, env, dt);
    this.player.lastNet = stats.net;
    this.emit('tick', { t: now, me: privateState(this.player), stats: slimStats(stats) });

    const board = [boardRow(this.player, MY_SLOT, stats)];
    for (const b of this.bots) {
      const s = stepPlayer(b.p, env, dt);
      b.p.lastNet = s.net;
      b.wait -= dt;
      if (b.wait <= 0) {
        b.wait = b.def.every * (0.7 + Math.random() * 0.6);
        if (botTurn(b.p, { favorites: b.def.favorites, maxActions: 6 }) > 0) this.emit('plot', publicPlot(b.p, b.def.slot));
      }
      const lvl = cityLevelIndex(b.p.pop);
      if (lvl > b.level) {
        b.level = lvl;
        if (lvl >= 2) this.system(`${b.p.name} şehrini ${CITY_LEVELS[lvl].name} yaptı!`);
      }
      board.push(boardRow(b.p, b.def.slot, s));
    }
    if (this.tickCount % 2 === 0) this.emit('board', board);
    if (this.tickCount % 60 === 0) this.emit('top', this.top());
  }
}
