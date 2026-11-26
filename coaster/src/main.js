// ============================================================================
//  main.js – Anwendung: Renderer, Zustände (Menü / Fahrt / Park), Kameras, Eingabe
// ============================================================================
import * as THREE from 'three';
import { Environment, WEATHERS } from './env.js';
import { ParkWorld, getTrack, clearTrackCache } from './park.js';
import { buildDatabase } from './data/index.js';
import { UI, CAM_LIST } from './ui.js';
import { poseAt, newPose } from './track.js';
import { AudioFx } from './audio.js';
import { CATS } from './specs.js';
import { seatLayout } from './train.js';
import { Net } from './net.js';
import { PhantasiaWorld, ZONES } from './phantasia.js';
import { PLGame } from './pl_game.js';
import { Editor } from './pl_editor.js';
import { Touch } from './touch.js';
import { Post } from './post.js';
import { Player } from './pl_player.js';
import { Account } from './account.js';
import { applyMaterialQuality } from './pl_quality.js';

const LS = {
  get(k, d) { try { const v = localStorage.getItem('ecs_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ecs_' + k, JSON.stringify(v)); } catch (e) { /* ignorieren */ } },
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (k, dt) => 1 - Math.exp(-k * dt);

class App {
  constructor() {
    this.canvas = document.getElementById('gl');
    this.settings = Object.assign({ quality: matchMedia('(pointer: coarse)').matches ? 'medium' : 'high', shadows: true, fov: 75, sens: 1, vol: 0.6, hour: 17.6, weather: 'clear', playerColor: '#1e88e5' }, LS.get('settings', {}));
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.3, 30000);
    this.scene.add(this.camera);
    this.env = new Environment(this.scene, this.renderer);
    this.post = new Post(this.renderer, this.scene, this.camera);
    this.env.setTime(this.settings.hour); this.env.setWeather(this.settings.weather); this.env.apply(true);
    this.audio = new AudioFx(); this.audio.vol = this.settings.vol;
    this.env.onThunder = () => this.audio.thunder();
    this.custom = LS.get('custom', []);
    this.favs = new Set(LS.get('favs', []));
    this.db = buildDatabase(this.custom);
    this.state = 'menu'; this.timeScale = 1; this.paused = false;
    this.park = null; this.ride = null; this.coaster = null;
    this.camMode = 'fp'; this.parkMode = 'fly';
    this.look = { yaw: 0, pitch: 0, idle: 0 };
    this.free = { pos: new THREE.Vector3(0, 120, 300), yaw: 0, pitch: -0.3, speed: 60 };
    this.walk = { pos: new THREE.Vector3(0, 1.75, 150), yaw: -Math.PI / 2, pitch: 0 };
    this.drone = { yaw: 0.8, pitch: 0.35, dist: 34, pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
    this.outside = { pos: new THREE.Vector3(), idx: -1, timer: 0, side: 1 };
    this.seat = { car: -1, row: 0, s: -1 };
    this.chase = { pos: new THREE.Vector3(), init: false };
    this.visIdx = 0; this.walkFov = 72; this.bird = { zone: 'klugheim', a: 0.6, r: 230, h: 170 }; this.rec = null; this.lastRec = null; this.replay = null; this.lockWanted = false;
    this.keys = new Set(); this.hudOn = true;
    this.menuOrbit = 0;
    this.camQ = new THREE.Quaternion(); this.camInit = false;
    this.tp = { dist: 5.2 }; this.pface = 0; this.pspeed = 0;
    this.headLight = new THREE.PointLight(0xffe2b0, 0, 24, 1.6); this.scene.add(this.headLight);
    this.net = new Net(this);
    this.account = new Account();
    this.game = new PLGame(this); this.editor = new Editor(this); this.noKeys = new Set();
    this.player = new Player(this.scene, this.game.lookNow());
    this.ui = new UI(this);
    this.touch = new Touch(this);
    this.net.onChange = chat => this.ui.refreshNet(chat);
    this.bindInput();
    this.applyQuality();
    window.addEventListener('resize', () => this.resize()); this.resize();
    this.clock = new THREE.Clock(); this.miniT = 0;
    this._pose = newPose();
    // Startpark laden
    const qs = new URLSearchParams(location.search), joining = qs.has('room') || qs.has('peerhost') || qs.has('light'); // beim Beitreten: leichten Park laden, der Host bestimmt den Park
    const startPark = joining ? 'Europa-Park' : LS.get('lastPark', 'Phantasialand');
    this.loadPark(this.db.parks[startPark] ? startPark : Object.keys(this.db.parks)[0]).then(() => { this.ui.loading(false); this.showMenu(); if (new URLSearchParams(location.search).get('room')) this.ui.tab('online'); this.startLogin(); });
    this.loop();
    window.__app = this; // Debug / Tests
  }

  // ------------------------------------------------------------------ Konto
  async startLogin() {
    const acc = this.account;
    if (!acc.required) { acc.guest = !acc.token; this.settings.name = acc.name || this.settings.name; this.ui.refreshAccount(); return; }
    if (acc.token && await acc.verify()) { await this.onLogin(); return; }
    this.ui.showLogin();
  }
  async onLogin() {
    const acc = this.account; this.settings.name = acc.name; this.saveSettings(); this.game.switchUser(acc.name);
    const cloud = await acc.cloudLoad(); if (cloud) this.game.applyCloud(cloud);
    this.game.S.name = acc.name; this.ui.hideLogin(); this.ui.refreshAccount(); this.ui.tab(this.ui.curTab === 'db' ? 'db' : 'hub'); this.ui.toast('Willkommen, ' + acc.name + '!');
  }
  async logout() { await this.account.logout(); this.game.autosave(); this.ui.showLogin(); }

  // Automatische Qualitätsanpassung: sinkt die Bildrate dauerhaft unter ~20 FPS, werden teure Effekte schrittweise abgeschaltet
  perfGuard(raw) {
    if (navigator.webdriver || this.settings.adaptive === false || this.state === 'menu' || this.paused || raw > 0.5) return;
    const g = this._pg || (this._pg = { t: 0, n: 0, sum: 0, cool: 6 }); g.cool -= raw; if (g.cool > 0) return;
    g.sum += raw; g.n++; g.t += raw; if (g.t < 3) return;
    const avg = g.sum / g.n; g.t = g.sum = g.n = 0; if (avg <= 0.05) return; g.cool = 5; const s = this.settings; let msg = '';
    if (this.aoOn()) { s.ao = false; msg = 'Ambient Occlusion aus'; }
    else if (this.post.enabled && this.post.bloom.enabled) { this.post.noBloom = true; msg = 'Bloom aus'; }
    else if (this.lookOn()) { s.look = false; msg = 'Vice-City-Look aus'; }
    else if (s.quality === 'high') { s.quality = 'medium'; msg = 'Qualität: Mittel'; }
    else if (s.shadows) { s.shadows = false; msg = 'Schatten aus'; }
    else if (s.quality === 'medium') { s.quality = 'low'; msg = 'Qualität: Niedrig'; }
    else return;
    this.applyQuality(); this.ui.toast('⚙ Grafik automatisch angepasst (zu wenig FPS): ' + msg, 4500);
  }

  // ------------------------------------------------------------------ Einstellungen
  applyLook() { if (!this.player) return; this.player.setLook(this.game.lookNow()); if (this.net && this.net.active) this.net.lookDirty = true; }
  pp() { return this.state === 'park' && this.parkMode === 'walk' ? this.walk.pos : this.camera.position; } // Position der Spielerfigur (nicht der Kamera)
  aoOn() { if (this.settings.ao !== undefined) return !!this.settings.ao; return this.settings.quality === 'high' && !matchMedia('(pointer: coarse)').matches && !navigator.webdriver; } // Standard: nur auf großen Geräten
  lookOn() { const q = new URLSearchParams(location.search); if (q.has('look')) return q.get('look') !== '0'; if (this.settings.look !== undefined) return !!this.settings.look; return !navigator.webdriver; } // Standard an (außer in automatisierten Tests)
  saveSettings() { this.settings.hour = this.env.hour; this.settings.weather = this.env.weatherName; LS.set('settings', this.settings); }
  applyQuality() {
    const q = this.settings.quality, dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'low' ? 0.75 : q === 'medium' ? Math.min(dpr, 1.25) : Math.min(dpr, 2));
    this.env.setShadows(this.settings.shadows && q !== 'low', q === 'high' ? 4096 : 2048);
    this.renderer.shadowMap.enabled = this.settings.shadows && q !== 'low';
    this.post.setQuality(q, this.lookOn(), this.aoOn());
    this.resize();
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); if (this.post) this.post.resize(w, h);
  }
  toggleFav(id) { if (this.favs.has(id)) this.favs.delete(id); else this.favs.add(id); LS.set('favs', [...this.favs]); }
  addCustom(j) {
    if (!j || !j.park || !Array.isArray(j.rows) || !j.rows.length) throw new Error('JSON braucht "park" und "rows"');
    for (const r of j.rows) { if (r.length < 9) throw new Error('Jede Zeile braucht: Name, Typ, Hersteller, Jahr, Höhe, Länge, km/h, Dauer, Inversionen'); }
    this.custom.push(j); LS.set('custom', this.custom); this.db = buildDatabase(this.custom); clearTrackCache();
    this.ui.tab('db');
  }
  removeCustom(c) {
    this.custom = this.custom.map(p => ({ ...p, rows: p.rows.filter(r => !(r[0] === c.name && p.park === c.park)) })).filter(p => p.rows.length);
    LS.set('custom', this.custom); this.db = buildDatabase(this.custom); this.ui.sel = null; this.ui.tab('db');
  }

  // ------------------------------------------------------------------ Park laden
  async loadPark(name) {
    if (this.park && this.park.def.name === name && this.park.quality === this.settings.quality) return this.park;
    this.ui.loading(true, `Lade ${name} …`, 'Bahnen, Wege, Gebäude und Besucher werden gebaut');
    await new Promise(r => setTimeout(r, 40));
    this.net.remotes.forEach(r => r.detach());
    if (this.park) { this.scene.remove(this.park.group); this.park.dispose(); this.park = null; }
    const def = this.db.parks[name];
    const t0 = performance.now();
    this.env.fogMul = 1; this.env.ambMul = 1; this.env.fogTint = null; this.env.fogTintAmt = 0;
    this.replayExit(true);
    const world = name === 'Phantasialand' ? new PhantasiaWorld(def, this.env, { quality: this.settings.quality }) : new ParkWorld(def, this.env, { quality: this.settings.quality });
    this.scene.add(world.group); world.group.updateMatrixWorld(true);
    try { const t0q = performance.now(); const nq = applyMaterialQuality(world.group, { terrain: world.terrainMesh, strength: 0.85 }); console.log(`[Grafik] ${nq} Materialien mit Normal Maps in ${(performance.now() - t0q).toFixed(0)} ms`); } catch (e) { console.warn('Normal Maps übersprungen', e); }
    this.park = world; this.ride = null; this.game.stopNav(); this.game.lapSeen.clear(); this.game.room = null;
    if (world.setWinter && this.game.S.winter) world.setWinter(true);
    this.ui.setPark(world);
    LS.set('lastPark', name);
    this.free.pos.set(0, 140, world.gate.z + 220); this.free.yaw = -Math.PI / 2; this.free.pitch = -0.28;
    this.walk.pos.set(world.gate.x, 1.75, world.gate.z - 12); this.walk.yaw = world.groundAt ? 0 : -Math.PI / 2; this.walk.pitch = 0; this.walk.vy = 0;
    if (world.groundAt) { this.free.pos.set(0, 120, world.gate.z + 120); this.free.yaw = 0; this.free.pitch = -0.4; }
    console.log(`[Park] ${name}: ${world.rides.length} Bahnen in ${(performance.now() - t0).toFixed(0)} ms`);
    return world;
  }

  // ------------------------------------------------------------------ Zustände
  canResume() { return !!this.ride || (this.park && this.state === 'menu' && this.prevState && this.prevState !== 'menu'); }
  showMenu() {
    if (this.state !== 'menu') this.prevState = this.state;
    this.lockWanted = false; document.exitPointerLock?.();
    this.state = 'menu'; this.audio.update(0.016, 0, 'menu', false, 0); this.ui.setMode('menu');
  }
  resume() { if (this.prevState === 'ride' && this.ride) this.enterRide(this.ride); else if (this.park) this.enterPark(); }

  async openRide(c) {
    this.audio.start(); this.audio.setVolume(this.settings.vol);
    if (this.net.active && !this.net.isHost && (!this.park || this.park.def.name !== c.park)) { this.ui.toast('Online: Nur der Host wechselt den Park (aktuell: ' + (this.park ? this.park.def.name : '–') + ')', 3500); return; }
    await this.loadPark(c.park);
    this.net.announcePark();
    this.ui.loading(false);
    const r = this.park.rides.find(x => x.coaster.id === c.id);
    if (r) this.enterRide(r, true);
  }
  async openPark(name) {
    this.audio.start();
    if (this.net.active && !this.net.isHost && (!this.park || this.park.def.name !== name)) { this.ui.toast('Online: Nur der Host wechselt den Park', 3000); return; }
    await this.loadPark(name); this.net.announcePark(); this.ui.loading(false);
    this.enterPark();
  }
  rideOn(r) { this.audio.start(); this.enterRide(r, true); }
  toPark() { if (this.park) this.enterPark(); }

  enterRide(r, fresh = false) {
    this.state = 'ride'; this.ride = r; this.coaster = r.coaster;
    if (fresh) { if (!this.net.active) { r.sim.reset(0); r.sim.timer = 30; r.sim.dispatch = 22; } this.camMode = this.camMode === 'free' ? 'fp' : this.camMode; this.seat = { car: -1, row: 0, s: -1 }; this.look.yaw = this.look.pitch = 0; this.outside.idx = -1; this.chase.init = false; }
    this.game.lapSeen.set(r.sim, r.sim.lap);
    this.ui.setMode('ride'); this.ui.setRide(r.coaster); this.ui.setTrains(r); this.ui.setCam(this.camMode); this.camInit = false;
    this.setCamera(this.camMode, true);
    this.ui.toast(`${r.coaster.name} – ${r.coaster.park}`);
  }
  departNow() { const r = this.ride; if (!r || r.sim.state !== 'station') return; if (this.net.active && !this.net.isHost) this.net.send({ t: 'dispatch', r: this.park.rides.indexOf(r) }); else r.sim.timer = Math.min(r.sim.timer, 0.3); }
  exitRide() { // Aussteigen: zurück auf die Wege direkt vor dem Eingang der Bahn
    const r = this.ride; if (!r) return; this.replayExit(true); const e = r.entrance, d = r.dir || [0, 1];
    this.enterPark();
    const gx = e.x + d[0] * 3, gz = e.z + d[1] * 3; this.camera.position.set(gx, (this.park.groundAt ? this.park.groundAt(gx, gz, 60) : 0) + 3, gz);
    this.free.yaw = Math.atan2(-d[0], -d[1]); this.free.pitch = 0; this.setParkMode('walk'); this.ui.toast('Ausgestiegen – bis zum nächsten Mal!');
  }
  enterPark() {
    this.state = 'park'; this.ride = null; this.coaster = null;
    this.ui.setMode('park'); this.ui.setRide({ name: this.park.def.name, park: (this.park.def.city || '') + ' · Park erkunden', cc: this.park.def.cc }); this.camInit = false;
    this.ui.toast('Park erkunden – Fliegen, Gehen oder Besucher beobachten');
    for (const r of this.park.rides) r.train.showAll();
  }
  setParkMode(m) {
    this.parkMode = m; this.camInit = false;
    if (m === 'walk') { const cp = this.camera.position; this.walk.pos.set(cp.x, (this.park.groundAt ? this.park.groundAt(cp.x, cp.z, 60) : 0) + 1.75 + 0.2, cp.z); this.walk.yaw = this.free.yaw; this.walk.vy = 0; this.walk.pitch = 0; this.pface = this.walk.yaw + Math.PI; this.player.yaw = this.pface; this.ui.toast('Klicken = Maus einfangen · WASD laufen · Leertaste springen · Mausrad zoomen · Esc Menü', 5000); }
    if (m === 'fly') { this.free.pos.copy(this.camera.position); const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ'); this.free.yaw = e.y; this.free.pitch = e.x; }
    if (m === 'bird') this.camInit = false;
    this.ui.toast(m === 'fly' ? 'Flug-Modus · WASD, Q/E, Shift' : m === 'bird' ? 'Vogelperspektive · Mausrad = Abstand, WASD = frei fliegen' : m === 'walk' ? 'Geh-Modus · WASD, Shift = rennen' : 'Besucher beobachten · N = nächster');
  }
  setCamera(id, silent) {
    if (this.state !== 'ride') { if (id === 'free') this.setParkMode('fly'); return; }
    this.camMode = id; this.ui.setCam(id); this.camInit = false; this.outside.idx = -1; this.chase.init = false;
    if (id === 'free') { this.free.pos.copy(this.camera.position); const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ'); this.free.yaw = e.y; this.free.pitch = e.x; }
    if (id === 'drone') { this.drone.pos.copy(this.camera.position); }
    this.look.yaw = this.look.pitch = 0;
    this.updateRiderVisibility();
    if (!silent) this.ui.toast(CAM_LIST.find(c => c[0] === id)[1]);
  }
  updateRiderVisibility() {
    const r = this.ride; if (!r) return;
    const own = ['fp', 'front', 'rear'].includes(this.camMode);
    if (own) r.train.hideRidersOf(this.seatCar(r)); else r.train.showAll();
  }
  flyTo(r) {
    const p = r.entrance; this.state !== 'park' && this.enterPark(); this.parkMode = 'fly';
    this.free.pos.set(p.x + r.dir[0] * 50, 45, p.z + r.dir[1] * 50); this.free.yaw = Math.atan2(-r.dir[1], -r.dir[0]); this.free.pitch = -0.2; this.camInit = false;
  }
  flyToXZ(x, z) { this.state !== 'park' && this.enterPark(); this.parkMode = 'fly'; this.free.pos.set(x, 70, z + 90); this.free.yaw = -Math.PI / 2; this.free.pitch = -0.35; }

  // ------------------------------------------------------------------ Eingabe
  bindInput() {
    const c = this.canvas;
    let drag = false, lx = 0, ly = 0;
    c.addEventListener('pointerdown', e => { if (this.state === 'park' && this.parkMode === 'walk' && !document.pointerLockElement && e.pointerType !== 'touch' && !this.ui.modal) { this.lockWanted = true; c.requestPointerLock?.(); } drag = true; lx = e.clientX; ly = e.clientY; c.setPointerCapture(e.pointerId); this.audio.start(); });
    c.addEventListener('pointerup', e => { drag = false; });
    c.addEventListener('pointermove', e => {
      if (!drag && document.pointerLockElement !== c) return;
      const locked = document.pointerLockElement === c;
      const dx = locked ? e.movementX : e.clientX - lx, dy = locked ? e.movementY : e.clientY - ly; lx = e.clientX; ly = e.clientY;
      const s = 0.0042 * this.settings.sens;
      this.look.idle = 0;
      if (this.state === 'ride') {
        if (this.camMode === 'drone') { this.drone.yaw -= dx * s; this.drone.pitch = clamp(this.drone.pitch + dy * s, -0.2, 1.4); }
        else if (this.camMode === 'free') { this.free.yaw -= dx * s; this.free.pitch = clamp(this.free.pitch - dy * s, -1.5, 1.5); }
        else { this.look.yaw = clamp(this.look.yaw - dx * s, -2.6, 2.6); this.look.pitch = clamp(this.look.pitch - dy * s, -1.2, 1.2); }
      } else if (this.state === 'park') {
        const o = this.parkMode === 'walk' ? this.walk : this.free;
        o.yaw -= dx * s; o.pitch = clamp(o.pitch - dy * s, -1.5, 1.5);
      }
    });
    c.addEventListener('wheel', e => {
      e.preventDefault();
      if (this.state === 'ride' && this.camMode === 'drone') this.drone.dist = clamp(this.drone.dist * (1 + Math.sign(e.deltaY) * 0.1), 8, 160);
      else if (this.state === 'park' && this.parkMode === 'walk') this.tp.dist = clamp(this.tp.dist * (1 + Math.sign(e.deltaY) * 0.1), 2.2, 14);
      else if (this.state === 'park' && this.parkMode === 'bird') { this.bird.r = clamp(this.bird.r * (1 + Math.sign(e.deltaY) * 0.1), 60, 700); this.bird.h = clamp(this.bird.h * (1 + Math.sign(e.deltaY) * 0.1), 40, 600); }
      else if (this.state === 'park' || this.camMode === 'free') this.free.speed = clamp(this.free.speed * (1 - Math.sign(e.deltaY) * 0.12), 8, 600);
      else this.zoom = clamp((this.zoom || 0) + Math.sign(e.deltaY) * 4, -25, 30);
    }, { passive: false });
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && this.lockWanted && this.state === 'park' && this.parkMode === 'walk') { this.lockWanted = false; this.showMenu(); } });
    window.addEventListener('keydown', e => {
      if (e.target.id === 'chatIn') { if (e.key === 'Enter') { this.net.sendChat(e.target.value); e.target.value = ''; e.target.blur(); } else if (e.key === 'Escape') e.target.blur(); e.stopPropagation(); return; }
      if (e.key === 'Enter' && this.net.active && this.state !== 'menu') { e.preventDefault(); document.getElementById('chatIn')?.focus(); return; }
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.key !== 'Escape') return;
      this.keys.add(e.code);
      const k = e.key;
      if (k === 'Escape') { if (this.state === 'menu') { if (this.canResume()) this.resume(); } else this.showMenu(); e.preventDefault(); return; }
      if (this.state === 'menu') return;
      if (this.ui.modal) return;
      if (/^[1-8]$/.test(k) && this.state === 'ride') this.setCamera(CAM_LIST[+k - 1][0]);
      else if ((k === 'v' || k === 'V') && this.state === 'ride') this.replay ? this.replayExit() : this.replayStart();
      else if ((k === '[' || k === ']') && this.state === 'ride') this.selectTrain(this.ride.sets ? (this.ride.sets.findIndex(x => x.sim === this.ride.sim) + 1) % this.ride.sets.length : 0);
      else if (k === 'c' || k === 'C') { if (this.state === 'ride') { const i = CAM_LIST.findIndex(x => x[0] === this.camMode); this.setCamera(CAM_LIST[(i + 1) % CAM_LIST.length][0]); } }
      else if (k === 'p' || k === 'P') { this.paused = !this.paused; this.ui.toast(this.paused ? 'Pause' : 'Weiter'); }
      else if (k === 'm' || k === 'M') this.openMapOrMini();
      else if ((k === 'e' || k === 'E') && this.state === 'park' && this.parkMode === 'walk') this.game.interact();
      else if (k === 'k' || k === 'K') this.game.takePhoto('Foto');
      else if ((k === 'i' || k === 'I') && this.park && this.park.def.name === 'Phantasialand') this.ui.openPanel('inventory');
      else if ((k === 'u' || k === 'U') && this.park && this.park.def.name === 'Phantasialand') this.ui.openPanel('wardrobe');
      else if ((k === 'g' || k === 'G') && this.state === 'ride') this.departNow();
      else if (k === 'Tab') { e.preventDefault(); if (this.state === 'ride') this.enterPark(); else if (this.state === 'park') { const r = this.park.rides[0]; if (r) this.enterRide(r); } }
      else if (k === 't' || k === 'T') { this.env.setTime(this.env.hour + 3); this.ui.root.querySelectorAll('#mTime,#hTime').forEach(x => x.value = this.env.hour); this.ui.toast('Uhrzeit ' + this.ui.clock(this.env.hour)); this.saveSettings(); }
      else if (k === 'r' || k === 'R') { const ks = Object.keys(WEATHERS); const n = ks[(ks.indexOf(this.env.weatherName) + 1) % ks.length]; this.env.setWeather(n); this.ui.root.querySelectorAll('#mWeather,#hWeather').forEach(x => x.value = n); this.ui.toast('Wetter: ' + WEATHERS[n].label); this.saveSettings(); }
      else if (k === 'h' || k === 'H') { this.hudOn = !this.hudOn; document.getElementById('hud').style.opacity = this.hudOn ? 1 : 0; }
      else if (k === 'f' || k === 'F') { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }
      else if (k === 'n' || k === 'N') { this.visIdx = (this.visIdx + 1 + Math.floor(Math.random() * 7)) % (this.park ? this.park.vis.length : 1); }
      else if (e.code === 'Space') {
        e.preventDefault();
        if (this.replay) { this.replay.playing = !this.replay.playing; return; }
        if (this.state === 'park' && this.parkMode === 'walk') { this.walk.jump = true; return; }
        if (this.state === 'ride' && this.ride.sim.state === 'station') { this.exitRide(); return; }
        this.look.yaw = this.look.pitch = 0;
      } else if (this.state === 'ride' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault();
        const spec = this.ride.spec, sl = seatLayout(spec);
        const cur = this.seatSel();
        if (e.code === 'ArrowLeft') this.seat.s = Math.max(0, cur.s - 1);
        if (e.code === 'ArrowRight') this.seat.s = Math.min(spec.across - 1, cur.s + 1);
        if (e.code === 'ArrowUp') { if (cur.row > 0) this.seat.row = cur.row - 1; else { this.seat.car = Math.max(0, cur.car - 1); this.seat.row = (spec.rows || 1) - 1; } }
        if (e.code === 'ArrowDown') { if (cur.row < (spec.rows || 1) - 1) this.seat.row = cur.row + 1; else { this.seat.car = Math.min(spec.cars - 1, cur.car + 1); this.seat.row = 0; } }
        this.seat.s = this.seat.s < 0 ? cur.s : this.seat.s; this.seat.car = this.seat.car < 0 ? cur.car : this.seat.car;
        this.seat.custom = true; this.updateRiderVisibility(); this.ui.toast(`Wagen ${this.seat.car + 1} · Reihe ${this.seat.row + 1} · Platz ${this.seat.s + 1}`);
      }
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  // ------------------------------------------------------------------ Replay / Zugauswahl / Vogelperspektive
  recordTick(dt) {
    const r = this.ride; if (!r || this.replay || this.state !== 'ride') return;
    const s = r.sim;
    if (s.state === 'run') {
      if (!this.rec || this.rec.sim !== s || this.rec.done) this.rec = { ride: r, sim: s, acc: 0, samples: [], done: false };
      this.rec.acc += dt;
      while (this.rec.acc >= 1 / 30) { this.rec.acc -= 1 / 30; if (this.rec.samples.length < 6000) this.rec.samples.push([s.s, s.v, s.g.vert, s.g.lat]); }
    } else if (s.state === 'station' && this.rec && this.rec.sim === s && !this.rec.done && this.rec.samples.length > 30) { this.rec.done = true; this.lastRec = this.rec; }
  }
  replayStart() {
    const r = this.ride; if (!r) return;
    const rec = (this.lastRec && this.lastRec.sim === r.sim) ? this.lastRec : (this.rec && this.rec.sim === r.sim && this.rec.samples.length > 30 ? this.rec : null);
    if (!rec) { this.ui.toast('Noch keine Aufzeichnung – erst eine Fahrt fahren (Replay: V)', 3500); return; }
    const sim = r.sim;
    this.replay = { rec, t: 0, playing: true, speed: 1, saved: { s: sim.s, v: sim.v, state: sim.state, timer: sim.timer, lap: sim.lap, arriving: sim.arriving, a: sim.a } };
    r.replayHook = () => this.replayApply();
    this.ui.replayShow(true); this.ui.toast('Replay – Leertaste Pause · V beenden · Kamera frei wählbar (1–8)', 4000);
  }
  replayApply() {
    const rp = this.replay; if (!rp) return;
    const sm = rp.rec.samples, n = sm.length;
    if (rp.playing) { rp.t += this._dt * 30 * rp.speed; if (rp.t >= n - 1) { rp.t = n - 1; rp.playing = false; } }
    if (rp.t < 0) rp.t = 0;
    const i = Math.min(n - 2, Math.floor(rp.t)), f = rp.t - i, a = sm[i], b = sm[i + 1] || a, sim = this.ride.sim;
    sim.s = a[0] + (b[0] - a[0]) * f; sim.v = a[1] + (b[1] - a[1]) * f; sim.g.vert = a[2] + (b[2] - a[2]) * f; sim.g.lat = a[3] + (b[3] - a[3]) * f;
    sim.state = 'run'; sim.arriving = sim.s >= sim.tr.L; this.ui.replayUpdate(rp.t / Math.max(1, n - 1), rp.playing);
  }
  replayExit(silent) {
    const rp = this.replay; if (!rp) return;
    const r = this.ride; if (r) { r.replayHook = null; Object.assign(r.sim, rp.saved); }
    this.replay = null; this.ui.replayShow(false); if (!silent) this.ui.toast('Live');
  }
  selectTrain(i) {
    const r = this.ride; if (!r || !r.sets || !r.sets[i]) return;
    if (this.replay) this.replayExit(true);
    r.train.showAll(); r.sim = r.sets[i].sim; r.train = r.sets[i].train; this.updateRiderVisibility(); this.ui.setTrains(r); this.camInit = false;
    this.ui.toast('Zug ' + (i + 1) + ' ausgewählt');
  }
  birdsEye(zone) { this.bird.zone = zone; this.bird.r = 230; this.bird.h = 170; if (this.state !== 'park') this.enterPark(); this.parkMode = 'bird'; this.camInit = false; this.ui.toast('Vogelperspektive – ' + ZONES[zone].name); }
  async phantasia(mode) {
    await this.openPark('Phantasialand');
    const g = this.park.gate; this.camera.position.set(g.x, 3, g.z - 14); this.free.yaw = 0; this.free.pitch = 0;
    if (mode === 'walk') this.setParkMode('walk'); else if (mode === 'bird') this.birdsEye('klugheim'); else this.setParkMode('fly');
  }

  // ------------------------------------------------------------------ Phantasialand-Spielsystem
  openMapOrMini() { if (this.park && this.park.def.name === 'Phantasialand') this.ui.openMap(); else this.ui.toggleMini(); }
  cycleCamera() { if (this.state !== 'ride') return; const i = CAM_LIST.findIndex(x => x[0] === this.camMode); this.setCamera(CAM_LIST[(i + 1) % CAM_LIST.length][0]); }
  setWinter(on) {
    this.game.S.winter = !!on; if (on) this.game.S.stats.flags.winter = 1;
    if (this.park && this.park.setWinter) this.park.setWinter(!!on); else this.env.setWeather(on ? 'snow' : 'clear');
    this.ui.syncEnv(); this.saveSettings(); this.game.checkAchievements();
    this.ui.toast(on ? '❄ Wintertraum: Schnee, Lichterketten, Weihnachtsmarkt' : 'Sommer');
  }
  async phantasiaPlay() {
    await this.openPark('Phantasialand'); const g = this.game;
    g.spawnGate(true);
    const gate = this.park.interactables.find(i => i.type === 'gate'); if (gate) g.navigateTo(gate);
    this.ui.toast('Willkommen! Folge der gelben Route zum Eingang, kaufe dort ein Ticket (E).', 6000);
  }
  async setCustomRows(parkName, rows, pick) {
    this.custom = this.custom.map(p => p.park === parkName ? { ...p, rows: p.rows.filter(r => !rows.some(n => n[0] === r[0])) } : p).filter(p => p.rows.length);
    const ex = this.custom.find(p => p.park === parkName); if (ex) ex.rows.push(...rows); else this.custom.push({ park: parkName, cc: 'DE', rows });
    LS.set('custom', this.custom); this.db = buildDatabase(this.custom); clearTrackCache();
    if (this.park && this.park.def.name === parkName) { this.scene.remove(this.park.group); this.park.dispose(); this.park = null; this.ride = null; }
    return this.db.coasters.find(c => c.name === pick && c.park === parkName);
  }
  async playSavedReplay(rec) {
    if (!rec) return; this.audio.start();
    const c = this.db.coasters.find(x => x.id === rec.ride); if (!c) { this.ui.toast('Bahn nicht gefunden'); return; }
    await this.openRide(c); const r = this.ride; if (!r) return;
    const sm = []; const src = rec.samples; // auf 30 Hz hochrechnen (gespeichert: jede 3. Probe)
    for (let i = 0; i < src.length - 1; i++) for (let k = 0; k < 3; k++) { const f = k / 3, a = src[i], b = src[i + 1]; sm.push(a.map((v, j) => v + (b[j] - v) * f)); }
    sm.push(src[src.length - 1]); this.lastRec = { ride: r, sim: r.sim, samples: sm, done: true }; this.replayStart();
  }

  // ------------------------------------------------------------------ Online
  netState() {
    if (!this.park) return null;
    if (this.state === 'ride' && this.ride) { const st = this.seatSel(); return { k: 'ride', r: this.park.rides.indexOf(this.ride), c: st.car, row: st.row, s: st.s }; }
    if (this.state === 'park') {
      const c = this.camera.position;
      if (this.parkMode === 'walk') { const p = this.walk.pos; return { k: 'walk', p: [p.x, p.y - 1.75, p.z], yaw: this.pface }; }
      return { k: 'fly', p: [c.x, c.y - 1.6, c.z], yaw: this.free.yaw + Math.PI };
    }
    return { k: 'menu' };
  }
  async onNetStart(m) {
    this.ui.setMode(this.state); this.ui.refreshNet();
    if (m) { // Client: Umgebung & Park des Hosts übernehmen
      if (m.env) { this.env.setTime(m.env.hour); this.env.setWeather(m.env.weather); this.ui.syncEnv(); }
      if (m.park) await this.followPark(m.park, m.rides);
    }
  }
  onNetEnd() { this.ui && this.ui.refreshNet && this.ui.refreshNet(); }
  async followPark(name, rides) {
    if (!this.db.parks[name]) { this.ui.toast('Park „' + name + '“ ist in deiner Datenbank nicht vorhanden'); return; }
    const was = this.state;
    await this.loadPark(name); this.ui.loading(false);
    if (rides && JSON.stringify(rides) !== JSON.stringify(this.park.rides.map(r => r.coaster.id))) this.ui.toast('Achtung: Deine Bahnen-Datenbank weicht vom Host ab – Synchronisation evtl. ungenau', 5000);
    if (was !== 'menu' || this.net.active) this.enterPark();
  }

  seatSel() {
    const spec = this.ride.spec, rows = spec.rows || 1;
    let car = this.seat.car, row = this.seat.row || 0, s = this.seat.s;
    if (this.seat.custom) { return { car: clamp(car, 0, spec.cars - 1), row, s: clamp(s, 0, spec.across - 1) }; }
    if (this.camMode === 'front') return { car: 0, row: 0, s: Math.floor((spec.across - 1) / 2) };
    if (this.camMode === 'rear') return { car: spec.cars - 1, row: rows - 1, s: Math.floor(spec.across / 2) };
    return { car: Math.floor((spec.cars - 1) / 2), row: 0, s: Math.floor((spec.across - 1) / 2) };
  }
  seatCar() { return this.seatSel().car; }

  // ------------------------------------------------------------------ Kameras
  worldPose(r, s, o) {
    poseAt(r.track, s, this._pose);
    const p = this._pose, m = r.group.matrixWorld;
    o.p.set(p.p[0], p.p[1] + r.yOff, p.p[2]).applyMatrix4(m);
    o.t.set(p.t[0], p.t[1], p.t[2]).transformDirection(m);
    o.u.set(p.u[0], p.u[1], p.u[2]).transformDirection(m);
    o.r.set(p.r[0], p.r[1], p.r[2]).transformDirection(m);
    return o;
  }

  updateCamera(dt) {
    const cam = this.camera, K = this.keys;
    const fovBase = this.settings.fov;
    if (this.state === 'menu') {
      this.player.show(false);
      // Kamerafahrt über den Park
      this.menuOrbit += dt * 0.035;
      const R = Math.max(220, this.park.radius * 0.7);
      cam.position.set(Math.cos(this.menuOrbit) * R, 70 + 40 * Math.sin(this.menuOrbit * 0.7), Math.sin(this.menuOrbit) * R);
      cam.lookAt(0, 22, 0); cam.fov = 60; cam.updateProjectionMatrix(); this.camInit = false;
      return;
    }
    if (this.state === 'park') { this.updateParkCam(dt); if (this.parkMode !== 'walk') this.player.show(false); return; }
    this.player.show(false);
    const r = this.ride; if (!r) return;
    const sim = r.sim, mode = this.camMode;
    const W = this._w || (this._w = { p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), r: new THREE.Vector3() });
    const tmp = this._tmp || (this._tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), e: new THREE.Euler() });
    let targetFov = fovBase;
    if (['fp', 'front', 'rear'].includes(mode)) {
      const st = this.seatSel(), spec = r.spec, sl = seatLayout(spec);
      const seat = sl.seats.find(x => x.row === st.row && x.s === st.s) || sl.seats[0];
      this.worldPose(r, sim.carS(st.car), W);
      const eyeY = spec.rider === 'fly' ? 0.2 : (this.camMode === 'fp' ? 1.1 : 0.95);
      const sh = clamp(sim.v / 25, 0, 1) * 0.006;
      const t = performance.now() / 1000;
      tmp.a.copy(W.p).addScaledVector(W.t, seat.x + 0.08).addScaledVector(W.u, eyeY + Math.sin(t * 31) * sh).addScaledVector(W.r, seat.z + Math.sin(t * 23) * sh);
      tmp.m.makeBasis(W.r, W.u, tmp.b.copy(W.t).negate());
      tmp.q.setFromRotationMatrix(tmp.m);
      // Blick-Offset (Maus) – kehrt langsam zurück
      this.look.idle += dt; if (this.look.idle > 3 && !(K.has('Mouse'))) { this.look.yaw *= 1 - damp(0.8, dt); this.look.pitch *= 1 - damp(0.8, dt); }
      tmp.e.set(this.look.pitch, this.look.yaw, 0, 'YXZ'); tmp.q2.setFromEuler(tmp.e); tmp.q.multiply(tmp.q2);
      if (!this.camInit) { cam.quaternion.copy(tmp.q); this.camInit = true; } else cam.quaternion.slerp(tmp.q, damp(26, dt));
      cam.position.copy(tmp.a);
      targetFov = fovBase + clamp(sim.v * 0.18, 0, 9) + (this.zoom || 0) * -0.6;
    } else if (mode === 'chase') {
      this.worldPose(r, sim.carS((r.spec.cars - 1) / 2), W);
      tmp.a.copy(W.p).addScaledVector(W.t, -16 - sim.v * 0.12).addScaledVector(W.u, 6.5);
      if (!this.chase.init) { this.chase.pos.copy(tmp.a); this.chase.init = true; }
      this.chase.pos.lerp(tmp.a, damp(4.5, dt));
      cam.position.copy(this.chase.pos); if (cam.position.y < 1.2) cam.position.y = 1.2;
      tmp.b.copy(W.p).addScaledVector(W.t, 6).addScaledVector(W.u, 1);
      cam.lookAt(tmp.b); targetFov = 62;
    } else if (mode === 'drone') {
      this.worldPose(r, sim.carS((r.spec.cars - 1) / 2), W);
      const d = this.drone, t = performance.now() / 1000;
      d.tgt.lerp(W.p, damp(5, dt));
      if (!this.camInit) { d.tgt.copy(W.p); this.camInit = true; }
      if (this.look.idle > 0 || !this.dragging) { d.yaw += dt * 0.07; }
      const cp = Math.cos(d.pitch), want = tmp.a.set(d.tgt.x + Math.sin(d.yaw) * cp * d.dist, d.tgt.y + Math.sin(d.pitch) * d.dist + 4, d.tgt.z + Math.cos(d.yaw) * cp * d.dist);
      want.x += Math.sin(t * 0.9) * 0.6; want.y += Math.sin(t * 1.3) * 0.45;
      d.pos.lerp(want, damp(3.5, dt)); if (d.pos.y < 1.5) d.pos.y = 1.5;
      cam.position.copy(d.pos); cam.lookAt(d.tgt); targetFov = 58;
    } else if (mode === 'outside') {
      this.worldPose(r, sim.carS((r.spec.cars - 1) / 2), W);
      const o = this.outside; o.timer -= dt;
      const tr = r.track;
      if (o.idx < 0 || o.timer <= 0 || cam.position.distanceTo(W.p) > 190) {
        const ahead = 60 + Math.random() * 110;
        poseAt(tr, sim.s + ahead, this._pose);
        const g = r.group.matrixWorld, sd = Math.random() < 0.5 ? -1 : 1;
        const pp = this._pose;
        tmp.a.set(pp.p[0] + pp.r[0] * 22 * sd, 0, pp.p[2] + pp.r[2] * 22 * sd).applyMatrix4(g);
        // Standort am Boden / niedrig, höher bei hoher Strecke
        tmp.a.y = Math.min(40, 2.2 + Math.max(0, pp.p[1] + r.yOff) * 0.35);
        o.pos.copy(tmp.a); o.idx = 1; o.timer = 5 + Math.random() * 5;
      }
      cam.position.copy(o.pos);
      tmp.b.copy(W.p).addScaledVector(W.t, sim.v * 0.25);
      cam.lookAt(tmp.b);
      const dist = cam.position.distanceTo(W.p);
      targetFov = clamp(Math.atan(10 / Math.max(10, dist)) * 2 * 180 / Math.PI, 12, 70);
    } else if (mode === 'station') {
      const tr = r.track, sl = tr.stationLen || 28;
      this.worldPose(r, sl * 0.5, W);
      const pos = tmp.a.copy(W.p).addScaledVector(W.r, 8.5).addScaledVector(W.t, -3);
      pos.y = Math.max(W.p.y + 2.3, this.park.groundAt ? this.park.groundAt(pos.x, pos.z, 60) + 2.3 : 2.3);
      cam.position.copy(pos);
      this.worldPose(r, sim.s - sim.spacing * sim.cars * 0.5, tmp.c2 || (tmp.c2 = { p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), r: new THREE.Vector3() }));
      const trainP = tmp.c2.p, far = trainP.distanceTo(W.p);
      tmp.b.copy(W.p).add(tmp.c.set(0, 1.2, 0));
      if (far > 12 && far < 160) tmp.b.copy(trainP); // fährt der Zug vorbei, folgt der Blick
      if (!this._stLook) this._stLook = tmp.b.clone(); this._stLook.lerp(tmp.b, damp(6, dt)); cam.lookAt(this._stLook);
      targetFov = 58;
    } else if (mode === 'free') {
      this.moveFree(dt, this.free, true);
    }
    if (Math.abs(cam.fov - targetFov) > 0.05) { cam.fov += (targetFov - cam.fov) * damp(5, dt); cam.updateProjectionMatrix(); }
  }

  moveFree(dt, f, fly) {
    const K = this.ui.modal ? this.noKeys : this.keys, cam = this.camera;
    const sp = f.speed * (K.has('ShiftLeft') || K.has('ShiftRight') ? 4 : 1) * (K.has('ControlLeft') ? 0.25 : 1);
    const fwd = new THREE.Vector3(-Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), -Math.cos(f.yaw) * Math.cos(f.pitch));
    const right = new THREE.Vector3(Math.cos(f.yaw), 0, -Math.sin(f.yaw));
    const mv = new THREE.Vector3();
    if (K.has('KeyW') || K.has('ArrowUp')) mv.add(fwd); if (K.has('KeyS') || K.has('ArrowDown')) mv.sub(fwd);
    if (K.has('KeyD') || K.has('ArrowRight')) mv.add(right); if (K.has('KeyA') || K.has('ArrowLeft')) mv.sub(right);
    if (K.has('KeyE')) mv.y += 1; if (K.has('KeyQ')) mv.y -= 1;
    if (mv.lengthSq()) mv.normalize().multiplyScalar(sp * dt);
    f.pos.add(mv); if (f.pos.y < 1.2) f.pos.y = 1.2;
    cam.position.copy(f.pos); cam.rotation.set(f.pitch, f.yaw, 0, 'YXZ');
  }

  updateParkCam(dt) {
    const cam = this.camera, K = this.ui.modal ? this.noKeys : this.keys, w = this.park;
    let fov = this.settings.fov * 0.9;
    if (this.parkMode === 'fly') this.moveFree(dt, this.free, true);
    else if (this.parkMode === 'walk') {
      const f = this.walk, sp = (K.has('ShiftLeft') || K.has('ShiftRight') ? 17 : 8) * dt;
      const fwd = new THREE.Vector3(-Math.sin(f.yaw), 0, -Math.cos(f.yaw)), right = new THREE.Vector3(Math.cos(f.yaw), 0, -Math.sin(f.yaw));
      const mv = new THREE.Vector3();
      if (K.has('KeyW')) mv.add(fwd); if (K.has('KeyS')) mv.sub(fwd); if (K.has('KeyD')) mv.add(right); if (K.has('KeyA')) mv.sub(right);
      if (mv.lengthSq()) mv.normalize().multiplyScalar(sp);
      const feetY0 = f.pos.y - 1.75, room = this.game.room, nSub = Math.max(1, Math.ceil(mv.length() / 0.2)); // in kleinen Schritten bewegen → nichts wird durchlaufen
      for (let i = 0; i < nSub; i++) {
        f.pos.x += mv.x / nSub; f.pos.z += mv.z / nSub;
        if (room) { f.pos.x = clamp(f.pos.x, 3000 - 3.05, 3000 + 3.05); f.pos.z = clamp(f.pos.z, 3000 - 2.55, 3000 + 2.55); }
        else if (w.collide) w.collide(f.pos, 0.5, feetY0);
      }
      let feet = f.pos.y - 1.75; const ground = room ? 0.1 : w.groundAt ? w.groundAt(f.pos.x, f.pos.z, feet + 0.6) : 0;
      f.vy = (f.vy || 0) - 20 * dt; feet += f.vy * dt;
      let grounded = false;
      if (feet <= ground) { feet = ground; f.vy = 0; grounded = true; }
      if (grounded && (f.jump || K.has('Space'))) { f.vy = 6.6; feet += 0.02; }
      f.jump = false;
      const bob = grounded && mv.lengthSq() ? Math.abs(Math.sin(performance.now() / (K.has('ShiftLeft') ? 110 : 170))) * 0.045 : 0;
      f.pos.y = feet + 1.75;
      // Third-Person: Figur sichtbar, Kamera kreist hinter ihr (Maus/Wischen), Mausrad = Abstand
      if (mv.lengthSq() > 1e-6) this.pface = Math.atan2(mv.x, mv.z);
      this.pspeed = mv.length() / Math.max(dt, 1e-4);
      this.player.update(dt, f.pos.x, feet, f.pos.z, this.pface, this.pspeed, !grounded); this.player.show(true);
      const T = this._tpT || (this._tpT = new THREE.Vector3()), e = clamp(0.3 - f.pitch * 0.9, 0.04, 1.3), d = room ? Math.min(this.tp.dist, 2.4) : this.tp.dist;
      T.set(f.pos.x, feet + 1.45, f.pos.z);
      let cx = T.x + Math.sin(f.yaw) * Math.cos(e) * d, cz = T.z + Math.cos(f.yaw) * Math.cos(e) * d, cy = T.y + Math.sin(e) * d;
      if (room) { cx = clamp(cx, 3000 - 3.2, 3000 + 3.2); cz = clamp(cz, 3000 - 2.7, 3000 + 2.7); cy = Math.min(cy, 2.8); }
      else if (w.collide) { const tmp = this._tpC || (this._tpC = new THREE.Vector3()); tmp.set(cx, cy, cz); w.collide(tmp, 0.4, cy - 1.7); cx = tmp.x; cz = tmp.z; }
      const gy = room ? 0.1 : (w.groundAt ? w.groundAt(cx, cz, cy + 2) : 0); cy = Math.max(cy, gy + 0.5);
      cam.position.set(cx, cy, cz); cam.lookAt(T);
      fov = this.settings.fov;
    } else if (this.parkMode === 'bird') {
      const b = this.bird, zn = (ZONES && ZONES[b.zone]) || { x: 0, z: 0 };
      b.a += dt * 0.07;
      if (K.has('KeyW') || K.has('KeyA') || K.has('KeyS') || K.has('KeyD')) { this.free.pos.copy(cam.position); const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ'); this.free.yaw = e.y; this.free.pitch = e.x; this.parkMode = 'fly'; }
      else { cam.position.set(zn.x + Math.cos(b.a) * b.r, b.h, zn.z + Math.sin(b.a) * b.r); cam.lookAt(zn.x, 8, zn.z); }
      fov = 62;
    } else {
      const v = w.vis[this.visIdx % w.vis.length], fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
      const want = new THREE.Vector3(v.x - fx * 4.2, 2.3, v.z - fz * 4.2);
      if (!this.camInit) { cam.position.copy(want); this.camInit = true; }
      cam.position.lerp(want, damp(5, dt)); cam.lookAt(v.x, 1.35, v.z); fov = 55;
    }
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * damp(5, dt); cam.updateProjectionMatrix(); }
  }

  // ------------------------------------------------------------------ Hauptschleife
  loop() {
    requestAnimationFrame(() => this.loop());
    const rawDt = this.clock.getDelta(); let dt = Math.min(0.05, rawDt); this.perfGuard(rawDt);
    if (!this.park) { return; }
    const online = this.net.active;
    const simDt = (this.paused && !online ? 0 : dt) * (online && !this.net.isHost ? 1 : this.timeScale);
    this.net.update(dt);
    if (this.park.setCam) this.park.setCam(this.camera.position);
    this._dt = dt; this.recordTick(dt);
    this.park.update(dt, simDt);
    if (this.settings.autoTime && !this.paused) { this.env.setTime(this.env.hour + dt / 60); this.syncT = (this.syncT || 0) - dt; if (this.syncT <= 0) { this.syncT = 1; this.ui.syncEnv(); } }
    this.game.update(dt);
    this.updateCamera(dt);
    this.headLight.position.copy(this.camera.position); this.headLight.intensity = (this.state === 'ride' ? 14 : 0) * Math.min(1, (this.env.night || 0) * 1.3) + (this.state === 'park' && this.parkMode === 'walk' ? 5 : 0) * Math.min(1, (this.env.night || 0) * 1.3);
    this.riderT = (this.riderT || 0) - dt; if (this.riderT <= 0 && this.state !== 'menu') { // Fahrgäste nahe der Kamera als Vice-City-Figuren
      this.riderT = 0.6; const cp = this.camera.position;
      for (const r of this.park.rides) { const d = Math.hypot(r.entrance.x - cp.x, r.entrance.z - cp.z), riding = this.state === 'ride' && this.ride === r; for (const set of r.sets || [{ train: r.train }]) { if (riding || d < 120) set.train.upgrade && set.train.upgrade(); else if (d > 230) set.train.downgrade && set.train.downgrade(); } }
    }
    this.env.setShadowSpan(this.state === 'park' && this.parkMode === 'walk' ? 115 : 170); // schärfere Schatten rund um die Spielerfigur
    this.env.update(dt, this.camera, this.state === 'ride' && this.ride ? this.camera.position : this.camera.position);
    // HUD
    if (this.state === 'ride' && this.ride) {
      const s = this.ride.sim, W = this._w || { p: this.camera.position };
      let state = s.state === 'station' ? 'Station' : s.arriving ? 'Einfahrt Station' : (this.ride.track.zone[Math.floor(((s.s / this.ride.track.ds) % this.ride.track.N + this.ride.track.N) % this.ride.track.N)] === 2 ? 'Kettenlift' : 'Fahrt');
      if (s.state === 'station') state = s.lap ? `Station · Fahrt ${s.lap} beendet` : 'Station';
      this.ui.hud({ kmh: s.v * 3.6, h: this.camera.position.y, gv: s.g.vert, gl: s.g.lat, prog: s.progress, state, count: s.state === 'station' ? Math.ceil(s.timer) : 0 });
      if (s.lastLapStats && s.lap !== this._lapShown && s.state === 'station') { this._lapShown = s.lap; const st = s.lastLapStats; this.ui.toast(`Fahrt beendet · max. ${(st.maxV * 3.6).toFixed(0)} km/h · ${st.maxG.toFixed(1)} G · ${st.maxY.toFixed(0)} m`, 4500); }
      const onLift = s.state === 'run' && this.ride.track.zone[Math.floor(((s.s / this.ride.track.ds) % this.ride.track.N + this.ride.track.N) % this.ride.track.N)] === 2;
      this.audio.update(dt, s.state === 'run' ? s.v : 0, 'ride', onLift, this.env.wCur.rain);
    } else this.audio.update(dt, 0, 'other', false, this.env.wCur.rain);
    this.miniT -= dt;
    if (this.miniT <= 0 && this.state !== 'menu') {
      this.miniT = 0.12;
      const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.ui.drawMini(this.park, this.camera.position, -e.y);
    }
    if (this.post.enabled) this.post.render(this.env.night || 0); else this.renderer.render(this.scene, this.camera);
    if (this.game.photoReq) this.game.capture(this.renderer);
    const nowMs = performance.now(); if (nowMs - (this._uiN || 0) > 400) { this._uiN = nowMs; this.ui.updateWallet(); this.touch.refresh(); } // in echter Zeit, unabhängig von der Bildrate
  }
}

new App();
