// Oyun denetleyicisi: ağ, 3D dünya ve arayüzü birbirine bağlar
import { $, toast, floater } from './ui/dom.js';
import { Hud } from './ui/hud.js';
import { Shop } from './ui/shop.js';
import { CityPanel } from './ui/citypanel.js';
import { Inspector } from './ui/inspector.js';
import { Chat } from './ui/chat.js';
import { setupLogin, setServerStatus, setLoginMode, hideLogin, confirmReset } from './ui/login.js';
import { World } from './render/world.js';
import { createConnection } from './connection.js';
import { sfx } from './sfx.js';
import { GENERATOR_BY_ID, GENERATORS } from '@shared/data/generators.js';
import { CATEGORIES } from '@shared/data/categories.js';
import { CENTER_BY_ID, CENTERS, CITY_LEVELS } from '@shared/data/centers.js';
import { placementError, isCityTile, ISLAND_SIZE, MAX_LAND_LEVEL } from '@shared/grid.js';
import { formatMoney, formatDuration } from '@shared/format.js';

export class Game {
  constructor(canvas) {
    this.state = {
      me: null,
      stats: null,
      slot: -1,
      roomId: '',
      plots: new Map(),
      board: [],
      top: [],
      serverOffset: 0,
      displayMoney: 0,
    };
    this.sfx = sfx;
    this.buildType = null;
    this.ghostPos = null;
    this.prevCityLevel = null;
    this.uiTimer = 0;

    this.world = new World(canvas);
    this.world.setTimeSource(() => Date.now() + this.state.serverOffset);
    this.net = createConnection();
    this.hud = new Hud();
    this.shop = new Shop(this);
    this.city = new CityPanel(this);
    this.inspector = new Inspector(this);
    this.chat = new Chat(this);

    this.bindNet();
    this.bindWorld();
    this.bindKeys();
    this.bindButtons();
    setupLogin((profile) => this.login(profile));
    // Giriş ekranının arkasında dünya yavaşça dönsün
    this.world.cam.goal.zoom = 48;
    this.world.cam.zoom = 48;
  }

  get myPlot() {
    return this.state.plots.get(this.state.slot);
  }

  // ---- Vitrin: tüm modelleri tek adada göster (?vitrin) ----

