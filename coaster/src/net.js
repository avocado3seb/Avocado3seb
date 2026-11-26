// ============================================================================
//  net.js – Online-Modus (Standard: Cloudflare-Relay per WebSocket; Alternative: WebRTC/PeerJS)
//  Der Host besitzt die Simulation aller Bahnen im Park und verteilt Schnappschüsse.
//  Mitspieler erscheinen als Avatare im Park oder sitzen sichtbar im gemeinsamen Zug.
// ============================================================================
import * as THREE from 'three';
import Peer from 'peerjs';
import { seatLayout } from './train.js';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
const COLORS = ['#ff5252', '#40c4ff', '#69f0ae', '#ffd54f', '#e040fb', '#ff9100', '#18ffff', '#b2ff59'];
const MAX_PLAYERS = 12;
const PREFIX = 'ecs-coaster-';
const SEND_HZ = 10, SNAP_HZ = 6;
// Standard: WebSocket-Relay auf Cloudflare (Worker + Durable Object, siehe coaster/cloudflare). Mit ?peerhost=… wird PeerJS/WebRTC genutzt, mit ?relay=wss://… ein eigener Relay.
const RELAY = 'wss://ecs-relay.jonathanrontgen7.workers.dev';

function nameSprite(name, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = 'rgba(8,14,26,.78)';
  g.beginPath(); g.roundRect(4, 8, 248, 48, 14); g.fill();
  g.fillStyle = color; g.fillRect(4, 8, 8, 48);
  g.fillStyle = '#fff'; g.font = '700 26px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name.slice(0, 14), 132, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false }));
  s.scale.set(2.8, 0.7, 1); s.renderOrder = 10; return s;
}

class Remote {
  constructor(net, id, name, idx) {
    this.net = net; this.id = id; this.name = name; this.color = COLORS[idx % COLORS.length];
    const g = this.group = new THREE.Group();
    const col = new THREE.Color(this.color);
    const m = (geo, c, y) => { const me = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })); me.position.y = y; me.castShadow = true; g.add(me); return me; };
    m(new THREE.BoxGeometry(0.46, 0.66, 0.28), col, 1.05);
    m(new THREE.BoxGeometry(0.34, 0.72, 0.22), 0x2a3042, 0.38);
    m(new THREE.SphereGeometry(0.17, 8, 6), 0xe0b090, 1.55);
    const arm = (x) => { const a = m(new THREE.BoxGeometry(0.1, 0.55, 0.1), col, 1.05); a.position.x = x; };
    arm(-0.3); arm(0.3);
    this.tag = nameSprite(name, this.color); this.tag.position.y = 2.15; g.add(this.tag);
    this.kind = 'menu'; this.tp = new THREE.Vector3(); this.yaw = 0; this.ty = 0; this.first = true; this.ride = null;
    net.app.scene.add(g); g.visible = false;
  }
  apply(m) {
    this.kind = m.k;
    if (m.k === 'ride') {
      const w = this.net.app.park;
      const r = w && w.rides[m.r];
      if (r && (this.ride !== r || this.car !== m.c || this.row !== m.row || this.s !== m.s)) this.attach(r, m.c, m.row, m.s);
      this.group.visible = !!r;
    } else {
      if (this.ride) this.detach();
      this.group.visible = m.k === 'walk' || m.k === 'fly';
      if (m.p) this.tp.set(m.p[0], m.p[1], m.p[2]);
      this.ty = m.yaw || 0;
      if (this.first) { this.group.position.copy(this.tp); this.yaw = this.ty; this.first = false; }
    }
  }
  attach(r, car, row, s) {
    this.detach();
    const spec = r.spec, sl = seatLayout(spec);
    const seat = sl.seats.find(x => x.row === row && x.s === s) || sl.seats[0];
    const cobj = r.train.cars[Math.min(car, r.train.cars.length - 1)];
    cobj.g.add(this.group);
    this.group.position.set(seat.x, -0.55, seat.z); this.group.rotation.set(0, Math.PI / 2, 0);
    this.ride = r; this.car = car; this.row = row; this.s = s;
  }
  detach() {
    if (!this.ride) return;
    this.net.app.scene.add(this.group); this.ride = null; this.first = true; this.group.rotation.set(0, 0, 0);
  }
  update(dt) {
    if (this.ride) return;
    const k = 1 - Math.exp(-12 * dt), p = this.group.position;
    p.x += (this.tp.x - p.x) * k; p.y += (this.tp.y - p.y) * k; p.z += (this.tp.z - p.z) * k;
    let d = this.ty - this.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    this.yaw += d * k; this.group.rotation.y = this.yaw;
    this.group.position.y += this.kind === 'walk' ? 0 : Math.sin(performance.now() / 400 + this.id) * 0.01;
  }
  remove() { this.detach(); this.net.app.scene.remove(this.group); }
}

