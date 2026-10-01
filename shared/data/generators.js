import { BALANCE } from '../balance.js';
import { CATEGORY_BY_ID } from './categories.js';

// [id, kategori, ad, kademe (tier), boyut (karo), açıklama]
const RAW = [
  // ☀️ Güneş
  ['solar_panel', 'solar', 'Küçük Güneş Paneli', 0, 1, 'Direğe takılı tek bir panel. Her şey burada başlar.'],
  ['solar_array', 'solar', 'Panel Dizisi', 3, 1, 'Dört panelli kompakt bir dizi.'],
  ['solar_farm', 'solar', 'Güneş Çiftliği', 7, 2, 'Sıra sıra dizilmiş paneller.'],
  ['solar_trough', 'solar', 'Parabolik Oluk', 11, 2, 'Kavisli aynalar ısıyı borulara odaklar.'],
  ['solar_dish', 'solar', 'Çanak Stirling', 16, 2, 'Güneşi takip eden dev çanaklar.'],
  ['solar_tower', 'solar', 'Güneş Kulesi (CSP)', 22, 3, 'Yüzlerce ayna ışığı kulenin tepesinde toplar.'],
  ['solar_orbital', 'solar', 'Yörünge Güneş Alıcısı', 30, 3, 'Uzaydaki panellerden gelen ışını yakalar.'],

  // 🌬️ Rüzgar
  ['wind_mini', 'wind', 'Mini Rüzgar Türbini', 1, 1, 'Bahçe tipi küçük bir türbin.'],
  ['wind_vertical', 'wind', 'Dikey Eksen Türbini', 4, 1, 'Her yönden esen rüzgarı yakalar.'],
  ['wind_turbine', 'wind', 'Rüzgar Türbini', 8, 1, 'Klasik üç kanatlı türbin.'],
  ['wind_large', 'wind', 'Büyük Rüzgar Türbini', 13, 2, 'Daha uzun kule, daha uzun kanatlar.'],
  ['wind_offshore', 'wind', 'Açık Deniz Türbini', 19, 2, 'Deniz rüzgarı hiç durmaz.'],
  ['wind_mega', 'wind', 'Mega Türbin', 26, 3, 'Gökyüzünü kesen dev kanatlar.'],

  // 💧 Hidro
  ['hydro_wheel', 'hydro', 'Su Çarkı', 2, 1, 'Akan suyla dönen ahşap çark.'],
  ['hydro_micro', 'hydro', 'Mikro Hidro', 5, 1, 'Küçük bir derenin gücü.'],
  ['hydro_river', 'hydro', 'Nehir Santrali', 10, 2, 'Nehir akışından sürekli enerji.'],
  ['hydro_wave', 'hydro', 'Dalga Enerjisi Parkı', 15, 2, 'Dalgalarla inip kalkan şamandıralar.'],
  ['hydro_tidal', 'hydro', 'Gelgit Santrali', 21, 3, 'Gelgitin devasa gücü.'],
  ['hydro_dam', 'hydro', 'Büyük Baraj', 28, 3, 'Koca bir gölü arkasında tutan beton dev.'],

  // 🌿 Biyokütle
  ['bio_tank', 'bio', 'Biyogaz Tankı', 2, 1, 'Organik atıklardan gaz üretir.'],
  ['bio_compost', 'bio', 'Kompost Jeneratörü', 6, 1, 'Çürüyen bitkilerin ısısını kullanır.'],
  ['bio_pellet', 'bio', 'Pelet Santrali', 9, 2, 'Odun peletleri yakar.'],
  ['bio_waste', 'bio', 'Atıktan Enerji Tesisi', 14, 2, 'Şehrin çöpünü elektriğe çevirir.'],
  ['bio_algae', 'bio', 'Alg Biyoreaktörü', 20, 3, 'Yeşil alg tüpleri yakıt üretir.'],
  ['bio_complex', 'bio', 'Biyokütle Kompleksi', 27, 3, 'Dev silolar ve kazanlar.'],

  // ⛏️ Kömür
  ['coal_boiler', 'coal', 'Küçük Kömür Kazanı', 3, 1, 'Dumanı tüten küçük bir kazan.'],
  ['coal_generator', 'coal', 'Kömür Jeneratörü', 6, 1, 'Kömürle çalışan buhar jeneratörü.'],
  ['coal_plant', 'coal', 'Kömür Santrali', 10, 2, 'Yüksek bacalı klasik santral.'],
  ['coal_fluid', 'coal', 'Akışkan Yataklı Santral', 15, 2, 'Daha verimli yakma teknolojisi.'],
  ['coal_supercritical', 'coal', 'Süper Kritik Santral', 21, 3, 'Aşırı basınçlı buhar, aşırı güç.'],
  ['coal_ultra', 'coal', 'Ultra Süper Kritik Kompleks', 27, 3, 'Kömürün ulaşabileceği zirve.'],

  // 🛢️ Petrol
  ['oil_diesel', 'oil', 'Dizel Jeneratör', 4, 1, 'Gürültülü ama güvenilir.'],
  ['oil_pumpjack', 'oil', 'Petrol Pompası', 7, 1, 'Durmadan eğilip kalkan pompa.'],
  ['oil_derrick', 'oil', 'Sondaj Kulesi', 11, 2, 'Yerin derinliklerinden petrol çeker.'],
  ['oil_plant', 'oil', 'Fuel-Oil Santrali', 16, 2, 'Dev tanklar ve türbinler.'],
  ['oil_refinery', 'oil', 'Rafineri Santrali', 22, 3, 'Damıtma kuleleri ve alev bacası.'],
  ['oil_platform', 'oil', 'Açık Deniz Platformu', 29, 3, 'Okyanusun ortasında çelik bir şehir.'],

  // 🔥 Doğalgaz
  ['gas_generator', 'gas', 'Gaz Jeneratörü', 5, 1, 'Kompakt doğalgaz motoru.'],
  ['gas_turbine', 'gas', 'Gaz Türbini', 9, 1, 'Jet motoru gibi dönen türbin.'],
  ['gas_combined', 'gas', 'Kombine Çevrim Santrali', 13, 2, 'Atık ısıyı da elektriğe çevirir.'],
  ['gas_lng', 'gas', 'LNG Terminali', 18, 2, 'Küresel tanklarda sıvı gaz.'],
  ['gas_cogen', 'gas', 'Kojenerasyon Tesisi', 24, 3, 'Hem elektrik hem ısı üretir.'],
  ['gas_mega', 'gas', 'Mega Kombine Çevrim', 31, 3, 'Gaz enerjisinin şaheseri.'],

  // 🌋 Jeotermal
  ['geo_heatpump', 'geo', 'Isı Pompası', 4, 1, 'Toprağın ılık ısısını kullanır.'],
  ['geo_well', 'geo', 'Jeotermal Kuyu', 8, 1, 'Buhar fışkıran derin kuyu.'],
  ['geo_drysteam', 'geo', 'Kuru Buhar Santrali', 12, 2, 'Doğal buharla doğrudan türbin.'],
  ['geo_flash', 'geo', 'Flaş Buhar Santrali', 17, 2, 'Sıcak suyu ani buhara çevirir.'],
  ['geo_binary', 'geo', 'Binary Çevrim Santrali', 23, 3, 'İkili akışkanla yüksek verim.'],
  ['geo_magma', 'geo', 'Magma Santrali', 32, 3, 'Doğrudan magmanın ısısına dokunur.'],

  // ☢️ Nükleer
  ['nuke_rtg', 'nuclear', 'Radyoizotop Jeneratörü (RTG)', 18, 1, 'Uzay sondalarının pili.'],
  ['nuke_micro', 'nuclear', 'Mikro Reaktör', 22, 1, 'Konteyner boyutunda reaktör.'],
  ['nuke_smr', 'nuclear', 'Küçük Modüler Reaktör', 26, 2, 'Fabrikada üretilen güvenli reaktör.'],
  ['nuke_pwr', 'nuclear', 'Basınçlı Su Reaktörü', 30, 3, 'Kubbe ve soğutma kulesi.'],
  ['nuke_breeder', 'nuclear', 'Hızlı Üretken Reaktör', 34, 3, 'Yakıtını kendi üretir.'],
  ['nuke_thorium', 'nuclear', 'Toryum Erimiş Tuz Reaktörü', 38, 3, 'Parlayan erimiş tuz döngüsü.'],
  ['nuke_complex', 'nuclear', 'Nükleer Kompleks', 42, 4, 'Çoklu reaktör ve dev soğutma kuleleri.'],

  // 🚀 Füzyon & Gelecek
  ['fusion_proto', 'fusion', 'Füzyon Prototipi', 36, 2, 'Yıldızların gücünün ilk kıvılcımı.'],
  ['fusion_tokamak', 'fusion', 'Tokamak', 40, 3, 'Halka şeklinde manyetik plazma.'],
  ['fusion_stellarator', 'fusion', 'Stellarator', 44, 3, 'Bükülmüş halkalarda kararlı plazma.'],
  ['future_antimatter', 'fusion', 'Antimadde Reaktörü', 48, 3, 'Madde ve antimadde buluşursa...'],
  ['future_zeropoint', 'fusion', 'Sıfır Noktası Jeneratörü', 52, 3, 'Boşluğun kendisinden enerji.'],
  ['future_dyson', 'fusion', 'Dyson Işın Alıcısı', 56, 4, 'Bir yıldızın tüm gücü tek ışında.'],
  ['future_blackhole', 'fusion', 'Kara Delik Jeneratörü', 60, 4, 'Minik bir kara delik. Dikkatli ol.'],
];

