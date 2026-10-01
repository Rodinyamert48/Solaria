// Tüm denge (balance) sabitleri tek yerde. `npm run balance` ile ilerleme hızını kontrol et.

export const BALANCE = {
  // Jeneratör kademesi (tier) -> maliyet ve güç
  // Her kademe: maliyet ×genCostGrowth, güç ×genPowerGrowth  =>  geri ödeme süresi yavaşça uzar
  genBaseCost: 10,
  genCostGrowth: 1.62,
  genBasePower: 1, // kW
  genPowerGrowth: 1.38,
  // Büyük ayak izi biraz daha verimli (aynı paraya biraz daha fazla güç)
  sizePowerMult: { 1: 1, 2: 1.12, 3: 1.25, 4: 1.4 },

  // Jeneratör yükseltmeleri (seviye 1..5)
  levelPowerMult: [1, 1.6, 2.3, 3.1, 4],
  levelUpgradeCostMult: [0.6, 1, 1.5, 2.1], // temel maliyetin katı
  sellRefund: 0.5,

  // Şehir
  kwPerCitizen: 1,
  basePrice: 1, // 1 kW = saniyede $1
  growthRate: 0.03, // açığın saniyede %3'ü kadar nüfus gelir
  minGrowth: 0.5, // saniyede en az bu kadar kişi gelir
  declineRate: 0.012, // karartmada fazlalığın saniyede %1.2'si gider
  pollutionImpact: 0.6, // tamamen kirli şebekede hava kalitesi en fazla bu kadar düşer
  minAirQuality: 0.4,

  // Arazi: merkezden Chebyshev yarıçapı ve maliyet
  landRadii: [7, 9, 12, 15],
  landCosts: [0, 100_000, 50_000_000, 50_000_000_000],

  // Çevrimdışı kazanç
  offlineRate: 0.5,
  offlineMaxSeconds: 8 * 3600,

  // Yeniden doğuş
  rebirthBasePop: 2_000_000,
  rebirthPopGrowth: 5,
  rebirthIncomeBonus: 0.5, // her yeniden doğuş +%50 gelir
  startMoney: 50,
};