export class Net {
  constructor(app) {
    this.app = app; this.mode = 'off'; this.peer = null; this.rws = null; this.gws = null; this.conns = new Map(); this.hostConn = null;
    this.remotes = new Map(); this.me = { id: 0, name: 'Spieler' }; this.code = ''; this.nextId = 1;
    this.sendT = 0; this.snapT = 0; this.envT = 0; this.status = ''; this.log = []; this.onChange = () => {};
    this._lastEnv = '';
  }
  get active() { return this.mode !== 'off'; }
  get isHost() { return this.mode === 'host'; }
  get link() { return `${location.origin}${location.pathname}?room=${this.code}`; }
  get players() { return [{ id: this.me.id, name: this.me.name, color: COLORS[0], local: true }, ...[...this.remotes.values()].map(r => ({ id: r.id, name: r.name, color: r.color }))]; }
  peerOpts() {
    const q = new URLSearchParams(location.search); const o = { debug: 0 };
    if (q.get('peerhost')) { o.host = q.get('peerhost'); o.port = +(q.get('peerport') || 9000); o.path = q.get('peerpath') || '/'; o.secure = q.get('peersecure') === '1'; }
    return o;
  }
  relayBase() { const q = new URLSearchParams(location.search); if (q.get('relay')) return q.get('relay').replace(/\/$/, ''); return q.get('peerhost') ? null : RELAY; }
  tokenQ() { const t = this.app.account && this.app.account.token; return t ? '&token=' + encodeURIComponent(t) : ''; }
  get transport() { return this.relayBase() ? 'Cloudflare-Relay' : 'WebRTC (PeerJS)'; }
  setStatus(s) { this.status = s; this.onChange(); }

