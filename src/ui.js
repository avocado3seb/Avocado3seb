// Benutzeroberfläche: HUD, Menüs, Karte, Pausenmenü
import * as THREE from 'three';
import { G, DEFAULT_SETTINGS } from './state.js';
import { clamp, lerp, fmtMoney, fmtClock, wrapPI, damp } from './util.js';
import { HALF, SEA, RECTS, ISLANDS } from './world.js';
import { POI_COLORS, POI_ICONS } from './game.js';
import { PACKS, PROPERTIES, WEAPONS, WATCHES, WEAPON_SKINS, HAIR, HATS, GLASSES, TOPS, BOTTOMS, SHOES, SKINS, PALETTE, HAIRCOL } from './data.js';
import { CATALOG, byKey, PALETTE_CARS } from './vehicledata.js';
import { Thumbs } from './thumbs.js';
import { openPOI } from './shops.js';

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) { if (k == null || k === false) continue; el.append(k.nodeType ? k : document.createTextNode(String(k))); }
  return el;
}
const TIPS = ['Tipp: Mit F steigst du in Fahrzeuge ein – auch in Boote, Flugzeuge und Helikopter.', 'Tipp: Gewitter erschrecken die Passanten – und machen die Straßen rutschig.', 'Tipp: Kaufe Immobilien, um Fahrzeuge in der Garage zu speichern.', 'Tipp: Ein Pay \'n\' Spray macht dich unsichtbar für die Polizei.', 'Tipp: Wer gut isst, regeneriert schneller Gesundheit.', 'Tipp: Content-Packs findest du im Handy-Menü (P).', 'Tipp: Drücke M für die interaktive Weltkarte und klicke, um ein GPS-Ziel zu setzen.'];

export class UI {
  constructor(G) {
    this.G = G; this.root = document.getElementById('ui'); this.blocking = false; this.bubbles = []; this.modalEl = null; this.pauseEl = null; this.tab = 'map';
    this.thumbs = null; this.legendOff = new Set(); this.lastMoney = null; this.lastHud = {};
    this.sub = null; this.objective = null; this.menuAngle = 0; this.route = null; this.routeT = 0;
    this.build();
    G.on('money', (e) => { if (e.n) this.cashPop(e.n); });
    G.on('playerHurt', () => { this.dmg.style.opacity = 1; setTimeout(() => (this.dmg.style.opacity = 0), 200); });
    G.on('weaponChanged', () => {});
  }
  build() {
    const R = this.root;
    this.loading = h('div', { id: 'loading' }, h('h1', {}, 'VICE CITY'), h('div', { class: 'bar' }, (this.loadBar = h('i'))), (this.loadTxt = h('div', { class: 'tip' }, 'Lade …')), (this.loadTip = h('div', { class: 'tip' }, TIPS[0])));
    this.hud = h('div', { class: 'hud hidden' });
    // Minimap
    this.mmCanvas = h('canvas', { width: 420, height: 420 }); this.mini = h('div', { id: 'minimap' }, this.mmCanvas); this.mmCtx = this.mmCanvas.getContext('2d');
    this.hp = h('i'), this.ar = h('i'), this.fd = h('i');
    this.bars = h('div', { class: 'bars' }, h('div', { class: 'bar' }, this.hp), (this.arBar = h('div', { class: 'bar arm' }, this.ar)), h('div', { class: 'bar food', title: 'Hunger' }, this.fd));
    this.districtEl = h('div', { class: 'district' });
    this.moneyEl = h('div', { class: 'money' }, '$0'); this.clockEl = h('div', { class: 'clock' }); this.starsEl = h('div', { class: 'stars' }); this.weaponEl = h('div', { class: 'weapon' });
    this.topright = h('div', { class: 'topright' }, this.moneyEl, this.clockEl, this.starsEl, this.weaponEl);
    this.speedo = h('div', { class: 'speedo' }, (this.kmh = h('div', { class: 'kmh' })), h('div', { class: 'rpm' }, (this.rpmI = h('i'))), (this.vname = h('div', { class: 'vname' })), (this.vmeta = h('div', { class: 'meta' })), h('div', { class: 'vhealth' }, (this.vhI = h('i'))));
    this.radio = h('div', { class: 'radio' });
    this.promptEl = h('div', { class: 'prompt' }); this.toasts = h('div', { class: 'toasts' });
    this.missionEl = h('div', { class: 'mission', style: { display: 'none' } }, (this.mTitle = h('h4')), (this.mText = h('p')), (this.mTimer = h('div', { class: 'timer' })));
    this.subEl = h('div', { class: 'sub' }); this.bannerEl = h('div', { class: 'banner' });
    this.cross = h('div', { class: 'crosshair' }); this.dmg = h('div', { class: 'dmgflash' }); this.vign = h('div', { class: 'vignette' });
    this.barT = h('div', { class: 'bars-cine top' }); this.barB = h('div', { class: 'bars-cine bot' }); this.fadeEl = h('div', { class: 'fade' });
    this.fpsEl = h('div', { class: 'fps' }); this.help = h('div', { class: 'helpline' }, 'WASD Bewegen · Shift Sprint · Space Springen · E Interagieren · F Ein-/Aussteigen · M Karte · ESC Pause');
    this.bubbleLayer = h('div', { class: 'hud' });
    this.hud.append(this.vign, this.dmg, this.mini, this.bars, this.districtEl, this.topright, this.speedo, this.radio, this.promptEl, this.toasts, this.missionEl, this.subEl, this.cross, this.fpsEl, this.help);
    this.menu = null;
    R.append(this.loading, this.hud, this.bubbleLayer, this.barT, this.barB, this.bannerEl, this.fadeEl);
    this.loadTipT = setInterval(() => { this.loadTip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; }, 2600);
  }
  setProgress(p, t) { this.loadBar.style.width = Math.round(p * 100) + '%'; if (t) this.loadTxt.textContent = t; }
  hideLoading() { clearInterval(this.loadTipT); this.loading.remove(); this.thumbs = new Thumbs(this.G); }

