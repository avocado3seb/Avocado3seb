// Mehrspieler: Peer-to-Peer (WebRTC über PeerJS). Der Host verteilt Nachrichten an alle Mitspieler.
import * as THREE from 'three';
import Peer from 'peerjs';
import { G } from './state.js';
import { h } from './ui.js';
import { Character } from './character.js';
import { byKey } from './vehicledata.js';
import { clamp, damp, dampAngle, fmtMoney } from './util.js';

const SEND_HZ = 12;
const MAX_PLAYERS = 24;
const EMOTES = ['👋', '😂', '👍', '💃', '🔥', '🥑', '😎', '🙏'];
const HILL = { x: -300, z: 60, r: 22, win: 120 };
const WIN_KILLS = 20;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
const COLORS = ['#ff5252', '#40c4ff', '#69f0ae', '#ffd54f', '#e040fb', '#ff9100', '#18ffff', '#b2ff59'];

class Remote {
  constructor(mp, id, name, outfit, idx) {
    this.mp = mp; this.id = id; this.name = name; this.color = COLORS[idx % COLORS.length];
    this.char = new Character(outfit || {}); G.scene.add(this.char.root);
    this.pos = this.char.root.position; this.tp = new THREE.Vector3(); this.yaw = 0; this.ty = 0; this.hp = 100; this.alive = true; this.veh = null; this.vKey = null; this.speed = 0; this.weapon = 'fist'; this.last = performance.now();
    this.tag = h('div', { class: 'bubble mptag', style: { background: 'rgba(10,6,24,.75)', color: '#fff', borderLeft: '3px solid ' + this.color } }, name); G.ui.bubbleLayer.append(this.tag);
    this.kills = 0; this.deaths = 0; this.first = true;
  }
  apply(s) {
    this.last = performance.now();
    this.tp.set(s.p[0], s.p[1], s.p[2]); this.ty = s.yaw; this.speed = s.sp || 0; this.hp = s.hp ?? 100; this.alive = !s.dead;
    const st = this.char.state; st.dead = !!s.dead; st.swim = !!s.sw; st.aiming = !!s.aim;
    if (s.w !== this.weapon) { this.weapon = s.w; this.char.setHeld(s.w && s.w !== 'fist' ? s.w : null); }
    if (this.first) { this.pos.copy(this.tp); this.yaw = this.ty; this.first = false; }
    // Fahrzeug
    if (s.v) {
      const v = s.v;
      if (!this.veh || this.vKey !== v.k) { this.dropVehicle(); this.makeVehicle(v); }
      const ve = this.veh; if (ve) { ve.net = v; if (v.x && !ve.exploded) G.vehicles.explode(ve); }
    } else if (this.veh) this.dropVehicle();
  }
  makeVehicle(v) {
    const spec = byKey.get(v.k); if (!spec) return;
    const ve = G.vehicles.spawn(spec, v.p[0], v.p[2], v.yaw, { color: v.c, sleep: false });
    ve.remote = true; ve.kinematic = true; ve.keep = true; ve.tag = 'remote'; ve.driver = { remote: this.id }; ve.sleeping = false; ve.owner = this;
    ve.pos.y = v.p[1]; this.veh = ve; this.vKey = v.k;
    ve.group.add(this.char.root); const s = ve.model.seat; this.char.root.position.set(s.x, s.y - 0.5, s.z); this.char.root.rotation.set(0, 0, 0);
    this.char.state.sit = true; this.char.setHeld(null);
  }
  dropVehicle() {
    const ve = this.veh; if (!ve) return;
    G.scene.add(this.char.root); this.char.state.sit = false; this.pos.copy(ve.pos);
    ve.remote = false; ve.keep = false; ve.driver = null; ve.kinematic = false; ve.tag = 'abandoned'; ve.sleeping = true; G.vehicles.despawn(ve);
    this.veh = null; this.vKey = null; this.char.setHeld(this.weapon && this.weapon !== 'fist' ? this.weapon : null);
  }
  update(dt) {
    const ve = this.veh;
    if (ve && ve.net) {
      const n = ve.net, k = 1 - Math.exp(-14 * dt);
      ve.pos.x += (n.p[0] - ve.pos.x) * k; ve.pos.y += (n.p[1] - ve.pos.y) * k; ve.pos.z += (n.p[2] - ve.pos.z) * k;
      ve.yaw = dampAngle(ve.yaw, n.yaw, 14, dt); ve.pitch = damp(ve.pitch, n.pt || 0, 10, dt); ve.roll = damp(ve.roll, n.rl || 0, 10, dt);
      ve.u = n.u || 0; ve.steerAng = n.st || 0; ve.rpm = n.rpm || 900; ve.sirenOn = !!n.si; ve.rotor = n.ro || 0; ve.thr3 = n.th || 0; ve.health = n.hp ?? 1000; ve.in.brake = n.br ? 1 : 0; ve.siren = !!n.si;
      this.char.state.speed = 0; this.char.update(dt, this.char.state);
      this.tp.copy(ve.pos);
    } else {
      const k = 1 - Math.exp(-14 * dt);
      this.pos.x += (this.tp.x - this.pos.x) * k; this.pos.y += (this.tp.y - this.pos.y) * k; this.pos.z += (this.tp.z - this.pos.z) * k;
      this.yaw = dampAngle(this.yaw, this.ty, 14, dt); this.char.root.rotation.y = this.yaw;
      this.char.state.speed = this.speed; this.char.update(dt, this.char.state);
    }
  }
  remove() { this.dropVehicle(); G.scene.remove(this.char.root); this.tag.remove(); }
}

