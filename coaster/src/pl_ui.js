// ============================================================================
//  pl_ui.js – Oberfläche der Phantasialand-Spielsysteme (Start-Hub, Panels, Parkkarte,
//  Hotels, Gastronomie, Attraktionen, Fotoalbum, Statistiken, Spielstände)
//  Wird als Mixin in die UI-Klasse eingehängt.
// ============================================================================
import { POIS, TICKETS, ACHIEVEMENTS } from './pl_data.js';
import { ZONES } from './phantasia.js';
import { getTrack } from './park.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const eur = n => n.toFixed(2).replace('.', ',') + ' €';
const ICON = { restaurant: '🍽', stand: '🥨', shop: '🛍', hotel: '🏨', stage: '🎭', wc: '🚻', ride: '🎢', gate: '🎟', attr: '🎡' };
const KIND_LABEL = { restaurant: 'Restaurant', stand: 'Imbiss', shop: 'Shop', hotel: 'Hotel', stage: 'Show', wc: 'Toiletten', ride: 'Achterbahn', attr: 'Attraktion' };
const FREE_NOTE = 'Beispielangebot – Speisekarte, Preise und Zimmertypen sind frei ergänzt und keine echten Angaben des Parks.';
const clock = h => { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };

export const plUi = {
  // ------------------------------------------------------------------ gemeinsame Overlays
  plBuild() {
    const root = this.root;
    root.insertAdjacentHTML('beforeend', `
      <div id="hint" class="hide"></div>
      <div id="navhud" class="hudbox hide"><div id="navArrow">➤</div><div><b id="navName"></b><div class="note" id="navDist"></div></div><button class="btn sm" id="navStop">✖</button></div>
      <div id="wallet" class="hudbox hide"></div>
      <div id="flash"></div>
      <div id="login" class="hide"><div class="lbox card"><h2>🎡 Phantasialand Simulator</h2><div class="note">Melde dich mit Name und Passwort an. Dein Spielstand wird mit deinem Konto in der Cloud gesichert – auch für den Multiplayer.</div>
        <input id="lgName" placeholder="Name (3–14 Zeichen)" maxlength="14" autocomplete="username"><input id="lgPw" type="password" placeholder="Passwort (mind. 6 Zeichen)" autocomplete="current-password">
        <div class="btnrow"><button class="btn pri" id="lgIn">Anmelden</button><button class="btn blue" id="lgReg">Neu registrieren</button></div><div id="lgMsg" class="note"></div>
        <div class="note">Das Passwort wird nur als Hash (PBKDF2) auf dem Server gespeichert. Nutze am besten kein Passwort, das du anderswo verwendest.</div></div></div>
      <div id="panel" class="hide"><div class="pbox card"><div class="phead"><b id="pTit"></b><button class="btn sm" id="pClose">✖ Schließen</button></div><div class="pbody" id="pBody"></div></div></div>
      <div id="bigmap" class="hide"><canvas id="bmC"></canvas>
        <div class="bmtop card"><input id="bmQ" placeholder="🔍 Suche (Bahn, Restaurant, Hotel …)"><div id="bmF" class="bmf"></div><button class="btn sm" id="bmX">✖ Schließen (M)</button></div>
        <div class="bmzoom card"><button class="btn sm" id="bmP">＋</button><button class="btn sm" id="bmM">－</button><button class="btn sm" id="bmC0" title="Auf mich zentrieren">◎</button></div>
        <div class="bminfo card hide" id="bmI"></div></div>`);
    $('#pClose').addEventListener('click', () => this.closePanel());
    $('#navStop').addEventListener('click', () => this.app.game.stopNav());
    $('#bmX').addEventListener('click', () => this.closeMap());
    this.mapInit();
    const doAuth = async kind => {
      const msg = $('#lgMsg'), name = $('#lgName').value.trim(), pw = $('#lgPw').value; msg.style.color = 'var(--dim)'; msg.textContent = 'Einen Moment …';
      try { await this.app.account.auth(kind, name, pw); await this.app.onLogin(); $('#lgPw').value = ''; } catch (e) { msg.style.color = 'var(--bad)'; msg.textContent = '✖ ' + (e.message === 'Failed to fetch' ? 'Server nicht erreichbar – Internetverbindung prüfen' : e.message); }
    };
    $('#lgIn').addEventListener('click', () => doAuth('login')); $('#lgReg').addEventListener('click', () => doAuth('register'));
    $('#lgPw').addEventListener('keydown', e => { if (e.key === 'Enter') doAuth('login'); e.stopPropagation(); }); $('#lgName').addEventListener('keydown', e => { if (e.key === 'Enter') $('#lgPw').focus(); e.stopPropagation(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.modalOpen()) { this.closePanel(); this.closeMap(); e.stopPropagation(); } }, true);
  },
  showLogin() { $('#login').classList.remove('hide'); this.modal = true; setTimeout(() => $('#lgName').focus(), 50); },
  hideLogin() { $('#login').classList.add('hide'); this.modal = this.modalOpen(); },
  refreshAccount() { if (this.curTab === 'hub') this.tab('hub'); },
  modalOpen() { return !$('#panel').classList.contains('hide') || !$('#bigmap').classList.contains('hide'); },
  setHint(t) { const h = $('#hint'); if (!h) return; if (t && !this.modalOpen()) { h.textContent = t; h.classList.remove('hide'); } else h.classList.add('hide'); },
  flash() { const f = $('#flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 120); },
  setNav(n) {
    const el = $('#navhud'); if (!el) return;
    if (!n) { el.classList.add('hide'); return; }
    el.classList.remove('hide'); $('#navName').textContent = n.name; $('#navDist').textContent = `${Math.round(n.dist)} m`;
    $('#navArrow').style.transform = `rotate(${(-n.rel * 180 / Math.PI - 90).toFixed(0)}deg)`;
  },
  updateWallet() {
    const w = $('#wallet'), a = this.app; if (!w) return;
    const on = a.park && a.park.def.name === 'Phantasialand' && a.state !== 'menu';
    w.classList.toggle('hide', !on); if (!on) return;
    const g = a.game, S = g.S;
    w.innerHTML = `💶 <b>${eur(S.wallet)}</b> · ${S.mode === 'play' ? (g.ticketOk() ? '🎟 ' + esc(S.ticket.type) : '🚫 kein Ticket') : '🆓 Freie Erkundung'} · 🕒 ${clock(a.env.hour)}${S.winter ? ' · ❄' : ''}`;
  },
  openPanel(kind, data) {
    const a = this.app, g = a.game; a.lockWanted = false; document.exitPointerLock?.();
    this.panelKind = kind; this.panelData = data; this.closeMap(true);
    $('#panel').classList.remove('hide'); this.renderPanel(); this.modal = true;
  },
  closePanel() { if (!$('#panel')) return; $('#panel').classList.add('hide'); this.panelKind = null; this.modal = this.modalOpen(); },
  renderPanel() {
    const kind = this.panelKind, p = this.panelData, g = this.app.game, S = g.S, body = $('#pBody'), tit = $('#pTit'); if (!kind) return;
    const wallet = `<div class="wal">💶 Guthaben: <b>${eur(S.wallet)}</b></div>`;
    if (kind === 'gate') {
      tit.textContent = '🎟 Eingang & Ticketscanner';
      body.innerHTML = `${wallet}<div class="note">Dein Ticket: ${g.ticketOk() ? '<b style="color:var(--ok)">' + esc(S.ticket.type) + ' – gültig heute</b>' : '<b style="color:var(--bad)">keins</b>'}</div>
        <div class="rows">${TICKETS.map((t, i) => `<div class="row2"><span>${esc(t[0])}</span><span>${eur(t[1])}</span><button class="btn pri sm" data-t="${i}">Kaufen</button></div>`).join('')}</div>
        <div class="acts2"><button class="btn blue" id="gScan">✔ Ticket scannen &amp; eintreten</button>${S.wallet < 60 ? '<button class="btn" id="gPocket">💶 Taschengeld (+100 €)</button>' : ''}</div>
        <div class="note">${FREE_NOTE} Die Ticketpreise sind Spielgeld und keine echten Preise. Im Modus „Freie Erkundung“ brauchst du kein Ticket.</div>`;
      body.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { g.buyTicket(+b.dataset.t); this.renderPanel(); }));
      $('#gScan').addEventListener('click', () => { if (g.scanTicket()) this.closePanel(); });
      const pk = $('#gPocket'); if (pk) pk.addEventListener('click', () => { g.addMoney(100); this.renderPanel(); });
      return;
    }
    if (kind === 'inventory') {
      tit.textContent = '🎒 Inventar'; const items = g.inventory(), food = items.filter(x => x.kind !== 'shop'), souv = items.filter(x => x.kind === 'shop'), b = S.bookings;
      const row = (x, eat) => `<div class="row2"><span>${esc(x.name)} <span class="chip">×${x.n}</span><div class="note">${esc(x.from || '')}${x.price ? ' · ' + eur(x.price) + ' pro Stück' : ''}</div></span>${eat ? `<button class="btn pri sm" data-eat="${esc(x.name)}">Verzehren</button>` : ''}</div>`;
      body.innerHTML = `${wallet}<div class="note">🎟 Ticket: ${g.ticketOk() ? '<b style="color:var(--ok)">' + esc(S.ticket.type) + ' (heute gültig)</b>' : 'keins'} · 🛏 Buchungen: ${b.length}</div>
        <h4>🍽 Essen &amp; Trinken</h4>${food.length ? `<div class="rows">${food.map(x => row(x, true)).join('')}</div>` : '<div class="note">Nichts dabei – kauf etwas in einem Restaurant oder Imbiss.</div>'}
        <h4>🛍 Souvenirs</h4>${souv.length ? `<div class="rows">${souv.map(x => row(x, false)).join('')}</div>` : '<div class="note">Noch keine Souvenirs – schau in einen Shop.</div>'}`;
      body.querySelectorAll('[data-eat]').forEach(bt => bt.addEventListener('click', () => { g.consume(bt.dataset.eat); this.renderPanel(); }));
      return;
    }
    if (kind === 'img') { tit.textContent = '📷 ' + esc(p.caption); body.innerHTML = `<img src="${p.src}" style="width:100%;border-radius:10px"><div class="note">${esc(p.t)}</div>`; return; }
    if (kind === 'poi') {
      const poi = p; tit.textContent = `${ICON[poi.kind] || ''} ${poi.name}`;
      const zn = ZONES[poi.zone] ? ZONES[poi.zone].name : '';
      if (poi.kind === 'restaurant' || poi.kind === 'stand' || poi.kind === 'shop') {
        const tables = poi.kind === 'restaurant' ? 12 : 0, occ = poi.kind === 'restaurant' ? Math.min(tables, poi.visitors || 0) : 0;
        body.innerHTML = `${wallet}<div class="note">${KIND_LABEL[poi.kind]} · ${esc(zn)}${tables ? ` · Tische: ${occ}/${tables} besetzt (Besucher-Simulation)` : ` · Wartende Besucher: ${poi.visitors || 0}`}</div>
          <div class="rows">${poi.menu.map((m, i) => `<div class="row2"><span>${esc(m[0])}</span><span>${eur(m[1])}</span><button class="btn pri sm" data-i="${i}">${poi.kind === 'shop' ? 'Kaufen' : 'Bestellen'}</button></div>`).join('')}</div>
          ${S.inventory && Object.keys(S.inventory).length ? `<div class="note">Dein Inventar: ${Object.entries(S.inventory).map(([k, v]) => esc(k) + ' ×' + v).join(', ')}</div>` : ''}
          <div class="note">${FREE_NOTE}</div>`;
        body.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { g.buy(poi, +b.dataset.i); this.renderPanel(); }));
      } else if (poi.kind === 'hotel') {
        const mine = S.bookings.filter(b => b.hotel === poi.id);
        body.innerHTML = `${wallet}<div class="note">Hotel · ${esc(zn)} · Rezeption (Lobby)</div>
          <div class="rows">${poi.rooms.map((r, i) => `<div class="row2"><span>${esc(r[0])}</span><span>${eur(r[1])} / Nacht</span><select data-n="${i}"><option>1</option><option>2</option><option>3</option><option>5</option></select><button class="btn pri sm" data-b="${i}">Buchen</button></div>`).join('')}</div>
          <h4>Deine Buchungen hier</h4>
          ${mine.length ? mine.map(b => `<div class="row2"><span>${esc(b.room)} · ${b.nights} Nacht/Nächte</span><span>${esc(b.date)}</span><button class="btn blue sm" data-in="${b.id}">🔑 Zimmer betreten (Check-in)</button><button class="btn sm" data-out="${b.id}">Check-out</button></div>`).join('') : '<div class="note">Noch keine Buchung.</div>'}
          <div class="note">${FREE_NOTE} Check-out erstattet im Spiel 50 % des Betrags.</div>`;
        body.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', () => { const n = +body.querySelector(`[data-n="${b.dataset.b}"]`).value; g.book(poi, +b.dataset.b, n); this.renderPanel(); }));
        body.querySelectorAll('[data-in]').forEach(b => b.addEventListener('click', () => g.enterRoom(poi, +b.dataset.in)));
        body.querySelectorAll('[data-out]').forEach(b => b.addEventListener('click', () => { g.checkout(+b.dataset.out); this.renderPanel(); }));
      } else if (poi.kind === 'stage') {
        const h = this.app.env.hour; const all = []; for (const [n, ts] of poi.shows) for (const t of ts) all.push([n, t]); all.sort((x, y) => x[1] - y[1]);
        const nxt = all.find(s => s[1] >= h) || all[0], cur = all.find(s => h >= s[1] && h < s[1] + 0.5);
        body.innerHTML = `<div class="note">Bühne · ${esc(zn)} · aktuelle Spielzeit ${clock(h)}</div>
          <div class="rows">${all.map(s => `<div class="row2"><span>${esc(s[0])}</span><span><b>${clock(s[1])}</b> Uhr</span></div>`).join('')}</div>
          <div class="note">${cur ? '🎭 <b style="color:var(--ok)">Show läuft gerade: ' + esc(cur[0]) + '</b>' : `Nächste Show: <b>${esc(nxt[0])}</b> um ${clock(nxt[1])} Uhr`}</div>
          <div class="acts2"><button class="btn blue" id="stWait">⏩ Bis zur nächsten Show warten</button></div><div class="note">Showzeiten sind frei ergänzt (Beispielprogramm). Während der Show versammeln sich Besucher vor der Bühne.</div>`;
        $('#stWait').addEventListener('click', () => { const t = nxt[1] - 0.03; this.app.env.setTime(t < h ? t + 24 : t); this.syncEnv(); this.app.saveSettings(); this.closePanel(); this.toast('⏩ Zeit: ' + clock(this.app.env.hour)); });
      } else { body.innerHTML = '<div class="note">Öffentliche Toiletten.</div>'; }
      return;
    }
  },

  // ------------------------------------------------------------------ Start-Hub und Unterseiten
  plTab(t, body) {
    const g = this.app.game;
    const back = '<button class="btn sm" data-home>← Start</button>';
    const wire = () => body.querySelectorAll('[data-home]').forEach(b => b.addEventListener('click', () => this.tab('hub')));
    if (t === 'hub') return this.buildHub(body);
    if (t === 'attr') this.buildAttr(body, back);
    else if (t === 'hotels') this.buildHotels(body, back);
    else if (t === 'food') this.buildFood(body, back);
    else if (t === 'photos') this.buildPhotos(body, back);
    else if (t === 'stats') this.buildStats(body, back);
    else if (t === 'saves') this.buildSaves(body, back);
    else if (t === 'editor') this.app.editor.build(body, back);
    wire();
  },
  buildHub(body) {
    const a = this.app, g = a.game, S = g.S, au = g.autoInfo();
    const tiles = [
      ['play', '▶', 'Spielen', 'Parkbetrieb: Parkplatz, Ticket, Geld, Hotels, Essen'], ['free', '🚶', 'Freie Erkundung', 'Ohne Ticket durch alle Welten laufen'],
      ['pl', '🎢', 'Achterbahnen', 'Taron, F.L.Y., Black Mamba, Colorado Adventure …'], ['attr', '🎡', 'Attraktionen', 'Alle Fahrgeschäfte mit Wartezeiten'],
      ['map', '🗺', 'Parkkarte', 'Zoom, Suche, Filter, Navigation'], ['hotels', '🏨', 'Hotels', 'Lobby, Zimmer, Buchung'],
      ['food', '🍽', 'Gastronomie', 'Restaurants, Imbisse, Shops'], ['photos', '📷', 'Fotoalbum', 'Fotos, gespeicherte Fahrten'],
      ['stats', '📊', 'Statistiken', 'Fahrten, Erfolge, Fortschritt'], ['editor', '🛠', 'Achterbahn-Editor', 'Eigene Bahn bauen und testen'],
      ['inv', '🎒', 'Inventar', 'Gekauftes Essen und Souvenirs'], ['online', '🌐', 'Multiplayer', 'Mit Freunden im Park – Raum erstellen oder beitreten'],
      ['saves', '💾', 'Spielstände', '3 Slots + Autosave'], ['help', '⚙', 'Einstellungen', 'Grafik, Steuerung, Zeit, Wetter'],
    ];
    body.innerHTML = `<div class="hub"><div class="hubhead"><div><h1>Phantasialand <small>Simulator</small></h1><div class="note">Stilisierte, frei erkundbare Nachbildung – keine offizielle Anwendung. Namen/Preise/Menüs der Gastronomie sind Beispielangebote.</div></div>
      <div class="hubenv card"><label>🕒 Zeit <span id="hubClock"></span><br><input id="hubTime" type="range" min="0" max="24" step="0.1" style="width:220px"></label>
      <div class="btnrow"><button class="btn sm" data-tm="9">🌄 Morgen</button><button class="btn sm" data-tm="13">☀ Mittag</button><button class="btn sm" data-tm="19.7">🌅 Sonnenuntergang</button><button class="btn sm" data-tm="23.5">🌙 Nacht</button></div>
      <div class="btnrow"><label class="note"><input type="checkbox" id="hubWin" ${S.winter ? 'checked' : ''}> ❄ Wintertraum</label><label class="note"><input type="checkbox" id="hubAuto" ${a.settings.autoTime ? 'checked' : ''}> ⏱ Tageszyklus</label>
      <select id="hubWeather"></select></div></div></div>
      <div class="note" style="margin:-4px 0 10px">${a.account.token ? '👤 Angemeldet als <b>' + esc(a.account.name) + '</b> · <button class="btn sm" id="hubOut">Abmelden</button>' : '👤 Gastmodus (lokal)'}</div>
      <div class="hubgrid">${tiles.map(t => `<button class="tile" data-k="${t[0]}"><span class="ti">${t[1]}</span><b>${t[2]}</b><small>${t[3]}</small></button>`).join('')}</div>
      <div class="btnrow" style="margin-top:12px">${au ? `<button class="btn blue" id="hubCont">⏯ Fortsetzen (Autosave · ${au.rides} Fahrten · ${new Date(au.savedAt).toLocaleString('de-DE')})</button>` : ''}<button class="btn" data-k="db">🌍 Alle Achterbahnen Europas</button><button class="btn" data-k="custom">➕ Eigene Bahn (JSON)</button></div></div>`;
    const wsel = $('#hubWeather'); const W = a.env.constructor.WEATHERS || null; for (const o of document.querySelectorAll('#mWeather option')) wsel.insertAdjacentHTML('beforeend', `<option value="${o.value}">${o.textContent}</option>`); wsel.value = a.env.weatherName;
    const setT = h => { a.env.setTime(h); this.syncEnv(); a.saveSettings(); $('#hubClock').textContent = clock(h); $('#hubTime').value = h; };
    $('#hubTime').addEventListener('input', e => setT(+e.target.value)); setT(a.env.hour);
    body.querySelectorAll('[data-tm]').forEach(b => b.addEventListener('click', () => setT(+b.dataset.tm)));
    wsel.addEventListener('change', () => { a.env.setWeather(wsel.value); this.syncEnv(); a.saveSettings(); });
    $('#hubWin').addEventListener('change', e => a.setWinter(e.target.checked));
    $('#hubAuto').addEventListener('change', e => { a.settings.autoTime = e.target.checked; a.saveSettings(); this.toast(e.target.checked ? 'Tageszyklus an (ca. 24 min pro Tag)' : 'Tageszyklus aus'); });
    body.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => this.hubAction(b.dataset.k)));
    const ho = $('#hubOut'); if (ho) ho.addEventListener('click', () => a.logout());
    const c = $('#hubCont'); if (c) c.addEventListener('click', async () => { a.audio.start(); g.load('auto'); });
  },
  async hubAction(k) {
    const a = this.app, g = a.game;
    if (k === 'inv') return this.openPanel('inventory');
    if (['pl', 'attr', 'hotels', 'food', 'photos', 'stats', 'saves', 'editor', 'help', 'db', 'online', 'custom'].includes(k)) return this.tab(k);
    a.audio.start();
    if (k === 'play') { g.S.mode = 'play'; if (!g.S.stats.flags.started) { g.S.stats.flags.started = 1; } await a.phantasiaPlay(); }
    else if (k === 'free') { g.S.mode = 'free'; await a.phantasia('walk'); }
    else if (k === 'map') { await a.openPark('Phantasialand'); this.openMap(); }
  },
  rideCards(list, mk) { return list.map(mk).join(''); },
  buildAttr(body, back) {
    const a = this.app, db = a.db.parks['Phantasialand'], w = a.park && a.park.def.name === 'Phantasialand' ? a.park : null;
    const list = db.coasters.slice().sort((x, y) => (x.kind === 'Achterbahn' ? 0 : 1) - (y.kind === 'Achterbahn' ? 0 : 1) || x.name.localeCompare(y.name));
    body.innerHTML = `<div class="card page"><div class="pghead">${back}<h3>🎡 Attraktionen & Achterbahnen</h3><input id="aQ" placeholder="Suche …"><label class="note"><input type="checkbox" id="aFav"> nur Favoriten</label></div>
      <div class="note">Wartezeiten stammen aus der Besucher-Simulation ${w ? '' : '(erst nach dem Betreten des Parks verfügbar)'} – sie sind keine echten Wartezeiten.</div><div class="pgrid" id="aGrid"></div></div>`;
    const render = () => {
      const q = $('#aQ').value.toLowerCase(), fv = $('#aFav').checked, grid = $('#aGrid'); grid.innerHTML = '';
      for (const c of list) {
        if (q && !(c.name + ' ' + c.area + ' ' + c.kind).toLowerCase().includes(q)) continue; if (fv && !a.favs.has(c.id)) continue;
        const ride = w && w.rides.find(r => r.coaster.id === c.id), wait = ride ? w.waitMinutes(ride) + ' Min.' : '–';
        const el = document.createElement('div'); el.className = 'card pcard';
        el.innerHTML = `<h3><span class="dot" style="background:${c.trackColor}"></span> ${esc(c.name)}</h3><div class="note">${esc(c.kind)} · ${esc(c.area || '–')}${c.kind === 'Achterbahn' ? `<br>${c.h} m · ${c.len} m · ${c.v} km/h · ${c.inv} Inv. · ${c.year || '–'}` : `<br>${esc(c.note)}`}</div>
          <div class="note">Wartezeit (Simulation): <b>${wait}</b></div><div class="acts"><button class="btn pri" data-r>▶ Fahren</button><button class="btn blue" data-v>👁</button><button class="btn" data-n>🧭</button><button class="btn" data-f>${a.favs.has(c.id) ? '★' : '☆'}</button></div>`;
        el.querySelector('[data-r]').addEventListener('click', () => a.openRide(c));
        el.querySelector('[data-v]').addEventListener('click', async () => { await a.openPark('Phantasialand'); const r = a.park.rides.find(x => x.coaster.id === c.id); if (r) a.flyTo(r); });
        el.querySelector('[data-n]').addEventListener('click', async () => { await a.phantasia('walk'); const r = a.park.rides.find(x => x.coaster.id === c.id); if (r) a.game.navigateTo({ type: 'ride', ride: r, x: r.entrance.x, z: r.entrance.z, name: c.name }); });
        el.querySelector('[data-f]').addEventListener('click', () => { a.toggleFav(c.id); render(); });
        grid.appendChild(el);
      }
    };
    render(); $('#aQ').addEventListener('input', render); $('#aFav').addEventListener('change', render);
  },
  poiNav(poi) { const a = this.app; return a.phantasia('walk').then(() => a.game.navigateTo({ type: 'poi', poi, x: poi.ax, z: poi.az, name: poi.name })); },
  buildHotels(body, back) {
    const a = this.app, g = a.game, w = a.park && a.park.def.name === 'Phantasialand' ? a.park : null;
    const hotels = POIS.filter(p => p.kind === 'hotel');
    body.innerHTML = `<div class="card page"><div class="pghead">${back}<h3>🏨 Hotels</h3><span class="wal">💶 <b>${eur(g.S.wallet)}</b></span></div>
      <div class="note">Hotelnamen: Charles Lindbergh, Matamba, Ling Bao. ${FREE_NOTE} Buchen kannst du hier oder direkt an der Rezeption im Park (E).</div><div class="pgrid" id="hGrid"></div>
      <h3 style="margin-top:18px">Meine Buchungen</h3><div id="hBook"></div></div>`;
    const grid = $('#hGrid');
    for (const h of hotels) {
      const el = document.createElement('div'); el.className = 'card pcard'; const zn = ZONES[h.zone];
      el.innerHTML = `<h3>🏨 ${esc(h.name)}</h3><div class="note">Themenbereich: ${esc(zn ? zn.name : '')}</div>
        <div class="rows">${h.rooms.map((r, i) => `<div class="row2"><span>${esc(r[0])}</span><span>${eur(r[1])}</span><select data-n="${i}"><option>1</option><option>2</option><option>3</option></select><button class="btn pri sm" data-b="${i}">Buchen</button></div>`).join('')}</div>
        <div class="acts"><button class="btn blue" data-go>🧭 Hinlaufen</button></div>`;
      el.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', () => { g.book(h, +b.dataset.b, +el.querySelector(`[data-n="${b.dataset.b}"]`).value); this.tab('hotels'); }));
      el.querySelector('[data-go]').addEventListener('click', async () => { await a.phantasia('walk'); const p = a.park.pois.find(x => x.id === h.id); if (p) g.navigateTo({ type: 'poi', poi: p, x: p.ax, z: p.az, name: p.name }); });
      grid.appendChild(el);
    }
    $('#hBook').innerHTML = g.S.bookings.length ? g.S.bookings.map(b => `<div class="row2"><span>🏨 ${esc(b.hotelName)} · ${esc(b.room)} · ${b.nights} N.</span><span>${eur(b.total)} · ${esc(b.date)}</span><button class="btn sm" data-out="${b.id}">Check-out</button></div>`).join('') : '<div class="note">Noch keine Buchung.</div>';
    body.querySelectorAll('[data-out]').forEach(b => b.addEventListener('click', () => { g.checkout(+b.dataset.out); this.tab('hotels'); }));
  },
  buildFood(body, back) {
    const a = this.app, g = a.game;
    const kinds = [['', 'Alle'], ['restaurant', 'Restaurants'], ['stand', 'Imbisse'], ['shop', 'Shops']]; let cur = '';
    body.innerHTML = `<div class="card page"><div class="pghead">${back}<h3>🍽 Gastronomie & Shops</h3>${kinds.map(k => `<button class="btn sm" data-kf="${k[0]}">${k[1]}</button>`).join('')}<input id="fdQ" placeholder="Suche …"><span class="wal">💶 <b id="fdW">${eur(g.S.wallet)}</b></span></div>
      <div class="note">${FREE_NOTE} Bestellen/Kaufen kannst du auch direkt vor Ort (E).</div><div class="pgrid" id="fdGrid"></div></div>`;
    const render = () => {
      const q = $('#fdQ').value.toLowerCase(), grid = $('#fdGrid'); grid.innerHTML = '';
      for (const p of POIS.filter(p => ['restaurant', 'stand', 'shop'].includes(p.kind) && (!cur || p.kind === cur) && (!q || (p.name + p.menu.map(m => m[0]).join(' ')).toLowerCase().includes(q)))) {
        const el = document.createElement('div'); el.className = 'card pcard'; const zn = ZONES[p.zone];
        el.innerHTML = `<h3>${ICON[p.kind]} ${esc(p.name)}</h3><div class="note">${KIND_LABEL[p.kind]} · ${esc(zn ? zn.name : '')}</div><div class="rows">${p.menu.map((m, i) => `<div class="row2"><span>${esc(m[0])}</span><span>${eur(m[1])}</span><button class="btn pri sm" data-i="${i}">${p.kind === 'shop' ? 'Kaufen' : 'Bestellen'}</button></div>`).join('')}</div><div class="acts"><button class="btn blue" data-go>🧭 Hinlaufen</button></div>`;
        el.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { g.buy(p, +b.dataset.i); $('#fdW').textContent = eur(g.S.wallet); }));
        el.querySelector('[data-go]').addEventListener('click', async () => { await a.phantasia('walk'); const pp = a.park.pois.find(x => x.id === p.id); if (pp) g.navigateTo({ type: 'poi', poi: pp, x: pp.ax, z: pp.az, name: pp.name }); });
        grid.appendChild(el);
      }
    };
    render(); $('#fdQ').addEventListener('input', render);
    body.querySelectorAll('[data-kf]').forEach(b => b.addEventListener('click', () => { cur = b.dataset.kf; render(); }));
  },
  buildPhotos(body, back) {
    const g = this.app.game;
    body.innerHTML = `<div class="card page"><div class="pghead">${back}<h3>📷 Fotoalbum</h3><button class="btn pri" id="phSnap">📷 Foto jetzt (K)</button></div><div class="note">Fotos entstehen mit <kbd>K</kbd> oder automatisch als Onride-Foto bei jeder Fahrt (gespeichert im Browser, max. 24).</div>
      <div class="pgrid" id="phGrid"></div><h3>Gespeicherte Fahrten (Replay)</h3><div class="note">Während eines Replays (V) mit „💾 Fahrt speichern“ ablegen. Wiedergabe mit Zeitlupe und allen Kameras.</div><div id="phRides"></div></div>`;
    const grid = $('#phGrid');
    if (!g.photos.length) grid.innerHTML = '<div class="note" style="padding:14px">Noch keine Fotos.</div>';
    for (const p of g.photos) {
      const el = document.createElement('div'); el.className = 'card pcard'; el.style.padding = '0'; el.style.overflow = 'hidden';
      el.innerHTML = `<img src="${p.src}" style="width:100%;display:block;cursor:zoom-in"><div style="padding:8px 10px"><b>${esc(p.caption)}</b><div class="note">${esc(p.t)}</div><div class="acts"><a class="btn sm" download="foto-${p.id}.jpg" href="${p.src}">⬇ Speichern</a><button class="btn sm" data-d>🗑</button></div></div>`;
      el.querySelector('img').addEventListener('click', () => { this.openPanel('img', p); });
      el.querySelector('[data-d]').addEventListener('click', () => { g.deletePhoto(p.id); this.tab('photos'); });
      grid.appendChild(el);
    }
    $('#phSnap').addEventListener('click', () => { if (!this.app.park) return; this.app.audio.start(); this.app.resume?.(); this.app.game.takePhoto('Foto'); });
    const rl = $('#phRides');
    rl.innerHTML = g.rides.length ? g.rides.map(r => `<div class="row2"><span>🎞 ${esc(r.name)}</span><span>${esc(r.t)}</span><button class="btn pri sm" data-p="${r.id}">▶ Abspielen</button><button class="btn sm" data-x="${r.id}">🗑</button></div>`).join('') : '<div class="note">Keine gespeicherten Fahrten.</div>';
    rl.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => this.app.playSavedReplay(g.rides.find(r => r.id === +b.dataset.p))));
    rl.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => { g.deleteRide(+b.dataset.x); this.tab('photos'); }));
  },
  buildStats(body, back) {
    const g = this.app.game, S = g.S, d = g.derived(), st = S.stats;
    const total = ACHIEVEMENTS.length, got = ACHIEVEMENTS.filter(x => g.unlocked.has(x[0])).length;
    const COASTERS = ['Taron', 'F.L.Y.', 'Black Mamba', 'Colorado Adventure', "Winja's Fear", "Winja's Force", 'Raik', 'Crazy Bats'];
    body.innerHTML = `<div class="card page"><div class="pghead">${back}<h3>📊 Statistiken & Erfolge</h3></div>
      <div class="stats" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
      <div class="stat"><b>${st.rides}</b><small>Fahrten</small></div><div class="stat"><b>${st.km.toFixed(1)} km</b><small>Strecke</small></div><div class="stat"><b>${Math.round((st.playTime || 0) / 60)} min</b><small>Spielzeit</small></div>
      <div class="stat"><b>${d.zoneCount}/8</b><small>Themenwelten</small></div><div class="stat"><b>${d.restCount}</b><small>Restaurants</small></div><div class="stat"><b>${d.hotelCount}/3</b><small>Hotels besucht</small></div>
      <div class="stat"><b>${st.purchases}</b><small>Käufe</small></div><div class="stat"><b>${st.bookings}</b><small>Buchungen</small></div><div class="stat"><b>${eur(st.spent)}</b><small>Ausgegeben</small></div>
      <div class="stat"><b>${g.photos.length}</b><small>Fotos</small></div><div class="stat"><b>${g.designs.length}</b><small>Eigene Bahnen</small></div><div class="stat"><b>${got}/${total}</b><small>Erfolge</small></div></div>
      <h3>Fahrten je Achterbahn</h3><div class="rows">${COASTERS.map(n => { const v = st.rideBy[n] || 0; return `<div class="row2"><span>${esc(n)}</span><span style="flex:1"><i class="bar" style="width:${Math.min(100, v * 10)}%"></i></span><b>${v}×</b></div>`; }).join('')}</div>
      <h3>Erfolge</h3><div class="pgrid">${ACHIEVEMENTS.map(([id, nm, ds, , pr]) => { const ok = g.unlocked.has(id), p = Math.round(pr(d) * 100); return `<div class="card pcard" style="${ok ? 'border-color:var(--acc)' : 'opacity:.8'}"><h3>${ok ? '🏆' : '🔒'} ${esc(nm)}</h3><div class="note">${esc(ds)}</div><div class="prog2"><i style="width:${ok ? 100 : p}%"></i></div></div>`; }).join('')}</div></div>`;
  },
  buildSaves(body, back) {
    const g = this.app.game, au = g.autoInfo();
    const fmt = i => i ? `${esc(i.name || 'Spielstand')} · 💶 ${eur(i.wallet)} · ${i.rides} Fahrten · ${new Date(i.savedAt).toLocaleString('de-DE')}` : '<i style="color:var(--dim)">leer</i>';
    body.innerHTML = `<div class="card page"><div class="pghead">${back}<h3>💾 Spielstände</h3></div><div class="note">Speichern im Browser (localStorage). Autosave alle 30 s im Park.</div>
      <div class="rows">${[1, 2, 3].map(i => { const info = g.slotInfo(i); return `<div class="row2"><b>Slot ${i}</b><span style="flex:1">${fmt(info)}</span><button class="btn pri sm" data-s="${i}">💾 Speichern</button><button class="btn blue sm" data-l="${i}" ${info ? '' : 'disabled'}>📂 Laden</button><button class="btn sm" data-d="${i}" ${info ? '' : 'disabled'}>🗑</button></div>`; }).join('')}
      <div class="row2"><b>Autosave</b><span style="flex:1">${au ? `${au.rides} Fahrten · ${new Date(au.savedAt).toLocaleString('de-DE')}` : '<i style="color:var(--dim)">leer</i>'}</span><button class="btn blue sm" data-l="auto" ${au ? '' : 'disabled'}>📂 Fortsetzen</button></div></div>
      <div class="acts2"><button class="btn" id="svNew">🆕 Neues Spiel (Fortschritt zurücksetzen)</button></div></div>`;
    body.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => { g.save(+b.dataset.s, 'Spielstand ' + b.dataset.s); this.toast('Gespeichert in Slot ' + b.dataset.s); this.tab('saves'); }));
    body.querySelectorAll('[data-l]').forEach(b => b.addEventListener('click', () => { this.app.audio.start(); g.load(b.dataset.l === 'auto' ? 'auto' : +b.dataset.l); }));
    body.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => { g.del(+b.dataset.d); this.tab('saves'); }));
    $('#svNew').addEventListener('click', () => { if (confirm('Neues Spiel beginnen? Der aktuelle Fortschritt (nicht die Slots) wird zurückgesetzt.')) { g.newGameState(); this.toast('Neues Spiel'); this.tab('hub'); } });
  },

  // ------------------------------------------------------------------ Parkkarte
  mapInit() {
    const cv = $('#bmC'); this.map = { x: 0, z: 100, scale: 0.55, q: '', filt: new Set(['ride', 'attr', 'restaurant', 'stand', 'shop', 'hotel', 'stage', 'wc']), sel: null, items: [], drag: null };
    const F = [['ride', '🎢 Bahnen'], ['attr', '🎡 Attraktionen'], ['restaurant', '🍽 Restaurants'], ['stand', '🥨 Imbisse'], ['shop', '🛍 Shops'], ['hotel', '🏨 Hotels'], ['stage', '🎭 Shows'], ['wc', '🚻'], ['fav', '★ Favoriten']];
    $('#bmF').innerHTML = F.map(f => `<button class="btn sm on" data-f="${f[0]}">${f[1]}</button>`).join('');
    $('#bmF').querySelectorAll('button').forEach(b => { if (b.dataset.f === 'fav') b.classList.remove('on'); b.addEventListener('click', () => { const k = b.dataset.f, s = this.map.filt; if (s.has(k)) s.delete(k); else s.add(k); b.classList.toggle('on', s.has(k)); this.mapDraw(); }); });
    $('#bmQ').addEventListener('input', e => { this.map.q = e.target.value.toLowerCase(); this.mapDraw(); });
    const M = this.map;
    $('#bmP').addEventListener('click', () => { M.scale = Math.min(6, M.scale * 1.4); this.mapDraw(); });
    $('#bmM').addEventListener('click', () => { M.scale = Math.max(0.12, M.scale / 1.4); this.mapDraw(); });
    $('#bmC0').addEventListener('click', () => { const c = this.app.pp(); M.x = c.x; M.z = c.z; this.mapDraw(); });
    cv.addEventListener('wheel', e => { e.preventDefault(); const k = e.deltaY < 0 ? 1.15 : 1 / 1.15; this.mapZoomAt(e.offsetX, e.offsetY, k); }, { passive: false });
    const pts = new Map(); let pinch = 0;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.offsetX, e.offsetY]); M.drag = { x: e.offsetX, y: e.offsetY, moved: 0 }; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) this.mapZoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch); pinch = d; M.drag = null; return; }
      if (!M.drag) return; const dx = e.offsetX - M.drag.x, dy = e.offsetY - M.drag.y; M.drag.moved += Math.abs(dx) + Math.abs(dy); M.drag.x = e.offsetX; M.drag.y = e.offsetY; M.x -= dx / M.scale; M.z -= dy / M.scale; this.mapDraw();
    });
    cv.addEventListener('pointerup', e => { pts.delete(e.pointerId); pinch = 0; if (M.drag && M.drag.moved < 6) this.mapClick(e.offsetX, e.offsetY); M.drag = null; });
    window.addEventListener('resize', () => this.mapDraw());
  },
  mapZoomAt(sx, sy, k) { const M = this.map, cv = $('#bmC'), W = cv.width, H = cv.height; const wx = M.x + (sx - W / 2) / M.scale, wz = M.z + (sy - H / 2) / M.scale; M.scale = Math.max(0.12, Math.min(6, M.scale * k)); M.x = wx - (sx - W / 2) / M.scale; M.z = wz - (sy - H / 2) / M.scale; this.mapDraw(); },
  openMap() {
    const a = this.app; if (!a.park || a.park.def.name !== 'Phantasialand') return this.toast('Die Parkkarte gibt es im Phantasialand-Modus');
    a.lockWanted = false; document.exitPointerLock?.(); this.closePanel();
    $('#bigmap').classList.remove('hide'); const c = a.pp(); this.map.x = c.x; this.map.z = c.z; this.map.sel = null; $('#bmI').classList.add('hide'); this.mapDraw(true); this.modal = true;
    this._mapT = setInterval(() => this.mapDraw(), 400);
  },
  closeMap(silent) { const m = $('#bigmap'); if (!m || m.classList.contains('hide')) return; m.classList.add('hide'); clearInterval(this._mapT); this.modal = this.modalOpen(); },
  mapItems() {
    const a = this.app, w = a.park, M = this.map, items = [], q = M.q, fav = M.filt.has('fav');
    const ok = (name, kind, id) => (!q || name.toLowerCase().includes(q)) && M.filt.has(kind) && (!fav || a.favs.has(id));
    for (const r of w.rides) { const c = r.coaster, kind = c.kind === 'Achterbahn' ? 'ride' : 'attr'; if (ok(c.name, kind, c.id)) items.push({ kind, name: c.name, x: r.entrance.x, z: r.entrance.z, id: c.id, ride: r, col: c.trackColor }); }
    for (const p of w.pois) { if (ok(p.name, p.kind, 'poi:' + p.id)) items.push({ kind: p.kind, name: p.name, x: p.ax, z: p.az, id: 'poi:' + p.id, poi: p }); }
    return items;
  },
  mapDraw(first) {
    const a = this.app, w = a.park, M = this.map, cv = $('#bmC'); if (!cv || $('#bigmap').classList.contains('hide') || !w) return;
    if (cv.width !== cv.clientWidth || cv.height !== cv.clientHeight) { cv.width = cv.clientWidth; cv.height = cv.clientHeight; }
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, S = M.scale, X = x => W / 2 + (x - M.x) * S, Z = z => H / 2 + (z - M.z) * S;
    const paper = g.createLinearGradient(0, 0, W, H); paper.addColorStop(0, '#efe4c2'); paper.addColorStop(1, '#e2d3a8'); g.fillStyle = paper; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(120,90,40,.10)'; g.lineWidth = 1; for (let x = (W / 2 - M.x * S) % 60; x < W; x += 60) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = (H / 2 - M.z * S) % 60; y < H; y += 60) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const ZC = { klugheim: '#b8b4a8', africa: '#6faa5a', rookburgh: '#c9a66a', mexico: '#e2a35a', fantasy: '#b58ad8', china: '#e07a7a', mystery: '#7a9ab8', berlin: '#a8c880', parking: '#c8c8c8' };
    for (const k in ZONES) { const zn = ZONES[k]; if (!zn.tint) continue; const col = ZC[k] || '#a8c880'; const gr = g.createRadialGradient(X(zn.x), Z(zn.z), zn.r * S * 0.2, X(zn.x), Z(zn.z), zn.r * S); gr.addColorStop(0, col + 'e6'); gr.addColorStop(0.75, col + '99'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.beginPath(); g.arc(X(zn.x), Z(zn.z), zn.r * S, 0, 7); g.fill(); }
    g.lineCap = 'round';
    for (const pass of [0, 1]) { g.strokeStyle = pass ? '#fffaf0' : 'rgba(92,66,34,.95)'; g.lineWidth = Math.max(2, 5 * S) + (pass ? 0 : Math.max(2, 2.2 * S)); for (const [i, j] of w.edges) { const A = w.nodes[i], B = w.nodes[j]; g.beginPath(); g.moveTo(X(A.x), Z(A.z)); g.lineTo(X(B.x), Z(B.z)); g.stroke(); } }
    for (const m of w.mini) { for (const pass of [0, 1]) { g.strokeStyle = pass ? m.ride.coaster.trackColor : 'rgba(30,24,16,.9)'; g.lineWidth = Math.max(1.5, 2 * S) + (pass ? 0 : 1.6); g.beginPath(); m.pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); g.closePath(); g.stroke(); } }
    if (S > 0.2) { g.textAlign = 'center'; g.font = `italic 700 ${Math.round(Math.max(12, Math.min(26, 110 * S)))}px Georgia, "Times New Roman", serif`; for (const k in ZONES) { const zn = ZONES[k]; if (k === 'parking' && S < 0.3) continue; g.lineWidth = 4; g.strokeStyle = 'rgba(255,250,235,.9)'; g.strokeText(zn.name, X(zn.x), Z(zn.z - zn.r * 0.5)); g.fillStyle = '#4a3418'; g.fillText(zn.name, X(zn.x), Z(zn.z - zn.r * 0.5)); } }
    // Route
    const nav = a.game.nav; if (nav && nav.route) { g.strokeStyle = '#ffd040'; g.lineWidth = Math.max(3, 7 * S); g.setLineDash([10, 8]); g.beginPath(); const rt = nav.route; rt.forEach((p, i) => i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); g.lineTo(X(nav.it.ax ?? nav.it.x), Z(nav.it.az ?? nav.it.z)); g.stroke(); g.setLineDash([]); }
    // Items
    M.items = this.mapItems(); const labelOn = S > 0.7 || !!M.q;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const it of M.items) {
      const x = X(it.x), y = Z(it.z); if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
      const big = it.kind === 'ride' || it.kind === 'hotel' ? 15 : 12; const hit = M.q && it.name.toLowerCase().includes(M.q);
      g.fillStyle = M.sel === it ? '#ffb020' : hit ? '#35c2ff' : '#fffaf0'; g.strokeStyle = '#5c4222'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, big + 3, 0, 7); g.fill(); g.stroke();
      g.font = `${big}px sans-serif`; g.fillText(ICON[it.kind], x, y + 1);
      if (labelOn || it.kind === 'ride' && S > 0.4) { g.font = '700 12px Georgia, serif'; g.fillStyle = '#3a2a12'; g.strokeStyle = 'rgba(255,250,235,.95)'; g.lineWidth = 3; g.strokeText(it.name, x, y + big + 12); g.fillText(it.name, x, y + big + 12); }
    }
    // Spieler
    const c = a.pp(), e = new (a.camera.rotation.constructor)().setFromQuaternion(a.camera.quaternion, 'YXZ');
    g.save(); g.translate(X(c.x), Z(c.z)); g.rotate(-e.y); g.fillStyle = '#e8202e'; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -13); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
    g.fillStyle = 'rgba(70,50,24,.9)'; g.font = 'italic 12px Georgia, serif'; g.textAlign = 'left'; g.fillText('Ziehen = verschieben · Mausrad/Pinch = Zoom · Klick = Details / Navigation', 14, H - 14);
    g.textAlign = 'right'; g.font = 'italic 700 16px Georgia, serif'; g.fillText('PARKPLAN · Phantasialand', W - 18, H - 34); g.font = 'italic 11px Georgia, serif'; g.fillText('stilisierte Nachbildung – kein offizieller Plan', W - 18, H - 18);
    g.save(); g.translate(W - 60, 130); g.strokeStyle = '#5c4222'; g.fillStyle = '#5c4222'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.stroke(); g.beginPath(); g.moveTo(0, -20); g.lineTo(6, 4); g.lineTo(0, 0); g.lineTo(-6, 4); g.closePath(); g.fill(); g.font = 'bold 13px Georgia, serif'; g.textAlign = 'center'; g.fillText('N', 0, -27); g.restore();
  },
  mapClick(sx, sy) {
    const M = this.map, cv = $('#bmC'), W = cv.width, H = cv.height, S = M.scale, a = this.app;
    let best = null, bd = 22; for (const it of M.items) { const d = Math.hypot(W / 2 + (it.x - M.x) * S - sx, H / 2 + (it.z - M.z) * S - sy); if (d < bd) { bd = d; best = it; } }
    const wx = M.x + (sx - W / 2) / S, wz = M.z + (sy - H / 2) / S;
    const inf = $('#bmI'); inf.classList.remove('hide');
    if (best) {
      M.sel = best; const c = best.ride ? best.ride.coaster : null; const fav = a.favs.has(best.id);
      const w = a.park, wait = best.ride ? ` · Wartezeit ${w.waitMinutes(best.ride)} Min.` : '';
      inf.innerHTML = `<b>${ICON[best.kind]} ${esc(best.name)}</b> <span class="chip">${KIND_LABEL[best.kind]}</span><div class="note">${c ? `${c.kind === 'Achterbahn' ? c.h + ' m · ' + c.v + ' km/h · ' + c.inv + ' Inv.' : esc(c.note)}${wait}` : best.poi.kind === 'hotel' || best.poi.kind === 'stage' || best.poi.menu ? esc(ZONES[best.poi.zone] ? ZONES[best.poi.zone].name : '') : ''}</div>
        <div class="btnrow"><button class="btn pri sm" id="miNav">🧭 Navigation starten</button><button class="btn blue sm" id="miFly">✈ Hinfliegen</button><button class="btn sm" id="miFav">${fav ? '★' : '☆'} Favorit</button>${best.ride ? '<button class="btn sm" id="miRide">▶ Fahren</button>' : ''}</div>`;
      $('#miNav').addEventListener('click', () => { this.startNav(best); });
      $('#miFly').addEventListener('click', () => { this.closeMap(); a.flyToXZ(best.x, best.z); });
      $('#miFav').addEventListener('click', () => { a.toggleFav(best.id); this.mapClick(sx, sy); });
      const mr = $('#miRide'); if (mr) mr.addEventListener('click', () => { this.closeMap(); a.rideOn(best.ride); });
    } else {
      M.sel = null; inf.innerHTML = `<b>📍 Punkt auf der Karte</b><div class="note">${Math.round(wx)} / ${Math.round(wz)}</div><div class="btnrow"><button class="btn pri sm" id="miNav">🧭 Navigation hierhin</button><button class="btn blue sm" id="miFly">✈ Hinfliegen</button></div>`;
      $('#miNav').addEventListener('click', () => this.startNav({ type: 'point', x: wx, z: wz, name: 'Gewählter Punkt', kind: 'point' }));
      $('#miFly').addEventListener('click', () => { this.closeMap(); a.flyToXZ(wx, wz); });
    }
    this.mapDraw();
  },
  startNav(it) {
    const a = this.app, g = a.game;
    const tgt = it.ride ? { type: 'ride', ride: it.ride, x: it.x, z: it.z, name: it.name } : it.poi ? { type: 'poi', poi: it.poi, x: it.x, z: it.z, name: it.name } : it;
    g.navigateTo(tgt); this.mapDraw();
    if (a.state === 'park' && a.parkMode !== 'walk') a.setParkMode('walk');
    this.toast('🧭 Route auf der Karte (gelb) und im Park (gelbe Punkte)');
  },
};