  // ---------- Hauptmenü ----------
  showMenu() {
    const G = this.G; G.mode = 'menu'; this.hud.classList.add('hidden'); this.closeAll();
    const eco = G.eco;
    const btn = (label, fn, cls = '') => h('button', { class: 'btn pe ' + cls, onClick: () => { G.audio?.init(); G.audio?.click(); fn(); } }, label);
    const has = eco.hasAnySave();
    this.menu = h('div', { id: 'menu' }, h('div', { class: 'box' },
      h('h1', {}, 'VICE', h('br'), 'CITY'), h('h2', {}, 'Open World · Neon Nights'),
      has && btn('▶  Fortsetzen', () => this.startGame(false), 'primary'),
      btn('★  Neues Spiel', () => this.startGame(true), has ? '' : 'primary'),
      has && btn('💾  Spiel laden', () => this.slotsModal('load')),
      btn('👥  Mehrspieler', () => G.mp.menu()),
      btn('⚙  Einstellungen', () => this.settingsModal()),
      btn('🎮  Steuerung', () => this.helpModal()),
      btn('ℹ  Credits', () => this.creditsModal()), btn('⛶  Vollbild', () => G.touch?.fullscreen())),
      h('div', { class: 'foot' }, 'Alle Marken und Figuren sind fiktiv. Läuft komplett im Browser (WebGL).'));
    this.root.append(this.menu);
    G.env.time = 18.3; G.env.setWeather('clear', true); G.env.lockWeather = true;
    G.player.char.root.visible = false;
  }
  menuCamera(dt) {
    const G = this.G; this.menuAngle += dt * 0.045;
    const a = this.menuAngle, cx = 1000, cz = 40;
    G.camera.position.set(cx + Math.cos(a) * 330, 70 + Math.sin(a * 0.7) * 20, cz + Math.sin(a) * 330);
    G.camera.lookAt(1060, 28, 90); G.camera.fov = 52; G.camera.updateProjectionMatrix();
    G.player.pos.set(1000, 0, 100); G.player.rig.smooth.set(1000, 0, 100);
    G.env.time = 18.2 + Math.sin(this.menuAngle) * 0.15;
  }
  startGame(isNew) {
    const G = this.G;
    this.menu?.remove(); this.menu = null; this.closeAll();
    G.env.lockWeather = false; G.mode = 'play'; this.hud.classList.remove('hidden');
    if (isNew) { G.newGame(); }
    else { const s = G.eco.latestSlot(); if (s !== null) G.eco.load(s); }
    G.camera.fov = G.settings.fov; G.camera.updateProjectionMatrix();
    G.input.lock();
    G.audio?.init();
  }
  creditsModal() {
    this.modal('Credits', h('div', { class: 'body' }, h('p', {}, 'Vice City – ein von Grund auf prozedural gebautes Open-World-Spiel mit three.js.'), h('p', {}, 'Welt, Fahrzeuge, Figuren, Texturen, Musik und Soundeffekte werden zur Laufzeit generiert – keine externen Assets.'), h('p', {}, 'Inspiriert vom Genre moderner Open-World-Crime-Spiele. Alle Namen, Orte und Figuren sind frei erfunden.')));
  }
  helpModal() {
    const rows = [['W A S D', 'Bewegen / Fahren / Fliegen'], ['Maus', 'Kamera'], ['Shift', 'Sprinten (Flugzeug: Schub +)'], ['Space', 'Springen · Handbremse · Heli steigen'], ['E', 'Interagieren / Ansprechen / Radio vor'], ['F', 'Fahrzeug betreten / verlassen'], ['Q', 'Radio zurück (Flugzeug/Heli: gieren)'], ['Linke Maustaste', 'Schießen / Schlagen'], ['Rechte Maustaste', 'Zielen'], ['R', 'Nachladen'], ['1–6 / Mausrad', 'Waffe wechseln'], ['H', 'Hupe'], ['G', 'Fahrzeuglicht'], ['V', 'Kameramodus im Fahrzeug'], ['C (halten)', 'Rückwärts schauen'], ['Strg', 'Flugzeug: Schub − · Heli: sinken'], ['Enter', 'Interagieren im Fahrzeug (Tankstelle, Pay \'n\' Spray …)'], ['M', 'Weltkarte'], ['I / O / P', 'Inventar / Charakter / Handy'], ['ESC', 'Pausemenü'], ['F3', 'FPS anzeigen']];
    this.modal('Steuerung', h('div', { class: 'body help' }, h('table', {}, rows.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, b))))));
  }

  // ---------- Modal-System ----------
  modal(title, body, opts = {}) {
    this.closeModal(true);
    const G = this.G, prevMode = G.mode === 'menu' ? 'menu' : 'play';
    const closeBtn = h('button', { class: 'btn small pe', onClick: () => this.closeModal() }, 'Schließen (ESC)');
    const win = h('div', { class: 'win slim' }, h('div', { class: 'head' }, h('h2', {}, title), h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center' } }, opts.cash !== false && G.mode !== 'menu' && (this.cashEl = h('span', { class: 'cash' }, fmtMoney(G.player.money))), closeBtn)), body);
    if (opts.wide) win.style.width = 'min(1100px,96vw)';
    this.modalEl = h('div', { class: 'overlay pe' }, win);
    this.modalEl.addEventListener('mousedown', (e) => e.stopPropagation());
    this.root.append(this.modalEl); this.modalOnClose = opts.onClose; this.blocking = true; this.prevMode = prevMode;
    if (G.mode === 'play') { G.mode = 'pause'; G.input.unlock(); }
    return win;
  }
  refreshCash() { if (this.cashEl) this.cashEl.textContent = fmtMoney(this.G.player.money); }
  closeModal(silent = false) {
    if (!this.modalEl) return;
    this.modalEl.remove(); this.modalEl = null; this.blocking = !!this.pauseEl;
    const cb = this.modalOnClose; this.modalOnClose = null;
    if (!silent) { if (this.pauseEl) { /* zurück ins Pausenmenü */ } else if (this.G.mode === 'pause' && this.prevMode !== 'menu') { this.G.mode = 'play'; this.G.input.lock(); } }
    cb && cb();
  }
  closeAll() { this.closeModal(true); if (this.pauseEl) { this.pauseEl.remove(); this.pauseEl = null; } this.blocking = false; }
  openPOI(poi) { openPOI(this, poi); }

  // ---------- Pause ----------
  openPause(tab = null) {
    const G = this.G;
    if (G.mode !== 'play' && G.mode !== 'pause') return;
    if (this.modalEl) { this.closeModal(); return; }
    if (tab) this.tab = tab;
    G.mode = 'pause'; G.input.unlock(); this.blocking = true;
    if (!this.pauseEl) {
      this.pauseEl = h('div', { class: 'overlay pe' });
      this.pauseEl.addEventListener('mousedown', (e) => e.stopPropagation());
      this.root.append(this.pauseEl);
    }
    this.renderPause();
  }
  closePause() {
    if (this.modalEl) { this.closeModal(); return; }
    if (!this.pauseEl) return;
    this.pauseEl.remove(); this.pauseEl = null; this.blocking = false;
    if (this.G.mode === 'pause') { this.G.mode = 'play'; this.G.input.lock(); }
    this.mapState = null;
  }
  renderPause() {
    const G = this.G;
    const tabs = [['map', '🗺  Karte'], ['missions', '🎯  Missionen'], ['character', '👤  Charakter'], ['inventory', '🎒  Inventar'], ['vehicles', '🚗  Fahrzeuge'], ['props', '🏠  Immobilien'], ['packs', '📦  Content-Packs'], ['stats', '📊  Statistik'], ['phone', '📱  Handy'], ['mp', '👥  Mehrspieler'], ['settings', '⚙  Einstellungen'], ['saves', '💾  Speichern'], ['help', '🎮  Steuerung']];
    const content = h('div', { class: 'content' });
    const tabEls = h('div', { class: 'tabs' }, h('h3', {}, 'PAUSE'), tabs.map(([k, l]) => h('button', { class: 'tab' + (k === this.tab ? ' on' : ''), onClick: () => { this.tab = k; G.audio?.click(); this.renderPause(); } }, l)), h('div', { class: 'sp' }),
      h('button', { class: 'tab', onClick: () => this.closePause() }, '▶  Weiter'), h('button', { class: 'tab', onClick: () => { if (confirm('Zum Hauptmenü? Nicht gespeicherter Fortschritt geht verloren.')) { G.eco.autosave(); location.reload(); } } }, '⏏  Hauptmenü'));
    this.pauseEl.replaceChildren(h('div', { class: 'win' }, tabEls, content));
    this['tab_' + this.tab]?.(content);
  }

  // ---------- Tabs ----------
  tab_map(c) {
    const G = this.G; c.replaceChildren();
    const cats = [['food', '🍔 Essen'], ['clothes', '👕 Mode'], ['guns', '🔫 Waffen'], ['property', '🏠 Immobilien'], ['dealer', '🚘 Autos'], ['fuel', '⛽ Tank/Tuning'], ['job', '💼 Jobs'], ['raceStart', '🏁 Rennen'], ['atm', '💵 ATM'], ['special', '⭐ Besonderes'], ['mission', '🎯 Missionen']];
    const legend = h('div', { class: 'legend' }, cats.map(([k, l]) => h('span', { class: 'chip' + (this.legendOff.has(k) ? '' : ' on'), onClick: (e) => { if (this.legendOff.has(k)) this.legendOff.delete(k); else this.legendOff.add(k); e.target.classList.toggle('on'); } }, l)),
      h('span', { class: 'chip', onClick: () => { G.waypoint = null; this.route = null; } }, '✖ GPS löschen'));
    const wrap = h('div', { class: 'mapwrap' }); const cv = h('canvas'); wrap.append(cv);
    c.append(h('h2', {}, 'Interaktive Weltkarte'), legend, wrap, h('div', { class: 'row', style: { marginTop: '8px' } }, h('div', { class: 'd' }, 'Linksklick: GPS-Ziel setzen · Ziehen: verschieben · Mausrad: zoomen · Rechtsklick: Ziel löschen')));
    const p = G.player.position;
    this.mapState = { cx: p.x, cz: p.z, scale: 0.34, cv, drag: null };
    const st = this.mapState;
    const resize = () => { cv.width = wrap.clientWidth * devicePixelRatio; cv.height = wrap.clientHeight * devicePixelRatio; };
    setTimeout(resize, 0); resize();
    cv.addEventListener('wheel', (e) => { e.preventDefault(); st.scale = clamp(st.scale * (e.deltaY < 0 ? 1.15 : 0.87), 0.06, 2.2); });
    cv.addEventListener('mousedown', (e) => { st.drag = { x: e.clientX, z: e.clientY, cx: st.cx, cz: st.cz, moved: false }; });
    addEventListener('mouseup', st.up = (e) => { if (st.drag && !st.drag.moved && e.target === cv) { const r = cv.getBoundingClientRect(); const dx = (e.clientX - r.left - r.width / 2) / st.scale, dz = (e.clientY - r.top - r.height / 2) / st.scale; if (e.button === 2) { G.waypoint = null; this.route = null; } else { G.waypoint = { x: st.cx + dx, z: st.cz + dz }; this.toast('GPS-Ziel gesetzt'); this.routeT = 0; } } if (st.drag) st.drag = null; });
    cv.addEventListener('mousemove', (e) => { if (st.drag) { const dx = e.clientX - st.drag.x, dz = e.clientY - st.drag.z; if (Math.abs(dx) + Math.abs(dz) > 4) st.drag.moved = true; st.cx = st.drag.cx - dx / st.scale; st.cz = st.drag.cz - dz / st.scale; } });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    this.drawFullMap();
  }
  drawFullMap() {
    const st = this.mapState; if (!st || !this.pauseEl || this.tab !== 'map') return;
    const cv = st.cv, ctx = cv.getContext('2d'), W = cv.width, H = cv.height, dpr = devicePixelRatio;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b2036'; ctx.fillRect(0, 0, W, H);
    this.drawMapView(ctx, W, H, st.cx, st.cz, st.scale * dpr, 0, { full: true });
  }
  drawMapView(ctx, W, H, cx, cz, s, rot, o = {}) {
    const G = this.G, map = G.world.mapCanvas; if (!map) return;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(rot); ctx.scale(s, s); ctx.translate(-cx, -cz);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(map, -HALF, -HALF, HALF * 2, HALF * 2);
    // GPS-Route
    const route = this.route;
    if (route && route.length > 1) { ctx.strokeStyle = '#ff2bd6'; ctx.lineWidth = (o.full ? 6 : 8) / s; ctx.lineJoin = 'round'; ctx.beginPath(); route.forEach((p, i) => (i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z))); ctx.stroke(); }
    const icon = (x, z, txt, size = 16, bg = null) => {
      ctx.save(); ctx.translate(x, z); ctx.rotate(-rot); ctx.scale(1 / s, 1 / s);
      if (bg) { ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, size * 0.62, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.font = `${size}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 1); ctx.restore();
    };
    const range = o.full ? 1e9 : 260;
    const full = !!o.full, vis = (kind) => { if (!full) return true; const cat = ['food', 'clothes', 'guns', 'property', 'dealer', 'fuel', 'job', 'raceStart', 'atm'].includes(kind) ? kind : (kind === 'tune' ? 'fuel' : kind === 'barber' || kind === 'jewel' || kind === 'store' ? 'clothes' : 'special'); return !this.legendOff.has(cat); };
    const px = G.player.position.x, pz = G.player.position.z;
    for (const p of G.world.pois) {
      if (p.disabled || (!full && Math.hypot(p.x - px, p.z - pz) > range)) continue;
      if (!vis(p.kind)) continue;
      const own = p.kind === 'property' && G.eco.owns(p.id);
      let ic = POI_ICONS[p.kind]; if (!ic) continue;
      if (p.kind === 'landmark') { if (!full || s < 0.25) continue; ctx.save(); ctx.translate(p.x, p.z); ctx.rotate(-rot); ctx.scale(1 / s, 1 / s); ctx.font = '11px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(p.name, 0, 0); ctx.restore(); continue; }
      icon(p.x, p.z, ic, full ? 15 : 14, own ? '#00a152' : 'rgba(20,10,40,.85)');
    }
    if (!full || !this.legendOff.has('mission')) for (const m of G.mission?.blips?.() || []) icon(m.x, m.z, m.icon || '★', full ? 17 : 15, m.color || '#c79a1a');
    // Fahrzeuge in Besitz
    for (const v of G.vehicles.list) if (v.owned && !v.exploded) icon(v.pos.x, v.pos.z, '🚗', 12, 'rgba(30,60,160,.9)');
    // Polizei
    if (G.police.stars > 0) for (const u of G.police.units) { const f = Math.floor(G.time * 4) % 2; ctx.fillStyle = f ? '#ff3030' : '#3060ff'; ctx.beginPath(); ctx.arc(u.v.pos.x, u.v.pos.z, 5 / s, 0, 7); ctx.fill(); }
    if (G.police.stars > 0) for (const c of G.police.footCops) if (c.alive) { ctx.fillStyle = '#4a8bff'; ctx.beginPath(); ctx.arc(c.pos.x, c.pos.z, 3 / s, 0, 7); ctx.fill(); }
    if (G.mp?.active) for (const r of G.mp.remotes.values()) icon(r.pos.x, r.pos.z, '●', 16, r.color);
    // Waypoint
    if (G.waypoint) icon(G.waypoint.x, G.waypoint.z, '🚩', 18);
    // Spieler
    ctx.save(); ctx.translate(px, pz); ctx.rotate(-G.player.yaw + Math.PI); ctx.scale(1 / s, 1 / s);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#d81b60'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 9); ctx.lineTo(0, 5); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  tab_missions(c) {
    const G = this.G; c.replaceChildren(h('h2', {}, 'Missionen & Aktivitäten'));
    const m = G.mission;
    if (m) c.append(...m.logRows(this));
  }
  tab_character(c) {
    const G = this.G, P = G.player; c.replaceChildren(h('h2', {}, 'Charakter & Garderobe'));
    const prev = h('img', { alt: '' });
    const upd = () => { prev.src = this.thumbs.character({ ...P.outfit }); };
    const apply = (k, v) => { P.outfit[k] = v; P.refreshOutfit(); upd(); };
    const sw = (arr, key, cur) => h('div', { class: 'swatches' }, arr.map((col) => h('div', { class: 'sw' + (cur() === col ? ' on' : ''), style: { background: '#' + col.toString(16).padStart(6, '0') }, onClick: (e) => { apply(key, col); e.target.parentNode.querySelectorAll('.sw').forEach((x) => x.classList.remove('on')); e.target.classList.add('on'); } })));
    const sel = (title, list, key, owned) => h('div', {}, h('h3', {}, title), h('div', { class: 'sel' }, list.map((it, i) => { const nm = Array.isArray(it) ? it[0] : it; const ok = !owned || owned.includes(i); return ok ? h('button', { class: P.outfit[key] === i ? 'on' : '', onClick: (e) => { apply(key, i); e.target.parentNode.querySelectorAll('button').forEach((x) => x.classList.remove('on')); e.target.classList.add('on'); } }, nm) : null; })));
    const O = P.owned;
    const watchSel = h('div', {}, h('h3', {}, 'Uhr'), h('div', { class: 'sel' }, WATCHES.map((w, i) => (O.watches.includes(i) ? h('button', { class: (P.watch || 0) === i ? 'on' : '', onClick: (e) => { P.watch = i; P.refreshOutfit(); upd(); e.target.parentNode.querySelectorAll('button').forEach((x) => x.classList.remove('on')); e.target.classList.add('on'); } }, w.name) : null))));
    const left = h('div', { class: 'prev' }, prev, h('div', { class: 'd' }, `Prestige: ${G.eco.prestige()}`), h('div', { class: 'd' }, 'Neue Kleidung gibt es in den Modeläden.'));
    const right = h('div', { style: { flex: 1 } },
      h('h3', {}, 'Hautton'), sw(SKINS, 'skin', () => P.outfit.skin),
      sel('Frisur', HAIR, 'hairStyle', O.hair), h('h3', {}, 'Haarfarbe'), sw(HAIRCOL, 'hairColor', () => P.outfit.hairColor),
      sel('Oberteil', TOPS, 'top', O.tops), h('h3', {}, 'Farbe Oberteil'), sw(PALETTE, 'topColor', () => P.outfit.topColor),
      sel('Hose', BOTTOMS, 'bottom', O.bottoms), h('h3', {}, 'Farbe Hose'), sw(PALETTE, 'bottomColor', () => P.outfit.bottomColor),
      sel('Schuhe', SHOES, 'shoe', O.shoes), sw(PALETTE, 'shoeColor', () => P.outfit.shoeColor),
      sel('Kopfbedeckung', HATS, 'hat', O.hats), sel('Brille', GLASSES, 'glasses', O.glasses), watchSel);
    c.append(h('div', { class: 'two' }, left, right)); upd();
  }
  tab_inventory(c) {
    const G = this.G, P = G.player; c.replaceChildren(h('h2', {}, 'Inventar'));
    c.append(h('h3', {}, 'Waffen'));
    for (const [k, e] of Object.entries(P.weapons)) { if (!e.owned) continue; const w = WEAPONS[k]; c.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, w.name, P.weapon === k && h('span', { class: 'pill' }, 'ausgerüstet')), h('div', { class: 'd' }, w.melee ? 'Nahkampf' : `Munition: ${e.loaded ?? 0} / ${e.ammo ?? 0}`)), h('button', { class: 'btn small', onClick: () => { P.selectWeapon(k); this.renderPause(); } }, 'Ausrüsten'))); }
    c.append(h('h3', {}, 'Waffen-Skins'));
    c.append(h('div', { class: 'sel' }, WEAPON_SKINS.filter((s) => P.skins[s.id] || s.price === 0).map((s) => h('button', { class: P.skinSel === s.id ? 'on owned' : 'owned', onClick: () => { P.skinSel = s.id; P.skinSelColor = s.id === 'default' ? 0 : s.color; P.refreshWeaponModel(); this.renderPause(); } }, s.name))));
    c.append(h('h3', {}, 'Verbrauchsgüter'));
    const use = (id, name, fn) => P.inv[id] > 0 && c.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, `${name} ×${P.inv[id]}`)), h('button', { class: 'btn small', onClick: () => { fn(); P.inv[id]--; this.renderPause(); } }, 'Benutzen')));
    use('medkit', 'Verbandskasten', () => { P.health = 100; this.toast('Gesundheit aufgefüllt'); }); use('armorkit', 'Schutzweste', () => { P.armor = 100; this.toast('Weste angelegt'); });
    c.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, `Hunger: ${Math.round(P.hunger)} %`), h('div', { class: 'd' }, 'Essen in Restaurants und Imbissen. Gut gesättigt = schnellere Regeneration.'))));
    c.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, `Versteckte Pakete: ${Object.keys(G.found.packages).length} / ${G.packagePts.length}`)), h('div', { class: 'price' }, fmtMoney(P.money))));
  }
  tab_vehicles(c) {
    const G = this.G; c.replaceChildren(h('h2', {}, `Garage (${G.eco.garage.length} / ${G.eco.slots()} Stellplätze)`));
    if (!G.eco.garage.length) c.append(h('p', { class: 'd' }, 'Du besitzt noch keine Fahrzeuge. Kaufe welche beim Händler (Premium Deluxe Motorsport) oder in der Marina / am Flughafen.'));
    const grid = h('div', { class: 'grid' });
    for (const e of G.eco.garage) {
      const spec = byKey.get(e.key); const img = h('img'); this.thumbs.lazyVehicle(img, spec, e.color);
      const out = G.vehicles.list.find((v) => v.entry === e && !v.dead);
      grid.append(h('div', { class: 'card' }, img, h('div', { class: 't' }, spec.name), h('div', { class: 'd' }, `${spec.label} · ${out ? 'draußen' : 'Garage'} · Zustand ${Math.round((e.health ?? 1000) / 10)}%`),
        h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
          h('button', { class: 'btn small', onClick: () => { if (out) { this.toast('Fahrzeug ist bereits draußen – GPS gesetzt'); G.waypoint = { x: out.pos.x, z: out.pos.z }; } else { const cost = 250; if (G.player.money < cost) return this.toast('Lieferung kostet $250'); G.player.addMoney(-cost); G.eco.takeOut(e); this.toast('Dein Fahrzeug wurde geliefert.'); } this.renderPause(); } }, out ? 'Orten' : 'Liefern ($250)'),
          h('button', { class: 'btn small', onClick: () => { const idx = (PALETTE_CARS.indexOf(e.color) + 1) % PALETTE_CARS.length; e.color = PALETTE_CARS[idx]; const v = G.vehicles.list.find((q) => q.entry === e); v?.setColor(e.color); this.renderPause(); } }, '🎨 Farbe'),
          h('button', { class: 'btn small', onClick: () => { if (!confirm(`${spec.name} für ${fmtMoney(spec.price * 0.5)} verkaufen?`)) return; const v = G.vehicles.list.find((q) => q.entry === e); if (v) G.vehicles.despawn(v); G.eco.garage = G.eco.garage.filter((q) => q !== e); G.player.addMoney(spec.price * 0.5, 'Verkauf'); this.renderPause(); } }, 'Verkaufen'))));
    }
    c.append(grid);
  }
  tab_props(c) {
    const G = this.G; c.replaceChildren(h('h2', {}, 'Immobilien & Geschäfte'));
    c.append(h('div', { class: 'd' }, `Tägliches Einkommen: ${fmtMoney(G.eco.income())} · Prestige: ${G.eco.prestige()}`));
    for (const p of PROPERTIES) {
      const own = G.eco.owns(p.id), locked = p.pack && !G.eco.packs[p.pack];
      c.append(h('div', { class: 'row' + (locked ? ' locked' : '') }, h('div', { class: 'grow' }, h('div', { class: 't' }, p.name, p.pack && h('span', { class: 'pill pack' }, PACKS[p.pack].name), own && h('span', { class: 'pill' }, 'Besitz')), h('div', { class: 'd' }, `${p.desc} · ${p.slots} Stellplätze${p.income ? ' · Einkommen ' + fmtMoney(p.income) + '/Tag' : ''}`)), h('div', { class: 'price' }, own ? '' : fmtMoney(p.price)),
        h('button', { class: 'btn small', onClick: () => { const poi = G.world.pois.find((q) => q.id === p.id); if (poi) { G.waypoint = { x: poi.x, z: poi.z }; this.routeT = 0; this.toast('GPS-Ziel gesetzt: ' + p.name); } } }, 'GPS')));
    }
  }
  tab_packs(c) {
    const G = this.G; c.replaceChildren(h('h2', {}, 'Content-Packs'), h('p', { class: 'd' }, 'Jedes Pack enthält neue Fahrzeuge, Kleidung, Missionen, Orte und Aktivitäten.'));
    for (const [id, pk] of Object.entries(PACKS)) {
      const own = G.eco.packs[id];
      const vcount = CATALOG.filter((v) => v.pack === id).length;
      c.append(h('div', { class: 'row', style: { borderColor: pk.color } }, h('div', { class: 'grow' }, h('div', { class: 't', style: { color: pk.color } }, pk.name, own && h('span', { class: 'pill' }, 'freigeschaltet')), h('div', { class: 'd' }, pk.desc), h('div', { class: 'd' }, `${vcount} Fahrzeuge · exklusive Outfits & Missionen`)),
        own ? null : h('div', { class: 'price' }, fmtMoney(pk.price)), own ? null : h('button', { class: 'btn small gold', onClick: () => { if (G.eco.buyPack(id)) this.renderPause(); } }, 'Kaufen')));
    }
  }
  tab_stats(c) {
    const G = this.G, s = G.player.stats; c.replaceChildren(h('h2', {}, 'Statistik'));
    const rows = [['Spielzeit', `${Math.floor(s.timePlayed / 3600)} h ${Math.floor(s.timePlayed / 60) % 60} min`], ['Strecke zu Fuß', (s.distFoot / 1000).toFixed(1) + ' km'], ['Strecke im Fahrzeug', (s.distCar / 1000).toFixed(1) + ' km'], ['Höchstgeschwindigkeit', Math.round(s.top) + ' km/h'], ['Gestohlene Fahrzeuge', s.cars], ['Besiegte Gegner', s.kills], ['Verdientes Geld', fmtMoney(s.money)], ['Missionen', G.mission?.doneCount?.() || 0], ['Rennen gewonnen', s.races], ['Pakete', `${Object.keys(G.found.packages).length}/${G.packagePts.length}`], ['Stunts', s.stunts], ['Festnahmen', s.busted], ['Tode', s.wasted], ['Prestige', G.eco.prestige()], ['Tag', G.day]];
    rows.forEach(([a, b]) => c.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, a), h('div', { class: 'price' }, b))));
  }
  tab_mp(c) { this.G.mp.tab(c); }
  tab_phone(c) { import('./shops.js').then((m) => m.phoneTab(this, c)); }
  tab_settings(c) { c.replaceChildren(h('h2', {}, 'Einstellungen'), ...this.settingsFields()); }
  tab_help(c) { c.replaceChildren(h('h2', {}, 'Steuerung')); const w = h('div', { class: 'help' }); this.helpModalInto(w); c.append(w); }
  helpModalInto(w) {
    const rows = [['W A S D', 'Bewegen / Fahren / Fliegen'], ['Maus', 'Kamera'], ['Shift', 'Sprinten · Flugzeug: Schub +'], ['Space', 'Springen · Handbremse · Heli steigen'], ['E', 'Interagieren · Passanten ansprechen'], ['F', 'Fahrzeug betreten / verlassen'], ['Q / E', 'Radio (Fahrzeuge) · Flugzeug/Heli: gieren'], ['Linke Maustaste', 'Schießen / Schlagen'], ['Rechte Maustaste', 'Zielen'], ['R', 'Nachladen'], ['1–6 / Mausrad', 'Waffe wechseln'], ['H', 'Hupe'], ['G', 'Licht'], ['V', 'Kamera im Fahrzeug'], ['C', 'Zurückschauen'], ['Strg', 'Flugzeug: Schub − · Heli: sinken'], ['Enter', 'Interagieren im Fahrzeug'], ['M · I · O · P', 'Karte · Inventar · Charakter · Handy'], ['ESC', 'Pause']];
    w.append(h('table', {}, rows.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, b)))));
  }
  tab_saves(c) { c.replaceChildren(h('h2', {}, 'Speichern & Laden')); this.slotsInto(c, 'both'); }
  slotsInto(c, mode) {
    const G = this.G;
    for (const s of [0, 1, 2, 'auto']) {
      const info = G.eco.info(s);
      const lab = s === 'auto' ? 'Autospeicherung' : `Slot ${s + 1}`;
      c.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, lab), h('div', { class: 'd' }, info ? `${new Date(info.ts).toLocaleString('de-DE')} · ${fmtMoney(info.money)} · ${fmtClock(info.time)} Uhr · ${info.missions} Missionen · ${info.props} Immobilien` : 'Leer')),
        mode !== 'load' && s !== 'auto' && h('button', { class: 'btn small', onClick: () => { if (G.eco.save(s)) { this.toast('Spiel gespeichert'); this.refreshSlots(c, mode); } else this.toast('Speichern fehlgeschlagen'); } }, 'Speichern'),
        info && h('button', { class: 'btn small primary', onClick: () => { if (this.menu) { this.startGame(false); G.eco.load(s); } else G.eco.load(s); this.closeAll(); if (G.mode === 'pause') { G.mode = 'play'; G.input.lock(); } this.toast('Spiel geladen'); } }, 'Laden'),
        info && s !== 'auto' && h('button', { class: 'btn small', onClick: () => { G.eco.deleteSlot(s); this.refreshSlots(c, mode); } }, '🗑')));
    }
  }
  refreshSlots(c, mode) { c.replaceChildren(h('h2', {}, 'Speichern & Laden')); this.slotsInto(c, mode); }
  slotsModal(mode) { const body = h('div', { class: 'body' }); this.slotsInto(body, mode); this.modal(mode === 'load' ? 'Spiel laden' : 'Speichern', body, { cash: false }); }
  settingsModal() { this.modal('Einstellungen', h('div', { class: 'body' }, ...this.settingsFields()), { cash: false }); }
  settingsFields() {
    const G = this.G, S = G.settings;
    const slider = (label, key, min, max, step, fmt = (v) => v) => { const val = h('span', { class: 'val' }, fmt(S[key])); return h('div', { class: 'field' }, h('label', {}, label), h('input', { type: 'range', min, max, step, value: S[key], onInput: (e) => { S[key] = +e.target.value; val.textContent = fmt(S[key]); G.applySettings(); } }), val); };
    const select = (label, key, opts) => h('div', { class: 'field' }, h('label', {}, label), h('select', { onChange: (e) => { S[key] = e.target.value; G.applySettings(); } }, opts.map(([v, l]) => h('option', { value: v, selected: S[key] === v }, l))));
    const check = (label, key) => h('div', { class: 'field' }, h('label', {}, label), h('input', { type: 'checkbox', checked: !!S[key], onChange: (e) => { S[key] = e.target.checked; G.applySettings(); } }));
    return [h('h3', {}, 'Grafik'), select('Grafikqualität', 'quality', [['low', 'Niedrig'], ['medium', 'Mittel'], ['high', 'Hoch (Bloom)'], ['ultra', 'Ultra (Schatten 4K, Bloom)']]), slider('Sichtfeld (FOV)', 'fov', 50, 100, 1, (v) => v + '°'), check('FPS anzeigen', 'fps'), check('Kamerawackeln', 'shake'), select('Touch-Steuerung', 'touch', [['auto', 'Automatisch'], ['on', 'Immer an'], ['off', 'Aus']]),
      h('h3', {}, 'Steuerung'), slider('Mausempfindlichkeit', 'sens', 0.3, 2.5, 0.05, (v) => (+v).toFixed(2)), check('Y-Achse invertieren', 'invertY'),
      h('h3', {}, 'Audio'), slider('Gesamtlautstärke', 'master', 0, 1, 0.05, (v) => Math.round(v * 100) + '%'), slider('Effekte', 'sfx', 0, 1, 0.05, (v) => Math.round(v * 100) + '%'), slider('Musik / Radio', 'music', 0, 1, 0.05, (v) => Math.round(v * 100) + '%'),
      h('h3', {}, 'Welt'), slider('Tageslänge (Minuten)', 'dayLen', 4, 90, 1, (v) => v + ' min'), slider('Verkehrsdichte', 'traffic', 0.2, 1.6, 0.1, (v) => Math.round(v * 100) + '%'), slider('Passantendichte', 'peds', 0.2, 1.6, 0.1, (v) => Math.round(v * 100) + '%'),
      h('div', { class: 'field' }, h('button', { class: 'btn small', onClick: () => { Object.assign(G.settings, DEFAULT_SETTINGS); G.applySettings(); this.renderPause?.(); } }, 'Zurücksetzen'))];
  }

  // ---------- HUD-Elemente ----------
  toast(msg, ms = 3400) {
    const el = h('div', { class: 'toast' }, msg); this.toasts.append(el);
    while (this.toasts.children.length > 5) this.toasts.firstChild.remove();
    setTimeout(() => el.remove(), ms);
  }
  radioToast(name) { this.radio.innerHTML = `📻 <b>${name}</b>`; this.radio.classList.add('on'); clearTimeout(this._rt); this._rt = setTimeout(() => this.radio.classList.remove('on'), 2800); }
  cashPop(n) { const el = h('div', { class: 'cash-pop', style: n < 0 ? { color: '#ff6b6b' } : {} }, (n > 0 ? '+' : '−') + fmtMoney(Math.abs(n))); this.hud.append(el); setTimeout(() => el.remove(), 1600); }
  banner(text, color = '#fff') { if (!text) { this.bannerEl.classList.remove('on'); return; } this.bannerEl.textContent = text; this.bannerEl.style.color = color; this.bannerEl.classList.add('on'); }
  fade(ms = 600) { this.fadeEl.style.transition = 'none'; this.fadeEl.style.opacity = 1; requestAnimationFrame(() => { this.fadeEl.style.transition = `opacity ${ms}ms`; this.fadeEl.style.opacity = 0; }); }
  fadeTo(v, ms = 500) { this.fadeEl.style.transition = `opacity ${ms}ms`; this.fadeEl.style.opacity = v; }
  cine(on) { this.barT.classList.toggle('on', on); this.barB.classList.toggle('on', on); this.hud.style.opacity = on ? 0.0 : 1; this.bubbleLayer.style.display = on ? 'none' : ''; }
  subtitle(who, text, ms = 3500) { this.subEl.innerHTML = (who ? `<b>${who}:</b> ` : '') + text; this.subEl.style.opacity = 1; clearTimeout(this._st); this._st = setTimeout(() => { this.subEl.innerHTML = ''; }, ms); }
  setObjective(title, text, timer = null) { if (!title && !text) { this.missionEl.style.display = 'none'; return; } this.missionEl.style.display = ''; this.mTitle.textContent = title || ''; this.mText.textContent = text || ''; this.mTimer.textContent = timer != null ? fmtClockSec(timer) : ''; }
  say(ped, text, dur = 2) {
    if (this.bubbles.length > 5 || this.G.mode !== 'play') return;
    if (this.bubbles.some((b) => b.ped === ped)) return;
    const el = h('div', { class: 'bubble' }, text); this.bubbleLayer.append(el); this.bubbles.push({ ped, el, t: dur });
  }
  updateBubbles(dt) {
    const cam = this.G.camera, v = new THREE.Vector3();
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]; b.t -= dt;
      if (b.t <= 0 || !b.ped.alive && b.t < 1 && false) { b.el.remove(); this.bubbles.splice(i, 1); continue; }
      v.set(b.ped.pos.x, b.ped.pos.y + 2.05, b.ped.pos.z).project(cam);
      if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.1) { b.el.style.display = 'none'; continue; }
      b.el.style.display = ''; b.el.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px'; b.el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
    }
  }

  // ---------- pro Frame ----------
  update(dt) {
    const G = this.G, P = G.player, mode = G.mode;
    this.thumbs?.pump(); G.touch?.update();
    if (this.pauseEl && this.tab === 'map') this.drawFullMap();
    if (mode === 'menu' || !this.hud) { return; }
    this.fpsEl.textContent = G.settings.fps ? `${G.fps || 0} FPS` : '';
    this.updateBubbles(dt);
    // Geld
    if (this.lastMoney !== P.money) { this.lastMoney = P.money; this.moneyEl.textContent = fmtMoney(P.money); }
    this.hp.style.width = clamp(P.health, 0, 100) + '%'; this.ar.style.width = clamp(P.armor, 0, 100) + '%'; this.arBar.style.display = P.armor > 0 ? '' : 'none'; this.fd.style.width = clamp(P.hunger, 0, 100) + '%';
    this.vign.style.opacity = P.health < 30 && P.alive ? (0.7 - P.health / 60) : 0;
    this.clockEl.innerHTML = `${fmtClock(G.env.time)} Uhr · ${G.env.weatherLabel}<small>${G.districtName} · Tag ${G.day}</small>`;
    // Sterne
    const pol = G.police, st = pol.stars;
    const sk = st + (pol.searching ? 's' : '') + (pol.bustT > 0 ? 'b' : '');
    if (this.lastHud.st !== sk) { this.lastHud.st = sk; this.starsEl.className = 'stars' + (pol.searching ? ' search' : ''); this.starsEl.innerHTML = st > 0 || true ? [1, 2, 3, 4, 5].map((i) => `<span class="${i <= st ? 'on' : 'off'}">★</span>`).join('') : ''; this.starsEl.style.display = st > 0 ? '' : 'none'; }
    // Waffe
    const w = WEAPONS[P.weapon], e = P.weapons[P.weapon];
    const wt = P.vehicle ? '' : w.melee ? '👊 ' + w.name : `${w.name}  <b>${e.loaded ?? 0}</b> / ${e.ammo ?? 0}${P.reloadT > 0 ? ' ↻' : ''}`;
    if (this.lastHud.w !== wt) { this.lastHud.w = wt; this.weaponEl.innerHTML = wt; }
    this.cross.classList.toggle('on', P.aim && !P.vehicle);
    // Tacho
    const v = P.vehicle;
    this.speedo.style.display = v ? '' : 'none';
    if (v) {
      const k = Math.round(v.speedKmh || v.speed * 3.6);
      this.kmh.innerHTML = `${k}<small>km/h</small>`; this.rpmI.style.width = clamp((v.rpm - 800) / 7000, 0, 1) * 100 + '%';
      this.vname.textContent = v.spec.name;
      const gear = v.kind === 'car' || v.kind === 'bike' ? (v.u < -0.5 ? 'R' : v.speed < 0.5 ? 'N' : v.gear + 1) : '';
      this.vmeta.textContent = v.kind === 'plane' ? `Höhe ${Math.round(v.pos.y - v.gnd)} m · Schub ${Math.round(v.thr3 * 100)}%` : v.kind === 'heli' ? `Höhe ${Math.round(v.pos.y - v.gnd)} m` : v.kind === 'boat' ? `Seemeilen/h ${Math.round(k / 1.852)}` : `Gang ${gear}`;
      this.vhI.style.width = clamp(v.health / 10, 0, 100) + '%'; this.vhI.style.background = v.health < 300 ? '#ff5252' : v.health < 600 ? '#ffd54f' : '#7bd88f';
    }
    // Radio-Anzeige bei Fahrzeugwechsel
    // Prompt
    this.updatePrompt();
    // Zeitlimit / Mission
    G.mission?.hud?.(this);
    // Karte
    this.drawMini();
    // GPS-Route
    this.routeT -= dt; if (G.waypoint && this.routeT <= 0) { this.routeT = 2; this.computeRoute(); }
    if (!G.waypoint) this.route = null;
    if (G.waypoint && Math.hypot(G.waypoint.x - P.position.x, G.waypoint.z - P.position.z) < 18) { G.waypoint = null; this.route = null; this.toast('Ziel erreicht'); }
  }
  updatePrompt() {
    const G = this.G, P = G.player; let t = '';
    if (G.mode === 'play' && P.alive && !this.blocking) {
      if (G.poiNear) t = `<kbd>${P.vehicle ? 'ENTER' : 'E'}</kbd> ${G.poiNear.name}`;
      else if (G.mission?.prompt?.()) t = G.mission.prompt();
      else if (!P.vehicle) {
        const v = G.vehicles.nearest(P.pos.x, P.pos.z, 3.6);
        const ped = G.peds.nearestTo(P.pos.x, P.pos.z, 2.0, (p) => p.state !== 'inside');
        if (v && !v.exploded) t = `<kbd>F</kbd> ${v.driver ? 'Fahrzeug übernehmen' : 'Einsteigen'}: ${v.spec.name}`;
        else if (ped) t = ped.state === 'hands' ? `<kbd>E</kbd> Ausrauben` : `<kbd>E</kbd> Ansprechen`;
      } else t = `<kbd>F</kbd> Aussteigen`;
      if (!t && P.stun > 0) t = '';
    }
    if (this.lastHud.p !== t) { this.lastHud.p = t; this.promptEl.innerHTML = t; this.promptEl.classList.toggle('on', !!t); }
    // Ansprechen / Ausrauben
    if (G.mode === 'play' && G.input.hit('KeyE') && !G.poiNear && !P.vehicle && !this.blocking && P.alive && !G.mission?.prompt?.()) {
      const ped = G.peds.nearestTo(P.pos.x, P.pos.z, 2.0, (p) => p.state !== 'inside');
      if (ped) {
        if (ped.state === 'hands' && !ped.robbed) { ped.robbed = true; const cash = Math.round(20 + Math.random() * 160); P.addMoney(cash, 'Raub'); G.police.crime('rob', 0.5, P.pos, ped); this.say(ped, 'Nimm es und lass mich leben!', 2); ped.state = 'flee'; ped.t = 10; ped.threat = P.pos; }
        else if (ped.state !== 'flee' && ped.type === 'civ') { ped.state = 'idle'; ped.t = 4; ped.lookAt = P.pos; ped.talkT = 4; const lines = this.G.talkLines ? this.G.talkLines(ped) : ['Hallo!']; this.say(ped, lines[Math.floor(Math.random() * lines.length)], 3.2); }
      }
    }
  }
  computeRoute() {
    const G = this.G, W = G.world, p = G.player.position, wp = G.waypoint; if (!wp) return;
    const a = W.nearestNode(p.x, p.z, 500), b = W.nearestNode(wp.x, wp.z, 500);
    if (!a || !b) { this.route = [{ x: p.x, z: p.z }, wp]; return; }
    const path = W.findPath(a, b, 3000);
    this.route = path ? [{ x: p.x, z: p.z }, ...path.map((n) => ({ x: n.x, z: n.z })), wp] : [{ x: p.x, z: p.z }, wp];
  }
  drawMini() {
    const G = this.G, ctx = this.mmCtx, W = 420, H = 420;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0c2238'; ctx.fillRect(0, 0, W, H);
    const p = G.player.position, rot = (G.player.rig?.yaw ?? 0) - Math.PI;
    this.drawMapView(ctx, W, H, p.x, p.z, 420 / (G.player.vehicle ? 520 : 340), rot, { full: false });
    // Rand-Marker für Ziel
    const m = G.mission?.blips?.()[0] || (G.waypoint ? { x: G.waypoint.x, z: G.waypoint.z } : null);
  }
}
function fmtClockSec(s) { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
