// Oda: 6 adalık bir dünya. Oyuncuları simüle eder ve değişiklikleri yayınlar.
import { stepPlayer, computeStats } from '../shared/economy.js';
import { envAt } from '../shared/env.js';
import { publicPlot, privateState, slimStats, boardRow } from '../shared/views.js';

export { publicPlot, privateState };

export const SLOTS_PER_ROOM = 6;
const TICK_MS = 500;
const BOARD_EVERY = 2; // her 2 tick'te bir liderlik tablosu

let roomCounter = 0;

export class Room {
  constructor(io) {
    this.io = io;
    this.id = `oda-${++roomCounter}`;
    this.slots = new Array(SLOTS_PER_ROOM).fill(null); // { player, socket }
    this.chat = [];
    this.tickCount = 0;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  get count() {
    return this.slots.filter(Boolean).length;
  }

  get full() {
    return this.count >= SLOTS_PER_ROOM;
  }

  add(player, socket) {
    const slot = this.slots.indexOf(null);
    if (slot < 0) throw new Error('oda dolu');
    this.slots[slot] = { player, socket };
    socket.join(this.id);
    socket.to(this.id).emit('plot', publicPlot(player, slot));
    this.system(`${player.name} adaya yerleşti 🏝️`);
    return slot;
  }

  remove(playerId) {
    const slot = this.slots.findIndex((s) => s?.player.id === playerId);
    if (slot < 0) return null;
    const { player, socket } = this.slots[slot];
    this.slots[slot] = null;
    socket.leave(this.id);
    this.io.to(this.id).emit('left', { slot });
    this.system(`${player.name} ayrıldı`);
    return player;
  }

  slotOf(playerId) {
    return this.slots.findIndex((s) => s?.player.id === playerId);
  }

  plots() {
    return this.slots.map((s, i) => (s ? publicPlot(s.player, i) : null)).filter(Boolean);
  }

  // Bir oyuncunun adası değişti: herkese bildir
  broadcastPlot(playerId) {
    const slot = this.slotOf(playerId);
    if (slot >= 0) this.io.to(this.id).emit('plot', publicPlot(this.slots[slot].player, slot));
  }

  pushChat(msg) {
    this.chat.push(msg);
    if (this.chat.length > 40) this.chat.shift();
    this.io.to(this.id).emit('chat', msg);
  }

  system(text) {
    this.pushChat({ system: true, text, t: Date.now() });
  }

  tick() {
    const now = Date.now();
    const env = envAt(now);
    const dt = TICK_MS / 1000;
    this.tickCount++;
    const board = [];
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s) continue;
      const stats = stepPlayer(s.player, env, dt);
      s.player.lastNet = stats.net;
      s.stats = stats;
      s.socket.emit('tick', { t: now, me: privateState(s.player), stats: slimStats(stats) });
      board.push(boardRow(s.player, i, stats));
    }
    if (this.tickCount % BOARD_EVERY === 0 && board.length) this.io.to(this.id).emit('board', board);
  }

  statsFor(player) {
    return computeStats(player, envAt(Date.now()));
  }

  players() {
    return this.slots.filter(Boolean).map((s) => s.player);
  }

  destroy() {
    clearInterval(this.timer);
  }
}
