// Ağ üzerinden gönderilen oyuncu görünümleri (sunucu ve tarayıcı içi yerel mod ortak kullanır)

// Herkesin gördüğü ada bilgisi
export function publicPlot(p, slot) {
  return {
    id: p.id,
    slot,
    name: p.name,
    color: p.color,
    land: p.land,
    centers: p.centers,
    generators: p.generators,
    pop: Math.floor(p.pop),
    rebirths: p.rebirths,
  };
}

// Sadece oyuncunun kendisine gönderilen durum
export function privateState(p) {
  return {
    money: p.money,
    lifetime: p.lifetime,
    runEarned: p.runEarned,
    rebirths: p.rebirths,
    bestCity: p.bestCity,
    pop: p.pop,
    stored: p.stored || 0,
    difficulty: p.difficulty || 'normal',
    land: p.land,
    centers: p.centers,
  };
}

// Tick ile gönderilen istatistiklerin ağ için hafif kopyası
export function slimStats(s) {
  return {
    supply: s.supply,
    available: s.available,
    rated: s.rated,
    demandFactor: s.demandFactor,
    storePower: s.storePower,
    storeCap: s.storeCap,
    stored: s.stored,
    charge: s.charge,
    discharge: s.discharge,
    demand: s.demand,
    served: s.served,
    coverage: s.coverage,
    wasted: s.wasted,
    capacity: s.capacity,
    perCapita: s.perCapita,
    price: s.price,
    income: s.income,
    upkeep: s.upkeep,
    net: s.net,
    airQuality: s.airQuality,
    pollutionShare: s.pollutionShare,
    growth: s.growth,
    byCat: s.byCat,
    cityLevel: s.cityLevel,
  };
}

export function boardRow(p, slot, stats) {
  return {
    slot,
    id: p.id,
    name: p.name,
    color: p.color,
    pop: Math.floor(p.pop),
    net: stats.net,
    supply: stats.supply,
    coverage: stats.coverage,
    cityLevel: stats.cityLevel,
    rebirths: p.rebirths,
  };
}
