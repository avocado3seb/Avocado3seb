// ============================================================================
//  ui.js – Menü (Datenbank, Parks, eigene Bahnen, Hilfe), HUD, Parkpanel, Minikarte
// ============================================================================
import { CATS, COUNTRIES } from './specs.js';
import { WEATHERS } from './env.js';
import { getTrack } from './park.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n, d = 0) => (n === undefined || n === null || Number.isNaN(n)) ? '–' : Number(n).toLocaleString('de-DE', { maximumFractionDigits: d });
const flag = cc => cc.toUpperCase().replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0)));
const cname = cc => (COUNTRIES[cc] ? COUNTRIES[cc][0] : cc);
const tlabel = cat => (CATS[cat] ? CATS[cat].label : cat);

export const CAM_LIST = [
  ['fp', 'First-Person (Zugmitte)'], ['front', 'Erster Sitz'], ['rear', 'Letzter Sitz'],
  ['outside', 'Außenkamera (TV)'], ['chase', 'Verfolger'], ['drone', 'Drohne'], ['free', 'Freie Kamera'],
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
          <button class="tab on" data-t="db">🎢 Datenbank</button>
          <button class="tab" data-t="parks">🏰 Parks</button>
          <button class="tab" data-t="custom">➕ Eigene Bahn</button>
          <button class="tab" data-t="help">⚙ Hilfe &amp; Einstellungen</button>
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
      <div id="hTL" class="hudbox"><div class="n" id="hName"></div><div class="p" id="hPark"></div></div>
      <div id="hTR"><button class="btn sm" id="bMap">🗺 Karte</button><button class="btn sm" id="bPark">🏞 Park</button><button class="btn sm" id="bSnd">🔊</button><button class="btn sm" id="bHelp">❓</button><button class="btn sm" id="bMenu">☰ Menü</button></div>
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
    $('#bMap').addEventListener('click', () => this.toggleMini());
    $('#bPark').addEventListener('click', () => app.toPark());
    $('#bSnd').addEventListener('click', () => { const on = app.audio.toggle(); $('#bSnd').textContent = on ? '🔊' : '🔇'; });
    $('#bHelp').addEventListener('click', () => this.toggleHelp());
    // Kameraliste
    const cams = $('#hCams');
    CAM_LIST.forEach(([id, label], i) => { const b = document.createElement('button'); b.dataset.c = id; b.innerHTML = `<b>${i + 1}</b>${label}`; b.addEventListener('click', () => app.setCamera(id)); cams.appendChild(b); });
    $('#park').querySelectorAll('.modes button').forEach(b => b.addEventListener('click', () => app.setParkMode(b.dataset.m)));
    $('#miniC').addEventListener('click', e => this.miniClick(e));
    this.tab('db');
  }

  clock(h) { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }

  // ------------------------------------------------------------------ Tabs
  tab(t) {
    this.root.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.dataset.t === t));
    this.curTab = t;
    const body = $('#mbody');
    if (t === 'db') this.buildDb(body);
    else if (t === 'parks') this.buildParks(body);
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
      <td><span class="chip">${tlabel(c.cat)}</span></td><td class="num">${fmt(c.h)} m</td><td class="num">${fmt(c.len)} m</td><td class="num">${fmt(c.v)}</td><td class="num">${c.inv}</td><td class="num">${c.year}</td></tr>`).join('') ||
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
        <div class="stat"><b>${c.inv}</b><small>Inversionen</small></div><div class="stat"><b>${Math.floor(c.dur / 60)}:${String(c.dur % 60).padStart(2, '0')}</b><small>Dauer</small></div><div class="stat"><b>${c.year}</b><small>Eröffnung</small></div>
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
        <tr><td><kbd>1</kbd>–<kbd>7</kbd></td><td>Kamera: First-Person · Erster Sitz · Letzter Sitz · Außen · Verfolger · Drohne · Frei</td></tr>
        <tr><td><kbd>C</kbd></td><td>Kamera weiterschalten</td></tr>
        <tr><td><kbd>Maus ziehen</kbd></td><td>Umschauen / Drohne drehen</td></tr>
        <tr><td><kbd>Mausrad</kbd></td><td>Zoom / Drohnen-Abstand</td></tr>
        <tr><td><kbd>Leertaste</kbd></td><td>Abfahrt sofort · Blick zentrieren</td></tr>
        <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Sitzplatz links/rechts · <kbd>↑</kbd> <kbd>↓</kbd> Wagen vor/zurück</td></tr>
        <tr><td><kbd>W A S D</kbd> <kbd>Q E</kbd></td><td>Freie Kamera / Fliegen / Gehen (<kbd>Shift</kbd> schneller)</td></tr></table></div>
      <div><h3>Allgemein</h3><table>
        <tr><td><kbd>P</kbd></td><td>Pause</td></tr><tr><td><kbd>M</kbd></td><td>Minikarte</td></tr><tr><td><kbd>Tab</kbd></td><td>Park-Ansicht (Erkunden)</td></tr>
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
      </div><div class="note">Qualitätsänderungen (Bäume, Besucher) gelten ab dem nächsten Parkwechsel.</div>${this.helpHtml()}
      <h3>Über dieses Spiel</h3><div class="note">Alle Modelle, Texturen und Geräusche entstehen zur Laufzeit im Browser (three.js, keine externen Assets). Streckenlayouts sind stilisierte Nachbildungen auf Basis von Höhe, Länge, Geschwindigkeit, Inversionen und Typ; Stammdaten sind gerundete Näherungswerte ohne Gewähr. Alle Markennamen gehören ihren Inhabern.</div></div>`;
    $('#sQ').value = s.quality; $('#sSh').value = s.shadows ? '1' : '0';
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
    $('#mBack').classList.toggle('hide', !this.app.canResume());
    if (menu) { this.renderRows && this.curTab === 'db' && this.renderRows(); }
  }
  hud(d) {
    $('#gS').textContent = d.kmh.toFixed(0); $('#gH').textContent = d.h.toFixed(0);
    $('#gV').textContent = d.gv.toFixed(1); $('#gL').textContent = d.gl.toFixed(1);
    $('#hProg').style.width = (d.prog * 100).toFixed(1) + '%'; $('#hState').textContent = d.state;
    $('#hCount').innerHTML = d.count ? `<div class="big">${d.count}</div><div class="sm">Leertaste: sofort losfahren</div>` : '';
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
