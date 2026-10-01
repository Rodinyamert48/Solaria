// ⚙️ Ayarlar penceresi: grafik, oyun, ses ve arayüz
import { $, h, toast, confirmButton } from './dom.js';
import { settings, QUALITY } from '../settings.js';
import { BALANCE } from '@shared/balance.js';

const GRAPHIC_KEYS = ['renderScale', 'shadows', 'shadowSize', 'glow', 'bloom', 'ssao', 'msaa', 'particles', 'clouds'];

const TABS = [
  {
    id: 'grafik',
    title: '🎨 Grafik',
    items: [
      { key: 'quality', label: 'Kalite ön ayarı', type: 'segment', options: Object.entries(QUALITY).map(([k, v]) => [k, v.name]), preset: true },
      { key: 'renderScale', label: 'Çözünürlük ölçeği', type: 'range', min: 50, max: 100, step: 5, suffix: '%', hint: 'Düşürmek eski cihazlarda akıcılığı artırır' },
      { key: 'shadows', label: 'Gölgeler', type: 'segment', options: [['kapali', 'Kapalı'], ['normal', 'Normal'], ['yumusak', 'Yumuşak']] },
      { key: 'shadowSize', label: 'Gölge kalitesi', type: 'segment', options: [[1024, '1K'], [2048, '2K'], [4096, '4K']] },
      { key: 'bloom', label: 'Işıma (bloom)', type: 'toggle' },
      { key: 'glow', label: 'Parlayan ışıklar', type: 'toggle', hint: 'Reaktörler, lambalar, pencereler' },
      { key: 'ssao', label: 'Ortam gölgelemesi (SSAO)', type: 'toggle', hint: 'Daha gerçekçi derinlik, güçlü ekran kartı ister' },
      { key: 'msaa', label: 'Kenar yumuşatma (MSAA)', type: 'toggle' },
      { key: 'particles', label: 'Duman, buhar, alev', type: 'segment', options: [[0, 'Kapalı'], [0.35, 'Az'], [0.7, 'Orta'], [1, 'Çok'], [1.3, 'Ultra']] },
      { key: 'clouds', label: 'Bulutlar', type: 'toggle' },
      { key: 'flow', label: 'Şehre akan enerji efekti', type: 'toggle' },
      { key: 'fps', label: 'FPS göstergesi', type: 'toggle' },
    ],
  },
  {
    id: 'oyun',
    title: '🎮 Oyun',
    items: [
      { key: 'difficulty', label: 'Zorluk', type: 'segment', options: Object.entries(BALANCE.difficulty).map(([k, v]) => [k, v.name]), localOnly: true, hint: 'Kolay: gelir ×1,5 · Zor: gelir ×0,7' },
      { key: 'cameraAngle', label: 'Kamera açısı', type: 'segment', options: [['yukaridan', 'Yukarıdan'], ['izometrik', 'İzometrik'], ['alcak', 'Alçak']] },
      { key: 'grid', label: 'İnşa ızgarası', type: 'segment', options: [['insa', 'İnşa ederken'], ['her-zaman', 'Her zaman']] },
      { key: 'continuousBuild', label: 'Sürekli inşa', type: 'toggle', hint: 'Kurduktan sonra aynı santral seçili kalsın' },
      { key: 'confirmSell', label: 'Satarken onay iste', type: 'toggle' },
      { key: 'notifications', label: 'Bildirim balonları', type: 'toggle' },
      { action: 'tutorial', label: '🎓 Eğitimi yeniden başlat' },
      { action: 'reset', label: '🗑️ İlerlemeyi sıfırla', localOnly: true, danger: true },
    ],
  },
  {
    id: 'ses',
    title: '🔊 Ses',
    items: [
      { key: 'sfxVolume', label: 'Efekt sesi', type: 'range', min: 0, max: 100, step: 5, suffix: '%' },
      { key: 'ambientVolume', label: 'Ortam sesi', type: 'range', min: 0, max: 100, step: 5, suffix: '%', hint: 'Rüzgar, kuşlar, cırcır böcekleri, şehir uğultusu' },
    ],
  },
  {
    id: 'arayuz',
    title: '🖥️ Arayüz',
    items: [{ key: 'uiScale', label: 'Arayüz boyutu', type: 'range', min: 80, max: 130, step: 5, suffix: '%' }],
  },
];

