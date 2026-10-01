import { niceRound } from './generators.js';

const dec = (v) => v.toFixed(2).replace('.', ',');

// Şehir seviyeleri (nüfus eşikleri)
export const CITY_LEVELS = [
  { name: 'Köy', pop: 0 },
  { name: 'Kasaba', pop: 200 },
  { name: 'İlçe', pop: 2_000 },
  { name: 'Şehir', pop: 20_000 },
  { name: 'Büyük Şehir', pop: 200_000 },
  { name: 'Metropol', pop: 2_000_000 },
  { name: 'Megakent', pop: 20_000_000 },
  { name: 'Ekümenopolis', pop: 200_000_000 },
  { name: 'Gezegen Başkenti', pop: 2_000_000_000 },
];

export function cityLevelIndex(pop) {
  let i = 0;
  while (i + 1 < CITY_LEVELS.length && pop >= CITY_LEVELS[i + 1].pop) i++;
  return i;
}

// Şehir merkezleri. Seviye 0'dan başlar.
// unlock: açılması için gereken şehir seviyesi (CITY_LEVELS indeksi)
// effect(L): seviyedeki etki değeri; text(L): arayüzde gösterilecek açıklama
export const CENTERS = [
  {
    id: 'residential', name: 'Konut Merkezi', icon: '🏠', unlock: 0,
    baseCost: 40, costGrowth: 2.3,
    desc: 'Yeni evler ve apartmanlar. Şehrin nüfus kapasitesini artırır.',
    effect: (L) => 20 * 1.85 ** L,
    text: (v) => `Kapasite tabanı: ${Math.floor(v).toLocaleString('tr-TR')} kişi`,
  },
  {
    id: 'commerce', name: 'Ticaret Merkezi', icon: '🏬', unlock: 0,
    baseCost: 150, costGrowth: 2.8,
    desc: 'Mağazalar ve ofisler elektriği daha pahalıya alır.',
    effect: (L) => 1 + 0.12 * L,
    text: (v) => `Elektrik fiyatı: ×${dec(v)}`,
  },
  {
    id: 'park', name: 'Park & Yeşil Alan', icon: '🌳', unlock: 0,
    baseCost: 80, costGrowth: 2.3,
    desc: 'Ağaçlar kirliliği emer. Fosil santrallerin zararını azaltır.',
    effect: (L) => 1 - 0.88 ** L,
    text: (v) => `Kirlilik etkisi: −%${Math.round(v * 100)}`,
  },
  {
    id: 'industry', name: 'Sanayi Merkezi', icon: '🏭', unlock: 1,
    baseCost: 600, costGrowth: 2.5,
    desc: 'Fabrikalar kişi başına çok daha fazla elektrik tüketir (ve öder).',
    effect: (L) => 1 + 0.1 * L,
    text: (v) => `Kişi başı talep: ×${dec(v)}`,
  },
  {
    id: 'health', name: 'Sağlık Merkezi', icon: '🏥', unlock: 1,
    baseCost: 450, costGrowth: 2.4,
    desc: 'Hastaneler şehri daha çekici yapar: hızlı büyüme ve daha fazla kapasite.',
    effect: (L) => L,
    text: (v) => `Büyüme +%${v * 15} · Kapasite +%${v * 8}`,
  },
  {
    id: 'education', name: 'Eğitim & Ar-Ge Merkezi', icon: '🎓', unlock: 2,
    baseCost: 4_000, costGrowth: 2.9,
    desc: 'Mühendisler tüm santrallerinin verimini artırır.',
    effect: (L) => 1 + 0.05 * L,
    text: (v) => `Tüm santral gücü: ×${dec(v)}`,
  },
  {
    id: 'entertainment', name: 'Eğlence Merkezi', icon: '🏟️', unlock: 2,
    baseCost: 3_000, costGrowth: 2.6,
    desc: 'Stadyumlar ve konser alanları uzaklardan insan çeker.',
    effect: (L) => 1 + 0.12 * L,
    text: (v) => `Nüfus kapasitesi: ×${dec(v)}`,
  },
  {
    id: 'transport', name: 'Ulaşım Merkezi', icon: '✈️', unlock: 3,
    baseCost: 40_000, costGrowth: 2.6,
    desc: 'Havalimanı ve metro: yeni gelenler için kapı.',
    effect: (L) => L,
    text: (v) => `Kapasite +%${v * 10} · Büyüme +%${v * 10}`,
  },
];

export const CENTER_BY_ID = Object.fromEntries(CENTERS.map((c) => [c.id, c]));

export function centerCost(center, level) {
  return niceRound(center.baseCost * center.costGrowth ** level);
}

export function emptyCenters() {
  return Object.fromEntries(CENTERS.map((c) => [c.id, 0]));
}
