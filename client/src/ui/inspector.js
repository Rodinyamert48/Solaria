// Seçili santralin bilgi kartı (yükselt / sat)
import { $, h } from './dom.js';
import { GENERATOR_BY_ID, upgradeCost, sellValue, levelPowerMult, MAX_GEN_LEVEL } from '@shared/data/generators.js';
import { CATEGORY_BY_ID } from '@shared/data/categories.js';
import { CENTER_BY_ID } from '@shared/data/centers.js';
import { envFactor } from '@shared/env.js';
import { formatMoney, formatPower } from '@shared/format.js';

export class Inspector {
  constructor(game) {
    this.game = game;
    this.el = $('#inspector');
    this.sel = null; // { slot, gid }
  }

  open(slot, gid) {
    this.sel = { slot, gid };
    this.render();
  }

  close() {
    this.sel = null;
    this.el.classList.add('hidden');
    this.game.world.showSelection(-1, null);
  }

  current() {
    if (!this.sel) return null;
    const plot = this.game.state.plots.get(this.sel.slot);
    const g = plot?.generators.find((x) => x.gid === this.sel.gid);
    return g ? { plot, g } : null;
  }

  render() {
    const cur = this.current();
    if (!cur) return this.close();
    const { plot, g } = cur;
    const def = GENERATOR_BY_ID[g.type];
    const cat = CATEGORY_BY_ID[def.cat];
    const mine = plot.slot === this.game.state.slot;
    const edu = CENTER_BY_ID.education.effect(plot.centers.education || 0);
    const rated = def.power * levelPowerMult(g.level) * edu;
    const env = this.game.world.env;
    const now = env ? rated * envFactor(cat.env, env) : rated;
    const up = upgradeCost(def, g.level);
    const nextRated = g.level < MAX_GEN_LEVEL ? def.power * levelPowerMult(g.level + 1) * edu : null;
    const money = this.game.state.displayMoney ?? 0;

    const stars = h('span', { class: 'stars' });
    for (let i = 1; i <= MAX_GEN_LEVEL; i++) stars.append(h('span', { class: i <= g.level ? '' : 'off' }, '★'));

    this.el.innerHTML = '';
    this.el.append(
      h(
        'div',
        { class: 'insp-head' },
        h('div', { class: 'card-icon', style: { '--icon-bg': `${cat.color}33` } }, cat.icon),
        h(
          'div',
          {},
          h('div', { class: 'insp-title' }, def.name),
          h('div', { class: 'insp-sub' }, `${cat.name} · ${def.size}×${def.size} · `, stars, mine ? '' : ` · ${plot.name}`),
        ),
        h('button', { class: 'icon-btn small insp-close', onclick: () => this.close(), title: 'Kapat (Esc)' }, '✕'),
      ),
      h(
        'div',
        { class: 'insp-stats' },
        h('div', {}, 'Şu an', h('b', {}, formatPower(now))),
        h('div', {}, 'Kurulu güç', h('b', {}, formatPower(rated))),
        h('div', {}, cat.upkeep > 0 ? 'Yakıt' : 'Kirlilik', h('b', {}, cat.upkeep > 0 ? `−${formatMoney(rated * cat.upkeep)}/sn` : cat.pollution > 0 ? `%${cat.pollution * 100}` : 'Temiz 🍃')),
      ),
    );
    if (mine) {
      const upBtn = h(
        'button',
        { class: 'btn green', onclick: () => this.game.upgradeSelected() },
        up == null ? 'En yüksek seviye' : `⬆ Yükselt ${formatMoney(up)}`,
      );
      upBtn.disabled = up == null || money < up;
      if (nextRated) upBtn.title = `${formatPower(rated)} → ${formatPower(nextRated)}`;
      this.el.append(
        h(
          'div',
          { class: 'insp-actions' },
          upBtn,
          h('button', { class: 'btn ghost', title: 'Taşı (M)', onclick: () => this.game.startMove() }, '↔️'),
          h('button', { class: 'btn red', onclick: () => this.game.sellSelected() }, `💰 Sat ${formatMoney(sellValue(def, g.level))}`),
        ),
      );
      if (nextRated) this.el.append(h('div', { class: 'insp-sub', style: { marginTop: '8px' } }, `Sonraki seviye: ⚡ ${formatPower(nextRated)}`));
    }
    this.el.classList.remove('hidden');
    this.game.world.showSelection(plot.slot, g);
  }
}
