// Şehir paneli: merkezler, arazi, yeniden doğuş, liderlik ve istatistik
import { $, h, confirmButton } from './dom.js';
import { CENTERS, CITY_LEVELS, centerCost, cityLevelIndex } from '@shared/data/centers.js';
import { CATEGORIES } from '@shared/data/categories.js';
import { BALANCE } from '@shared/balance.js';
import { buildableTileCount, MAX_LAND_LEVEL } from '@shared/grid.js';
import { landCost, canRebirth } from '@shared/actions.js';
import { rebirthRequirement, rebirthMultiplier } from '@shared/economy.js';
import { formatMoney, formatPower, formatPop, formatNumber } from '@shared/format.js';

export class CityPanel {
  constructor(game) {
    this.game = game;
    this.tab = 'centers';
    this.centerCards = new Map();
    for (const btn of document.querySelectorAll('#city-tabs .tab')) {
      btn.addEventListener('click', () => {
        this.tab = btn.dataset.tab;
        for (const b of document.querySelectorAll('#city-tabs .tab')) b.classList.toggle('active', b === btn);
        $('#city-centers').classList.toggle('hidden', this.tab !== 'centers');
        $('#city-board').classList.toggle('hidden', this.tab !== 'board');
        $('#city-stats').classList.toggle('hidden', this.tab !== 'stats');
        this.game.sfx.click();
        this.update();
      });
    }
    this.renderCenters();
  }

  renderCenters() {
    const list = $('#city-centers');
    list.innerHTML = '';
    list.append(h('div', { class: 'section-title' }, 'Merkezler'));
    for (const c of CENTERS) {
      const level = h('span', { class: 'lvl' });
      const effect = h('div', { class: 'effect' });
      const btn = h('button', { class: 'btn green', onclick: (e) => (e.stopPropagation(), this.game.upgradeCenter(c.id)) }, 'Yükselt');
      const lock = h('span', { class: 'card-meta' });
      const el = h(
        'div',
        { class: 'card center-card' },
        h('div', { class: 'card-icon' }, c.icon),
        h('div', {}, h('div', { class: 'card-title' }, c.name, level), h('div', { class: 'card-desc' }, c.desc)),
        h('div', { class: 'row' }, h('div', {}, effect, lock), btn),
      );
      this.centerCards.set(c.id, { el, level, effect, btn, lock, c });
      list.append(el);
    }

    list.append(h('div', { class: 'section-title' }, 'Ada'));
    this.landLevel = h('span', { class: 'lvl' });
    this.landInfo = h('div', { class: 'effect' });
    this.landBtn = h('button', { class: 'btn', onclick: () => this.game.buyLand() }, 'Satın al');
    list.append(
      h(
        'div',
        { class: 'card center-card' },
        h('div', { class: 'card-icon' }, '🗺️'),
        h('div', {}, h('div', { class: 'card-title' }, 'Arazi Genişlet', this.landLevel), h('div', { class: 'card-desc' }, 'Adanın kilitli kısımlarını aç, daha çok santrale yer aç.')),
        h('div', { class: 'row' }, this.landInfo, this.landBtn),
      ),
    );

    this.rebirthInfo = h('div', { class: 'effect' });
    this.rebirthBar = h('div');
    this.rebirthBtn = h('button', { class: 'btn' }, 'Yeniden Doğ ⭐');
    confirmButton(this.rebirthBtn, 'Emin misin? Tekrar tıkla', () => this.game.rebirth());
    list.append(
      h(
        'div',
        { class: 'card center-card rebirth-card' },
        h('div', { class: 'card-icon' }, '⭐'),
        h(
          'div',
          {},
          h('div', { class: 'card-title' }, 'Yeniden Doğuş'),
          h('div', { class: 'card-desc' }, 'Her şey sıfırlanır ama kalıcı gelir çarpanı kazanırsın.'),
        ),
        h('div', { class: 'row' }, h('div', { style: { flex: 1 } }, this.rebirthInfo, h('div', { class: 'progress' }, this.rebirthBar)), this.rebirthBtn),
      ),
    );
  }

  update() {
    const { state } = this.game;
    const me = state.me;
    if (!me) return;
    if (this.tab === 'centers') this.updateCenters(me, state);
    else if (this.tab === 'board') this.renderBoard(state);
    else this.renderStats(state);
  }

