// Enerji kategorileri.
// powerMult: kategori güç çarpanı (değişken kaynaklar ortalamayı dengelemek için daha yüksek)
// pollution: üretilen her kW için kirlilik payı (0 = temiz, 1 = çok kirli)
// upkeep: anma gücünün her kW'ı için saniyelik yakıt gideri ($)
// env: üretimi etkileyen çevre koşulu ('sun' | 'wind' | null)
export const CATEGORIES = [
  {
    id: 'solar', name: 'Güneş', icon: '☀️', color: '#f6c445',
    powerMult: 1.9, pollution: 0, upkeep: 0, env: 'sun',
    desc: 'Temiz ve ucuz. Gündüz çok güçlü, gece neredeyse hiç üretmez.',
  },
  {
    id: 'wind', name: 'Rüzgar', icon: '🌬️', color: '#8fd3f4',
    powerMult: 1.2, pollution: 0, upkeep: 0, env: 'wind',
    desc: 'Temiz. Üretim rüzgarın şiddetine göre iner çıkar.',
  },
  {
    id: 'hydro', name: 'Hidro', icon: '💧', color: '#3b8ede',
    powerMult: 1.05, pollution: 0, upkeep: 0, env: null,
    desc: 'Temiz ve sabit. Gece gündüz aynı güçte çalışır.',
  },
  {
    id: 'bio', name: 'Biyokütle', icon: '🌿', color: '#7cc36a',
    powerMult: 1.15, pollution: 0.2, upkeep: 0.04, env: null,
    desc: 'Atıklardan enerji. Az kirletir, küçük bir yakıt gideri var.',
  },
  {
    id: 'coal', name: 'Kömür', icon: '⛏️', color: '#6b6b78',
    powerMult: 1.8, pollution: 1, upkeep: 0.15, env: null,
    desc: 'Ucuz ve çok güçlü ama havayı çok kirletir ve yakıt yer.',
  },
  {
    id: 'oil', name: 'Petrol', icon: '🛢️', color: '#3a3346',
    powerMult: 1.95, pollution: 0.8, upkeep: 0.2, env: null,
    desc: 'En güçlü fosil yakıt. Kirli ve yakıt gideri yüksek.',
  },
  {
    id: 'gas', name: 'Doğalgaz', icon: '🔥', color: '#ff8a3d',
    powerMult: 1.55, pollution: 0.45, upkeep: 0.1, env: null,
    desc: 'Fosillerin en temizi. Orta kirlilik, orta yakıt gideri.',
  },
  {
    id: 'geo', name: 'Jeotermal', icon: '🌋', color: '#e8603c',
    powerMult: 1.15, pollution: 0, upkeep: 0, env: null,
    desc: 'Yerin ısısından temiz ve sabit enerji (termal).',
  },
  {
    id: 'nuclear', name: 'Nükleer', icon: '☢️', color: '#9be15d',
    powerMult: 1.6, pollution: 0, upkeep: 0.03, env: null,
    desc: 'Devasa ve temiz güç. Pahalı ama küçük alanda çok enerji.',
  },
  {
    id: 'fusion', name: 'Füzyon & Gelecek', icon: '🚀', color: '#b07cff',
    powerMult: 2.0, pollution: 0, upkeep: 0, env: null,
    desc: 'Geleceğin teknolojileri. Oyun sonu için akıl almaz güç.',
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