  showcase({ pop = 3e8, centerLevel = 12, phase = null } = {}) {
    const occupied = new Set();
    const fits = (x, y, s) => {
      for (let dy = 0; dy < s; dy++)
        for (let dx = 0; dx < s; dx++) {
          const tx = x + dx;
          const ty = y + dy;
          if (tx >= ISLAND_SIZE || ty >= ISLAND_SIZE || isCityTile(tx, ty) || occupied.has(`${tx},${ty}`)) return false;
        }
      return true;
    };
    const generators = [];
    const sorted = [...GENERATORS].sort((a, b) => b.size - a.size || a.index - b.index);
    for (const def of sorted) {
      search: for (let y = 0; y < ISLAND_SIZE; y++)
        for (let x = 0; x < ISLAND_SIZE; x++)
          if (fits(x, y, def.size)) {
            for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) occupied.add(`${x + dx},${y + dy}`);
            generators.push({ gid: generators.length + 1, type: def.id, x, y, level: 1 });
            break search;
          }
    }
    const plot = {
      id: 'vitrin', slot: 4, name: 'Vitrin', color: '#ffcc4d', land: MAX_LAND_LEVEL,
      centers: Object.fromEntries(CENTERS.map((c) => [c.id, centerLevel])), generators, pop, rebirths: 0,
    };
    this.state.plots.set(plot.slot, plot);
    this.world.updatePlot(plot);
    this.world.focusSlot(plot.slot, 20);
    if (phase != null) this.world.setTimeSource(() => 6 * 60 * 1000 * phase);
    hideLogin();
    return generators.length;
  }

  // ---- Giriş ----

  async login(profile) {
    const res = await this.net.join(profile);
    if (res.ok) {
      this.onWelcome(res, true);
      hideLogin();
    }
    return res;
  }

  onWelcome(res, first) {
    const st = this.state;
    st.slot = res.slot;
    st.roomId = res.roomId;
    st.me = res.me;
    st.displayMoney = res.me.money;
    st.top = res.top || [];
    st.serverOffset = res.serverTime - Date.now();
    st.plots = new Map(res.plots.map((p) => [p.slot, p]));
    this.world.setPlots(res.plots, res.slot);
    this.world.focusSlot(res.slot, 21);
    this.chat.reset(res.chat);
    this.inspector.close();
    this.cancelBuild();

    const small = window.innerWidth < 760;
    $('#shop').classList.toggle('hidden', small);
    $('#citypanel').classList.toggle('hidden', small);
    $('#open-shop').classList.toggle('hidden', !small);
    $('#open-city').classList.toggle('hidden', !small);
    this.hud.show();
    this.chat.show();
    this.shop.update();
    this.city.update();

    if (res.offline?.gain > 0) {
      toast(`🌙 Sen yokken ${formatMoney(res.offline.gain)} kazandın (${formatDuration(res.offline.seconds)})`, 'gold', 6);
    }
    if (first && this.myPlot && this.myPlot.generators.length <= 1) {
      setTimeout(() => toast('💡 Soldan bir santral seç ve adanda boş bir yere tıkla!', '', 6), 1200);
    }
    this.net.measureOffset().then((o) => {
      if (o != null) st.serverOffset = o;
    });
  }

  // ---- Ağ olayları ----

  bindNet() {
    const st = this.state;
    if (this.net.local) {
      setLoginMode(
        '🎮 <b>Tek oyunculu mod</b> — ilerlemen bu tarayıcıda kaydedilir. Komşu adalarda yapay zekâ oyuncular var.',
      );
    } else if (this.net.url) {
      setLoginMode(`🌐 <b>Online mod</b> — sunucu: ${this.net.url.replace(/[<>&"]/g, '')}`);
    }
    this.net.on('connect', async () => {
      setServerStatus(this.net.local ? 'Hazır ✓' : 'Sunucu hazır ✓');
      if (this.wasJoined && this.net.profile) {
        const res = await this.net.join(this.net.profile);
        if (res.ok) {
          this.onWelcome(res, false);
          toast('🔌 Yeniden bağlandın', 'good');
        }
      }
    });
    this.net.on('connect_error', () => setServerStatus('Sunucuya ulaşılamıyor, tekrar deneniyor…'));
    this.net.on('disconnect', () => {
      this.wasJoined = this.net.joined;
      this.net.joined = false;
      if (this.wasJoined) toast('⚠️ Bağlantı koptu, yeniden bağlanılıyor…', 'bad', 4);
    });
    this.net.on('kicked', (msg) => {
      this.wasJoined = false;
      toast(msg, 'bad', 10);
      $('#login').classList.remove('hidden');
      $('#login-error').textContent = msg;
    });

    this.net.on('tick', ({ t, me, stats }) => {
      st.me = me;
      st.stats = stats;
      st.displayMoney = me.money;
      const drift = t - Date.now() - st.serverOffset;
      if (Math.abs(drift) > 2000) st.serverOffset += drift;

      const plot = this.myPlot;
      if (plot) {
        plot.pop = me.pop;
        this.world.setPop(st.slot, me.pop);
      }
      // Sadece bu turda ilk kez ulaşılan seviyeleri kutla (gece-gündüz dalgalanmasında tekrar etmesin)
      if (this.prevCityLevel != null && stats.cityLevel > this.prevCityLevel) {
        toast(`🎉 Şehrin büyüdü: artık bir ${CITY_LEVELS[stats.cityLevel].name}!`, 'gold', 4);
        sfx.levelUp();
      }
      this.prevCityLevel = Math.max(this.prevCityLevel ?? stats.cityLevel, stats.cityLevel, me.bestCity || 0);
      this.hud.update(st);
      this.hud.updateAir(stats);
      this.world.lastCoverage = stats.coverage;
      this.city.update();
      if (this.inspector.sel) this.inspector.render();
    });

    this.net.on('plot', (plot) => {
      st.plots.set(plot.slot, plot);
      this.world.updatePlot(plot);
      if (plot.slot === st.slot) {
        this.shop.update();
        this.city.update();
      }
      if (this.inspector.sel?.slot === plot.slot) this.inspector.render();
    });

    this.net.on('left', ({ slot }) => {
      st.plots.delete(slot);
      this.world.removePlot(slot);
      if (this.inspector.sel?.slot === slot) this.inspector.close();
    });

    this.net.on('board', (list) => {
      st.board = list;
      for (const r of list) {
        if (r.slot === st.slot) continue;
        const p = st.plots.get(r.slot);
        if (p) p.pop = r.pop;
        this.world.setPop(r.slot, r.pop);
      }
      if (this.city.tab === 'board') this.city.update();
    });

    this.net.on('top', (list) => (st.top = list));
    this.net.on('chat', (m) => this.chat.add(m));
  }

  // ---- Dünya etkileşimi ----

  bindWorld() {
    this.world.on('hover', (info) => this.onHover(info));
    this.world.on('click', (info) => this.onClick(info));
    this.world.on('frame', (dt) => this.onFrame(dt));
  }

  onFrame(dt) {
    const st = this.state;
    if (!st.me) {
      this.world.cam.rotateBy(dt * 0.05);
      return;
    }
    if (st.stats) st.displayMoney = Math.max(0, st.displayMoney + st.stats.net * dt);
    this.hud.setMoney(st.displayMoney);
    this.uiTimer += dt;
    if (this.uiTimer > 0.25) {
      this.uiTimer = 0;
      this.shop.update();
      if (this.world.env) this.hud.updateEnv(this.world.env, Date.now() + st.serverOffset);
      if (this.buildType && this.lastHover) this.onHover(this.lastHover);
      this.world.refreshFlow(st.stats?.coverage ?? 1);
    }
  }

  onHover(info) {
    this.lastHover = info;
    if (!this.buildType) return;
    const st = this.state;
    const plot = this.myPlot;
    if (!info || !plot || info.slot !== st.slot) {
      this.world.updateGhost(-1);
      this.ghostPos = null;
      this.setHint('Kendi adanda bir yer seç');
      return;
    }
    const def = GENERATOR_BY_ID[this.buildType];
    const x = Math.round(info.fx - def.size / 2);
    const y = Math.round(info.fy - def.size / 2);
    let err = placementError(plot.generators, plot.land, def.id, x, y, this.moveGid);
    if (!err && this.moveGid == null && st.displayMoney < def.cost) err = 'Yeterli paran yok';
    this.ghostPos = { x, y, err };
    this.world.updateGhost(st.slot, x, y, !err);
    this.setHint(err);
  }

  async onClick(info) {
    if (info.button === 2) {
      if (this.buildType) this.cancelBuild();
      else this.inspector.close();
      return;
    }
    if (info.button !== 0) return;
    if (this.buildType) {
      // Dokunmatik ekranda "hover" yok: tıklanan noktaya göre yeniden hesapla
      if (info.island) this.onHover(info);
      if (!this.ghostPos) return;
      if (this.ghostPos.err) {
        sfx.error();
        toast(this.ghostPos.err, 'bad');
        return;
      }
      const def = GENERATOR_BY_ID[this.buildType];
      const { x, y } = this.ghostPos;
      if (this.moveGid != null) {
        const gid = this.moveGid;
        const res = await this.act('move', { gid, x, y });
        if (res.ok) {
          sfx.build();
          this.cancelBuild();
          this.inspector.open(this.state.slot, gid);
        }
        return;
      }
      const res = await this.act('build', { type: def.id, x, y });
      if (res.ok) {
        sfx.build();
        this.floatAtPointer(`−${formatMoney(def.cost)}`);
      }
      return;
    }
    if (!info.island) return this.inspector.close();
    const e = info.island.genAtTile(info.x, info.y);
    if (e) {
      sfx.click();
      this.inspector.open(info.slot, e.g.gid);
    } else this.inspector.close();
  }

  floatAtPointer(text) {
    const p = this.lastPointer || { x: innerWidth / 2, y: innerHeight / 2 };
    floater(text, p.x, p.y - 20);
  }

  setHint(err) {
    const def = GENERATOR_BY_ID[this.buildType];
    const el = $('#build-hint');
    el.innerHTML = '';
    el.append(
      this.moveGid != null
        ? `↔️ ${def.name} taşınıyor — yeni yerine tıkla · Esc iptal`
        : `🔨 ${def.name} (${formatMoney(def.cost)}) — yerleştirmek için tıkla · Esc iptal`,
    );
    if (err) {
      const span = document.createElement('span');
      span.className = 'err';
      span.textContent = ` · ${err}`;
      el.append(span);
    }
    const cancel = document.createElement('button');
    cancel.className = 'hint-cancel';
    cancel.textContent = '✕';
    cancel.title = 'İptal (Esc)';
    cancel.addEventListener('click', () => this.cancelBuild());
    el.append(cancel);
  }

  startBuild(type, moveGid = null) {
    if (this.buildType === type && moveGid == null && this.moveGid == null) return this.cancelBuild();
    this.buildType = type;
    this.moveGid = moveGid;
    this.inspector.close();
    this.world.setGhost(type);
    $('#build-hint').classList.remove('hidden');
    this.setHint(null);
    if (this.lastHover) this.onHover(this.lastHover);
    this.shop.update();
    sfx.click();
  }

  startMove() {
    const cur = this.inspector.current();
    if (!cur || cur.plot.slot !== this.state.slot) return;
    this.startBuild(cur.g.type, cur.g.gid);
  }

  cancelBuild() {
    this.buildType = null;
    this.moveGid = null;
    this.ghostPos = null;
    this.world.setGhost(null);
    $('#build-hint').classList.add('hidden');
    this.shop.update();
  }

  // ---- Eylemler ----

  async act(type, payload) {
    const res = await this.net.action(type, payload);
    if (res.me) {
      this.state.me = { ...this.state.me, ...res.me };
      this.state.displayMoney = res.me.money;
      this.hud.setMoney(res.me.money);
    }
    if (!res.ok) {
      sfx.error();
      toast(res.error || 'İşlem başarısız', 'bad');
    }
    this.shop.update();
    this.city.update();
    return res;
  }

  async upgradeSelected() {
    const cur = this.inspector.current();
    if (!cur || cur.plot.slot !== this.state.slot) return;
    const res = await this.act('upgrade', { gid: cur.g.gid });
    if (res.ok) {
      sfx.upgrade();
      toast(`⬆️ ${GENERATOR_BY_ID[cur.g.type].name} seviye ${res.gen.level}`, 'good');
    }
  }

  async sellSelected() {
    const cur = this.inspector.current();
    if (!cur || cur.plot.slot !== this.state.slot) return;
    const res = await this.act('sell', { gid: cur.g.gid });
    if (res.ok) {
      sfx.sell();
      toast(`💰 Satıldı: +${formatMoney(res.value)}`, 'gold');
      this.inspector.close();
    }
  }

  async upgradeCenter(id) {
    const res = await this.act('upgradeCenter', { center: id });
    if (res.ok) {
      sfx.center();
      toast(`${CENTER_BY_ID[id].icon} ${CENTER_BY_ID[id].name} → seviye ${res.level}`, 'good');
    }
  }

  async buyLand() {
    const res = await this.act('buyLand', {});
    if (res.ok) {
      sfx.levelUp();
      toast('🗺️ Yeni arazi açıldı!', 'gold');
    }
  }

  async rebirth() {
    const res = await this.act('rebirth', {});
    if (res.ok) {
      sfx.levelUp();
      toast(`⭐ Yeniden doğdun! Kalıcı gelir çarpanın artık ×${1 + 0.5 * res.rebirths}`, 'gold', 6);
      this.prevCityLevel = 0;
      this.inspector.close();
    }
  }

  // ---- Klavye & düğmeler ----

  bindKeys() {
    window.addEventListener('pointermove', (e) => (this.lastPointer = { x: e.clientX, y: e.clientY }));
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      if (!this.state.me) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (this.buildType) this.cancelBuild();
        else this.inspector.close();
        $('#help').classList.add('hidden');
      } else if (k === 'b') this.togglePanel('shop');
      else if (k === 'c') this.togglePanel('citypanel');
      else if (k === 'h') this.world.focusSlot(this.state.slot, 21);
      else if (k === 'u') this.upgradeSelected();
      else if (k === 'm') this.startMove();
      else if (k === 'x' || k === 'delete') this.sellSelected();
      else if (/^[0-9]$/.test(k)) {
        const cat = CATEGORIES[(Number(k) + 9) % 10];
        if (cat) this.shop.selectCategory(cat.id);
      }
    });
  }

  togglePanel(id, show) {
    const panel = $(`#${id}`);
    const fab = $(id === 'shop' ? '#open-shop' : '#open-city');
    const visible = show ?? panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !visible);
    fab.classList.toggle('hidden', visible);
    // Dar ekranda aynı anda tek panel
    if (visible && window.innerWidth < 760) {
      const other = id === 'shop' ? 'citypanel' : 'shop';
      $(`#${other}`).classList.add('hidden');
      $(other === 'shop' ? '#open-shop' : '#open-city').classList.remove('hidden');
    }
    sfx.click();
  }

  bindButtons() {
    for (const btn of document.querySelectorAll('.collapse')) {
      btn.addEventListener('click', () => this.togglePanel(btn.dataset.target, false));
    }
    $('#open-shop').addEventListener('click', () => this.togglePanel('shop', true));
    $('#open-city').addEventListener('click', () => this.togglePanel('citypanel', true));
    $('#btn-home').addEventListener('click', () => this.world.focusSlot(this.state.slot, 21));
    $('#btn-help').addEventListener('click', () => $('#help').classList.remove('hidden'));
    $('#help-close').addEventListener('click', () => $('#help').classList.add('hidden'));
    if (this.net.local) {
      const reset = $('#help-reset');
      reset.classList.remove('hidden');
      confirmReset(reset, () => {
        this.net.reset();
        location.reload();
      });
    }
    const sound = $('#btn-sound');
    sound.textContent = sfx.muted ? '🔇' : '🔊';
    sound.addEventListener('click', () => (sound.textContent = sfx.toggle() ? '🔇' : '🔊'));
  }
}
