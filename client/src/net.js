// Sunucu bağlantısı (Socket.IO). Hesap bilgisi tarayıcıda saklanır.
import { io } from 'socket.io-client';

// Her sunucu adresi için ayrı hesap (aynı tarayıcıdan farklı sunuculara bağlanılabilir)
const keyFor = (url) => (url ? `solaria.account:${url}` : 'solaria.account');

export function loadAccount(url = null) {
  try {
    return JSON.parse(localStorage.getItem(keyFor(url))) || null;
  } catch {
    return null;
  }
}

function saveAccount(url, acc) {
  try {
    localStorage.setItem(keyFor(url), JSON.stringify(acc));
  } catch {
    /* gizli sekme vb. */
  }
}

export class Net {
  // url: başka bir adresteki oyun sunucusu (boşsa sayfanın kendi sunucusu)
  constructor(url = null) {
    this.url = url;
    this.socket = io(url || undefined, { transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
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
    const acc = loadAccount(this.url);
    const payload = { name: profile.name, color: profile.color };
    if (acc?.id && acc?.secret) Object.assign(payload, { id: acc.id, secret: acc.secret });
    return new Promise((resolve) => {
      this.socket.timeout(8000).emit('join', payload, (err, res) => {
        if (err) return resolve({ ok: false, error: 'Sunucu yanıt vermedi' });
        if (res.ok) {
          this.joined = true;
          saveAccount(this.url, {
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
