// Santral mağazası: kategoriler ve jeneratör kartları
import { $, h } from './dom.js';
import { CATEGORIES, CATEGORY_BY_ID } from '@shared/data/categories.js';
import { generatorsOfCategory } from '@shared/data/generators.js';
import { CENTER_BY_ID } from '@shared/data/centers.js';
import { formatMoney, formatPower } from '@shared/format.js';

export class Shop {
  constructor(game) {
    this.game = game;
    this.cat = 'solar';
    this.cards = new Map(); // id -> { el, def }
    this.renderTabs();
    this.renderList();
  }

  renderTabs() {
    const tabs = $('#shop-tabs');
    tabs.innerHTML = '';
    for (const c of CATEGORIES) {
      tabs.append(
        h(
          'button',
          {
            class: `tab ${c.id === this.cat ? 'active' : ''}`,
            title: c.name,
            style: { '--tab-color': `${c.color}33`, '--tab-border': `${c.color}aa` },
            onclick: () => {
              this.cat = c.id;
              this.renderTabs();
              this.renderList();
              this.game.sfx.click();
            },
          },
          c.icon,
        ),
      );
    }
  }

  renderList() {
    const cat = CATEGORY_BY_ID[this.cat];
    const desc = $('#shop-cat-desc');
    desc.innerHTML = '';
    desc.append(h('b', {}, `${cat.icon} ${cat.name}: `), cat.desc);

    const list = $('#shop-list');
    list.innerHTML = '';
    this.cards.clear();
    for (const def of generatorsOfCategory(this.cat)) {
      const meta = h('div', { class: 'card-meta' });
      const tags = [];
      if (cat.env === 'sun') tags.push(h('span', {}, '🌙 gece düşük'));
      if (cat.env === 'wind') tags.push(h('span', {}, '🌬️ rüzgara bağlı'));
      if (cat.pollution > 0) tags.push(h('span', { class: 'bad' }, `🏭 kirlilik %${Math.round(cat.pollution * 100)}`));
      const el = h(
        'div',
        {
          class: 'card clickable',
          title: def.desc,
          onclick: () => this.game.startBuild(def.id),
        },
        h(
          'div',
          { class: 'card-icon', style: { '--icon-bg': `${cat.color}33` } },
          cat.icon,
          h('span', { class: 'size' }, `${def.size}×${def.size}`),
        ),
        h('div', {}, h('div', { class: 'card-title' }, def.name), meta, h('div', { class: 'card-desc' }, def.desc), h('div', { class: 'card-meta' }, ...tags)),
        h('div', { class: 'cost' }, formatMoney(def.cost)),
      );
      this.cards.set(def.id, { el, def, meta, cat });
      list.append(el);
    }
    this.update();
  }

  update() {
    const { state } = this.game;
    const money = state.displayMoney ?? state.me?.money ?? 0;
    const edu = CENTER_BY_ID.education.effect(state.me?.centers?.education || 0);
    for (const { el, def, meta, cat } of this.cards.values()) {
      el.classList.toggle('cant', money < def.cost);
      el.classList.toggle('selected', this.game.buildType === def.id);
      const power = def.power * edu;
      const upkeep = def.power * edu * cat.upkeep;
      const key = `${power}|${upkeep}`;
      if (meta.dataset.key === key) continue;
      meta.dataset.key = key;
      meta.innerHTML = '';
      meta.append(h('span', { class: 'pw' }, `⚡ ${formatPower(power)}`));
      if (upkeep > 0) meta.append(h('span', { class: 'bad' }, `⛽ −${formatMoney(upkeep)}/sn`));
    }
  }

  selectCategory(catId) {
    this.cat = catId;
    this.renderTabs();
    this.renderList();
  }
}
