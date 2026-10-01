// Tarayıcı içi "sunucu": GitHub Pages gibi statik barındırmada oyunu tek başına çalıştırır.
// Net sınıfıyla aynı arayüzü sunar (on / join / action / chat), simülasyonu ortak kodla tarayıcıda yürütür
// ve ilerlemeyi localStorage'a kaydeder.
import { ACTIONS, newPlayerState, migratePlayer } from '../../../shared/actions.js';
import { stepPlayer } from '../../../shared/economy.js';
import { envAt } from '../../../shared/env.js';
import { BALANCE } from '../../../shared/balance.js';
import { publicPlot, privateState, slimStats, boardRow } from '../../../shared/views.js';

export const SAVE_KEY = 'solaria.local.v1';
const TICK_MS = 500;
const SAVE_EVERY_MS = 10_000;
const MY_SLOT = 1;

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
    this.chatLog = [];
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
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify({ v: 2, player: this.player }));
    } catch {
      /* depolama dolu veya kapalı */
    }
  }

  reset() {
    this.stop();
    this.player = null;
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
    this.persist();

    return {
      ok: true,
      id: this.player.id,
      slot: MY_SLOT,
      roomId: 'yerel',
      serverTime: Date.now(),
      me: privateState(this.player),
      plots: [publicPlot(this.player, MY_SLOT)],
      chat: [],
      offline,
      top: [],
      firstTime: !saved,
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

  async action(type, payload = {}) {
    if (!this.joined) return { ok: false, error: 'Önce giriş yap' };
    const fn = ACTIONS[type];
    if (!fn) return { ok: false, error: 'Bilinmeyen eylem' };
    const result = fn(this.player, payload && typeof payload === 'object' ? payload : {});
    if (result.ok) {
      this.emit('plot', publicPlot(this.player, MY_SLOT));
      if (type !== 'move') this.persist();
    }
    return { ...result, me: privateState(this.player) };
  }

  // Zorluk yalnızca tek oyunculu modda değiştirilebilir
  setDifficulty(level) {
    if (!this.player || !BALANCE.difficulty[level]) return false;
    this.player.difficulty = level;
    this.persist();
    return true;
  }

  get difficulty() {
    return this.player?.difficulty || 'normal';
  }

  chat() {
    /* tek oyunculu modda sohbet yok */
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
    const dt = Math.min(elapsed, (TICK_MS / 1000) * 2);
    this.tickCount++;

    const stats = stepPlayer(this.player, envAt(now), dt);
    this.player.lastNet = stats.net;
    this.emit('tick', { t: now, me: privateState(this.player), stats: slimStats(stats) });
    if (this.tickCount % 2 === 0) this.emit('board', [boardRow(this.player, MY_SLOT, stats)]);
  }
}