  updateCenters(me, state) {
    const money = state.displayMoney ?? me.money;
    const lvlIdx = Math.max(cityLevelIndex(me.pop), me.bestCity || 0);
    for (const { level, effect, btn, lock, c, el } of this.centerCards.values()) {
      const L = me.centers[c.id] || 0;
      const cost = centerCost(c, L);
      const locked = lvlIdx < c.unlock;
      level.textContent = L > 0 ? `Sv. ${L}` : '';
      effect.innerHTML = '';
      const next = c.text(c.effect(L + 1));
      effect.append(c.text(c.effect(L)), h('div', { class: 'next' }, `Sonraki: ${next.includes(':') ? next.split(':')[1].trim() : next}`));
      lock.textContent = locked ? `🔒 ${CITY_LEVELS[c.unlock].name} seviyesinde açılır` : '';
      el.classList.toggle('locked', locked);
      btn.disabled = locked || money < cost;
      btn.textContent = formatMoney(cost);
    }
    // Arazi
    const maxed = me.land >= MAX_LAND_LEVEL;
    this.landLevel.textContent = `${me.land + 1}/${MAX_LAND_LEVEL + 1}`;
    if (maxed) {
      this.landInfo.textContent = 'Adanın tamamı senin!';
      this.landBtn.disabled = true;
      this.landBtn.textContent = 'Tamam';
    } else {
      const extra = buildableTileCount(me.land + 1) - buildableTileCount(me.land);
      const cost = landCost(me.land);
      this.landInfo.textContent = `+${extra} karo`;
      this.landBtn.disabled = money < cost;
      this.landBtn.textContent = formatMoney(cost);
    }
    // Yeniden doğuş
    const req = rebirthRequirement(me.rebirths);
    const progress = Math.min(1, Math.log10(Math.max(1, me.pop)) / Math.log10(req));
    this.rebirthBar.style.width = `${progress * 100}%`;
    this.rebirthInfo.textContent = `${formatPop(me.pop)} / ${formatPop(req)} nüfus · Gelir ×${rebirthMultiplier(me.rebirths)} → ×${rebirthMultiplier(me.rebirths + 1)}`;
    this.rebirthBtn.disabled = !canRebirth(me);
  }

  renderBoard(state) {
    const list = $('#city-board');
    list.innerHTML = '';
    list.append(h('div', { class: 'section-title' }, `Bu sunucu (${state.roomId || ''})`));
    const rows = [...state.board].sort((a, b) => b.net - a.net);
    rows.forEach((r, i) => {
      list.append(
        h(
          'div',
          {
            class: `board-row clickable ${r.slot === state.slot ? 'me' : ''}`,
            title: 'Adaya git',
            onclick: () => this.game.world.focusSlot(r.slot, 22),
          },
          h('span', { class: 'rank' }, `${i + 1}`),
          h('span', { class: 'dot', style: { background: r.color } }),
          h('span', {}, `${r.name}${r.rebirths ? ' ' + '★'.repeat(Math.min(r.rebirths, 5)) : ''}`, h('span', { class: 'sub' }, `👥 ${formatPop(r.pop)} · ${CITY_LEVELS[r.cityLevel].name}`)),
          h('span', { class: 'val' }, `${formatMoney(r.net)}/sn`),
        ),
      );
    });
    list.append(h('div', { class: 'section-title' }, 'Tüm zamanların en iyileri'));
    (state.top || []).forEach((r, i) => {
      list.append(
        h(
          'div',
          { class: 'board-row' },
          h('span', { class: 'rank' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}`),
          h('span', { class: 'dot', style: { background: r.color } }),
          h('span', {}, r.name, h('span', { class: 'sub' }, `⭐ ${r.rebirths} · 👥 ${formatPop(r.pop)}`)),
          h('span', { class: 'val' }, formatMoney(r.lifetime)),
        ),
      );
    });
  }

  renderStats(state) {
    const s = state.stats;
    const me = state.me;
    const list = $('#city-stats');
    list.innerHTML = '';
    if (!s) return;
    const row = (k, v) => h('div', { class: 'stat-row' }, k, h('b', {}, v));
    list.append(h('div', { class: 'section-title' }, 'Enerji karışımı'));
    const bar = h('div', { class: 'mix-bar' });
    const legend = h('div', { class: 'mix-legend' });
    const total = Math.max(1e-9, s.supply);
    for (const c of CATEGORIES) {
      const v = s.byCat[c.id] || 0;
      if (v <= 0) continue;
      bar.append(h('div', { style: { width: `${(v / total) * 100}%`, background: c.color }, title: `${c.name}: ${formatPower(v)}` }));
      legend.append(h('span', {}, `${c.icon} ${c.name} %${Math.round((v / total) * 100)}`));
    }
    list.append(bar, legend);
    list.append(h('div', { class: 'section-title' }, 'Şebeke'));
    list.append(
      row('Anlık üretim', formatPower(s.supply)),
      row('Kurulu güç', formatPower(s.rated)),
      row('Talep', formatPower(s.demand)),
      row('Karşılanan', `%${Math.round(s.coverage * 100)}`),
      row('Boşa giden', formatPower(s.wasted)),
    );
    list.append(h('div', { class: 'section-title' }, 'Ekonomi'));
    list.append(
      row('Elektrik fiyatı', `${formatMoney(s.price)} / kW·sn`),
      row('Brüt gelir', `${formatMoney(s.income)}/sn`),
      row('Yakıt gideri', `−${formatMoney(s.upkeep)}/sn`),
      row('Net gelir', `${formatMoney(s.net)}/sn`),
      row('Toplam kazanç', formatMoney(me.lifetime)),
    );
    list.append(h('div', { class: 'section-title' }, 'Şehir'));
    list.append(
      row('Nüfus', `${formatPop(me.pop)} / ${formatPop(s.capacity)}`),
      row('Kişi başı tüketim', formatPower(s.perCapita)),
      row('Hava kalitesi', `%${Math.round(s.airQuality * 100)}`),
      row('Büyüme hızı', `%${formatNumber(s.growth * 100)}/sn`),
      row('Yeniden doğuş', `${me.rebirths} (gelir ×${rebirthMultiplier(me.rebirths)})`),
      row('Çevrimdışı kazanç', `%${BALANCE.offlineRate * 100}, en fazla ${BALANCE.offlineMaxSeconds / 3600} sa`),
    );
  }
}