  // ----------------------------------------------------------------- Host
  host(name) {
    const base = this.relayBase(); if (base) return this.hostRelay(name, base);
    return new Promise((resolve, reject) => {
      this.leave(true); this.me.name = name; this.me.id = 0;
      let tries = 0;
      const open = () => {
        const code = randCode(); this.code = code;
        const peer = this.peer = new Peer(PREFIX + code, this.peerOpts());
        peer.on('open', () => { this.mode = 'host'; this.setStatus('Raum offen'); this.chatLine('Raum ' + code + ' geöffnet – Mitspieler können beitreten.', '#ffd54f'); this.app.onNetStart(); resolve(code); });
        peer.on('error', e => {
          if (e.type === 'unavailable-id' && tries++ < 5) { try { peer.destroy(); } catch (x) { /* */ } open(); return; }
          this.setStatus('Fehler: ' + (e.type || e.message)); if (this.mode === 'off') reject(new Error(e.type || e.message));
        });
        peer.on('connection', c => { c.on('data', m => this.onHostData(c, m)); c.on('close', () => this.drop(c)); c.on('error', () => this.drop(c)); });
        peer.on('disconnected', () => { try { peer.reconnect(); } catch (x) { /* */ } });
      };
      open();
    });
  }
  hostRelay(name, base) {
    return new Promise((resolve, reject) => {
      this.leave(true); this.me.name = name; this.me.id = 0; let tries = 0, settled = false;
      const open = () => {
        const code = randCode(); this.code = code; let ws;
        try { ws = this.rws = new WebSocket(`${base}/room/${code}?role=host${this.tokenQ()}`); } catch (e) { this.setStatus('Fehler: ' + e.message); reject(e); return; }
        const rc = new Map(); this._rc = rc;
        const timer = setTimeout(() => { if (!settled) { settled = true; try { ws.close(); } catch (e) { /* */ } this.rws = null; this.setStatus('Fehler: Relay nicht erreichbar'); reject(new Error('Relay nicht erreichbar')); } }, 15000);
        ws.onmessage = ev => {
          let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          if (m.r === 'taken') { clearTimeout(timer); try { ws.close(); } catch (e) { /* */ } if (tries++ < 5) open(); else { settled = true; reject(new Error('Kein freier Raumcode')); } return; }
          if (m.r === 'hosting') { clearTimeout(timer); settled = true; this.mode = 'host'; this.setStatus('Raum offen'); this.chatLine('Raum ' + code + ' geöffnet – Mitspieler können beitreten.', '#ffd54f'); this.app.onNetStart(); resolve(code); return; }
          if (m.r === 'open') { const cid = m.c, conn = { open: true, _cid: cid, _user: m.u || '', send: d => { if (ws.readyState === 1) ws.send(JSON.stringify({ to: cid, d })); }, close: () => { conn.open = false; } }; rc.set(cid, conn); return; }
          if (m.r === 'close') { const conn = rc.get(m.c); if (conn) { conn.open = false; rc.delete(m.c); this.drop(conn); } return; }
          if (m.c !== undefined) { const conn = rc.get(m.c); if (conn) this.onHostData(conn, m.d); }
        };
        ws.onclose = () => { clearTimeout(timer); if (this.rws === ws) { this.rws = null; if (this.mode === 'host') { this.app.ui.toast('Verbindung zum Relay verloren'); this.leave(); } else if (!settled) { settled = true; reject(new Error('Relay nicht erreichbar')); } } };
      };
      open();
    });
  }
  drop(conn) {
    const id = conn._pid; if (id === undefined || !this.conns.has(id)) return;
    this.conns.delete(id); const n = this.remotes.get(id)?.name || '?'; this.removeRemote(id); this.broadcast({ t: 'leave', id });
    this.chatLine('➜ ' + n + ' hat den Raum verlassen', '#ff8a80');
  }
  onHostData(conn, m) {
    if (!m || !m.t) return;
    if (m.t === 'hello') {
      if (this.conns.size >= MAX_PLAYERS - 1) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 200); return; }
      const id = this.nextId++; conn._pid = id; this.conns.set(id, conn);
      const nm = String(conn._user || m.name || 'Spieler').slice(0, 14); // angemeldeter Name vom Server hat Vorrang
      conn.send({ t: 'welcome', id, players: [{ id: 0, name: this.me.name }, ...[...this.remotes.values()].map(r => ({ id: r.id, name: r.name }))], park: this.app.park ? this.app.park.def.name : '', rides: this.app.park ? this.app.park.rides.map(r => r.coaster.id) : [], env: this.envState() });
      this.addRemote(id, nm); this.broadcast({ t: 'join', id, name: nm }, id);
      this.chatLine('➜ ' + nm + ' ist beigetreten', '#69f0ae'); this.app.ui.toast(nm + ' ist beigetreten');
      return;
    }
    const from = conn._pid; if (from === undefined) return;
    if (m.t === 'p') { m.id = from; this.onData(m); this.broadcast(m, from); }
    else if (m.t === 'chat') { m.id = from; this.onData(m); this.broadcast(m, from); }
    else if (m.t === 'dispatch') { const r = this.app.park?.rides[m.r]; if (r && r.sim.state === 'station') r.sim.timer = Math.min(r.sim.timer, 0.5); }
  }
  addRemote(id, name) { if (this.remotes.has(id)) return; this.remotes.set(id, new Remote(this, id, name, this.remotes.size + 1)); this.onChange(); }
  removeRemote(id) { const r = this.remotes.get(id); if (!r) return; r.remove(); this.remotes.delete(id); this.onChange(); }
  broadcast(m, except = null) {
    if (this.rws) { if (this.rws.readyState === 1) { const ex = except != null ? this.conns.get(except)?._cid : undefined; this.rws.send(JSON.stringify({ to: '*', except: ex, d: m })); } return; }
    for (const [id, c] of this.conns) if (id !== except && c.open) c.send(m);
  }
  send(m) { if (this.mode === 'host') this.broadcast(m); else if (this.mode === 'client' && this.hostConn?.open) this.hostConn.send(m); }
  envState() { return { hour: this.app.env.hour, weather: this.app.env.weatherName }; }

  // ----------------------------------------------------------------- Client
  join(code, name) {
    const base = this.relayBase(); if (base) return this.joinRelay(code, name, base);
    return new Promise((resolve, reject) => {
      this.leave(true); this.me.name = name; code = code.trim().toUpperCase();
      const peer = this.peer = new Peer(undefined, this.peerOpts());
      const fail = msg => { this.setStatus(msg); try { peer.destroy(); } catch (x) { /* */ } this.peer = null; this.mode = 'off'; reject(new Error(msg)); };
      const timer = setTimeout(() => fail('Zeitüberschreitung – Raum nicht gefunden'), 30000);
      peer.on('error', e => { clearTimeout(timer); fail(e.type === 'peer-unavailable' ? 'Raum nicht gefunden' : 'Fehler: ' + (e.type || e.message)); });
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' }); this.hostConn = conn;
        conn.on('open', () => conn.send({ t: 'hello', name }));
        conn.on('data', m => {
          if (m.t === 'welcome') {
            clearTimeout(timer); this.me.id = m.id; this.code = code; this.mode = 'client';
            for (const p of m.players) this.addRemote(p.id, p.name);
            this.setStatus('Verbunden'); this.chatLine('Verbunden mit Raum ' + code, '#ffd54f');
            this.app.onNetStart(m); resolve(code);
          } else if (m.t === 'full') { clearTimeout(timer); fail('Raum ist voll'); }
          else this.onData(m);
        });
        conn.on('close', () => { if (this.mode === 'client') { this.app.ui.toast('Verbindung zum Host verloren'); this.leave(); } });
      });
    });
  }
  joinRelay(code, name, base) {
    return new Promise((resolve, reject) => {
      this.leave(true); this.me.name = name; code = code.trim().toUpperCase(); let done = false, ws;
      const fail = msg => { if (done) return; done = true; this.setStatus(msg); try { ws && ws.close(); } catch (x) { /* */ } this.gws = null; this.hostConn = null; this.mode = 'off'; reject(new Error(msg)); };
      try { ws = this.gws = new WebSocket(`${base}/room/${encodeURIComponent(code)}?role=guest${this.tokenQ()}`); } catch (e) { fail('Fehler: ' + e.message); return; }
      const timer = setTimeout(() => fail('Zeitüberschreitung – Raum nicht gefunden'), 30000);
      const conn = this.hostConn = { open: false, send: m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); }, close: () => { try { ws.close(); } catch (e) { /* */ } } };
      ws.onopen = () => { conn.open = true; ws.send(JSON.stringify({ t: 'hello', name })); };
      ws.onerror = () => { clearTimeout(timer); fail('Relay nicht erreichbar'); };
      ws.onmessage = ev => {
        let w; try { w = JSON.parse(ev.data); } catch (e) { return; }
        if (w.r === 'nohost') { clearTimeout(timer); fail('Raum nicht gefunden'); return; }
        if (w.r === 'full') { clearTimeout(timer); fail('Raum ist voll'); return; }
        const m = w.d; if (!m) return;
        if (m.t === 'welcome' && !done) {
          clearTimeout(timer); done = true; this.me.id = m.id; this.code = code; this.mode = 'client';
          for (const p of m.players) this.addRemote(p.id, p.name);
          this.setStatus('Verbunden'); this.chatLine('Verbunden mit Raum ' + code, '#ffd54f'); this.app.onNetStart(m); resolve(code);
        } else if (m.t === 'full') { clearTimeout(timer); fail('Raum ist voll'); }
        else if (done) this.onData(m);
      };
      ws.onclose = () => { clearTimeout(timer); if (this.mode === 'client' && this.gws === ws) { this.app.ui.toast('Verbindung zum Host verloren'); this.leave(); } else if (!done) fail('Raum nicht gefunden'); };
    });
  }
  leave(silent = false) {
    try { this.rws?.close(); } catch (e) { /* */ } this.rws = null; try { this.gws?.close(); } catch (e) { /* */ } this.gws = null;
    for (const r of this.remotes.values()) r.remove(); this.remotes.clear();
    for (const c of this.conns.values()) { try { c.close(); } catch (e) { /* */ } } this.conns.clear();
    try { this.hostConn?.close(); } catch (e) { /* */ } this.hostConn = null;
    try { this.peer?.destroy(); } catch (e) { /* */ } this.peer = null;
    const was = this.mode !== 'off'; this.mode = 'off'; this.code = ''; this.log = [];
    this.setStatus(''); this.app.onNetEnd?.();
    if (was && !silent) this.app.ui.toast('Online-Modus beendet');
  }

  // ----------------------------------------------------------------- Nachrichten
  onData(m) {
    const app = this.app;
    switch (m.t) {
      case 'p': { const r = this.remotes.get(m.id); if (r) r.apply(m); break; }
      case 'join': this.addRemote(m.id, m.name); this.chatLine('➜ ' + m.name + ' ist beigetreten', '#69f0ae'); break;
      case 'leave': { const n = this.remotes.get(m.id)?.name || '?'; this.removeRemote(m.id); this.chatLine('➜ ' + n + ' hat den Raum verlassen', '#ff8a80'); break; }
      case 'chat': this.chatLine((this.remotes.get(m.id)?.name || '?') + ': ' + m.text, '#fff'); break;
      case 'env': app.env.setTime(m.hour); if (m.weather !== app.env.weatherName) app.env.setWeather(m.weather); app.ui.syncEnv?.(); break;
      case 'park': app.followPark(m.name); break;
      case 'sim': this.applySnapshot(m.a); break;
    }
  }
  chatLine(text, color = '#fff') {
    this.log.push({ text, color, t: performance.now() }); if (this.log.length > 60) this.log.shift();
    this.onChange(true);
  }
  sendChat(text) {
    text = String(text).trim().slice(0, 200); if (!text) return;
    this.chatLine(this.me.name + ': ' + text, '#9fe8ff');
    this.send({ t: 'chat', id: this.me.id, text });
  }
  announcePark() { if (this.isHost && this.app.park) this.broadcast({ t: 'park', name: this.app.park.def.name }); }

  applySnapshot(a) {
    const w = this.app.park; if (!w) return;
    for (let i = 0; i < a.length && i < w.rides.length; i++) {
      const sim = w.rides[i].sim, [s, v, st, timer, lap] = a[i], L = sim.tr.L;
      if (st === 0) { sim.state = 'station'; sim.s = sim.tr.sStop; sim.v = 0; sim.timer = timer; sim.arriving = false; }
      else {
        if (sim.state !== 'run' || Math.abs(s - sim.s) > 4) { sim.s = s; sim.v = v; if (sim.state !== 'run') sim.rideTime = 0; }
        else { sim.s += (s - sim.s) * 0.5; sim.v += (v - sim.v) * 0.5; }
        sim.state = 'run'; sim.arriving = sim.s >= L;
      }
      sim.lap = lap;
    }
  }
  snapshot() {
    return this.app.park.rides.map(r => { const s = r.sim; return [+s.s.toFixed(2), +s.v.toFixed(2), s.state === 'run' ? 1 : 0, +s.timer.toFixed(1), s.lap]; });
  }

  update(dt) {
    if (!this.active) return;
    const now = performance.now(), real = Math.min(1, (now - (this._t || now)) / 1000); this._t = now; // Netz-Takte in echter Zeit
    for (const r of this.remotes.values()) r.update(dt);
    this.sendT -= real;
    if (this.sendT <= 0) { this.sendT = 1 / SEND_HZ; const st = this.app.netState(); if (st) { st.t = 'p'; st.id = this.me.id; this.send(st); } }
    if (this.isHost && this.app.park) {
      this.snapT -= real; if (this.snapT <= 0) { this.snapT = 1 / SNAP_HZ; this.broadcast({ t: 'sim', a: this.snapshot() }); }
      this.envT -= real; if (this.envT <= 0) { this.envT = 2; this.broadcast({ t: 'env', ...this.envState() }); }
    }
  }
}
