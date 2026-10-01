// İlk giriş eğitimi: arayüzü vurgulayarak adım adım ilerler, bazı adımlar oyuncunun gerçekten yapmasını bekler.
import { $, h } from './dom.js';

const KEY = 'solaria.tutorial';

export class Tutorial {
  constructor(game) {
    this.game = game;
    this.card = $('#tutorial');
    this.ring = $('#tutorial-ring');
    this.step = -1;
    this.timer = null;
    window.addEventListener('resize', () => this.position());
  }

  get done() {
    try {
      return localStorage.getItem(KEY) === 'done';
    } catch {
      return false;
    }
  }

  markDone() {
    try {
      localStorage.setItem(KEY, 'done');
    } catch {
      /* yok say */
    }
  }

  steps() {
    const g = this.game;
    const name = g.state.me ? g.myPlot?.name || '' : '';
    return [
      {
        title: `Hoş geldin${name ? `, ${name}` : ''}! ☀️`,
        text: 'Bu ada senin. Ortadaki köy elektrik bekliyor. Santraller kurup şehre güç verecek, şehri büyütüp para kazanacaksın. Kısa bir turla başlayalım.',
        next: 'Başlayalım',
      },
      {
        target: '#hud .hud-power',
        title: '⚡ Arz ve talep',
        text: 'Arz: santrallerinin ürettiği elektrik. Talep: şehrin istediği. Talep karşılanırsa para kazanırsın; arz yetmezse karartma olur ve insanlar şehri terk eder.',
      },
      {
        target: '#hud .hud-money',
        title: '💰 Gelirin',
        text: 'Şehre verdiğin her kW saniyede para kazandırır. Sağ alttaki rakam saniyelik net gelirin.',
      },
      {
        target: () => document.querySelector('#shop-tabs .tab[data-cat="wind"]'),
        title: '🌬️ Santral seç',
        text: 'Santraller panelindeki sekmeler enerji türleridir. Rüzgar (🌬️) sekmesine tıkla.',
        onEnter: () => g.togglePanel('shop', true),
        until: () => g.shop.cat === 'wind',
      },
      {
        target: () => document.querySelector('#shop-list .card'),
        title: '🔨 Mini Rüzgar Türbini',
        text: 'Bu ucuz türbin gece de üretir. Kartına tıklayarak seç.',
        until: () => g.buildType === 'wind_mini' || this.built(),
      },
      {
        world: true,
        title: '🏝️ Adana yerleştir',
        text: 'Adandaki çimenlik alanda boş bir karoya tıkla. Şehir bölgesine ve kilitli araziye kurulamaz. (Sürükle: kaydır · Tekerlek: yakınlaştır · Q/E: döndür)',
        onEnter: () => {
          this.startGens = g.myPlot?.generators.length ?? 0;
          if (!g.buildType) g.startBuild('wind_mini');
        },
        until: () => this.built(),
      },
      {
        target: () => document.querySelector('#city-centers .center-card'),
        title: '🏠 Şehri büyüt',
        text: 'Daha çok insan = daha çok talep = daha çok gelir. Konut Merkezi\'ni yükselt. Para yetmiyorsa birkaç saniye bekle.',
        onEnter: () => {
          g.cancelBuild();
          g.togglePanel('citypanel', true);
        },
        until: () => (g.state.me?.centers?.residential ?? 0) >= 1,
      },
      {
        title: '🌙 Gerçekçi şebeke',
        text: 'Güneş gece üretmez, rüzgar sürekli değişir ve akşamları talep zirve yapar. Hidro, nükleer gibi sabit kaynaklar ve 🔋 Depolama (bataryalar) ile şebekeni dengele. Fosil yakıtlar ucuzdur ama havayı kirletir.',
      },
      {
        target: '#btn-settings',
        title: '⚙️ Ayarlar',
        text: 'Grafik kalitesi, zorluk, kamera açısı ve ses buradan ayarlanır. Santrallere tıklayarak yükseltebilir, taşıyabilir veya satabilirsin. İyi oyunlar!',
        next: 'Bitir 🎉',
      },
    ];
  }

  built() {
    const n = this.game.myPlot?.generators.length ?? 0;
    return this.startGens != null && n > this.startGens;
  }

  start(force = false) {
    if (!force && this.done) return;
    this.list = this.steps();
    this.startGens = null;
    this.go(0);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 200);
  }

  go(i) {
    this.step = i;
    const s = this.list[i];
    if (!s) return this.finish();
    s.onEnter?.();
    this.render();
    this.game.sfx.click();
  }

  tick() {
    const s = this.list?.[this.step];
    if (!s) return;
    if (s.until?.()) {
      this.game.sfx.upgrade();
      this.go(this.step + 1);
      return;
    }
    this.position();
  }

  finish() {
    clearInterval(this.timer);
    this.timer = null;
    this.step = -1;
    this.card.classList.add('hidden');
    this.ring.classList.add('hidden');
    this.markDone();
  }

  targetEl() {
    const s = this.list?.[this.step];
    if (!s?.target) return null;
    const el = typeof s.target === 'function' ? s.target() : document.querySelector(s.target);
    if (!el || el.offsetParent === null) return null;
    return el;
  }

  render() {
    const s = this.list[this.step];
    const total = this.list.length;
    this.card.innerHTML = '';
    this.card.append(
      h('div', { class: 'tut-progress' }, `${this.step + 1} / ${total}`),
      h('div', { class: 'tut-title' }, s.title),
      h('div', { class: 'tut-text' }, s.text),
      h(
        'div',
        { class: 'tut-actions' },
        h('button', { class: 'btn ghost', onclick: () => this.finish() }, 'Eğitimi geç'),
        s.until
          ? h('span', { class: 'tut-wait' }, '⏳ Senin hamleni bekliyorum…')
          : h('button', { class: 'btn', onclick: () => this.go(this.step + 1) }, s.next || 'İleri →'),
      ),
    );
    this.card.classList.remove('hidden');
    this.position();
  }

  position() {
    if (this.step < 0) return;
    const el = this.targetEl();
    const card = this.card;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const vw = innerWidth;
    const vh = innerHeight;
    if (!el) {
      this.ring.classList.add('hidden');
      const s = this.list[this.step];
      // dünya adımında kartı üste, diğerlerinde ortaya koy
      card.style.left = `${(vw - cw) / 2}px`;
      card.style.top = s.world ? `${Math.min(110, vh * 0.14)}px` : `${(vh - ch) / 2}px`;
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 6;
    Object.assign(this.ring.style, {
      left: `${r.left - pad}px`,
      top: `${r.top - pad}px`,
      width: `${r.width + pad * 2}px`,
      height: `${r.height + pad * 2}px`,
    });
    this.ring.classList.remove('hidden');
    // kartı hedefin altına, sığmazsa üstüne/yanına yerleştir
    let left = r.left + r.width / 2 - cw / 2;
    let top = r.bottom + 14;
    if (top + ch > vh - 10) top = r.top - ch - 14;
    if (top < 10) {
      top = Math.max(10, r.top);
      left = r.right + 14;
      if (left + cw > vw - 10) left = r.left - cw - 14;
    }
    card.style.left = `${Math.max(10, Math.min(vw - cw - 10, left))}px`;
    card.style.top = `${Math.max(10, Math.min(vh - ch - 10, top))}px`;
  }
}
