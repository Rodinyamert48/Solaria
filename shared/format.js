// Sayı biçimlendirme (Türkçe ondalık virgül, uluslararası kısaltmalar)

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
const POWER_UNITS = ['kW', 'MW', 'GW', 'TW', 'PW', 'EW', 'ZW', 'YW', 'RW', 'QW'];

function fixed(n, digits) {
  return n.toFixed(digits).replace(/\.0+$|(\.\d*?)0+$/, '$1').replace('.', ',');
}

function scaled(n, units, base = 1000) {
  if (!Number.isFinite(n)) return { v: 0, unit: units[0] };
  let i = 0;
  let v = Math.abs(n);
  while (v >= base && i < units.length - 1) {
    v /= base;
    i++;
  }
  return { v: Math.sign(n) * v, unit: units[i], i };
}

export function formatNumber(n) {
  if (Math.abs(n) < 1000) return fixed(n, Math.abs(n) < 10 && n % 1 ? 1 : 0);
  const { v, unit } = scaled(n, SUFFIXES);
  return fixed(v, Math.abs(v) < 100 ? 2 : 1) + unit;
}

export function formatMoney(n) {
  return (n < 0 ? '-$' : '$') + formatNumber(Math.abs(n));
}

export function formatPower(kw) {
  const { v, unit, i } = scaled(kw, POWER_UNITS);
  const digits = i === 0 && Math.abs(v) < 10 ? 1 : Math.abs(v) < 100 ? (i === 0 ? 0 : 2) : 1;
  return `${fixed(v, digits)} ${unit}`;
}

export function formatPop(n) {
  return formatNumber(Math.floor(n));
}

export function formatDuration(seconds) {
  const s = Math.floor(seconds);
  if (s < 60) return `${s} sn`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dk ${s % 60} sn`;
  const h = Math.floor(m / 60);
  return `${h} sa ${m % 60} dk`;
}

// Enerji: kW·sn -> oyun saati cinsinden kWh (1 oyun saati = 15 sn)
export function formatEnergy(kws, gameHourSeconds = 15) {
  const kwh = kws / gameHourSeconds;
  return formatPower(kwh).replace(/W$/, 'Wh');
}
