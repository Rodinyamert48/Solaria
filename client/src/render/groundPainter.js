// Ada zemini için prosedürel doku çizimi: çim, asfalt, kaldırım, meydan taşı.
// Desenler bir kez üretilir ve tüm adalarda paylaşılır.
import { ISLAND_SIZE, CITY_MIN, CITY_MAX, isCityTile, isUnlocked, MAX_LAND_LEVEL } from '@shared/grid.js';
import { BALANCE } from '@shared/balance.js';

const HALF = ISLAND_SIZE / 2;
let patterns = null;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Kenarlardan taşan çizimleri karşı kenara da çizerek döşenebilir (tileable) doku üret
function tileable(size, draw) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
    ctx.save();
    ctx.translate(dx, dy);
    draw(ctx, dx === 0 && dy === 0);
    ctx.restore();
  }
  return c;
}

function makePatterns() {
  const S = 256;
  // Çim: taban + lekeler + binlerce ot çizgisi + küçük çiçekler
  const grass = canvas(S);
  {
    const ctx = grass.getContext('2d');
    ctx.fillStyle = '#6da94c';
    ctx.fillRect(0, 0, S, S);
    const r = rng(11);
    const layer = tileable(S, (c) => {
      const rr = rng(11);
      for (let i = 0; i < 26; i++) {
        const x = rr() * S;
        const y = rr() * S;
        const rad = 18 + rr() * 40;
        const g = c.createRadialGradient(x, y, 0, x, y, rad);
        const light = rr() < 0.5;
        g.addColorStop(0, light ? 'rgba(150,200,95,0.35)' : 'rgba(60,110,40,0.3)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    });
    ctx.drawImage(layer, 0, 0);
    const blades = ['#5c9a40', '#7bb957', '#88c465', '#4e8a37', '#96cc72', '#689f48'];
    const bladeLayer = tileable(S, (c) => {
      const rr = rng(23);
      c.lineWidth = 1;
      for (let i = 0; i < 5200; i++) {
        const x = rr() * S;
        const y = rr() * S;
        const len = 1.5 + rr() * 3.5;
        const a = -Math.PI / 2 + (rr() - 0.5) * 0.9;
        c.strokeStyle = blades[(rr() * blades.length) | 0];
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        c.stroke();
      }
    });
    ctx.drawImage(bladeLayer, 0, 0);
    const flowers = ['#ffffff', '#ffe066', '#ff9ec7', '#c6a6ff'];
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = flowers[(r() * flowers.length) | 0];
      ctx.fillRect(r() * S, r() * S, 1.6, 1.6);
    }
  }
  // Asfalt: koyu gri + ince taneli gürültü
  const asphalt = canvas(128);
  {
    const ctx = asphalt.getContext('2d');
    ctx.fillStyle = '#4a4e57';
    ctx.fillRect(0, 0, 128, 128);
    const r = rng(5);
    for (let i = 0; i < 2600; i++) {
      const v = 50 + r() * 50;
      ctx.fillStyle = `rgba(${v},${v + 3},${v + 8},0.5)`;
      ctx.fillRect(r() * 128, r() * 128, 1, 1);
    }
  }
  // Kaldırım/beton: açık renk + derz çizgileri
  const concrete = canvas(128);
  {
    const ctx = concrete.getContext('2d');
    ctx.fillStyle = '#cdc8bd';
    ctx.fillRect(0, 0, 128, 128);
    const r = rng(9);
    for (let i = 0; i < 1600; i++) {
      const v = 175 + r() * 50;
      ctx.fillStyle = `rgba(${v},${v - 4},${v - 12},0.45)`;
      ctx.fillRect(r() * 128, r() * 128, 1.2, 1.2);
    }
    ctx.strokeStyle = 'rgba(120,112,100,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 128; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i + 0.5, 0);
      ctx.lineTo(i + 0.5, 128);
      ctx.moveTo(0, i + 0.5);
      ctx.lineTo(128, i + 0.5);
      ctx.stroke();
    }
  }
  // Meydan: sıcak tonlu taş döşeme
  const plaza = canvas(64);
  {
    const ctx = plaza.getContext('2d');
    const r = rng(3);
    for (let y = 0; y < 64; y += 16)
      for (let x = 0; x < 64; x += 16) {
        const v = 205 + r() * 30;
        ctx.fillStyle = `rgb(${v},${v - 10},${v - 28})`;
        ctx.fillRect(x, y, 16, 16);
        ctx.strokeStyle = 'rgba(110,95,70,0.45)';
        ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
      }
  }
  return { grass, asphalt, concrete, plaza };
}

// Zemini çiz. T: karo başına piksel. Kanvas satırı: karo y=0 dokunun altında (z-) olmalı.
export function paintGround(ctx, T, { land, grid }) {
  patterns ||= makePatterns();
  const N = ISLAND_SIZE;
  const W = N * T;
  const rect = (x, y, w = 1, h = 1) => [x * T, (N - y - h) * T, w * T, h * T];
  const fill = (img, ...r) => {
    ctx.fillStyle = ctx.createPattern(img, 'repeat');
    ctx.fillRect(...r);
  };

  // Tüm ada çim
  fill(patterns.grass, 0, 0, W, W);

  // Kilitli arazi: daha koyu, yabani çayır; bir sonraki halka biraz daha açık
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (isCityTile(x, y) || isUnlocked(x, y, land)) continue;
      const next = land < MAX_LAND_LEVEL && isUnlocked(x, y, land + 1);
      ctx.fillStyle = next ? 'rgba(70,80,40,0.16)' : 'rgba(45,60,30,0.3)';
      ctx.fillRect(...rect(x, y));
    }
  }

  // Şehir: parseller beton, yollar asfalt, ortada meydan
  const cityRect = rect(CITY_MIN, CITY_MIN, 10, 10);
  fill(patterns.concrete, ...cityRect);
  const isRoad = (c) => c === 3 || c === 6;
  for (let cy = 0; cy < 10; cy++) {
    for (let cx = 0; cx < 10; cx++) {
      const x = CITY_MIN + cx;
      const y = CITY_MIN + cy;
      if (isRoad(cx) || isRoad(cy)) fill(patterns.asphalt, ...rect(x, y));
      else if (cx >= 4 && cx <= 5 && cy >= 4 && cy <= 5) fill(patterns.plaza, ...rect(x, y));
    }
  }
  // Yol çizgileri: orta şerit (sarı kesikli), kaldırım kenarı, yaya geçitleri
  ctx.save();
  for (const c of [3, 6]) {
    const mid = (CITY_MIN + c + 0.5) * T;
    const midY = (N - (CITY_MIN + c + 0.5)) * T;
    ctx.strokeStyle = 'rgba(255,214,90,0.9)';
    ctx.lineWidth = Math.max(1.5, T * 0.05);
    ctx.setLineDash([T * 0.28, T * 0.22]);
    for (const [a, b] of [[0, 3], [4, 6], [7, 10]]) {
      ctx.beginPath();
      ctx.moveTo(mid, (N - CITY_MIN - a) * T - T * 0.15);
      ctx.lineTo(mid, (N - CITY_MIN - b) * T + T * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo((CITY_MIN + a) * T + T * 0.15, midY);
      ctx.lineTo((CITY_MIN + b) * T - T * 0.15, midY);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  // Kaldırım bordürü ve yaya geçitleri kavşaklarda
  ctx.strokeStyle = 'rgba(235,232,224,0.95)';
  ctx.lineWidth = Math.max(1, T * 0.06);
  for (let cy = 0; cy < 10; cy++)
    for (let cx = 0; cx < 10; cx++) {
      if (!(isRoad(cx) || isRoad(cy))) continue;
      const [px, py] = rect(CITY_MIN + cx, CITY_MIN + cy);
      if (isRoad(cx) && !isRoad(cy)) {
        ctx.beginPath();
        ctx.moveTo(px + 1, py);
        ctx.lineTo(px + 1, py + T);
        ctx.moveTo(px + T - 1, py);
        ctx.lineTo(px + T - 1, py + T);
        ctx.stroke();
      } else if (isRoad(cy) && !isRoad(cx)) {
        ctx.beginPath();
        ctx.moveTo(px, py + 1);
        ctx.lineTo(px + T, py + 1);
        ctx.moveTo(px, py + T - 1);
        ctx.lineTo(px + T, py + T - 1);
        ctx.stroke();
      } else {
        // kavşak: dört kenarda zebra çizgileri
        ctx.fillStyle = 'rgba(245,245,240,0.9)';
        const n = 5;
        const w = T / (n * 2);
        for (let i = 0; i < n; i++) {
          const o = i * 2 * w + w / 2;
          ctx.fillRect(px + o, py + 1, w, T * 0.12);
          ctx.fillRect(px + o, py + T - T * 0.12 - 1, w, T * 0.12);
          ctx.fillRect(px + 1, py + o, T * 0.12, w);
          ctx.fillRect(px + T - T * 0.12 - 1, py + o, T * 0.12, w);
        }
      }
    }
  ctx.restore();
  // Şehir sınırı bordürü
  ctx.strokeStyle = '#a9a396';
  ctx.lineWidth = Math.max(2, T * 0.08);
  ctx.strokeRect(cityRect[0] + 1, cityRect[1] + 1, cityRect[2] - 2, cityRect[3] - 2);

  // İnşa ızgarası (yalnızca inşa ederken veya ayarda açıkken)
  const r = BALANCE.landRadii[land];
  const a = Math.max(0, Math.ceil(HALF - r - 0.5));
  const b = Math.min(N, Math.floor(HALF + r + 0.5));
  if (grid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    for (let i = a; i <= b; i++) {
      ctx.beginPath();
      ctx.moveTo(i * T + 0.5, (N - b) * T);
      ctx.lineTo(i * T + 0.5, (N - a) * T);
      ctx.moveTo(a * T, (N - i) * T + 0.5);
      ctx.lineTo(b * T, (N - i) * T + 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(a * T + 1.5, (N - b) * T + 1.5, (b - a) * T - 3, (b - a) * T - 3);
    ctx.setLineDash([]);
  }

  // Ada kenarı
  ctx.strokeStyle = 'rgba(40,70,25,0.6)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, W - 3);
  return { a, b };
}