export class Multiplayer {
  constructor(G) {
    this.G = G; this.mode = 'off'; this.peer = null; this.conns = new Map(); this.hostConn = null; this.remotes = new Map(); this.me = { id: 0, name: 'Spieler' };
    this.code = ''; this.pvp = false; this.game = 'freeroam'; this.t = 0; this.envT = 0; this.chat = []; this.lastAtk = null; this.status = ''; this.nextId = 1; this.kills = { 0: 0 }; this.deaths = { 0: 0 };
    this.chatEl = h('div', { class: 'mpchat' }); this.board = h('div', { class: 'mpboard', style: { display: 'none' } });
    G.ui.hud.append(this.chatEl); G.ui.root.append(this.board);
    G.on('playerDied', () => { if (this.active) this.onLocalDeath(); });
    G.on('key', (e) => { if (!this.active) return; if (e.code === 'KeyT' && G.mode === 'play' && !G.ui.blocking) { e.preventDefault(); this.openChat(); } });
  }
  get active() { return this.mode !== 'off'; }
  get playerList() { return [{ id: this.me.id, name: this.me.name, color: COLORS[0], local: true }, ...[...this.remotes.values()].map((r) => ({ id: r.id, name: r.name, color: r.color }))]; }
  peerOpts() {
    const q = new URLSearchParams(location.search); const o = { debug: 0 };
    if (q.get('peerhost')) { o.host = q.get('peerhost'); o.port = +(q.get('peerport') || 9000); o.path = q.get('peerpath') || '/'; o.secure = q.get('peersecure') === '1'; }
    return o;
  }
  name() { return (G.settings.name || '').trim().slice(0, 14) || 'Spieler' + Math.floor(Math.random() * 90 + 10); }

