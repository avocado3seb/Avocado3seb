// ============================================================================
//  ui.js – Menü (Datenbank, Parks, eigene Bahnen, Hilfe), HUD, Parkpanel, Minikarte
// ============================================================================
import { CATS, COUNTRIES } from './specs.js';
import { WEATHERS } from './env.js';
import { getTrack } from './park.js';
import { ZONES } from './phantasia.js';
import { plUi } from './pl_ui.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n, d = 0) => (n === undefined || n === null || Number.isNaN(n)) ? '–' : Number(n).toLocaleString('de-DE', { maximumFractionDigits: d });
const flag = cc => cc.toUpperCase().replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0)));
const cname = cc => (COUNTRIES[cc] ? COUNTRIES[cc][0] : cc);
const tlabel = cat => (CATS[cat] ? CATS[cat].label : cat);

export const CAM_LIST = [
  ['fp', 'First-Person (Zugmitte)'], ['front', 'Erster Sitz'], ['rear', 'Letzter Sitz'],
  ['outside', 'Außenkamera (TV)'], ['chase', 'Verfolger'], ['drone', 'Drohne'], ['free', 'Freie Kamera'], ['station', 'Stationskamera'],
];

export class UI {
  constructor(app) {
    this.app = app;
    this.f = { q: '', cc: '', park: '', cat: '', v: 0, h: 0, inv: 0, fav: false, sort: 'h', dir: -1 };
    this.sel = null;
    this.root = $('#app');
    this.build();
  }

