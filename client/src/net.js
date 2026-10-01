// Sunucu bağlantısı (Socket.IO). Hesap bilgisi tarayıcıda saklanır.
import { io } from 'socket.io-client';

const KEY = 'solaria.account';

export function loadAccount() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

function saveAccount(acc) {
  try {
    localStorage.setItem(KEY, JSON.stringify(acc));
  } catch {
    /* gizli sekme vb. */
  }
}

export class Net {
  constructor() {
    this.socket = io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
    this.joined = false;
    this.profile = null;
  }

  on(event, fn) {
    this.socket.on(event, fn);
  }

  get connected() {
    return this.socket.connected;
  }

  join(profile) {
    this.profile = profile;
    const acc = loadAccount();
    const payload = { name: profile.name, color: profile.color };
    if (acc?.id && acc?.secret) Object.assign(payload, { id: acc.id, secret: acc.secret });
    return new Promise((resolve) => {
      this.socket.timeout(8000).emit('join', payload, (err, res) => {
        if (err) return resolve({ ok: false, error: 'Sunucu yanıt vermedi' });
        if (res.ok) {
          this.joined = true;
          saveAccount({
            id: res.id,
            secret: res.secret || acc?.secret,
            name: profile.name,
            color: profile.color,
          });
        }
        resolve(res);
      });
    });
  }

  action(type, payload = {}) {
    return new Promise((resolve) => {
      this.socket.timeout(6000).emit('action', { type, payload }, (err, res) => {
        resolve(err ? { ok: false, error: 'Bağlantı sorunu' } : res);
      });
    });
  }

  chat(text) {
    this.socket.emit('chat', text);
  }

  // Sunucu saat farkı (ms): serverTime ≈ Date.now() + offset
  async measureOffset() {
    const t0 = Date.now();
    const server = await new Promise((r) => this.socket.timeout(4000).emit('ping:time', (e, v) => r(e ? null : v)));
    if (server == null) return null;
    const t1 = Date.now();
    return server - (t0 + t1) / 2;
  }
}
