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

const LS = {
  get(k, d) { try { const v = localStorage.getItem('ecs_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ecs_' + k, JSON.stringify(v)); } catch (e) { /* ignorieren */ } },
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (k, dt) => 1 - Math.exp(-k * dt);

class App {
  constructor() {
    this.canvas = document.getElementById('gl');
    this.settings = Object.assign({ quality: 'medium', shadows: true, fov: 75, sens: 1, vol: 0.6, hour: 15.5, weather: 'clear' }, LS.get('settings', {}));
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.3, 30000);
    this.scene.add(this.camera);
    this.env = new Environment(this.scene, this.renderer);
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
    this.visIdx = 0;
    this.keys = new Set(); this.hudOn = true;
    this.menuOrbit = 0;
    this.camQ = new THREE.Quaternion(); this.camInit = false;
    this.net = new Net(this);
    this.ui = new UI(this);
    this.net.onChange = chat => this.ui.refreshNet(chat);
    this.bindInput();
    this.applyQuality();
    window.addEventListener('resize', () => this.resize()); this.resize();
    this.clock = new THREE.Clock(); this.miniT = 0;
    this._pose = newPose();
    // Startpark laden
    const startPark = LS.get('lastPark', 'Europa-Park');
    this.loadPark(this.db.parks[startPark] ? startPark : Object.keys(this.db.parks)[0]).then(() => { this.ui.loading(false); this.showMenu(); if (new URLSearchParams(location.search).get('room')) this.ui.tab('online'); });
    this.loop();
    window.__app = this; // Debug / Tests
  }

  // ------------------------------------------------------------------ Einstellungen
  saveSettings() { this.settings.hour = this.env.hour; this.settings.weather = this.env.weatherName; LS.set('settings', this.settings); }
  applyQuality() {
    const q = this.settings.quality, dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'low' ? 0.75 : q === 'medium' ? Math.min(dpr, 1.25) : Math.min(dpr, 2));
    this.env.setShadows(this.settings.shadows && q !== 'low', q === 'high' ? 4096 : 2048);
    this.renderer.shadowMap.enabled = this.settings.shadows && q !== 'low';
    this.resize();
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
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
    const world = new ParkWorld(def, this.env, { quality: this.settings.quality });
    this.scene.add(world.group); world.group.updateMatrixWorld(true);
    this.park = world; this.ride = null;
    this.ui.setPark(world);
    LS.set('lastPark', name);
    this.free.pos.set(0, 140, world.gate.z + 220); this.free.yaw = -Math.PI / 2; this.free.pitch = -0.28;
    this.walk.pos.set(world.gate.x, 1.75, world.gate.z - 12); this.walk.yaw = -Math.PI / 2; this.walk.pitch = 0;
    console.log(`[Park] ${name}: ${world.rides.length} Bahnen in ${(performance.now() - t0).toFixed(0)} ms`);
    return world;
  }

  // ------------------------------------------------------------------ Zustände
  canResume() { return !!this.ride || (this.park && this.state === 'menu' && this.prevState && this.prevState !== 'menu'); }
  showMenu() {
    if (this.state !== 'menu') this.prevState = this.state;
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
    if (fresh) { if (!this.net.active) { r.sim.reset(0); r.sim.timer = 6; r.sim.dispatch = 9; } this.camMode = this.camMode === 'free' ? 'fp' : this.camMode; this.seat = { car: -1, row: 0, s: -1 }; this.look.yaw = this.look.pitch = 0; this.outside.idx = -1; this.chase.init = false; }
    this.ui.setMode('ride'); this.ui.setRide(r.coaster); this.ui.setCam(this.camMode); this.camInit = false;
    this.setCamera(this.camMode, true);
    this.ui.toast(`${r.coaster.name} – ${r.coaster.park}`);
  }
  enterPark() {
    this.state = 'park'; this.ride = null; this.coaster = null;
    this.ui.setMode('park'); this.ui.setRide({ name: this.park.def.name, park: (this.park.def.city || '') + ' · Park erkunden', cc: this.park.def.cc }); this.camInit = false;
    this.ui.toast('Park erkunden – Fliegen, Gehen oder Besucher beobachten');
    for (const r of this.park.rides) r.train.showAll();
  }
  setParkMode(m) {
    this.parkMode = m; this.camInit = false;
    if (m === 'walk') { this.walk.pos.set(this.camera.position.x, 1.75, this.camera.position.z); this.walk.yaw = this.free.yaw; }
    if (m === 'fly') { this.free.pos.copy(this.camera.position); }
    this.ui.toast(m === 'fly' ? 'Flug-Modus · WASD, Q/E, Shift' : m === 'walk' ? 'Geh-Modus · WASD, Shift = rennen' : 'Besucher beobachten · N = nächster');
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
    c.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; ly = e.clientY; c.setPointerCapture(e.pointerId); this.audio.start(); });
    c.addEventListener('pointerup', e => { drag = false; });
    c.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
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
      else if (this.state === 'park' || this.camMode === 'free') this.free.speed = clamp(this.free.speed * (1 - Math.sign(e.deltaY) * 0.12), 8, 600);
      else this.zoom = clamp((this.zoom || 0) + Math.sign(e.deltaY) * 4, -25, 30);
    }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.target.id === 'chatIn') { if (e.key === 'Enter') { this.net.sendChat(e.target.value); e.target.value = ''; e.target.blur(); } else if (e.key === 'Escape') e.target.blur(); e.stopPropagation(); return; }
      if (e.key === 'Enter' && this.net.active && this.state !== 'menu') { e.preventDefault(); document.getElementById('chatIn')?.focus(); return; }
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.key !== 'Escape') return;
      this.keys.add(e.code);
      const k = e.key;
      if (k === 'Escape') { if (this.state === 'menu') { if (this.canResume()) this.resume(); } else this.showMenu(); e.preventDefault(); return; }
      if (this.state === 'menu') return;
      if (/^[1-7]$/.test(k) && this.state === 'ride') this.setCamera(CAM_LIST[+k - 1][0]);
      else if (k === 'c' || k === 'C') { if (this.state === 'ride') { const i = CAM_LIST.findIndex(x => x[0] === this.camMode); this.setCamera(CAM_LIST[(i + 1) % CAM_LIST.length][0]); } }
      else if (k === 'p' || k === 'P') { this.paused = !this.paused; this.ui.toast(this.paused ? 'Pause' : 'Weiter'); }
      else if (k === 'm' || k === 'M') this.ui.toggleMini();
      else if (k === 'Tab') { e.preventDefault(); if (this.state === 'ride') this.enterPark(); else if (this.state === 'park') { const r = this.park.rides[0]; if (r) this.enterRide(r); } }
      else if (k === 't' || k === 'T') { this.env.setTime(this.env.hour + 3); this.ui.root.querySelectorAll('#mTime,#hTime').forEach(x => x.value = this.env.hour); this.ui.toast('Uhrzeit ' + this.ui.clock(this.env.hour)); this.saveSettings(); }
      else if (k === 'r' || k === 'R') { const ks = Object.keys(WEATHERS); const n = ks[(ks.indexOf(this.env.weatherName) + 1) % ks.length]; this.env.setWeather(n); this.ui.root.querySelectorAll('#mWeather,#hWeather').forEach(x => x.value = n); this.ui.toast('Wetter: ' + WEATHERS[n].label); this.saveSettings(); }
      else if (k === 'h' || k === 'H') { this.hudOn = !this.hudOn; document.getElementById('hud').style.opacity = this.hudOn ? 1 : 0; }
      else if (k === 'f' || k === 'F') { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }
      else if (k === 'n' || k === 'N') { this.visIdx = (this.visIdx + 1 + Math.floor(Math.random() * 7)) % (this.park ? this.park.vis.length : 1); }
      else if (e.code === 'Space') {
        e.preventDefault();
        if (this.state === 'ride' && this.ride.sim.state === 'station') { if (this.net.active && !this.net.isHost) this.net.send({ t: 'dispatch', r: this.park.rides.indexOf(this.ride) }); else this.ride.sim.timer = Math.min(this.ride.sim.timer, 0.3); }
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

  // ------------------------------------------------------------------ Online
  netState() {
    if (!this.park) return null;
    if (this.state === 'ride' && this.ride) { const st = this.seatSel(); return { k: 'ride', r: this.park.rides.indexOf(this.ride), c: st.car, row: st.row, s: st.s }; }
    if (this.state === 'park') {
      const c = this.camera.position;
      if (this.parkMode === 'walk') return { k: 'walk', p: [c.x, 0, c.z], yaw: this.walk.yaw + Math.PI };
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
      // Kamerafahrt über den Park
      this.menuOrbit += dt * 0.035;
      const R = Math.max(220, this.park.radius * 0.7);
      cam.position.set(Math.cos(this.menuOrbit) * R, 70 + 40 * Math.sin(this.menuOrbit * 0.7), Math.sin(this.menuOrbit) * R);
      cam.lookAt(0, 22, 0); cam.fov = 60; cam.updateProjectionMatrix(); this.camInit = false;
      return;
    }
    if (this.state === 'park') { this.updateParkCam(dt); return; }
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
    } else if (mode === 'free') {
      this.moveFree(dt, this.free, true);
    }
    if (Math.abs(cam.fov - targetFov) > 0.05) { cam.fov += (targetFov - cam.fov) * damp(5, dt); cam.updateProjectionMatrix(); }
  }

  moveFree(dt, f, fly) {
    const K = this.keys, cam = this.camera;
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
    const cam = this.camera, K = this.keys, w = this.park;
    let fov = this.settings.fov * 0.9;
    if (this.parkMode === 'fly') this.moveFree(dt, this.free, true);
    else if (this.parkMode === 'walk') {
      const f = this.walk, sp = (K.has('ShiftLeft') ? 9 : 3.6) * dt;
      const fwd = new THREE.Vector3(-Math.sin(f.yaw), 0, -Math.cos(f.yaw)), right = new THREE.Vector3(Math.cos(f.yaw), 0, -Math.sin(f.yaw));
      if (K.has('KeyW')) f.pos.addScaledVector(fwd, sp); if (K.has('KeyS')) f.pos.addScaledVector(fwd, -sp);
      if (K.has('KeyD')) f.pos.addScaledVector(right, sp); if (K.has('KeyA')) f.pos.addScaledVector(right, -sp);
      f.pos.y = 1.75 + Math.abs(Math.sin(performance.now() / 260)) * ((K.has('KeyW') || K.has('KeyS')) ? 0.04 : 0);
      cam.position.copy(f.pos); cam.rotation.set(f.pitch, f.yaw, 0, 'YXZ');
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
    let dt = Math.min(0.05, this.clock.getDelta());
    if (!this.park) { return; }
    const online = this.net.active;
    const simDt = (this.paused && !online ? 0 : dt) * (online && !this.net.isHost ? 1 : this.timeScale);
    this.net.update(dt);
    this.park.update(dt, simDt);
    this.updateCamera(dt);
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
    this.renderer.render(this.scene, this.camera);
  }
}

new App();