  build() {
    const app = this.app;
    this.root.innerHTML = `
    <div id="menu">
      <header>
        <div class="logo"><b>EUROPA</b> COASTER SIMULATOR<small>Alle Achterbahnen Europas · fahren · erkunden · entdecken</small></div>
        <div class="tabs">
          <button class="tab on" data-t="hub">🏠 Start</button>
          <button class="tab" data-t="db">🎢 Datenbank</button>
          <button class="tab" data-t="parks">🏰 Parks</button>
          <button class="tab" data-t="pl">🎡 Phantasialand</button>
          <button class="tab" data-t="online">🌐 Online</button>
          <button class="tab" data-t="help">⚙ Einstellungen</button>
        </div>
        <div class="env">
          <label>🕒 Zeit <input id="mTime" type="range" min="0" max="24" step="0.1"><span id="mTimeV"></span></label>
          <label>☁ <select id="mWeather"></select></label>
          <button class="btn sm hide" id="mBack">⏎ Zurück zur Fahrt</button>
        </div>
      </header>
      <div class="mbody" id="mbody"></div>
    </div>
    <div id="hud" class="hide">
      <div id="hTL" class="hudbox"><div class="n" id="hName"></div><div class="p" id="hPark"></div><div class="p hide" id="hNet" style="color:var(--acc2)"></div></div>
      <div id="chat" class="hide"><div id="chatLog"></div><input id="chatIn" maxlength="200" placeholder="Enter = Chat"></div>
      <div id="hTR"><button class="btn sm rnd" id="bTouch" title="Touch-Steuerung an/aus">👆</button><button class="btn sm rnd" id="bPhoto" title="Foto (K)">📷</button><button class="btn sm rnd" id="bMap" title="Parkkarte (M)">🗺</button><button class="btn sm rnd" id="bPark" title="Park erkunden">🏞</button><button class="btn sm rnd" id="bSnd" title="Ton">🔊</button><button class="btn sm rnd" id="bHelp" title="Steuerung">❓</button><button class="btn sm rnd" id="bMenu" title="Menü (Esc)">☰</button></div>
      <div id="hCams" class="hudbox"></div>
      <div id="hGauge" class="hudbox">
        <div class="m"><b id="gH">0</b><small>Höhe m</small></div>
        <div class="spd"><span id="gS">0</span><small>km/h</small></div>
        <div class="m"><b id="gV">1.0</b><small>G vertikal</small></div>
        <div class="m"><b id="gL">0.0</b><small>G seitlich</small></div>
      </div>
      <div id="hBot" class="hudbox">
        <span id="hState" style="min-width:150px">Station</span>
        <div class="prog"><i id="hProg"></i></div>
        <label>🕒 <input id="hTime" type="range" min="0" max="24" step="0.1"></label>
        <label>☁ <select id="hWeather"></select></label>
        <label>⏱ <select id="hSpeed"><option value="1">1×</option><option value="0.5">0,5×</option><option value="2">2×</option><option value="4">4×</option></select></label>
      </div>
      <div id="hCount"></div>
      <div id="replay" class="hudbox hide"><button class="btn sm" id="rpPlay">⏸</button><input id="rpBar" type="range" min="0" max="1000" value="0"><select id="rpSpeed"><option value="0.25">0,25×</option><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select><button class="btn sm" id="rpSave">💾 Fahrt speichern</button><button class="btn sm" id="rpLive">⏹ Live</button><span class="note">REPLAY</span></div>
      <div id="toast"></div>
      <div id="park" class="hudbox hide"><h4 id="pTitle"></h4><div class="modes"><button class="btn sm" data-m="fly">✈ Fliegen</button><button class="btn sm" data-m="walk">🚶 Gehen</button><button class="btn sm" data-m="visitor">👥 Besucher</button></div><div class="list" id="pList"></div></div>
      <div id="mini" class="hudbox hide"><canvas id="miniC" width="260" height="260"></canvas></div>
      <div id="help" class="hudbox hide"></div>
      <div class="crosshair hide" id="cross"></div>
    </div>
    <div id="vign" class="hide"></div>
    <div id="loading"><div class="spin"></div><div class="t" id="lT">Lade …</div><div class="s" id="lS"></div></div>`;
    // Env-Controls
    const wsel = [$('#mWeather'), $('#hWeather')];
    for (const s of wsel) for (const [k, v] of Object.entries(WEATHERS)) s.insertAdjacentHTML('beforeend', `<option value="${k}">${v.label}</option>`);
    const timeEls = [$('#mTime'), $('#hTime')];
    const setTime = v => { app.env.setTime(+v); timeEls.forEach(e => e.value = v); $('#mTimeV').textContent = this.clock(+v); app.saveSettings(); };
    timeEls.forEach(e => e.addEventListener('input', () => setTime(e.value)));
    wsel.forEach(s => s.addEventListener('change', () => { app.env.setWeather(s.value); wsel.forEach(x => x.value = s.value); app.saveSettings(); }));
    $('#hSpeed').addEventListener('change', e => { app.timeScale = +e.target.value; });
    setTime(app.env.hour); wsel.forEach(x => x.value = app.env.weatherName);
    // Tabs
    this.root.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => this.tab(t.dataset.t)));
    $('#mBack').addEventListener('click', () => app.resume());
    $('#bMenu').addEventListener('click', () => app.showMenu());
    $('#bMap').addEventListener('click', () => app.openMapOrMini());
    $('#bPhoto').addEventListener('click', () => app.game.takePhoto('Foto'));
    $('#bTouch').addEventListener('click', () => { const on = !app.touch.on; app.settings.touch = on; app.touch.setEnabled(on); app.saveSettings(); this.toast(on ? '👆 Touch-Steuerung an' : 'Touch-Steuerung aus'); });
    $('#rpSave').addEventListener('click', () => { if (app.replay && app.game.saveRide(app.replay.rec, app.ride)) this.toast('💾 Fahrt gespeichert (Fotoalbum → Gespeicherte Fahrten)'); });
    $('#bPark').addEventListener('click', () => app.toPark());
    $('#bSnd').addEventListener('click', () => { const on = app.audio.toggle(); $('#bSnd').textContent = on ? '🔊' : '🔇'; });
    $('#bHelp').addEventListener('click', () => this.toggleHelp());
    // Kameraliste
    const cams = $('#hCams');
    const tr = document.createElement('div'); tr.id = 'hTrain'; tr.className = 'hide'; tr.style.cssText = 'display:flex;gap:6px;padding:6px 4px 0;border-top:1px solid var(--line);margin-top:4px;align-items:center;font-size:12px;color:var(--dim)'; cams.appendChild(tr);
    $('#rpPlay').addEventListener('click', () => { if (app.replay) app.replay.playing = !app.replay.playing; });
    $('#rpBar').addEventListener('input', e => { if (app.replay) { app.replay.playing = false; app.replay.t = e.target.value / 1000 * (app.replay.rec.samples.length - 1); } });
    $('#rpSpeed').addEventListener('change', e => { if (app.replay) app.replay.speed = +e.target.value; });
    $('#rpLive').addEventListener('click', () => app.replayExit());
    CAM_LIST.forEach(([id, label], i) => { const b = document.createElement('button'); b.dataset.c = id; b.innerHTML = `<b>${i + 1}</b>${label}`; b.addEventListener('click', () => app.setCamera(id)); cams.appendChild(b); });
    $('#park').querySelectorAll('.modes button').forEach(b => b.addEventListener('click', () => app.setParkMode(b.dataset.m)));
    $('#miniC').addEventListener('click', e => this.miniClick(e));
    this.plBuild();
    this.tab('hub');
  }

  clock(h) { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }

  // ------------------------------------------------------------------ Tabs
  tab(t) {
    this.root.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.dataset.t === t));
    this.curTab = t;
    const body = $('#mbody');
    if (['hub', 'attr', 'hotels', 'food', 'photos', 'stats', 'saves', 'editor'].includes(t)) this.plTab(t, body);
    else if (t === 'custom') this.buildCustom(body);
    else if (t === 'db') this.buildDb(body);
    else if (t === 'parks') this.buildParks(body);
    else if (t === 'pl') this.buildPL(body);
    else if (t === 'online') this.buildOnline(body);
    else if (t === 'custom') this.buildCustom(body);
    else this.buildHelp(body);
  }

  // ------------------------------------------------------------------ Datenbank
  buildDb(body) {
    const db = this.app.db, f = this.f;
    const ccs = [...new Set(db.coasters.map(c => c.cc))].sort((a, b) => cname(a).localeCompare(cname(b)));
    const cats = Object.keys(CATS);
    body.innerHTML = `
    <div class="card dbmain">
      <div class="filters">
        <label class="search">Suche (Name, Park, Hersteller)<input id="fQ" placeholder="z. B. Taron, B&amp;M, Europa-Park …" value="${esc(f.q)}"></label>
        <label>Land<select id="fCc"><option value="">Alle Länder</option>${ccs.map(c => `<option value="${c}">${flag(c)} ${cname(c)}</option>`).join('')}</select></label>
        <label>Freizeitpark<select id="fPark"></select></label>
        <label>Achterbahntyp<select id="fCat"><option value="">Alle Typen</option>${cats.map(c => `<option value="${c}">${CATS[c].label}</option>`).join('')}</select></label>
        <label>Geschwindigkeit ≥<div class="rng"><input id="fV" type="range" min="0" max="190" step="5" value="${f.v}"><span id="fVv"></span></div></label>
        <label>Höhe ≥<div class="rng"><input id="fH" type="range" min="0" max="115" step="5" value="${f.h}"><span id="fHv"></span></div></label>
        <label>Loopings/Inversionen ≥<div class="rng"><input id="fI" type="range" min="0" max="14" step="1" value="${f.inv}"><span id="fIv"></span></div></label>
        <label>Sortierung<select id="fSort"><option value="h">Höhe</option><option value="len">Länge</option><option value="v">Geschwindigkeit</option><option value="inv">Inversionen</option><option value="year">Eröffnung</option><option value="name">Name</option><option value="park">Park</option></select></label>
        <label>&nbsp;<span style="display:flex;gap:6px"><button class="btn sm" id="fDir">↓ absteigend</button><button class="btn sm" id="fFav">☆ Favoriten</button><button class="btn sm" id="fReset">Zurücksetzen</button></span></label>
      </div>
      <div class="count"><span id="dbCount"></span><span>Klick auf eine Zeile = Details · Doppelklick = sofort fahren</span></div>
      <div class="tbl"><table><thead><tr id="thead"></tr></thead><tbody id="tbody"></tbody></table></div>
    </div>
    <div class="card detail" id="detail"></div>`;
    $('#fCc').value = f.cc; $('#fCat').value = f.cat; $('#fSort').value = f.sort;
    this.fillParks();
    const upd = () => { $('#fVv').textContent = f.v ? f.v + '' : 'egal'; $('#fHv').textContent = f.h ? f.h + ' m' : 'egal'; $('#fIv').textContent = f.inv ? f.inv + '' : 'egal'; };
    upd();
    const bind = (id, key, num) => $(id).addEventListener('input', e => { f[key] = num ? +e.target.value : e.target.value; if (key === 'cc') { f.park = ''; this.fillParks(); } upd(); this.renderRows(); });
    bind('#fQ', 'q'); bind('#fCc', 'cc'); bind('#fPark', 'park'); bind('#fCat', 'cat'); bind('#fV', 'v', 1); bind('#fH', 'h', 1); bind('#fI', 'inv', 1); bind('#fSort', 'sort');
    $('#fDir').addEventListener('click', () => { f.dir = -f.dir; this.renderRows(); });
    $('#fFav').addEventListener('click', () => { f.fav = !f.fav; this.renderRows(); });
    $('#fReset').addEventListener('click', () => { Object.assign(f, { q: '', cc: '', park: '', cat: '', v: 0, h: 0, inv: 0, fav: false }); this.tab('db'); });
    this.renderRows();
    if (!this.sel) this.sel = db.coasters.find(c => c.name === 'Silver Star') || db.coasters[0];
    this.showDetail(this.sel);
  }

  fillParks() {
    const db = this.app.db, f = this.f, sel = $('#fPark');
    const parks = Object.values(db.parks).filter(p => !f.cc || p.cc === f.cc).sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML = '<option value="">Alle Parks</option>' + parks.map(p => `<option value="${esc(p.name)}">${esc(p.name)} (${p.coasters.length})</option>`).join('');
    sel.value = f.park;
  }

  filtered() {
    const f = this.f, q = f.q.trim().toLowerCase();
    const fav = this.app.favs;
    let list = this.app.db.coasters.filter(c =>
      (!f.cc || c.cc === f.cc) && (!f.park || c.park === f.park) && (!f.cat || c.cat === f.cat) &&
      c.v >= f.v && c.h >= f.h && c.inv >= f.inv && (!f.fav || fav.has(c.id)) &&
      (!q || (c.name + ' ' + c.park + ' ' + c.maker + ' ' + c.alias + ' ' + cname(c.cc) + ' ' + tlabel(c.cat) + ' ' + c.year).toLowerCase().includes(q)));
    const k = f.sort, d = f.dir;
    list.sort((a, b) => (typeof a[k] === 'string' ? a[k].localeCompare(b[k]) * d * -1 * -1 : (a[k] - b[k]) * d) || a.name.localeCompare(b.name));
    return list;
  }

  renderRows() {
    const f = this.f, list = this.filtered(), fav = this.app.favs;
    const cols = [['name', 'Name'], ['park', 'Park'], ['cc', 'Land'], ['cat', 'Typ'], ['h', 'Höhe'], ['len', 'Länge'], ['v', 'km/h'], ['inv', 'Inv.'], ['year', 'Jahr']];
    $('#thead').innerHTML = '<th></th>' + cols.map(([k, l]) => `<th data-k="${k}" class="${f.sort === k ? 's' : ''}" data-d="${f.dir < 0 ? '▼' : '▲'}">${l}</th>`).join('');
    $('#thead').querySelectorAll('th[data-k]').forEach(th => th.addEventListener('click', () => { const k = th.dataset.k; if (['name', 'park', 'h', 'len', 'v', 'inv', 'year'].includes(k)) { if (f.sort === k) f.dir = -f.dir; else { f.sort = k; f.dir = (k === 'name' || k === 'park') ? 1 : -1; } $('#fSort').value = f.sort; this.renderRows(); } }));
    $('#fDir').textContent = f.dir < 0 ? '↓ absteigend' : '↑ aufsteigend';
    $('#fFav').textContent = f.fav ? '★ Favoriten' : '☆ Favoriten';
    $('#dbCount').textContent = `${list.length} von ${this.app.db.coasters.length} Achterbahnen`;
    $('#tbody').innerHTML = list.map(c => `<tr class="row ${this.sel && this.sel.id === c.id ? 'sel' : ''}" data-id="${c.id}">
      <td>${fav.has(c.id) ? '★' : ''}</td>
      <td><span class="dot" style="background:${c.trackColor}"></span><b>${esc(c.name)}</b></td><td>${esc(c.park)}</td><td>${flag(c.cc)} ${cname(c.cc)}</td>
      <td><span class="chip">${tlabel(c.cat)}</span></td><td class="num">${fmt(c.h)} m</td><td class="num">${fmt(c.len)} m</td><td class="num">${fmt(c.v)}</td><td class="num">${c.inv}</td><td class="num">${c.year || '–'}</td></tr>`).join('') ||
      '<tr><td colspan="10" style="padding:30px;text-align:center;color:var(--dim)">Keine Treffer – Filter anpassen.</td></tr>';
    const byId = new Map(this.app.db.coasters.map(c => [c.id, c]));
    $('#tbody').querySelectorAll('tr.row').forEach(tr => {
      tr.addEventListener('click', () => { this.sel = byId.get(tr.dataset.id); $('#tbody').querySelectorAll('tr.row').forEach(x => x.classList.toggle('sel', x === tr)); this.showDetail(this.sel); });
      tr.addEventListener('dblclick', () => this.app.openRide(byId.get(tr.dataset.id)));
    });
  }

  showDetail(c) {
    const el = $('#detail'); if (!el || !c) return;
    const fav = this.app.favs.has(c.id);
    el.innerHTML = `
      <div><h2>${esc(c.name)}</h2><div class="sub">${esc(c.park)} · ${flag(c.cc)} ${cname(c.cc)} · ${tlabel(c.cat)}</div></div>
      <div class="stats">
        <div class="stat"><b>${fmt(c.h)} m</b><small>Höhe</small></div><div class="stat"><b>${fmt(c.len)} m</b><small>Länge</small></div><div class="stat"><b>${fmt(c.v)} km/h</b><small>Tempo</small></div>
        <div class="stat"><b>${c.inv}</b><small>Inversionen</small></div><div class="stat"><b>${Math.floor(c.dur / 60)}:${String(c.dur % 60).padStart(2, '0')}</b><small>Dauer</small></div><div class="stat"><b>${c.year || '–'}</b><small>Eröffnung</small></div>
      </div>
      <div class="kv"><span>Hersteller</span><span>${esc(c.maker)}</span><span>Zug</span><span>${CATS[c.cat].cars} Wagen · ${CATS[c.cat].cars * (CATS[c.cat].rows || 1) * CATS[c.cat].across} Plätze</span><span>Streckenlayout</span><span>${c.layout ? 'handgebaut' : 'automatisch erzeugt'} (stilisiert)</span></div>
      <canvas id="pvTop" width="440" height="200"></canvas>
      <canvas id="pvSide" width="440" height="90"></canvas>
      <div class="acts"><button class="btn pri" id="dRide">▶ Fahren</button><button class="btn blue" id="dPark">🏞 Park erkunden</button><button class="btn" id="dFav">${fav ? '★ Favorit' : '☆ Favorit'}</button></div>
      <div class="note">Werte gerundet / ohne Gewähr. Das Layout ist eine stilisierte Nachbildung (Höhe, Länge, Tempo, Inversionen, Farben) – keine maßstabsgetreue Vermessung.${c.custom ? ' <b>Eigene Bahn</b> – <a href="#" id="dDel" style="color:var(--bad)">löschen</a>' : ''}</div>`;
    $('#dRide').addEventListener('click', () => this.app.openRide(c));
    $('#dPark').addEventListener('click', () => this.app.openPark(c.park));
    $('#dFav').addEventListener('click', () => { this.app.toggleFav(c.id); this.showDetail(c); this.renderRows(); });
    const del = $('#dDel'); if (del) del.addEventListener('click', e => { e.preventDefault(); this.app.removeCustom(c); });
    requestAnimationFrame(() => { try { this.drawPreview(c); } catch (e) { console.warn(e); } });
  }

  drawPreview(c) {
    const tr = getTrack(c);
    const top = $('#pvTop'), side = $('#pvSide'); if (!top || !side) return;
    const g = top.getContext('2d'), w = top.width, h = top.height;
    g.clearRect(0, 0, w, h);
    const b = tr.bounds, sx = (w - 30) / Math.max(10, b.maxX - b.minX), sz = (h - 30) / Math.max(10, b.maxZ - b.minZ), s = Math.min(sx, sz);
    const ox = (w - (b.maxX - b.minX) * s) / 2 - b.minX * s, oz = (h - (b.maxZ - b.minZ) * s) / 2 - b.minZ * s;
    g.lineWidth = 2.2; g.lineCap = 'round';
    const hmax = Math.max(1, b.maxY);
    for (let i = 0; i < tr.N; i += 2) {
      const j = (i + 2) % tr.N;
      const t = tr.P[i * 3 + 1] / hmax;
      g.strokeStyle = `hsl(${200 - t * 170},85%,${52 + t * 8}%)`;
      g.beginPath(); g.moveTo(tr.P[i * 3] * s + ox, tr.P[i * 3 + 2] * s + oz); g.lineTo(tr.P[j * 3] * s + ox, tr.P[j * 3 + 2] * s + oz); g.stroke();
    }
    g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText('Station', ox + 4, oz - 6); g.beginPath(); g.arc(ox, oz, 3.5, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText('Draufsicht', 8, h - 8);
    const g2 = side.getContext('2d'), w2 = side.width, h2 = side.height;
    g2.clearRect(0, 0, w2, h2); g2.strokeStyle = 'rgba(255,255,255,.15)'; g2.beginPath(); g2.moveTo(0, h2 - 12.5); g2.lineTo(w2, h2 - 12.5); g2.stroke();
    g2.beginPath(); g2.strokeStyle = '#ffb020'; g2.lineWidth = 2;
    for (let i = 0; i < tr.N; i++) { const x = i / tr.N * (w2 - 10) + 5, y = h2 - 12 - tr.P[i * 3 + 1] / hmax * (h2 - 24); if (i) g2.lineTo(x, y); else g2.moveTo(x, y); }
    g2.stroke(); g2.fillStyle = 'rgba(255,255,255,.55)'; g2.font = '11px sans-serif'; g2.fillText(`Höhenprofil · max. ${fmt(hmax)} m (Modell) · Strecke ${fmt(tr.L)} m (Modell)`, 8, 12);
  }

  // ------------------------------------------------------------------ Parks
  buildParks(body) {
    const db = this.app.db;
    const parks = Object.values(db.parks).sort((a, b) => cname(a.cc).localeCompare(cname(b.cc)) || a.name.localeCompare(b.name));
    body.innerHTML = `<div class="card page"><div class="pgrid">${parks.map(p => `
      <div class="card pcard"><h3>${esc(p.name)}</h3><div class="sub" style="color:var(--dim);font-size:13px">${flag(p.cc)} ${cname(p.cc)}${p.city ? ' · ' + esc(p.city) : ''}</div>
      <div class="chips">${p.coasters.map(c => `<span class="chip" style="border-left:4px solid ${c.trackColor}">${esc(c.name)}</span>`).join('')}</div>
      <div class="acts"><button class="btn blue" data-p="${esc(p.name)}">🏞 Park erkunden</button></div></div>`).join('')}</div></div>`;
    body.querySelectorAll('button[data-p]').forEach(b => b.addEventListener('click', () => this.app.openPark(b.dataset.p)));
  }

  // ------------------------------------------------------------------ Phantasialand
  plThumb(c, zone) {
    const cv = document.createElement('canvas'); cv.width = 360; cv.height = 170; const g = cv.getContext('2d');
    const pal = { klugheim: ['#2a3340', '#6a7584', '#3a4048'], africa: ['#12331c', '#2f6a35', '#1a3a20'], rookburgh: ['#3a302c', '#8a5a3a', '#2a2422'], mexico: ['#e8a860', '#c2683a', '#8a4a2a'], fantasy: ['#7ab8e8', '#9a6ad0', '#4a8a4a'] }[zone] || ['#4a6a8a', '#6a8a6a', '#3a5a3a'];
    const sky = g.createLinearGradient(0, 0, 0, 170); sky.addColorStop(0, pal[0]); sky.addColorStop(1, pal[1]); g.fillStyle = sky; g.fillRect(0, 0, 360, 170);
    // Hintergrund-Silhouetten
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.moveTo(0, 130); for (let x = 0; x <= 360; x += 12) g.lineTo(x, 100 + Math.sin(x * 0.05 + zone.length) * 18 + Math.sin(x * 0.17) * 8); g.lineTo(360, 170); g.lineTo(0, 170); g.fill();
    if (zone === 'klugheim') { g.fillStyle = '#ff6a20'; g.globalAlpha = .8; g.beginPath(); g.arc(290, 80, 10, 0, 7); g.fill(); g.globalAlpha = 1; }
    const tr = getTrack(c), hm = Math.max(1, tr.bounds.maxY);
    g.strokeStyle = c.trackColor; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath();
    for (let i = 0; i < tr.N; i += 2) { const x = 14 + i / tr.N * 332, y = 148 - tr.P[i * 3 + 1] / hm * 95; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke(); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = pal[2]; g.fillRect(0, 148, 360, 22);
    for (let x = 6; x < 360; x += 18) { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.moveTo(x, 148); g.lineTo(x + 7, 132 - (x * 7 % 14)); g.lineTo(x + 14, 148); g.fill(); }
    g.fillStyle = 'rgba(8,14,26,.72)'; g.fillRect(0, 0, 360, 30); g.fillStyle = '#fff'; g.font = '700 16px "Segoe UI", sans-serif'; g.fillText(c.name, 10, 20);
    return cv;
  }
  buildPL(body) {
    const app = this.app, db = app.db, park = db.parks['Phantasialand'];
    body.innerHTML = `<div class="card page" id="plPage"><div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
      <div style="flex:1;min-width:300px"><h3 style="margin:0 0 4px;font-size:22px">🎡 Phantasialand <span class="chip">Brühl · Deutschland</span></h3>
      <div class="note">Handgebaute, begehbare Nachbildung im Stil des Parks (stilisiert, nicht maßstabsgetreu): Klugheim, Deep in Africa, Rookburgh, Mexico und Fantasy mit Felsen, Schluchten, Vulkan, Wasserfällen, Brücken, begehbaren Gebäuden, Nebel und Nachtbeleuchtung. Die Zuordnung der Bahnen zu den Themenbereichen ist nach bestem Wissen.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn pri" id="plWalk">🚶 Freie Erkundung (Laufen)</button><button class="btn blue" id="plFly">✈ Fliegen</button><button class="btn" id="plNight">🌙 Nacht (23:30)</button><button class="btn" id="plDusk">🌅 Sonnenuntergang (19:40)</button><button class="btn" id="plNoon">☀ Mittag (13:00)</button></div>
      <div style="margin-top:10px" class="note">🦅 Vogelperspektive: ${Object.entries(ZONES).filter(([k]) => k !== 'berlin').map(([k, z]) => `<button class="btn sm" data-bz="${k}">${z.name}</button>`).join(' ')}</div></div>
      <div style="min-width:240px"><label class="note">🕒 Uhrzeit <span id="plClock"></span><br><input id="plTime" type="range" min="0" max="24" step="0.1" style="width:240px"></label></div></div>
      <div class="filters" style="padding:12px 0"><label class="search" style="grid-column:span 2">Suche<input id="plQ" placeholder="Bahn, Themenbereich …"></label><label>&nbsp;<button class="btn sm" id="plFav">☆ Nur Favoriten</button></label></div>
      <div class="pgrid" id="plGrid"></div></div>`;
    const st = { q: '', fav: false };
    const render = () => {
      const q = st.q.toLowerCase(), grid = $('#plGrid'); grid.innerHTML = '';
      const list = park.coasters.filter(c => c.kind === 'Achterbahn' && (!st.fav || app.favs.has(c.id)) && (!q || (c.name + ' ' + c.area + ' ' + c.maker + ' ' + c.alias + ' ' + tlabel(c.cat)).toLowerCase().includes(q)));
      for (const c of list) {
        const zone = { 'Klugheim': 'klugheim', 'Deep in Africa': 'africa', 'Rookburgh': 'rookburgh', 'Mexico': 'mexico', 'Fantasy': 'fantasy' }[c.area] || 'fantasy';
        const el = document.createElement('div'); el.className = 'card pcard'; el.style.padding = '0'; el.style.overflow = 'hidden';
        const th = this.plThumb(c, zone); th.style.cssText = 'width:100%;display:block'; el.appendChild(th);
        const inf = document.createElement('div'); inf.style.cssText = 'padding:10px 12px;display:flex;flex-direction:column;gap:6px';
        inf.innerHTML = `<div><b style="font-size:16px">${esc(c.name)}</b> <span class="chip">${esc(c.area || '–')}</span></div><div class="note">${tlabel(c.cat)} · ${esc(c.maker)} · ${c.year || '–'}<br>${fmt(c.h)} m hoch · ${fmt(c.len)} m · ${fmt(c.v)} km/h · ${c.inv} Inv. · ${(c.trains || 1)} Zug/Züge</div>
          <div class="acts"><button class="btn pri" data-r="1">▶ Fahren</button><button class="btn blue" data-v="1">👁 Ansehen</button><button class="btn" data-f="1">${app.favs.has(c.id) ? '★' : '☆'}</button></div>`;
        el.appendChild(inf);
        inf.querySelector('[data-r]').addEventListener('click', () => app.openRide(c));
        inf.querySelector('[data-v]').addEventListener('click', async () => { await app.openPark('Phantasialand'); const r = app.park.rides.find(x => x.coaster.id === c.id); if (r) app.flyTo(r); });
        inf.querySelector('[data-f]').addEventListener('click', () => { app.toggleFav(c.id); render(); });
        grid.appendChild(el);
      }
      if (!list.length) grid.innerHTML = '<div class="note" style="padding:20px">Keine Treffer.</div>';
    };
    render();
    $('#plQ').addEventListener('input', e => { st.q = e.target.value; render(); });
    $('#plFav').addEventListener('click', e => { st.fav = !st.fav; e.target.textContent = st.fav ? '★ Nur Favoriten' : '☆ Nur Favoriten'; render(); });
    $('#plWalk').addEventListener('click', () => app.phantasia('walk'));
    $('#plFly').addEventListener('click', () => app.phantasia('fly'));
    const setT = h => { app.env.setTime(h); this.syncEnv(); app.saveSettings(); $('#plClock').textContent = this.clock(h); $('#plTime').value = h; };
    $('#plNight').addEventListener('click', () => setT(23.5)); $('#plDusk').addEventListener('click', () => setT(19.7)); $('#plNoon').addEventListener('click', () => setT(13));
    $('#plTime').addEventListener('input', e => setT(+e.target.value)); setT(app.env.hour);
    body.querySelectorAll('[data-bz]').forEach(b => b.addEventListener('click', async () => { await app.openPark('Phantasialand'); app.birdsEye(b.dataset.bz); }));
  }
  setTrains(r) {
    const el = $('#hTrain'); if (!el) return;
    if (!r || !r.sets || r.sets.length < 2) { el.classList.add('hide'); return; }
    el.classList.remove('hide'); el.innerHTML = 'Zug: ' + r.sets.map((s, i) => `<button class="btn sm ${s.sim === r.sim ? 'pri' : ''}" data-t="${i}">${i + 1}</button>`).join('') + ' <span style="margin-left:4px">[ ]</span>';
    el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => this.app.selectTrain(+b.dataset.t)));
  }
  replayShow(on) { $('#replay').classList.toggle('hide', !on); }
  replayUpdate(f, playing) { $('#rpBar').value = Math.round(f * 1000); $('#rpPlay').textContent = playing ? '⏸' : '▶'; }

  // ------------------------------------------------------------------ Online
  buildOnline(body) {
    const app = this.app, net = app.net;
    const room = new URLSearchParams(location.search).get('room') || '';
    const name = ((app.account && app.account.name) || app.settings.name || '').trim(), locked = !!(app.account && app.account.token);
    body.innerHTML = `<div class="card page help"><h3 style="margin-top:0">🌐 Online-Modus</h3>
      <div class="note">Gemeinsam Parks erkunden und im selben Zug fahren – über einen kleinen WebSocket-Relay auf Cloudflare (Worker + Durable Object, kein Spielserver nötig – der Host betreibt die Simulation). Der Host bestimmt Park, Tageszeit und Wetter und betreibt die Bahnen; alle sehen dieselben Züge, Mitspieler erscheinen als Avatare oder sitzen im Zug. Chat: <kbd>Enter</kbd>.</div>
      <div class="form" id="onForm" style="margin-top:12px">
        <label>Dein Name${locked ? ' (Konto)' : ''}<br><input id="onName" maxlength="14" placeholder="Spieler" value="${esc(name)}" ${locked ? 'readonly' : ''}></label>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
          <button class="btn pri" id="onHost">🏠 Raum eröffnen (Host)</button>
          <span style="color:var(--dim)">oder</span>
          <label>Raum-Code<br><input id="onCode" maxlength="5" style="text-transform:uppercase;width:120px;letter-spacing:4px;text-align:center" value="${esc(room.toUpperCase())}"></label>
          <button class="btn blue" id="onJoin">➜ Beitreten</button>
        </div>
        <div id="onMsg" class="note"></div>
      </div>
      <div id="onRoom"></div></div>`;
    $('#onHost').addEventListener('click', async () => {
      app.settings.name = $('#onName').value.trim(); app.saveSettings(); app.audio.start();
      $('#onMsg').textContent = 'Raum wird eröffnet …';
      try { await net.host(app.settings.name || 'Host'); await app.openPark('Phantasialand'); app.setParkMode('walk'); this.refreshNet(); } catch (e) { $('#onMsg').textContent = '✖ ' + e.message; }
    });
    $('#onJoin').addEventListener('click', async () => {
      app.settings.name = $('#onName').value.trim(); app.saveSettings(); app.audio.start();
      const code = $('#onCode').value.trim(); if (code.length < 4) { $('#onMsg').textContent = 'Bitte Raum-Code eingeben.'; return; }
      $('#onMsg').textContent = 'Verbinde …';
      try { await net.join(code, app.settings.name || 'Gast'); } catch (e) { $('#onMsg').textContent = '✖ ' + e.message; }
    });
    this.refreshNet();
  }
  refreshNet(chatOnly) {
    const net = this.app.net, active = net.active;
    const hn = $('#hNet'); if (hn) { hn.classList.toggle('hide', !active); hn.textContent = active ? `🌐 Raum ${net.code} · ${net.players.length} Spieler` : ''; }
    const chat = $('#chat'); if (chat) {
      chat.classList.toggle('hide', !active);
      const lg = $('#chatLog'); lg.innerHTML = net.log.slice(-7).map(l => `<div style="color:${l.color}">${esc(l.text)}</div>`).join('');
    }
    const el = $('#onRoom'); if (!el || chatOnly === true) return;
    if (!active) { el.innerHTML = net.status ? `<div class="note" style="margin-top:12px">${esc(net.status)}</div>` : ''; return; }
    el.innerHTML = `<h3>Raum <span style="letter-spacing:4px;color:var(--acc)">${net.code}</span> · ${net.isHost ? 'du bist Host' : 'verbunden'}</h3>
      ${net.isHost ? `<div class="note">Einladungslink: <input id="onLink" readonly style="width:min(480px,90%)" value="${esc(net.link)}"> <button class="btn sm" id="onCopy">Kopieren</button></div>` : '<div class="note">Park, Tageszeit und Wetter bestimmt der Host.</div>'}
      <div class="chips" style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0">${net.players.map(p => `<span class="chip" style="border-left:4px solid ${p.color}">${esc(p.name)}${p.local ? ' (du)' : ''}</span>`).join('')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn blue" id="onPark">🏞 Zum Park</button><button class="btn" id="onLeave">Raum verlassen</button></div>
      ${net.isHost ? '<div class="note" style="margin-top:8px">Tipp: Wähle in der Datenbank „Park erkunden“ oder eine Bahn – alle Mitspieler folgen dir in denselben Park.</div>' : ''}`;
    $('#onLeave').addEventListener('click', () => net.leave());
    $('#onPark').addEventListener('click', () => { if (this.app.park) this.app.enterPark(); });
    const cp = $('#onCopy'); if (cp) cp.addEventListener('click', () => { const i = $('#onLink'); i.select(); try { navigator.clipboard.writeText(i.value); } catch (e) { document.execCommand('copy'); } cp.textContent = '✔ Kopiert'; });
  }
  syncEnv() {
    const h = this.app.env.hour; document.querySelectorAll('#mTime,#hTime').forEach(e => e.value = h); const v = $('#mTimeV'); if (v) v.textContent = this.clock(h);
    document.querySelectorAll('#mWeather,#hWeather').forEach(e => e.value = this.app.env.weatherName);
  }

  // ------------------------------------------------------------------ Eigene Bahn
  buildCustom(body) {
    const tpl = JSON.stringify({ park: 'Mein Park', cc: 'DE', rows: [['Meine Bahn', 'hyper', 'Hersteller', 2026, 60, 1200, 110, 120, 2, { tc: '#e8202e', sc: '#e8e8ee', layout: 'ST LIFT:60:40 DROP:58:62 HILL:20:110 TR:180:55:60 LOOP:25 TL:180:50:50 BRAKE:30:5' }]] }, null, 1);
    body.innerHTML = `<div class="card page help"><h3 style="margin-top:0">Eigene Achterbahn hinzufügen</h3>
    <div class="note">Das Spiel ist erweiterbar: Trage eine Bahn als JSON ein (wird im Browser gespeichert und taucht in Datenbank, Suche und Park auf). Ohne <code>layout</code> wird automatisch ein Streckenverlauf aus Typ, Höhe, Länge und Inversionen erzeugt.
    Dauerhaft erweitern: Dateien in <code>coaster/src/data/</code> ergänzen (Format identisch) und in <code>data/index.js</code> eintragen.</div>
    <div class="form"><textarea id="cJson" spellcheck="false">${esc(tpl)}</textarea><div><button class="btn pri" id="cAdd">Hinzufügen</button> <span id="cMsg" class="note"></span></div></div>
    <h3>Layout-Sprache</h3>
    <pre class="code">ST[:L]  Station            S:L  Gerade           LIFT:H[:Winkel[:m/s]]  Kettenlift
DROP:H[:Winkel]  Abfahrt   CLIMB:H[:Winkel]  freier Anstieg   PIT:Winkel[:R]  Neigung
HILL:h:L  Airtime-Hügel (h&lt;0 = Senke)   TR|TL:Grad:Radius[:Bank]  Kurve rechts/links
HELR|HELL:Umdrehungen:R:Bank:Höhenverlust   LOOP:H   CORK:L:R   BARREL:L:h   IMM:H  DIVE:H  COBRA:H
TOPHAT:H[:R]  LAUNCH:Länge:km/h   BRAKE:Länge[:m/s]   ROLL:Bank[:L]
Am Ende wird die Strecke automatisch zur Station zurückgeführt.</pre>
    <h3>Typen</h3><div class="note">${Object.entries(CATS).map(([k, v]) => `<code>${k}</code> = ${v.label}`).join(' · ')}</div></div>`;
    $('#cAdd').addEventListener('click', () => {
      try { const j = JSON.parse($('#cJson').value); this.app.addCustom(j); $('#cMsg').textContent = '✔ Hinzugefügt – siehe Datenbank.'; $('#cMsg').style.color = 'var(--ok)'; }
      catch (e) { $('#cMsg').textContent = '✖ ' + e.message; $('#cMsg').style.color = 'var(--bad)'; }
    });
  }

  // ------------------------------------------------------------------ Hilfe & Einstellungen
  helpHtml() {
    return `<div class="two">
      <div><h3>Fahren</h3><table>
        <tr><td><kbd>1</kbd>–<kbd>8</kbd></td><td>Kamera: First-Person · Erster Sitz · Letzter Sitz · Außen · Verfolger · Drohne · Frei · Station</td></tr>
        <tr><td><kbd>V</kbd></td><td>Replay der letzten Fahrt (Leertaste = Pause) · <kbd>[</kbd> <kbd>]</kbd> Zug wechseln</td></tr>
        <tr><td><kbd>C</kbd></td><td>Kamera weiterschalten</td></tr>
        <tr><td><kbd>Maus ziehen</kbd></td><td>Umschauen / Drohne drehen</td></tr>
        <tr><td><kbd>Mausrad</kbd></td><td>Zoom / Drohnen-Abstand</td></tr>
        <tr><td><kbd>Leertaste</kbd></td><td>In der Station: aussteigen · sonst Blick zentrieren</td></tr><tr><td><kbd>G</kbd></td><td>In der Station: sofort losfahren (sonst automatisch nach dem Countdown)</td></tr>
        <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Sitzplatz links/rechts · <kbd>↑</kbd> <kbd>↓</kbd> Wagen vor/zurück</td></tr>
        <tr><td><kbd>W A S D</kbd> <kbd>Q E</kbd></td><td>Freie Kamera / Fliegen / Gehen (<kbd>Shift</kbd> schneller)</td></tr>
        <tr><td><kbd>E</kbd></td><td>Phantasialand (Gehen): Interagieren – Restaurants, Shops, Hotels, Ticketscanner, Bahn-Eingang</td></tr>
        <tr><td><kbd>M</kbd></td><td>Phantasialand: große Parkkarte (Suche, Filter, Navigation) · sonst Minikarte</td></tr>
        <tr><td><kbd>K</kbd></td><td>Foto aufnehmen (Fotoalbum)</td></tr>
        <tr><td>Gehen</td><td>Klick = Maus einfangen · Maus = Umsehen · <kbd>Leertaste</kbd> springen · <kbd>Mausrad</kbd> zoomen · <kbd>Esc</kbd> Menü</td></tr></table></div>
      <div><h3>Allgemein</h3><table>
        <tr><td><kbd>P</kbd></td><td>Pause</td></tr><tr><td><kbd>Tab</kbd></td><td>Park-Ansicht (Erkunden)</td></tr>
        <tr><td><kbd>T</kbd></td><td>Tageszeit weiter · <kbd>R</kbd> Wetter weiter</td></tr><tr><td><kbd>H</kbd></td><td>HUD aus/an</td></tr>
        <tr><td><kbd>F</kbd></td><td>Vollbild</td></tr><tr><td><kbd>N</kbd></td><td>Nächster Besucher (Besucher-Modus)</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>Menü / Datenbank</td></tr></table></div></div>`;
  }
  buildHelp(body) {
    const a = this.app, s = a.settings;
    body.innerHTML = `<div class="card page help"><h3 style="margin-top:0">Einstellungen</h3>
      <div class="form" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
        <label>Grafikqualität<br><select id="sQ"><option value="low">Niedrig</option><option value="medium">Mittel</option><option value="high">Hoch</option></select></label>
        <label>Schatten<br><select id="sSh"><option value="1">An</option><option value="0">Aus</option></select></label>
        <label>Sichtfeld (FOV) <span id="sFovV">${s.fov}</span>°<br><input id="sFov" type="range" min="55" max="100" value="${s.fov}"></label>
        <label>Mausempfindlichkeit<br><input id="sSens" type="range" min="0.3" max="2.5" step="0.1" value="${s.sens}"></label>
        <label>Lautstärke<br><input id="sVol" type="range" min="0" max="1" step="0.05" value="${s.vol}"></label>
        <label>Tageszyklus (automatisch)<br><select id="sAuto"><option value="0">Aus</option><option value="1">An (1 Spielstunde = 1 Minute)</option></select></label>
        <label>Onride-Fotos<br><select id="sPhoto"><option value="1">Automatisch</option><option value="0">Aus</option></select></label>
        <label>Grafikstil „Vice-City-Look“ (Bloom, Farbkorrektur)<br><select id="sLook"><option value="1">An</option><option value="0">Aus (schneller)</option></select></label>
        <label>Spielerfarbe (Shirt)<br><input type="color" id="sCol" value="${s.playerColor || '#1e88e5'}"></label>
        <label>Ambient Occlusion (Schattierung in Ecken, braucht starke GPU)<br><select id="sAO"><option value="0">Aus</option><option value="1">An</option></select></label>
        <label>Touch-Steuerung (Tablet/Handy)<br><select id="sTouch"><option value="1">An</option><option value="0">Aus</option></select></label>
      </div><div class="note">Qualitätsänderungen (Bäume, Besucher) gelten ab dem nächsten Parkwechsel.</div>${this.helpHtml()}
      <h3>Über dieses Spiel</h3><div class="note">Alle Modelle, Texturen und Geräusche entstehen zur Laufzeit im Browser (three.js, keine externen Assets). Streckenlayouts sind stilisierte Nachbildungen auf Basis von Höhe, Länge, Geschwindigkeit, Inversionen und Typ; Stammdaten sind gerundete Näherungswerte ohne Gewähr. Alle Markennamen gehören ihren Inhabern.</div></div>`;
    $('#sQ').value = s.quality; $('#sSh').value = s.shadows ? '1' : '0';
    $('#sLook').value = a.lookOn() ? '1' : '0'; $('#sLook').addEventListener('change', e => { s.look = e.target.value === '1'; a.saveSettings(); a.applyQuality(); });
    $('#sCol').addEventListener('input', e => { s.playerColor = e.target.value; a.player.setColor(s.playerColor); a.saveSettings(); });
    $('#sAO').value = s.ao ? '1' : '0'; $('#sAO').addEventListener('change', e => { s.ao = e.target.value === '1'; a.saveSettings(); a.applyQuality(); });
    $('#sAuto').value = s.autoTime ? '1' : '0'; $('#sPhoto').value = s.autoPhoto === false ? '0' : '1'; $('#sTouch').value = a.touch && a.touch.on ? '1' : '0';
    $('#sAuto').addEventListener('change', e => { s.autoTime = e.target.value === '1'; a.saveSettings(); });
    $('#sPhoto').addEventListener('change', e => { s.autoPhoto = e.target.value === '1'; a.saveSettings(); });
    $('#sTouch').addEventListener('change', e => { s.touch = e.target.value === '1'; a.touch.setEnabled(s.touch); a.saveSettings(); });
    $('#sQ').addEventListener('change', e => { s.quality = e.target.value; a.saveSettings(); a.applyQuality(); });
    $('#sSh').addEventListener('change', e => { s.shadows = e.target.value === '1'; a.saveSettings(); a.applyQuality(); });
    $('#sFov').addEventListener('input', e => { s.fov = +e.target.value; $('#sFovV').textContent = s.fov; a.saveSettings(); });
    $('#sSens').addEventListener('input', e => { s.sens = +e.target.value; a.saveSettings(); });
    $('#sVol').addEventListener('input', e => { s.vol = +e.target.value; a.audio.setVolume(s.vol); a.saveSettings(); });
  }
  toggleHelp() { const h = $('#help'); if (h.classList.contains('hide')) { h.innerHTML = `<h3 style="margin-top:0;color:var(--acc)">Steuerung</h3>${this.helpHtml()}<div style="margin-top:14px"><button class="btn" id="hClose">Schließen</button></div>`; h.classList.remove('hide'); $('#hClose').addEventListener('click', () => h.classList.add('hide')); } else h.classList.add('hide'); }

  // ------------------------------------------------------------------ HUD
  setMode(mode) {
    const menu = mode === 'menu';
    $('#menu').classList.toggle('hide', !menu);
    $('#hud').classList.toggle('hide', menu);
    $('#vign').classList.toggle('hide', menu || mode !== 'ride');
    $('#hCams').classList.toggle('hide', mode !== 'ride');
    $('#hGauge').classList.toggle('hide', mode !== 'ride');
    $('#hTL').classList.toggle('hide', false);
    $('#park').classList.toggle('hide', mode !== 'park');
    $('#bPark').classList.toggle('hide', mode === 'park');
    $('#cross').classList.toggle('hide', true);
    if (mode !== 'ride') { $('#hCount').innerHTML = ''; }
    this.updateWallet(); if (this.app.touch) this.app.touch.refresh();
    if (!menu && !this._miniShown) { this._miniShown = true; $('#mini').classList.remove('hide'); }
    $('#mBack').classList.toggle('hide', !this.app.canResume());
    if (menu) { this.renderRows && this.curTab === 'db' && this.renderRows(); }
  }
  hud(d) {
    $('#gS').textContent = d.kmh.toFixed(0); $('#gH').textContent = d.h.toFixed(0);
    $('#gV').textContent = d.gv.toFixed(1); $('#gL').textContent = d.gl.toFixed(1);
    $('#hProg').style.width = (d.prog * 100).toFixed(1) + '%'; $('#hState').textContent = d.state;
    $('#hCount').innerHTML = d.count ? `<div class="big">${d.count}</div><div class="sm">Leertaste: aussteigen · G: sofort losfahren</div>` : '';
  }
  setRide(c) { $('#hName').textContent = c ? c.name : ''; $('#hPark').textContent = c ? `${c.park} · ${cname(c.cc)}` : ''; }
  setCam(id) { $('#hCams').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.c === id)); }
  toast(t, ms = 2200) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => e.classList.remove('on'), ms); }
  loading(show, t = '', s = '') { const l = $('#loading'); $('#lT').textContent = t; $('#lS').textContent = s; if (show) { l.style.display = 'flex'; l.style.opacity = 1; } else { l.style.opacity = 0; setTimeout(() => { l.style.display = 'none'; }, 400); } }
  toggleMini() { $('#mini').classList.toggle('hide'); }

  // Parkpanel + Minikarte
  setPark(world) {
    $('#pTitle').textContent = world ? `${world.def.name} – Attraktionen` : '';
    const list = $('#pList'); list.innerHTML = '';
    if (!world) return;
    for (const r of world.rides) {
      const c = r.coaster, el = document.createElement('div'); el.className = 'it';
      el.innerHTML = `<span class="dot" style="background:${c.trackColor}"></span><span>${esc(c.name)}</span><small>${c.h} m · ${c.v} km/h</small>`;
      el.title = 'Klick: hinfliegen · Doppelklick: fahren';
      el.addEventListener('click', () => this.app.flyTo(r)); el.addEventListener('dblclick', () => this.app.rideOn(r));
      list.appendChild(el);
    }
    for (const f of world.flats || []) {
      const el = document.createElement('div'); el.className = 'it';
      el.innerHTML = `<span class="dot" style="background:#aaa"></span><span>${esc(f.name)}</span><small>Fahrgeschäft</small>`;
      el.addEventListener('click', () => this.app.flyToXZ(f.x, f.z)); list.appendChild(el);
    }
  }
  drawMini(world, camPos, camYaw) {
    const cv = $('#miniC'); if (!cv || $('#mini').classList.contains('hide') || !world) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, R = world.radius + 150;
    this.mini = { R, W };
    const X = x => W / 2 + x / R * (W / 2 - 4), Z = z => H / 2 + z / R * (H / 2 - 4);
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(40,80,40,.5)'; g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 3, 0, 7); g.fill();
    g.strokeStyle = 'rgba(220,210,180,.7)'; g.lineWidth = 2;
    for (const [a, b] of world.edges) { const A = world.nodes[a], B = world.nodes[b]; g.beginPath(); g.moveTo(X(A.x), Z(A.z)); g.lineTo(X(B.x), Z(B.z)); g.stroke(); }
    for (const m of world.mini) {
      g.strokeStyle = m.ride.coaster.trackColor; g.lineWidth = 1.6; g.beginPath();
      m.pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); g.closePath(); g.stroke();
      const e = m.ride.entrance; g.fillStyle = '#fff'; g.beginPath(); g.arc(X(e.x), Z(e.z), 3, 0, 7); g.fill();
      // Zug
      const p = m.ride.sim; const tr = m.ride.track, i = Math.floor(((p.s / tr.ds) % tr.N + tr.N) % tr.N);
      const th = m.ride.th, lx = tr.P[i * 3], lz = tr.P[i * 3 + 2];
      const wx = m.ride.ox + lx * Math.cos(th) + lz * Math.sin(th), wz = m.ride.oz - lx * Math.sin(th) + lz * Math.cos(th);
      g.fillStyle = '#ffb020'; g.beginPath(); g.arc(X(wx), Z(wz), 2.6, 0, 7); g.fill();
    }
    g.fillStyle = '#35c2ff'; g.save(); g.translate(X(camPos.x), Z(camPos.z)); g.rotate(camYaw); g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(-5, 5); g.closePath(); g.fill(); g.restore();
  }
  miniClick(e) {
    const cv = $('#miniC'), rc = cv.getBoundingClientRect(), W = cv.width, R = this.mini ? this.mini.R : 500;
    const x = ((e.clientX - rc.left) / rc.width * W - W / 2) / (W / 2 - 4) * R, z = ((e.clientY - rc.top) / rc.height * W - W / 2) / (W / 2 - 4) * R;
    const world = this.app.park; if (!world) return;
    let best = null, bd = 1e9;
    for (const r of world.rides) { const d = Math.hypot(r.entrance.x - x, r.entrance.z - z); if (d < bd) { bd = d; best = r; } }
    if (best && bd < R * 0.12) this.app.flyTo(best); else this.app.flyToXZ(x, z);
  }
}

Object.assign(UI.prototype, plUi);