export class SettingsPanel {
  constructor(game) {
    this.game = game;
    this.tab = 'grafik';
    this.el = $('#settings');
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });
    settings.subscribe(() => this.isOpen() && this.render());
  }

  isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open(tab) {
    if (tab) this.tab = tab;
    this.render();
    this.el.classList.remove('hidden');
  }

  close() {
    this.el.classList.add('hidden');
  }

  value(item) {
    if (item.key === 'difficulty') return this.game.net.difficulty ?? 'normal';
    return settings.get(item.key);
  }

  change(item, v) {
    this.game.sfx.click();
    if (item.preset) return settings.applyQuality(v);
    if (item.key === 'difficulty') {
      if (this.game.net.setDifficulty?.(v)) toast(`Zorluk: ${BALANCE.difficulty[v].name}`, 'good');
      this.render();
      return;
    }
    const patch = { [item.key]: v };
    if (GRAPHIC_KEYS.includes(item.key)) patch.quality = 'ozel';
    settings.set(patch);
  }

  control(item) {
    const v = this.value(item);
    if (item.type === 'toggle') {
      return h(
        'button',
        { class: `switch ${v ? 'on' : ''}`, role: 'switch', 'aria-checked': String(!!v), onclick: () => this.change(item, !v) },
        h('span'),
      );
    }
    if (item.type === 'segment') {
      return h(
        'div',
        { class: 'segment' },
        item.options.map(([val, label]) =>
          h('button', { class: String(val) === String(v) ? 'active' : '', onclick: () => this.change(item, val) }, label),
        ),
      );
    }
    if (item.type === 'range') {
      const out = h('span', { class: 'range-val' }, `${v}${item.suffix || ''}`);
      const input = h('input', { type: 'range', min: item.min, max: item.max, step: item.step, value: v });
      input.addEventListener('input', () => (out.textContent = `${input.value}${item.suffix || ''}`));
      input.addEventListener('change', () => this.change(item, Number(input.value)));
      return h('div', { class: 'range' }, input, out);
    }
    return null;
  }

  render() {
    const local = !!this.game.net.local;
    this.el.innerHTML = '';
    const tabs = h(
      'div',
      { class: 'tabs settings-tabs' },
      TABS.map((t) =>
        h('button', { class: `tab ${t.id === this.tab ? 'active' : ''}`, onclick: () => ((this.tab = t.id), this.render()) }, t.title),
      ),
    );
    const tab = TABS.find((t) => t.id === this.tab);
    const list = h('div', { class: 'settings-list' });
    for (const item of tab.items) {
      if (item.localOnly && !local) {
        if (item.key === 'difficulty')
          list.append(h('div', { class: 'setting-row muted' }, h('div', {}, h('div', { class: 'setting-label' }, item.label), h('div', { class: 'setting-hint' }, 'Online sunucuda zorluk herkes için Normal'))));
        continue;
      }
      if (item.action) {
        const btn = h('button', { class: `btn ${item.danger ? 'red' : 'ghost'} setting-action` }, item.label);
        if (item.action === 'tutorial') btn.addEventListener('click', () => (this.close(), this.game.tutorial.start(true)));
        if (item.action === 'reset')
          confirmButton(btn, 'Emin misin? Her şey silinir!', () => {
            this.game.net.reset?.();
            location.reload();
          });
        list.append(btn);
        continue;
      }
      list.append(
        h(
          'div',
          { class: 'setting-row' },
          h('div', {}, h('div', { class: 'setting-label' }, item.label), item.hint ? h('div', { class: 'setting-hint' }, item.hint) : null),
          this.control(item),
        ),
      );
    }
    if (this.tab === 'grafik' && settings.get('quality') === 'ozel')
      list.prepend(h('div', { class: 'setting-hint custom-note' }, '✏️ Özel ayarlar kullanılıyor'));
    this.el.append(
      h(
        'div',
        { class: 'settings-card panel' },
        h('div', { class: 'panel-head' }, h('h2', {}, '⚙️ Ayarlar'), h('button', { class: 'icon-btn small', onclick: () => this.close(), title: 'Kapat' }, '✕')),
        tabs,
        list,
        h(
          'div',
          { class: 'settings-foot' },
          h('button', { class: 'btn ghost', onclick: () => (settings.reset(), toast('Ayarlar varsayılana döndü')) }, 'Varsayılanlar'),
          h('button', { class: 'btn', onclick: () => this.close() }, 'Tamam'),
        ),
      ),
    );
  }
}