  // ---------- Host ----------
  host(opts) {
    return new Promise((resolve, reject) => {
      this.leave(true); this.me.name = opts.name; this.pvp = !!opts.pvp; this.game = opts.game || 'freeroam'; this.me.id = 0;
      let tries = 0;
      const open = () => {
        const code = randCode(); this.code = code;
        const peer = this.peer = new Peer('vcity-' + code, this.peerOpts());
        peer.on('open', () => { this.mode = 'host'; this.status = 'Raum offen'; this.kills = { 0: 0 }; this.deaths = { 0: 0 }; this.onStart(); resolve(code); });
        peer.on('error', (e) => { if (e.type === 'unavailable-id' && tries++ < 5) { try { peer.destroy(); } catch (x) { /* */ } open(); } else { this.status = 'Fehler: ' + (e.type || e.message); if (this.mode === 'off') reject(e); } });
        peer.on('connection', (c) => this.onIncoming(c));
        peer.on('disconnected', () => { try { peer.reconnect(); } catch (x) { /* */ } });
      };
      open();
    });
  }
  onIncoming(conn) {
    conn.on('data', (m) => this.onHostData(conn, m));
    conn.on('close', () => this.dropConn(conn)); conn.on('error', () => this.dropConn(conn));
  }
  dropConn(conn) { const id = conn._pid; if (id === undefined || !this.conns.has(id)) return; this.conns.delete(id); this.removeRemote(id); this.toHost({ t: 'leave', id }); G.ui.toast(`${this.nameOf(id)} hat das Spiel verlassen`); }
  nameOf(id) { return id === this.me.id ? this.me.name : this.remotes.get(id)?.name ?? '?'; }
  onHostData(conn, m) {
    if (!m || !m.t) return;
    if (m.t === 'hello') {
      if (this.conns.size >= MAX_PLAYERS - 1) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 200); return; }
      const id = this.nextId++; conn._pid = id; this.conns.set(id, conn);
      const players = [{ id: 0, name: this.me.name, outfit: G.player.outfit }, ...[...this.remotes.values()].map((r) => ({ id: r.id, name: r.name, outfit: r.outfit }))];
      conn.send({ t: 'welcome', id, players, pvp: this.pvp, game: this.game, env: this.envState(), kills: this.kills, deaths: this.deaths });
      this.addRemote(id, m.name, m.outfit); this.kills[id] = 0; this.deaths[id] = 0;
      this.broadcast({ t: 'join', id, name: m.name, outfit: m.outfit }, id);
      G.ui.toast(`${m.name} ist beigetreten`); this.chatLine(`➜ ${m.name} ist beigetreten`, '#69f0ae');
      return;
    }
    const from = conn._pid; if (from === undefined) return;
    this.onData(m, from);
    // weiterleiten
    if (m.t === 'hit') { const c = this.conns.get(m.to); if (c) c.send(m); }
    else if (m.t === 'adm' || m.t === 'gift') { const c = this.conns.get(m.to); if (c) c.send(m); }
    else if (m.t === 's') { const sp = m.p, pl = G.player.position; for (const [id, c] of this.conns) { if (id === from || !c.open) continue; const r = this.remotes.get(id); const rp = r ? r.tp : pl; if ((rp.x - sp[0]) ** 2 + (rp.z - sp[2]) ** 2 < 1100 * 1100 || this.conns.size < 8) c.send(m); } }
    else if (['chat', 'shot', 'kill', 'emote', 'announce'].includes(m.t)) this.broadcast(m, from);
    if (m.t === 'kill') this.scoreKill(m);
  }
  broadcast(m, except = null) { for (const [id, c] of this.conns) if (id !== except && c.open) c.send(m); }
  toHost(m) { this.broadcast(m); }
  envState() { return { time: G.env.time, weather: G.env.target }; }

  // ---------- Client ----------
  join(code, name) {
    return new Promise((resolve, reject) => {
      this.leave(true); this.me.name = name; code = code.trim().toUpperCase();
      const peer = this.peer = new Peer(undefined, this.peerOpts());
      const fail = (msg) => { this.status = msg; try { peer.destroy(); } catch (x) { /* */ } this.peer = null; this.mode = 'off'; reject(new Error(msg)); };
      const timer = setTimeout(() => fail('Zeitüberschreitung – Raum nicht gefunden'), 15000);
      peer.on('error', (e) => { clearTimeout(timer); fail(e.type === 'peer-unavailable' ? 'Raum nicht gefunden' : 'Fehler: ' + (e.type || e.message)); });
      peer.on('open', () => {
        const conn = peer.connect('vcity-' + code, { reliable: true, serialization: 'json' }); this.hostConn = conn;
        conn.on('open', () => conn.send({ t: 'hello', name, outfit: G.player.outfit }));
        conn.on('data', (m) => {
          if (m.t === 'welcome') { clearTimeout(timer); this.me.id = m.id; this.pvp = m.pvp; this.game = m.game; this.code = code; this.mode = 'client'; this.kills = m.kills || {}; this.deaths = m.deaths || {}; for (const p of m.players) this.addRemote(p.id, p.name, p.outfit); this.applyEnv(m.env); this.onStart(); resolve(code); }
          else if (m.t === 'full') { clearTimeout(timer); fail('Raum ist voll'); }
          else this.onData(m, m.id);
        });
        conn.on('close', () => { if (this.mode === 'client') { G.ui.toast('Verbindung zum Host verloren'); this.leave(); } });
      });
    });
  }
  leave(silent = false) {
    for (const r of this.remotes.values()) r.remove(); this.remotes.clear();
    for (const c of this.conns.values()) { try { c.close(); } catch (e) { /* */ } } this.conns.clear();
    try { this.hostConn?.close(); } catch (e) { /* */ } this.hostConn = null;
    try { this.peer?.destroy(); } catch (e) { /* */ } this.peer = null;
    if (this.hillMarker) { G.markers.remove(this.hillMarker); this.hillMarker = null; }
    const was = this.mode !== 'off'; this.mode = 'off'; this.code = ''; this.chatEl.replaceChildren(); this.board.style.display = 'none';
    if (G.env) G.env.lockWeather = false;
    if (was && !silent) G.ui.toast('Mehrspieler beendet');
  }
  onStart() {
    if (this.hillMarker) { G.markers.remove(this.hillMarker); this.hillMarker = null; }
    if (this.game === 'koth') this.hillMarker = G.markers.add({ x: HILL.x, z: HILL.z, color: 0xffd54f, r: HILL.r, far: 700, y: G.world.groundY(HILL.x, HILL.z) });
    G.env.lockWeather = this.mode === 'client';
    G.ui.toast(this.mode === 'host' ? `Raum-Code: ${this.code} – Mitspieler können jetzt beitreten` : `Verbunden mit Raum ${this.code}`, 6000);
    this.chatLine(this.mode === 'host' ? `Raum ${this.code} geöffnet · ${this.game === 'deathmatch' ? 'Deathmatch (PvP)' : this.pvp ? 'Freies Spiel (PvP an)' : 'Freies Spiel (kooperativ)'} · Chat mit T` : 'Verbunden – Chat mit T (Touch: 💬)', '#ffd54f');
  }
  addRemote(id, name, outfit) { if (this.remotes.has(id)) return; const r = new Remote(this, id, name, outfit, this.remotes.size + 1); r.outfit = outfit; this.remotes.set(id, r); }
  removeRemote(id) { const r = this.remotes.get(id); if (!r) return; r.remove(); this.remotes.delete(id); this.chatLine(`➜ ${r.name} hat das Spiel verlassen`, '#ff8a80'); }

  // ---------- Nachrichten ----------
  send(m) { if (this.mode === 'host') this.broadcast(m); else if (this.mode === 'client' && this.hostConn?.open) this.hostConn.send(m); }
  onData(m, from) {
    switch (m.t) {
      case 's': { const r = this.remotes.get(m.id); if (r) r.apply(m); break; }
      case 'join': this.addRemote(m.id, m.name, m.outfit); this.kills[m.id] = 0; this.deaths[m.id] = 0; G.ui.toast(`${m.name} ist beigetreten`); this.chatLine(`➜ ${m.name} ist beigetreten`, '#69f0ae'); break;
      case 'leave': this.removeRemote(m.id); break;
      case 'chat': this.chatLine(`${this.nameOf(m.id)}: ${m.text}`, '#fff'); break;
      case 'shot': { G.fx?.muzzle(m.o[0], m.o[1], m.o[2]); G.fx?.tracer(m.o[0], m.o[1], m.o[2], m.o[0] + m.d[0] * m.l, m.o[1] + m.d[1] * m.l, m.o[2] + m.d[2] * m.l); G.audio?.gun(m.w, { x: m.o[0], y: m.o[1], z: m.o[2] }); break; }
      case 'hit': if (m.to === this.me.id && this.pvp && G.player.alive) { this.lastAtk = { id: m.by, t: G.time }; G.player.hurt(m.dmg, { remote: m.by }); } break;
      case 'kill': this.scoreKill(m, true); break;
      case 'env': this.applyEnv(m); break;
      case 'win': this.onWin(m); break;
      case 'emote': { const r = this.remotes.get(m.id); if (r) this.showEmote(r, m.e); break; }
      case 'announce': G.ui.banner(m.text, '#ffd54f'); G.ui.toast('📢 ' + m.text, 6000); this.chatLine('📢 ' + m.text, '#ffd54f'); setTimeout(() => G.ui.banner(null), 4000); break;
      case 'gift': if (m.to === this.me.id) { G.player.addMoney(Math.min(500e9, Math.max(0, +m.amt || 0)), 'Geschenk'); G.ui.toast(`🎁 ${this.nameOf(m.by)} schenkt dir ${fmtMoney(+m.amt || 0)}!`, 6000); } break;
      case 'adm': if (m.to === this.me.id) this.applyAdmin(m); break;
      case 'hill': this.hill = m.sc; break;
    }
  }
  sendTo(id, m) { if (this.mode === 'host') { const c = this.conns.get(id); if (c?.open) c.send(m); } else this.send(m); }
  gift(id, amt) {
    amt = Math.floor(+amt); if (!(amt > 0)) return; const P = G.player;
    if (!G.admin) { if (P.money < amt) return G.ui.toast('Nicht genug Geld!'); P.addMoney(-amt); } else amt = Math.min(500e9, amt);
    this.sendTo(id, { t: 'gift', to: id, by: this.me.id, amt }); G.ui.toast(`Geschenk an ${this.nameOf(id)}: ${fmtMoney(amt)}`);
  }
  sendAdmin(id, o) { if (!G.admin) return; this.sendTo(id, { t: 'adm', to: id, by: this.me.id, ...o }); G.ui.toast('Aktion gesendet'); }
  announce(text) { if (!G.admin) return; this.send({ t: 'announce', text: String(text).slice(0, 80) }); G.ui.banner(text, '#ffd54f'); setTimeout(() => G.ui.banner(null), 4000); }
  kick(id) { if (!G.admin || this.mode !== 'host') return; const c = this.conns.get(id); if (c) { try { c.send({ t: 'chat', id: 0, text: 'Du wurdest vom Host entfernt.' }); c.close(); } catch (e) { /* */ } } }
  applyAdmin(m) {
    const P = G.player; if (!P.alive) return;
    if (m.weapons) { for (const k of ['smg', 'shotgun', 'rifle', 'grenade']) P.addWeapon(k, 200); G.ui.toast('🎁 Admin schenkt dir Waffen!'); }
    if (m.heal) { P.health = P.maxHealth; P.armor = 100; G.ui.toast('❤ Admin heilt dich'); }
    if (m.vehicle) { const spec = byKey.get(m.vehicle); if (spec) { G.adminPanel.spawnVehicle(m.vehicle, 8); G.ui.toast('🚗 Admin schenkt dir ein Fahrzeug'); } }
    if (m.money) P.addMoney(Math.min(500e9, +m.money || 0), 'Geschenk');
  }
  showEmote(r, e) { r.tag.dataset.emote = e; setTimeout(() => { delete r.tag.dataset.emote; }, 3500); }
  emote(i) { const e = EMOTES[i % EMOTES.length]; this.send({ t: 'emote', id: this.me.id, e }); G.ui.toast(e); }
  joinLink() { return `${location.origin}${location.pathname}?join=${this.code}`; }
  teleportTo(id) { const r = this.remotes.get(id); if (!r || G.prison?.active) return; const P = G.player; if (P.vehicle) P.exitVehicle(true); P.teleport(r.pos.x + 2, r.pos.z + 2); P.rig.snap?.(P); G.ui.toast(`Teleport zu ${r.name}`); }
  applyEnv(e) { if (!e || this.mode === 'host') return; const d = Math.abs(((e.time - G.env.time + 36) % 24) - 12) - 12; if (Math.abs(d) > 0.05) G.env.time = e.time; if (e.weather && G.env.target !== e.weather) G.env.setWeather(e.weather); }
  sendHit(id, dmg) {
    if (!this.pvp) return; const m = { t: 'hit', to: id, dmg, by: this.me.id };
    if (this.mode === 'host') { const c = this.conns.get(id); if (c) c.send(m); } else this.hostConn?.send(m);
  }
  onLocalDeath() {
    const a = this.lastAtk && G.time - this.lastAtk.t < 8 ? this.lastAtk.id : null;
    const m = { t: 'kill', by: a, victim: this.me.id }; this.send(m); this.scoreKill(m, true, true); this.lastAtk = null;
  }
  scoreKill(m, fromNet = false, local = false) {
    this.deaths[m.victim] = (this.deaths[m.victim] || 0) + 1; if (m.by !== null && m.by !== undefined && m.by !== m.victim) this.kills[m.by] = (this.kills[m.by] || 0) + 1;
    const line = m.by === null || m.by === undefined ? `☠ ${this.nameOf(m.victim)} ist gestorben` : `☠ ${this.nameOf(m.by)} ➜ ${this.nameOf(m.victim)}`;
    if (!local || true) this.chatLine(line, '#ff8a80');
    if (this.mode === 'host' && this.game === 'deathmatch' && m.by !== null && m.by !== undefined && this.kills[m.by] >= WIN_KILLS) { const w = { t: 'win', id: m.by }; this.broadcast(w); this.onWin(w); }
  }
  onWin(m) { G.ui.banner(`${this.nameOf(m.id)} GEWINNT!`, '#ffd54f'); setTimeout(() => G.ui.banner(null), 4000); for (const k of Object.keys(this.kills)) { this.kills[k] = 0; this.deaths[k] = 0; } this.chatLine(`🏆 ${this.nameOf(m.id)} gewinnt die Runde!`, '#ffd54f'); }

  // ---------- Chat ----------
  chatLine(text, color = '#fff') {
    const el = h('div', { class: 'mpline', style: { color } }, text); this.chatEl.append(el); while (this.chatEl.children.length > 7) this.chatEl.firstChild.remove();
    setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 800); }, 12000);
  }
  openChat() {
    if (!this.active || this.chatInput) return;
    if (G.input.touch) { const t = window.prompt('Nachricht an alle:'); if (t) this.sendChat(t); return; }
    G.input.unlock();
    const inp = h('input', { class: 'mpinput pe', type: 'text', maxlength: 120, placeholder: 'Nachricht … (Enter senden, Esc abbrechen)' }); this.chatInput = inp; G.ui.hud.append(inp); inp.focus();
    const close = (send) => { const v = inp.value.trim(); inp.remove(); this.chatInput = null; if (send && v) this.sendChat(v); if (G.mode === 'play') G.input.lock(); };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') close(true); else if (e.key === 'Escape') { e.preventDefault(); close(false); } });
    inp.addEventListener('blur', () => { if (this.chatInput) close(false); });
  }
  sendChat(text) { text = text.slice(0, 120); this.chatLine(`${this.me.name}: ${text}`, '#fff'); this.send({ t: 'chat', id: this.me.id, text }); }
  announceShot(o, d, w, len) { if (!this.active) return; this.send({ t: 'shot', id: this.me.id, o: [o.x, o.y, o.z], d: [d.x, d.y, d.z], w, l: len }); }

  // ---------- pro Frame ----------
  stateMsg() {
    const P = G.player, v = P.vehicle;
    const m = { t: 's', id: this.me.id, p: [+P.position.x.toFixed(2), +P.position.y.toFixed(2), +P.position.z.toFixed(2)], yaw: +P.yaw.toFixed(3), sp: +Math.hypot(P.vel.x, P.vel.z).toFixed(2), hp: Math.round(P.health), dead: !P.alive, w: P.weapon, sw: P.swimming, aim: !!P.aim };
    if (v) m.v = { k: v.spec.key, c: v.color, p: [+v.pos.x.toFixed(2), +v.pos.y.toFixed(2), +v.pos.z.toFixed(2)], yaw: +v.yaw.toFixed(3), pt: +v.pitch.toFixed(3), rl: +v.roll.toFixed(3), u: +v.u.toFixed(2), st: +v.steerAng.toFixed(3), rpm: Math.round(v.rpm), si: v.sirenOn ? 1 : 0, ro: +(v.rotor || 0).toFixed(2), th: +(v.thr3 || 0).toFixed(2), hp: Math.round(v.health), br: v.in.brake > 0.1 ? 1 : 0, x: v.exploded ? 1 : 0 };
    return m;
  }
  update(dt) {
    if (!this.active) return;
    this.t += dt;
    if (this.t > 1 / SEND_HZ) { this.t = 0; this.send(this.stateMsg()); }
    if (this.mode === 'host' && this.game === 'koth') this.kothTick(dt);
    if (this.mode === 'host') { this.envT += dt; if (this.envT > 4) { this.envT = 0; this.broadcast({ t: 'env', ...this.envState() }); } }
    const cam = G.camera, v = new THREE.Vector3();
    for (const r of this.remotes.values()) {
      r.update(dt);
      if (performance.now() - r.last > 15000) { r.tag.style.display = 'none'; continue; }
      v.set(r.pos.x, r.pos.y + (r.veh ? r.veh.spec.hgt + 0.7 : 2.15), r.pos.z); if (r.veh) v.copy(r.veh.pos).y += r.veh.spec.hgt + 0.7; v.project(cam);
      const d = Math.hypot(r.pos.x - G.player.position.x, r.pos.z - G.player.position.z);
      if (v.z > 1 || Math.abs(v.x) > 1.2 || d > 400 || G.mode === 'cutscene') { r.tag.style.display = 'none'; continue; }
      r.tag.style.display = ''; r.tag.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px'; r.tag.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px'; r.tag.textContent = `${r.tag.dataset.emote ? r.tag.dataset.emote + ' ' : ''}${r.name} · ${Math.round(d)} m`;
    }
    // Rangliste (Tab)
    const show = G.input.down('Tab') && G.mode === 'play';
    this.board.style.display = show ? '' : 'none';
    if (show) {
      const rows = this.playerList.sort((a, b) => (this.kills[b.id] || 0) - (this.kills[a.id] || 0));
      this.board.replaceChildren(h('h3', {}, `Mehrspieler · Raum ${this.code}`), h('table', {}, h('tr', {}, h('th', {}, 'Spieler'), h('th', {}, 'Kills'), h('th', {}, 'Tode')), ...rows.map((p) => h('tr', { style: { color: p.color, fontWeight: p.local ? 700 : 400 } }, h('td', {}, p.name + (p.local ? ' (Du)' : '')), h('td', {}, this.kills[p.id] || 0), h('td', {}, this.deaths[p.id] || 0)))));
    }
  }

  kothTick(dt) {
    this.hill = this.hill || {}; this._ht = (this._ht || 0) + dt; this._hb = (this._hb || 0) + dt;
    if (this._ht >= 1) {
      this._ht = 0; const ins = (x, z) => Math.hypot(x - HILL.x, z - HILL.z) < HILL.r; const P = G.player;
      if (P.alive && ins(P.position.x, P.position.z)) this.hill[0] = (this.hill[0] || 0) + 1;
      for (const r of this.remotes.values()) if (r.alive && ins(r.pos.x, r.pos.z)) this.hill[r.id] = (this.hill[r.id] || 0) + 1;
      this.broadcast({ t: 'hill', sc: this.hill });
      for (const [id, v] of Object.entries(this.hill)) if (v >= HILL.win) { this.hill = {}; const m = { t: 'win', id: +id }; this.broadcast(m); this.onWin(m); break; }
    }
  }
  // ---------- Oberfläche ----------
  menu() {
    const ui = G.ui, S = G.settings;
    const name = h('input', { type: 'text', maxlength: 14, placeholder: 'Dein Name', value: S.name || '', class: 'mpfield' });
    const code = h('input', { type: 'text', maxlength: 5, placeholder: 'CODE', class: 'mpfield mpcode', value: S.lastRoom || '', style: { textTransform: 'uppercase' } });
    const mode = h('select', { class: 'mpfield' }, h('option', { value: 'freeroam' }, 'Freies Spiel (kooperativ)'), h('option', { value: 'freepvp' }, 'Freies Spiel (PvP an)'), h('option', { value: 'deathmatch' }, 'Deathmatch (PvP, erster mit 20 Kills)'), h('option', { value: 'koth' }, 'King of the Hill (Hügel im Central Park halten)'));
    const msg = h('div', { class: 'd', style: { minHeight: '20px', margin: '8px 0' } }, 'Bis zu 24 Spieler · direkte Verbindung (WebRTC) über einen kostenlosen Vermittlungsserver (PeerJS).');
    const begin = (fn) => async () => {
      const nm = (name.value || '').trim() || this.name(); S.name = nm; if ((code.value || '').trim()) S.lastRoom = code.value.trim().toUpperCase(); G.applySettings(); G.ui.updateProfile?.(); msg.textContent = 'Verbinde …';
      try {
        const c = await fn(nm);
        const wasMenu = G.mode === 'menu';
        ui.closeModal(true);
        if (wasMenu) ui.startGame(!G.eco.hasAnySave() || false);
        else if (G.mode === 'pause') { ui.closePause(); }
        G.ui.toast(this.mode === 'host' ? `Dein Raum-Code: ${c}` : `Beigetreten: Raum ${c}`, 6000);
      } catch (e) { msg.textContent = '⚠ ' + (e.message || 'Fehlgeschlagen'); }
    };
    const body = h('div', { class: 'body' },
      h('h3', {}, 'Name'), name,
      h('h3', {}, 'Raum erstellen'), mode,
      h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn primary', onClick: begin((nm) => this.host({ name: nm, pvp: mode.value === 'freepvp' || mode.value === 'deathmatch', game: mode.value === 'deathmatch' ? 'deathmatch' : mode.value === 'koth' ? 'koth' : 'freeroam' })) }, '🏠 Raum erstellen')),
      h('h3', {}, 'Raum beitreten'), h('div', { style: { display: 'flex', gap: '8px' } }, code, h('button', { class: 'btn primary', onClick: begin((nm) => this.join(code.value, nm)) }, '➜ Beitreten')),
      msg,
      h('div', { class: 'd' }, 'Hinweis: Jeder spielt in seiner eigenen Stadt-Simulation (Verkehr/Passanten sind lokal). Spieler, Fahrzeuge, Schüsse, Uhrzeit und Wetter werden synchronisiert.'));
    ui.modal('Mehrspieler', body, { cash: false });
  }
  tab(c) {
    c.replaceChildren(h('h2', {}, 'Mehrspieler'));
    if (!this.active) { c.append(h('p', { class: 'd' }, 'Du bist in keinem Raum.'), h('button', { class: 'btn primary', onClick: () => this.menu() }, 'Raum erstellen / beitreten')); return; }
    const gname = this.game === 'deathmatch' ? 'Deathmatch' : this.game === 'koth' ? 'King of the Hill' : this.pvp ? 'PvP an' : 'kooperativ';
    c.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, `Raum-Code: ${this.code}`), h('div', { class: 'd' }, `${this.mode === 'host' ? 'Du bist Host' : 'Du bist Mitspieler'} · ${gname} · ${this.playerList.length}/${MAX_PLAYERS} Spieler`)), h('button', { class: 'btn small', onClick: () => { navigator.clipboard?.writeText(this.code); G.ui.toast('Code kopiert'); } }, 'Code'), h('button', { class: 'btn small', onClick: () => { navigator.clipboard?.writeText(this.joinLink()); G.ui.toast('Einladungs-Link kopiert'); } }, '🔗 Link')));
    if (this.game === 'koth') c.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, '👑 Hügel im Central Park halten'), h('div', { class: 'd' }, `Erster mit ${HILL.win} Punkten gewinnt.`)), h('button', { class: 'btn small', onClick: () => { G.waypoint = { x: HILL.x, z: HILL.z }; } }, 'GPS')));
    c.append(h('h3', {}, 'Emotes'), h('div', { class: 'sel' }, ...EMOTES.map((e, i) => h('button', { class: 'btn small', onClick: () => this.emote(i) }, e))));
    const gamt = h('input', { type: 'number', class: 'mpfield', min: 0, value: 1000, style: { width: '140px' } });
    c.append(h('h3', {}, 'Spieler'), h('div', { class: 'field' }, h('label', {}, 'Geschenk-Betrag'), gamt));
    for (const p of this.playerList) c.append(h('div', { class: 'row' }, h('div', { class: 'grow t', style: { color: p.color } }, p.name + (p.local ? ' (Du)' : '')), h('div', { class: 'd' }, `Kills ${this.kills[p.id] || 0} · Tode ${this.deaths[p.id] || 0}${this.hill?.[p.id] ? ' · 👑 ' + this.hill[p.id] : ''}`),
      !p.local && h('button', { class: 'btn small', onClick: () => { const r = this.remotes.get(p.id); if (r) { G.waypoint = { x: r.pos.x, z: r.pos.z }; G.ui.toast('GPS auf ' + r.name); } } }, 'GPS'),
      !p.local && h('button', { class: 'btn small', onClick: () => { this.teleportTo(p.id); G.ui.closePause?.(); } }, 'Teleport'),
      !p.local && h('button', { class: 'btn small', onClick: () => this.gift(p.id, +gamt.value) }, '🎁 Geld')));
    c.append(h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn', onClick: () => { this.leave(); G.ui.renderPause(); } }, 'Raum verlassen')));
  }
}
