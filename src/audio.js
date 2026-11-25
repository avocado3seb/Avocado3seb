// Prozedurale Audio-Engine (WebAudio): Motoren, Sirenen, Regen, Donner, Waffen, Radio
import * as THREE from 'three';
import { clamp, lerp } from './util.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioSys {
  constructor(G) {
    this.G = G; this.ctx = null; this.ready = false; this.station = 0; this.stations = ['Radio aus', 'Neon FM', 'Latin Heat', 'Lo-Fi Beach', 'Techno Bunker', 'Island Reggae'];
    this.nextStep = 0; this.step = 0; this.engines = []; this.sirens = []; this.tmpV = new THREE.Vector3();
    this.vol = { master: 0.8, sfx: 0.9, music: 0.6 };
  }
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(this.master); this.bus = comp;
    this.sfx = ctx.createGain(); this.sfx.connect(this.bus);
    this.music = ctx.createGain(); this.musicLP = ctx.createBiquadFilter(); this.musicLP.type = 'lowpass'; this.musicLP.frequency.value = 18000; this.music.connect(this.musicLP); this.musicLP.connect(this.bus);
    // Hall
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.impulse(1.6, 2.5);
    this.revGain = ctx.createGain(); this.revGain.gain.value = 0.25; this.reverb.connect(this.revGain); this.revGain.connect(this.bus);
    this.musicSend = ctx.createGain(); this.musicSend.gain.value = 0.35; this.music.connect(this.musicSend); this.musicSend.connect(this.reverb);
    // Rauschen
    this.noiseBuf = this.makeNoise('white'); this.brownBuf = this.makeNoise('brown');
    this.setVolumes();
    this.buildBeds();
    this.ready = true;
  }
  setVolumes() {
    if (!this.ctx) return; const s = this.G.settings;
    this.master.gain.value = s.master; this.sfx.gain.value = s.sfx; this.music.gain.value = s.music * 0.7;
  }
  impulse(sec, decay) { const ctx = this.ctx, n = ctx.sampleRate * sec, b = ctx.createBuffer(2, n, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; }
  makeNoise(type) { const ctx = this.ctx, n = ctx.sampleRate * 3, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (type === 'brown') { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; } return b; }
  noiseSrc(buf = this.noiseBuf, loop = true) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = loop; return s; }
  // Dauerhafte Klangbetten
  buildBeds() {
    const ctx = this.ctx;
    const mk = (buf, type, f, q, g) => { const s = this.noiseSrc(buf), fl = ctx.createBiquadFilter(), gn = ctx.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; gn.gain.value = g; s.connect(fl); fl.connect(gn); gn.connect(this.sfx); s.start(); return { s, fl, gn }; };
    this.rainBed = mk(this.noiseBuf, 'highpass', 1800, 0.5, 0);
    this.rainBed2 = mk(this.noiseBuf, 'bandpass', 700, 0.4, 0);
    this.windBed = mk(this.brownBuf, 'bandpass', 500, 0.7, 0);
    this.cityBed = mk(this.brownBuf, 'lowpass', 380, 0.5, 0);
    this.waveBed = mk(this.brownBuf, 'lowpass', 900, 0.3, 0);
    this.squeal = mk(this.noiseBuf, 'bandpass', 2400, 6, 0);
    this.rotorBed = mk(this.brownBuf, 'lowpass', 160, 1.2, 0);
    // Spieler-Motor
    const mkOsc = (type, f, g) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const gn = ctx.createGain(); gn.gain.value = g; o.connect(gn); o.start(); return { o, gn }; };
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 1.5;
    const eg = ctx.createGain(); eg.gain.value = 0; lp.connect(eg); eg.connect(this.sfx);
    this.eng = { a: mkOsc('sawtooth', 50, 0.5), b: mkOsc('square', 25, 0.35), c: mkOsc('triangle', 100, 0.25), lp, gain: eg };
    for (const k of ['a', 'b', 'c']) this.eng[k].gn.connect(lp);
    // Sirene
    const so = ctx.createOscillator(); so.type = 'sawtooth'; so.frequency.value = 800; const sg = ctx.createGain(); sg.gain.value = 0; const sl = ctx.createBiquadFilter(); sl.type = 'bandpass'; sl.frequency.value = 1100; sl.Q.value = 0.8; so.connect(sl); sl.connect(sg); sg.connect(this.sfx); so.start();
    this.sirenN = { o: so, g: sg };
    // Hupe
    const h1 = mkOsc('square', 415, 0.0), h2 = mkOsc('square', 523, 0.0); const hg = ctx.createGain(); hg.gain.value = 0; h1.gn.connect(hg); h2.gn.connect(hg); hg.connect(this.sfx); h1.gn.gain.value = 0.12; h2.gn.gain.value = 0.12; this.horn = hg;
    // Ambiente: Vögel (zufällig, im Update)
    this.birdT = 3;
    // Flugzeug-/Boots-Motor
    const po = mkOsc('sawtooth', 70, 0.3), pg = ctx.createGain(); pg.gain.value = 0; const pl = ctx.createBiquadFilter(); pl.type = 'lowpass'; pl.frequency.value = 600; po.gn.connect(pl); pl.connect(pg); pg.connect(this.sfx); this.prop = { o: po.o, g: pg, lp: pl };
    // AI Motoren (Pool)
    for (let i = 0; i < 6; i++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 70; const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 500; const g = ctx.createGain(); g.gain.value = 0; const p = ctx.createStereoPanner(); o.connect(lp2); lp2.connect(g); g.connect(p); p.connect(this.sfx); o.start();
      this.engines.push({ o, g, p, lp: lp2, v: null });
    }
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 800; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.8; const g = ctx.createGain(); g.gain.value = 0; const p = ctx.createStereoPanner(); o.connect(bp); bp.connect(g); g.connect(p); p.connect(this.sfx); o.start();
      this.sirens.push({ o, g, p });
    }
  }
  spatial(pos) {
    const cam = this.G.camera; const dx = pos.x - cam.position.x, dz = pos.z - cam.position.z, dy = (pos.y ?? cam.position.y) - cam.position.y;
    const d = Math.hypot(dx, dy, dz);
    const f = this.tmpV; cam.getWorldDirection(f);
    const rx = f.z, rz = -f.x; // rechts (xz)
    const pan = clamp((dx * rx + dz * rz) / (d + 0.01), -1, 1);
    return { d, gain: 1 / (1 + d / 22), pan };
  }
  // ----- Einmal-Effekte -----
  burst(dur, type, f0, f1, vol, pos = null, q = 1) {
    if (!this.ready) return; const ctx = this.ctx, t = ctx.currentTime;
    const s = this.noiseSrc(this.noiseBuf, false), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = type; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); fl.Q.value = q;
    let v = vol, pan = null;
    if (pos) { const sp = this.spatial(pos); v *= sp.gain * 1.6; if (sp.d > 400) return; pan = sp.pan; }
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); if (pan !== null) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.sfx); } else g.connect(this.sfx);
    s.start(t); s.stop(t + dur + 0.05);
  }
  tone(f, dur, type = 'sine', vol = 0.2, f2 = null, dest = null, delay = 0) {
    if (!this.ready) return; const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  gun(w, pos) {
    const big = w === 'shotgun' ? 1.4 : w === 'rifle' ? 1.1 : w === 'smg' ? 0.8 : 0.9;
    this.burst(0.28 * big, 'lowpass', 5000, 200, 0.7 * big, pos); this.burst(0.1, 'highpass', 3000, 1200, 0.3, pos); if (pos) { const sp = this.spatial(pos); this.tone(110, 0.15, 'sine', 0.35 * sp.gain, 40); } else this.tone(110, 0.15, 'sine', 0.3, 40);
  }
  explosion(pos) { this.burst(1.6, 'lowpass', 1500, 60, 1.4, pos); this.burst(0.5, 'bandpass', 800, 100, 0.8, pos); this.tone(70, 1.2, 'sine', 0.8, 25); }
  crash(k = 0.5, pos = null) { this.burst(0.25 + k * 0.3, 'bandpass', 900 + k * 800, 120, 0.4 + k * 0.6, pos, 0.7); if (k > 0.35) this.tone(90, 0.3, 'sine', 0.5 * k, 40); }
  thud() { this.burst(0.18, 'lowpass', 400, 80, 0.7); this.tone(80, 0.15, 'sine', 0.4, 40); }
  punch() { this.thud(); } swing() { this.burst(0.12, 'bandpass', 900, 300, 0.12); }
  ricochet(x, y, z) { this.burst(0.18, 'bandpass', 3500, 1800, 0.25, { x, y, z }, 6); }
  footstep(run, pos) { this.burst(run ? 0.07 : 0.09, 'lowpass', run ? 1400 : 900, 400, run ? 0.14 : 0.08); }
  jump() { this.burst(0.1, 'bandpass', 600, 300, 0.1); }
  doorClose() { this.burst(0.1, 'lowpass', 800, 150, 0.4); this.tone(180, 0.08, 'square', 0.1, 80); }
  empty() { this.tone(900, 0.04, 'square', 0.08); } reload() { this.tone(400, 0.05, 'square', 0.1); this.tone(300, 0.07, 'square', 0.1, null, null, 0.4); this.tone(600, 0.04, 'square', 0.1, null, null, 0.9); }
  pickup() { this.tone(880, 0.08, 'triangle', 0.18); this.tone(1320, 0.12, 'triangle', 0.18, null, null, 0.07); }
  cash() { this.tone(1760, 0.08, 'triangle', 0.15); this.tone(2349, 0.2, 'triangle', 0.15, null, null, 0.08); }
  click() { this.tone(660, 0.04, 'square', 0.06); } hover() { this.tone(500, 0.03, 'sine', 0.04); }
  wasted() { this.tone(220, 1.8, 'sawtooth', 0.15, 55); this.burst(1.5, 'lowpass', 1200, 80, 0.4); }
  wantedUp() { for (let i = 0; i < 3; i++) this.tone(880, 0.12, 'square', 0.09, null, null, i * 0.16); }
  missionPass() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.18, null, null, i * 0.14)); }
  missionFail() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.45, 'sawtooth', 0.12, null, null, i * 0.25)); }
  thunder(dist) {
    if (!this.ready) return; const delay = Math.min(6, dist / 340); const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = this.noiseSrc(this.brownBuf, false), fl = ctx.createBiquadFilter(), g = ctx.createGain(); fl.type = 'lowpass'; fl.frequency.value = 500 - Math.min(300, dist * 0.15);
    const v = clamp(1.6 - dist / 1100, 0.25, 1.4);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
    s.connect(fl); fl.connect(g); g.connect(this.sfx); s.start(t); s.stop(t + 3.4);
  }
  // ----- Radio -----
  radioNext() { this.setStation((this.station + 1) % this.stations.length); }
  radioPrev() { this.setStation((this.station + this.stations.length - 1) % this.stations.length); }
  setStation(i) { this.station = i; this.step = 0; this.nextStep = this.ctx ? this.ctx.currentTime + 0.1 : 0; this.G.ui?.radioToast?.(this.stations[i]); this.click(); }
  nt(f, t, d, type = 'sawtooth', v = 0.15, cut = 2500, dest = this.music) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cut; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + d);
    o.connect(fl); fl.connect(g); g.connect(dest); o.start(t); o.stop(t + d + 0.05);
  }
  kick(t, v = 0.7) { const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.25); }
  hat(t, v = 0.12, open = false) { const ctx = this.ctx, s = this.noiseSrc(this.noiseBuf, false), fl = ctx.createBiquadFilter(), g = ctx.createGain(); fl.type = 'highpass'; fl.frequency.value = 7000; const d = open ? 0.18 : 0.04; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(fl); fl.connect(g); g.connect(this.music); s.start(t); s.stop(t + d + 0.02); }
  snare(t, v = 0.35) { const ctx = this.ctx, s = this.noiseSrc(this.noiseBuf, false), fl = ctx.createBiquadFilter(), g = ctx.createGain(); fl.type = 'bandpass'; fl.frequency.value = 1900; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); s.connect(fl); fl.connect(g); g.connect(this.music); s.start(t); s.stop(t + 0.2); this.nt(190, t, 0.1, 'triangle', 0.2, 1000); }
  conga(t, f, v = 0.25) { this.nt(f, t, 0.12, 'sine', v, 900); this.burst; }
  scheduleMusic() {
    const ctx = this.ctx; if (!ctx || this.station === 0) return;
    while (this.nextStep < ctx.currentTime + 0.25) {
      const t = this.nextStep, i = this.step;
      switch (this.station) {
        case 1: { // Synthwave
          const bpm = 104, sd = 60 / bpm / 4; const bar = Math.floor(i / 16) % 4, st = i % 16;
          const roots = [45, 41, 36, 43], r = roots[bar];
          if (st % 4 === 0) this.kick(t, 0.65); if (st === 4 || st === 12) this.snare(t, 0.3); if (st % 2 === 0) this.hat(t, 0.08, st % 8 === 6);
          this.nt(midi(r), t, sd * 1.8, 'sawtooth', 0.2, 500 + 400 * Math.sin(i * 0.1));
          const arp = [0, 7, 12, 7, 15, 12, 7, 3]; this.nt(midi(r + 24 + arp[st % 8]), t, sd * 0.9, 'square', 0.07, 3000);
          if (st === 0) { for (const iv of [0, 3, 7]) this.nt(midi(r + 36 + iv), t, sd * 14, 'sawtooth', 0.04, 1600); }
          this.nextStep += sd; break;
        }
        case 2: { // Latin
          const bpm = 98, sd = 60 / bpm / 4; const bar = Math.floor(i / 16) % 4, st = i % 16; const roots = [57, 53, 55, 52], r = roots[bar];
          if (st % 8 === 0 || st === 6) this.kick(t, 0.45); const cl = [0, 3, 6, 10, 12].includes(st); if (cl) this.nt(1900, t, 0.05, 'square', 0.08, 5000);
          if (st % 4 === 2) this.conga(t, 280, 0.22); if (st % 4 === 3) this.conga(t, 380, 0.16); this.hat(t, 0.05);
          if (st % 4 === 0) this.nt(midi(r - 24), t, sd * 3, 'triangle', 0.3, 700);
          const mel = [0, 4, 7, 12, 7, 4, 9, 7]; if (st % 2 === 0) this.nt(midi(r + 12 + mel[(st / 2 + bar * 2) % 8]), t, sd * 1.6, 'triangle', 0.14, 3000);
          if (st % 8 === 3 || st % 8 === 6) for (const iv of [0, 4, 7]) this.nt(midi(r + 12 + iv), t, sd, 'square', 0.04, 2000);
          this.nextStep += sd; break;
        }
        case 3: { // Lo-Fi
          const bpm = 76, sd = 60 / bpm / 4; const bar = Math.floor(i / 16) % 4, st = i % 16; const ch = [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]][bar];
          if (st === 0 || st === 10) this.kick(t, 0.4); if (st === 8) this.snare(t, 0.2); if (st % 2 === 0) this.hat(t, 0.04);
          if (st === 0 || st === 6) for (const n of ch) this.nt(midi(n), t, sd * 6, 'triangle', 0.08, 1400);
          if (st % 4 === 2 && Math.random() < 0.6) this.nt(midi(ch[Math.floor(Math.random() * 4)] + 12), t, sd * 2, 'sine', 0.1, 2400);
          if (st === 0) this.nt(midi(ch[0] - 24), t, sd * 7, 'sine', 0.3, 400);
          this.nextStep += sd + (st % 2 ? 0.004 : -0.004) * 0.0; break;
        }
        case 4: { // Techno
          const bpm = 128, sd = 60 / bpm / 4; const st = i % 16; const bar = Math.floor(i / 16) % 8;
          if (st % 4 === 0) this.kick(t, 0.8); if (st % 4 === 2) this.hat(t, 0.1, true); if (st === 4 || st === 12) this.snare(t, 0.22);
          const seq = [0, 0, 12, 0, 3, 0, 7, 0, 0, 12, 0, 10, 0, 5, 0, 7]; const n = seq[st];
          if (st % 2 === 1 || st % 4 === 2) this.nt(midi(36 + n), t, sd * 0.9, 'sawtooth', 0.2, 300 + 1800 * Math.abs(Math.sin(i * 0.07)), this.music);
          if (bar >= 4 && st === 0) for (const iv of [0, 3, 7]) this.nt(midi(60 + iv), t, sd * 8, 'square', 0.03, 1200);
          this.nextStep += sd; break;
        }
        case 5: { // Reggae
          const bpm = 80, sd = 60 / bpm / 4; const bar = Math.floor(i / 16) % 4, st = i % 16; const roots = [50, 55, 57, 55], r = roots[bar];
          if (st === 8) this.kick(t, 0.55); if (st === 8 || st === 4) this.snare(t, 0.15); if (st % 2 === 0) this.hat(t, 0.05);
          if (st === 4 || st === 12) for (const iv of [0, 4, 7]) this.nt(midi(r + 12 + iv), t, sd * 1.2, 'square', 0.07, 2200);
          if (st === 0 || st === 3 || st === 10) this.nt(midi(r - 12), t, sd * 2.5, 'sine', 0.4, 500);
          this.nextStep += sd; break;
        }
      }
      this.step++;
    }
  }
  // ----- pro Frame -----
  update(dt) {
    if (!this.ready) return;
    const G = this.G, ctx = this.ctx, t = ctx.currentTime, P = G.player, v = P.vehicle;
    if (ctx.state === 'suspended' && G.mode === 'play') ctx.resume();
    const paused = G.mode === 'pause';
    const env = G.env;
    const set = (param, val, k = 0.1) => { if (Number.isFinite(val)) param.setTargetAtTime(val, t, k); };
    // Wetter
    set(this.rainBed.gn.gain, paused ? 0 : env.w.rain * 0.28 * (v && v.kind === 'car' ? 0.55 : 1)); set(this.rainBed2.gn.gain, paused ? 0 : env.w.rain * 0.22);
    const sp = v ? v.speed : Math.hypot(P.vel.x, P.vel.z);
    set(this.windBed.gn.gain, paused ? 0 : clamp(sp / 60, 0, 1) * 0.28 + env.w.wind * 0.04 + (v && (v.kind === 'plane' || v.kind === 'heli') ? 0.06 : 0)); set(this.windBed.fl.frequency, 300 + sp * 12);
    // Stadt-Brummen
    const pp = P.position;
    const dn = G.districtName || '';
    const city = dn.includes('Zentrum') ? 0.07 : dn.includes('Hafen') ? 0.06 : dn.includes('Umland') || dn.includes('Berge') || dn.includes('See') ? 0.0 : 0.045;
    set(this.cityBed.gn.gain, paused ? 0 : city * (1 - env.night * 0.4), 0.5);
    // Meer
    const nearW = clamp(1 - (G.world.groundY(pp.x + 40, pp.z) < -0.5 || G.world.groundY(pp.x - 40, pp.z) < -0.5 || G.world.groundY(pp.x, pp.z + 40) < -0.5 || G.world.groundY(pp.x, pp.z - 40) < -0.5 ? 0 : 1), 0, 1);
    set(this.waveBed.gn.gain, paused ? 0 : nearW * 0.09 * (0.6 + 0.4 * Math.sin(G.time * 0.4)), 0.5);
    // Vögel / Grillen
    this.birdT -= dt;
    if (this.birdT <= 0 && !paused) { this.birdT = 1.5 + Math.random() * 4; if (env.night < 0.3 && env.w.rain < 0.1 && city < 0.06) { const f = 2200 + Math.random() * 1800; this.tone(f, 0.08, 'sine', 0.025, f * 1.3); this.tone(f * 1.2, 0.07, 'sine', 0.025, f * 0.9, null, 0.1); } }
    // Spieler-Motor
    let engOn = 0;
    const E = this.eng;
    if (v && !paused && !v.exploded && (v.kind === 'car' || v.kind === 'bike')) {
      engOn = 1; const cls = v.spec.cls;
      const base = cls === 'bus' || cls === 'truck' ? 0.6 : cls === 'moto' || cls === 'quad' ? 1.5 : cls === 'super' || cls === 'sport' ? 1.15 : cls === 'muscle' ? 0.8 : 1;
      const f = (24 + v.rpm * 0.038) * base;
      set(E.a.o.frequency, f, 0.03); set(E.b.o.frequency, f * 0.5, 0.03); set(E.c.o.frequency, f * 2.01, 0.03);
      set(E.lp.frequency, 380 + v.rpm * 0.35 + Math.max(0, v.in.throttle) * 600, 0.05);
      set(E.gain.gain, (0.12 + Math.max(0, v.in.throttle) * 0.16 + v.rpm / 40000) * 0.9, 0.05);
      E.a.gn.gain.value = cls === 'super' || cls === 'sport' ? 0.7 : 0.5;
    } else set(E.gain.gain, 0, 0.1);
    // Flugzeug / Heli / Boot
    const Pr = this.prop;
    if (v && !paused && !v.exploded && (v.kind === 'plane' || v.kind === 'heli' || v.kind === 'boat')) {
      const jet = v.spec.sub === 'jet';
      Pr.o.type = v.kind === 'heli' ? 'sawtooth' : jet ? 'sawtooth' : 'sawtooth';
      set(Pr.o.frequency, v.kind === 'heli' ? 40 + v.rotor * 10 : v.kind === 'boat' ? 35 + v.rpm * 0.02 : jet ? 90 + v.thr3 * 90 : 48 + v.thr3 * 60, 0.1);
      set(Pr.lp.frequency, v.kind === 'heli' ? 260 : jet ? 900 : 480 + v.thr3 * 300, 0.1);
      set(Pr.g.gain, v.kind === 'heli' ? 0.2 * v.rotor : v.kind === 'plane' ? 0.1 + v.thr3 * 0.2 : 0.08 + Math.abs(v.in.throttle) * 0.12, 0.1);
      set(this.rotorBed.gn.gain, v.kind === 'heli' ? v.rotor * 0.35 * (0.8 + 0.2 * Math.sin(G.time * 28)) : 0, 0.05);
    } else { set(Pr.g.gain, 0, 0.1); set(this.rotorBed.gn.gain, 0, 0.1); }
    // Reifenquietschen
    set(this.squeal.gn.gain, v && !paused && v.skid > 0.15 && !v.air ? clamp(v.skid, 0, 1) * 0.12 : 0, 0.04);
    // Hupe
    set(this.horn.gain, v && v.horn && !paused ? 1 : 0, 0.015);
    // AI-Motoren und Sirenen
    const cand = [];
    for (const o of G.vehicles.list) { if (o === v || o.exploded || (!o.driver && !o.ai)) continue; const dx = o.pos.x - pp.x, dz = o.pos.z - pp.z; const d = dx * dx + dz * dz; if (d < 60 * 60) cand.push([d, o]); }
    cand.sort((a, b) => a[0] - b[0]);
    this.engines.forEach((e, i) => {
      const c = cand[i]; if (!c || paused) { set(e.g.gain, 0, 0.1); return; }
      const o = c[1], s = this.spatial(o.pos);
      set(e.o.frequency, (22 + o.rpm * 0.03) * (o.spec.cls === 'moto' ? 1.5 : o.spec.cls === 'bus' || o.spec.cls === 'truck' ? 0.6 : 1), 0.05); set(e.lp.frequency, 300 + o.rpm * 0.2, 0.05);
      set(e.g.gain, 0.12 * s.gain * (o.kind === 'plane' || o.kind === 'heli' ? 3 : 1), 0.08); e.p.pan.value = s.pan;
    });
    const sc = []; for (const o of G.vehicles.list) if ((o.siren || o.sirenOn) && o.driver && !o.exploded) { const d = Math.hypot(o.pos.x - pp.x, o.pos.z - pp.z); if (d < 220) sc.push([d, o]); }
    sc.sort((a, b) => a[0] - b[0]);
    this.sirens.forEach((s, i) => {
      const c = sc[i]; if (!c || paused) { set(s.g.gain, 0, 0.1); return; }
      const sp2 = this.spatial(c[1].pos); const ph = (G.time * 0.9 + i * 0.3) % 1;
      const fr = c[1].kind === 'heli' ? 600 : 780 + 420 * (0.5 + 0.5 * Math.sin(ph * Math.PI * 2));
      set(s.o.frequency, fr, 0.02); set(s.g.gain, 0.09 * Math.min(1, sp2.gain * 1.8), 0.1); s.p.pan.value = sp2.pan;
    });
    // Radio
    const radioActive = v && !paused && (v.kind === 'car' || v.kind === 'bike' || v.kind === 'boat');
    set(this.music.gain, radioActive || G.mode === 'menu' ? G.settings.music * 0.7 : 0, 0.3);
    if (G.mode === 'menu' && this.station === 0) { this.station = 1; this.step = 0; this.nextStep = t + 0.1; }
    set(this.musicLP.frequency, radioActive && v.kind === 'car' && (G.mode === 'play') ? 9000 : 9000, 0.3);
    this.scheduleMusic();
  }
}