// Göze hoş gelen yuvarlama: 2 anlamlı basamak (1234 -> 1200)
export function niceRound(n) {
  if (n < 100) return Math.round(n);
  const mag = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
}

export function tierCost(tier) {
  return niceRound(BALANCE.genBaseCost * BALANCE.genCostGrowth ** tier);
}

export function tierPower(tier) {
  return BALANCE.genBasePower * BALANCE.genPowerGrowth ** tier;
}

export const GENERATORS = RAW.map(([id, cat, name, tier, size, desc], index) => {
  const category = CATEGORY_BY_ID[cat];
  if (!category) throw new Error(`Bilinmeyen kategori: ${cat}`);
  const power = tierPower(tier) * category.powerMult * BALANCE.sizePowerMult[size];
  return {
    id,
    cat,
    name,
    tier,
    size,
    desc,
    index,
    cost: tierCost(tier),
    power: Math.round(power * 100) / 100, // anma gücü (kW), seviye 1
  };
});

export const GENERATOR_BY_ID = Object.fromEntries(GENERATORS.map((g) => [g.id, g]));

export function generatorsOfCategory(catId) {
  return GENERATORS.filter((g) => g.cat === catId).sort((a, b) => a.tier - b.tier);
}

export const MAX_GEN_LEVEL = BALANCE.levelPowerMult.length;

export function levelPowerMult(level) {
  return BALANCE.levelPowerMult[Math.min(level, MAX_GEN_LEVEL) - 1];
}

// level -> level+1 yükseltme maliyeti; maksimumdaysa null
export function upgradeCost(def, level) {
  if (level >= MAX_GEN_LEVEL) return null;
  return niceRound(def.cost * BALANCE.levelUpgradeCostMult[level - 1]);
}

// Bu seviyeye kadar harcanan toplam para
export function investedCost(def, level) {
  let total = def.cost;
  for (let l = 1; l < level; l++) total += upgradeCost(def, l);
  return total;
}

export function sellValue(def, level) {
  return Math.floor(investedCost(def, level) * BALANCE.sellRefund);
}
