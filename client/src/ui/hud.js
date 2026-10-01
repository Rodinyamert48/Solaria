// Üst bilgi çubuğu
import { $ } from './dom.js';
import { formatMoney, formatPower, formatPop } from '@shared/format.js';
import { CITY_LEVELS } from '@shared/data/centers.js';
import { clockString } from '@shared/env.js';

export class Hud {
  constructor() {
    this.el = {
      money: $('#hud-money'),
      net: $('#hud-net'),
      pop: $('#hud-pop'),
      cap: $('#hud-cap'),
      level: $('#hud-level'),
      supply: $('#hud-supply'),
      demand: $('#hud-demand'),
      fill: $('#hud-power-fill'),
      over: $('#hud-power-over'),
      note: $('#hud-power-note'),
      clock: $('#hud-clock'),
      sun: $('#hud-sun'),
      wind: $('#hud-wind'),
      air: $('#hud-air'),
    };
  }

  show() {
    $('#hud').classList.remove('hidden');
  }

  setMoney(money) {
    this.el.money.textContent = formatMoney(money);
  }

  update(state) {
    const s = state.stats;
    const me = state.me;
    if (!s || !me) return;
    const net = s.net;
    this.el.net.textContent = `${net >= 0 ? '+' : ''}${formatMoney(net)}/sn`;
    this.el.net.className = `hud-sub ${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}`;
    this.el.pop.textContent = formatPop(me.pop);
    this.el.cap.textContent = `kapasite ${formatPop(s.capacity)}`;
    this.el.level.textContent = CITY_LEVELS[s.cityLevel].name;
    this.el.supply.textContent = formatPower(s.supply);
    this.el.demand.textContent = formatPower(s.demand);

    const max = Math.max(s.supply, s.demand, 1e-9);
    const fill = s.demand > 0 ? Math.min(1, s.supply / s.demand) : 1;
    this.el.fill.style.width = `${(s.demand / max) * fill * 100}%`;
    this.el.fill.classList.toggle('short', s.coverage < 0.999);
    this.el.over.style.width = `${(s.wasted / max) * 100}%`;

    let note;
    if (s.coverage < 0.999) note = `⚠️ Karartma! Talebin %${Math.round(s.coverage * 100)}'i karşılanıyor`;
    else if (s.wasted > s.supply * 0.25) note = '💡 Fazla elektrik boşa gidiyor — şehri büyüt';
    else if (state.me.pop >= s.capacity * 0.97) note = '🏠 Şehir dolu — konut merkezini yükselt';
    else note = '✅ Şehrin tamamı aydınlık';
    this.el.note.textContent = note;
  }

  updateEnv(env, timeMs) {
    this.el.clock.textContent = `${env.daylight > 0.5 ? '🌤️' : '🌙'} ${clockString(timeMs)}`;
    this.el.sun.textContent = `☀️ %${Math.round(env.sun * 100)}`;
    this.el.wind.textContent = `🌬️ %${Math.round(env.wind * 100)}`;
  }

  updateAir(stats) {
    if (!stats) return;
    const q = stats.airQuality;
    this.el.air.textContent = `${q > 0.85 ? '🍃' : q > 0.6 ? '🌫️' : '🏭'} %${Math.round(q * 100)}`;
  }
}
