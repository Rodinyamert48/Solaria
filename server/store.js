// Basit JSON dosya deposu: her oyuncu data/players/<id>.json
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ID_RE = /^[a-z0-9]{12,32}$/;

export class Store {
  constructor(dir) {
    this.dir = path.join(dir, 'players');
    fs.mkdirSync(this.dir, { recursive: true });
    // Küresel liderlik için hafif özet: id -> { name, color, lifetime, rebirths, bestPop }
    this.summaries = new Map();
    this.pending = new Map(); // id -> son kayıt sözü (aynı dosyaya eşzamanlı yazmayı önler)
    for (const file of fs.readdirSync(this.dir)) {
      // Kapanışta yarım kalmış geçici dosyalar
      if (file.endsWith('.tmp')) fs.rmSync(path.join(this.dir, file), { force: true });
      if (!file.endsWith('.json')) continue;
      try {
        const p = JSON.parse(fs.readFileSync(path.join(this.dir, file), 'utf8'));
        this.summaries.set(p.id, summarize(p));
      } catch (err) {
        console.warn(`[store] okunamadı: ${file}`, err.message);
      }
    }
  }

  static newId() {
    return crypto.randomBytes(9).toString('hex');
  }

  static newSecret() {
    return crypto.randomBytes(24).toString('base64url');
  }

  static hash(secret) {
    return crypto.createHash('sha256').update(String(secret)).digest('hex');
  }

  file(id) {
    if (!ID_RE.test(id)) throw new Error('geçersiz id');
    return path.join(this.dir, `${id}.json`);
  }

  load(id) {
    if (!ID_RE.test(String(id))) return null;
    try {
      return JSON.parse(fs.readFileSync(this.file(id), 'utf8'));
    } catch {
      return null;
    }
  }

  save(p) {
    this.summaries.set(p.id, summarize(p));
    const file = this.file(p.id);
    const data = JSON.stringify(p);
    const prev = this.pending.get(p.id) || Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(async () => {
        const tmp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`;
        await fsp.writeFile(tmp, data);
        await fsp.rename(tmp, file);
      })
      .finally(() => {
        if (this.pending.get(p.id) === next) this.pending.delete(p.id);
      });
    this.pending.set(p.id, next);
    return next;
  }

  saveSync(p) {
    this.summaries.set(p.id, summarize(p));
    fs.writeFileSync(this.file(p.id), JSON.stringify(p));
  }

  topPlayers(n = 10) {
    return [...this.summaries.values()].sort((a, b) => b.lifetime - a.lifetime).slice(0, n);
  }
}

function summarize(p) {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    lifetime: p.lifetime || 0,
    rebirths: p.rebirths || 0,
    pop: Math.floor(p.pop || 0),
  };
}
