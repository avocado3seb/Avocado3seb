/* NEON REDLINE – audio.js : prozeduraler Motorsound, Turbo, Auspuffknallen, Reifen, Wind, Sirenen, Musik */
(function (G) {
'use strict';
const U = G.U; const { clamp, lerp } = U;
const A = { ctx: null, on: false, vol: { master: 0.8, engine: 1, music: 0.55, ambient: 0.8, sfx: 1, voice: 1 }, view: 'chase', musicStation: 0, tunnel: 0 };
/* Motorprofile: cyl = Zylinder, saw/sq = Anteil Sägezahn/Rechteck, dist = Verzerrung, lp = Tiefpass, rough = Unruhe, lope = V8-Brummen, whine = Kompressor/E-Motor */
const ENG = {
  i4: { cyl: 4, saw: 1, sq: 0.25, dist: 1.5, lp: 2400, q: 0.9, rough: 0.012, noise: 0.1, vol: 0.8 },
  i4t: { cyl: 4, saw: 1, sq: 0.35, dist: 2.2, lp: 2900, q: 1.1, rough: 0.01, noise: 0.12, vol: 0.85 },
  i6: { cyl: 6, saw: 1, sq: 0.15, dist: 1.2, lp: 3200, q: 0.8, rough: 0.005, noise: 0.08, vol: 0.85 },
  i6t: { cyl: 6, saw: 1, sq: 0.2, dist: 1.8, lp: 3400, q: 1.0, rough: 0.006, noise: 0.1, vol: 0.9 },
  v6: { cyl: 6, saw: 1, sq: 0.3, dist: 1.6, lp: 2600, q: 0.9, rough: 0.012, noise: 0.1, vol: 0.85 },
  v6t: { cyl: 6, saw: 1, sq: 0.35, dist: 2.2, lp: 3000, q: 1.0, rough: 0.01, noise: 0.12, vol: 0.9 },
  v8: { cyl: 8, saw: 1, sq: 0.6, dist: 2.6, lp: 2200, q: 1.2, rough: 0.02, lope: 0.35, noise: 0.1, vol: 1.0 },
  v8big: { cyl: 8, saw: 1, sq: 0.8, dist: 3.2, lp: 1800, q: 1.2, rough: 0.03, lope: 0.5, noise: 0.12, vol: 1.05 },
  v8sc: { cyl: 8, saw: 1, sq: 0.7, dist: 3.0, lp: 2400, q: 1.2, rough: 0.02, lope: 0.3, noise: 0.1, whine: 'sc', vol: 1.05 },
  v8flat: { cyl: 8, saw: 1, sq: 0.2, dist: 2.0, lp: 4200, q: 0.9, rough: 0.004, noise: 0.08, vol: 0.95 },
  v10: { cyl: 10, saw: 1, sq: 0.2, dist: 2.0, lp: 4200, q: 0.9, rough: 0.004, noise: 0.08, vol: 1.0 },
  v12: { cyl: 12, saw: 1, sq: 0.15, dist: 1.6, lp: 4800, q: 0.8, rough: 0.003, noise: 0.07, vol: 1.0 },
  w16: { cyl: 16, saw: 1, sq: 0.5, dist: 2.4, lp: 3000, q: 1.0, rough: 0.006, noise: 0.1, vol: 1.05 },
  f6t: { cyl: 6, saw: 1, sq: 0.5, dist: 2.0, lp: 2800, q: 1.2, rough: 0.015, lope: 0.2, noise: 0.1, vol: 0.9 },
  rotary: { cyl: 3, saw: 0.6, sq: 1, dist: 3.5, lp: 5200, q: 1.8, rough: 0.008, noise: 0.18, vol: 0.9 },
  diesel: { cyl: 4, saw: 0.5, sq: 1, dist: 2.4, lp: 1500, q: 1.4, rough: 0.025, noise: 0.22, vol: 0.8 },
  ev: { cyl: 0, whine: 'ev', vol: 0.55 },
};
function noiseBuffer(ctx, sec, color) { const n = Math.floor(ctx.sampleRate * sec); const b = ctx.createBuffer(1, n, ctx.sampleRate); const d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (color === 'brown') { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else if (color === 'pink') { l = 0.97 * l + 0.03 * w; d[i] = (w * 0.5 + l * 2.2); } else d[i] = w; } return b; }
function distCurve(k) { const n = 512, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } return c; }
function impulse(ctx, sec, decay) { const n = Math.floor(ctx.sampleRate * sec); const b = ctx.createBuffer(2, n, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; }

A.start = function () {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const ctx = A.ctx = new AC(); A.on = true;
  A.master = ctx.createGain(); A.master.gain.value = A.vol.master; A.comp = ctx.createDynamicsCompressor(); A.comp.threshold.value = -14; A.comp.ratio.value = 5; A.comp.attack.value = 0.004; A.comp.release.value = 0.2; A.master.connect(A.comp); A.comp.connect(ctx.destination);
  const bus = (v) => { const g = ctx.createGain(); g.gain.value = v; g.connect(A.master); return g; };
  A.busEngine = bus(1); A.busSfx = bus(1); A.busMusic = bus(A.vol.music); A.busAmb = bus(A.vol.ambient); A.busUi = bus(0.7);
  // Hall (Tunnel)
  A.rev = ctx.createConvolver(); A.rev.buffer = impulse(ctx, 2.4, 2.6); A.revSend = ctx.createGain(); A.revSend.gain.value = 0; A.revOut = ctx.createGain(); A.revOut.gain.value = 0.9; A.revSend.connect(A.rev); A.rev.connect(A.revOut); A.revOut.connect(A.master);
  A.busEngine.connect(A.revSend); A.busSfx.connect(A.revSend);
  A.noiseW = noiseBuffer(ctx, 3, 'white'); A.noiseB = noiseBuffer(ctx, 3, 'brown'); A.noiseP = noiseBuffer(ctx, 3, 'pink');
  A.viewFilter = ctx.createBiquadFilter(); A.viewFilter.type = 'lowpass'; A.viewFilter.frequency.value = 20000; A.busEngine.disconnect(); A.busEngine.connect(A.viewFilter); A.viewFilter.connect(A.master); A.viewFilter.connect(A.revSend);
  A.engine = null; A.setEngine('v8'); buildAmbient(); buildSirens(); buildTraffic(); A.startMusic();
};
const noiseSrc = (buf, loop) => { const s = A.ctx.createBufferSource(); s.buffer = buf; s.loop = loop !== false; s.loopStart = Math.random() * 1.5; s.start(0, Math.random() * 2); return s; };

/* ------------------------------------------------------------ Motor */
A.setEngine = function (name) {
  if (!A.ctx) { A.pendingEngine = name; return; } const ctx = A.ctx; const prof = ENG[name] || ENG.v8; if (A.engine) { try { A.engine.stop(); } catch (e) { } }
  const out = ctx.createGain(); out.gain.value = 0; out.connect(A.busEngine); const e = { prof, out, oscs: [], t0: ctx.currentTime };
  if (prof.cyl) {
    e.lp = ctx.createBiquadFilter(); e.lp.type = 'lowpass'; e.lp.frequency.value = prof.lp; e.lp.Q.value = prof.q; e.shaper = ctx.createWaveShaper(); e.shaper.curve = distCurve(prof.dist); e.shaper.oversample = '2x';
    e.o1 = ctx.createOscillator(); e.o1.type = 'sawtooth'; e.o2 = ctx.createOscillator(); e.o2.type = 'square'; e.o3 = ctx.createOscillator(); e.o3.type = 'sawtooth'; e.o4 = ctx.createOscillator(); e.o4.type = 'triangle';
    e.g1 = ctx.createGain(); e.g2 = ctx.createGain(); e.g3 = ctx.createGain(); e.g4 = ctx.createGain(); e.g1.gain.value = 0.5 * prof.saw; e.g2.gain.value = 0.35 * prof.sq; e.g3.gain.value = 0.22; e.g4.gain.value = 0.35;
    e.o1.connect(e.g1); e.o2.connect(e.g2); e.o3.connect(e.g3); e.o4.connect(e.g4); for (const g of [e.g1, e.g2, e.g3, e.g4]) g.connect(e.shaper); e.shaper.connect(e.lp); e.lp.connect(out);
    e.ns = noiseSrc(A.noiseP); e.ng = ctx.createGain(); e.ng.gain.value = 0; e.nf = ctx.createBiquadFilter(); e.nf.type = 'bandpass'; e.nf.frequency.value = 900; e.nf.Q.value = 0.8; e.ns.connect(e.nf); e.nf.connect(e.ng); e.ng.connect(out);
    e.lfo = ctx.createOscillator(); e.lfoG = ctx.createGain(); e.lfo.frequency.value = 6; e.lfoG.gain.value = 0; e.lfo.connect(e.lfoG); e.lfoG.connect(out.gain); e.lfo.start();
    for (const o of [e.o1, e.o2, e.o3, e.o4]) { o.start(); e.oscs.push(o); }
  }
  // Aufladung / Elektromotor
  e.wh = ctx.createOscillator(); e.wh.type = prof.whine === 'ev' ? 'sine' : 'sine'; e.whG = ctx.createGain(); e.whG.gain.value = 0; e.wh.connect(e.whG); e.whG.connect(out); e.wh.start();
  e.wh2 = ctx.createOscillator(); e.wh2.type = 'triangle'; e.wh2G = ctx.createGain(); e.wh2G.gain.value = 0; e.wh2.connect(e.wh2G); e.wh2G.connect(out); e.wh2.start();
  e.turbo = ctx.createOscillator(); e.turbo.type = 'sine'; e.turboG = ctx.createGain(); e.turboG.gain.value = 0; e.turbo.connect(e.turboG); e.turboG.connect(out); e.turbo.start();
  A.engine = { stop() { try { e.out.gain.setTargetAtTime(0, A.ctx.currentTime, 0.1); setTimeout(() => { for (const o of e.oscs.concat([e.wh, e.wh2, e.turbo, e.lfo])) { try { o.stop(); } catch (x) { } } if (e.ns) try { e.ns.stop(); } catch (x) { } e.out.disconnect(); }, 400); } catch (x) { } } }; A.eng = e;
};
/* st: {rpm, red, thr, load, boost, turbo(Level), speed, gear, nitro, cyl} */
A.updateEngine = function (dt, st) {
  if (!A.ctx || !A.eng) return; const e = A.eng, p = e.prof, t = A.ctx.currentTime; const rpm = Math.max(st.rpm, 0), x = rpm / (st.red || 7000); const thr = st.thr, cockpit = A.view === 'cockpit' || A.view === 'hood';
  e.out.gain.setTargetAtTime(p.vol * 0.55 * (0.5 + 0.5 * thr + 0.25 * x) * (st.on === false ? 0 : 1) * A.vol.engine, t, 0.05);
  if (p.cyl) { const fire = rpm / 60 * p.cyl / 2; const jit = 1 + (Math.random() - 0.5) * p.rough * (1.4 - x); const f = fire * jit; e.o1.frequency.setTargetAtTime(f, t, 0.02); e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.02); e.o3.frequency.setTargetAtTime(f * 2.003, t, 0.02); e.o4.frequency.setTargetAtTime(f * 0.25 + 18, t, 0.03);
    e.g3.gain.setTargetAtTime(0.1 + 0.3 * x * thr, t, 0.08); e.g1.gain.setTargetAtTime((0.35 + 0.35 * thr) * p.saw, t, 0.05); e.g4.gain.setTargetAtTime(0.4 * (1 - x * 0.6), t, 0.08);
    const lp = (p.lp * (0.38 + 0.8 * thr + 0.5 * x)) * (cockpit ? 0.45 : 1); e.lp.frequency.setTargetAtTime(clamp(lp, 280, 11000), t, 0.04); e.lp.Q.setTargetAtTime(p.q + x * 1.2 + (st.nitro ? 1.5 : 0), t, 0.1);
    e.ng.gain.setTargetAtTime(p.noise * (0.2 + 0.9 * thr * (0.3 + x)) * (st.nitro ? 1.8 : 1), t, 0.05); e.nf.frequency.setTargetAtTime(500 + 2800 * x + 700 * thr, t, 0.06);
    if (p.lope) { e.lfo.frequency.setTargetAtTime(fire / (p.cyl / 2) * 0.5, t, 0.1); e.lfoG.gain.setTargetAtTime(p.lope * 0.12 * (1 - x) * (1 - thr * 0.6), t, 0.1); } }
  // Kompressor / E-Motor
  if (p.whine === 'sc') { e.wh.frequency.setTargetAtTime(rpm / 60 * 6.2, t, 0.03); e.whG.gain.setTargetAtTime(0.06 * thr * (0.3 + x), t, 0.05); e.wh2.frequency.setTargetAtTime(rpm / 60 * 12.4, t, 0.03); e.wh2G.gain.setTargetAtTime(0.025 * thr * x, t, 0.05); }
  else if (p.whine === 'ev') { const f = 260 + st.speed * 38 + rpm * 0.05; e.wh.frequency.setTargetAtTime(f, t, 0.03); e.whG.gain.setTargetAtTime((0.1 + 0.25 * thr) * (cockpit ? 0.6 : 1), t, 0.05); e.wh2.frequency.setTargetAtTime(f * 2.01, t, 0.03); e.wh2G.gain.setTargetAtTime(0.06 + 0.12 * thr, t, 0.05); }
  else { e.whG.gain.setTargetAtTime(0, t, 0.05); e.wh2G.gain.setTargetAtTime(0, t, 0.05); }
  // Turbo-Pfeifen
  if (st.turbo > 0) { e.turbo.frequency.setTargetAtTime(2200 + 7200 * st.boost + (cockpit ? 0 : 400), t, 0.05); e.turboG.gain.setTargetAtTime(0.028 * st.boost * st.turbo * (0.3 + thr) * (cockpit ? 1.4 : 0.9), t, 0.06); } else e.turboG.gain.setTargetAtTime(0, t, 0.1);
  A.viewFilter.frequency.setTargetAtTime(cockpit ? 2600 : 20000, t, 0.15);
  // Ereignisse
  if (st.blowoff) A.blowoff(st.turbo); if (st.pop) A.pops(st.pop, st.rpm / st.red); if (st.shift) A.shift(st.turbo);
};
A.blowoff = function (lvl) { const ctx = A.ctx; if (!ctx) return; const s = noiseSrc(A.noiseW, false); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.9; const g = ctx.createGain(); const t = ctx.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28 * (0.6 + lvl * 0.3), t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); bp.frequency.exponentialRampToValueAtTime(900, t + 0.45); s.connect(bp); bp.connect(g); g.connect(A.busEngine); setTimeout(() => { try { s.stop(); } catch (e) { } }, 650); };
A.shift = function (turbo) { const ctx = A.ctx; if (!ctx) return; const t = ctx.currentTime; A.eng.out.gain.setTargetAtTime(0.05, t, 0.01); A.eng.out.gain.setTargetAtTime(0.5, t + 0.07, 0.04); if (turbo > 0) A.blowoff(turbo * 0.6); A.click(0.12, 240); };
A.pops = function (n, x) { const ctx = A.ctx; if (!ctx) return; n = Math.min(8, Math.floor(2 + n * 1.6)); for (let i = 0; i < n; i++) setTimeout(() => A.pop(0.5 + Math.random() * 0.5 + x * 0.3), i * (50 + Math.random() * 110)); };
A.pop = function (v) { const ctx = A.ctx; if (!ctx) return; const t = ctx.currentTime; const s = noiseSrc(A.noiseW, false); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600 + Math.random() * 900; bp.Q.value = 0.7; const g = ctx.createGain(); g.gain.setValueAtTime(0.5 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); s.connect(bp); bp.connect(g); g.connect(A.busEngine);
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.1); const og = ctx.createGain(); og.gain.setValueAtTime(0.45 * v, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(og); og.connect(A.busEngine); o.start(t); o.stop(t + 0.15); setTimeout(() => { try { s.stop(); } catch (e) { } }, 200); };
A.click = function (v, f) { const ctx = A.ctx; if (!ctx) return; const t = ctx.currentTime; const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f || 800; const g = ctx.createGain(); g.gain.setValueAtTime(v * 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g); g.connect(A.busSfx); o.start(t); o.stop(t + 0.06); };

/* ------------------------------------------------------------ Umgebung: Reifen, Wind, Straße, Regen */
function buildAmbient() {
  const ctx = A.ctx; const mk = (buf, type, f, q) => { const s = noiseSrc(buf); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 0.7; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); return { s, fl, g }; };
  A.wind = mk(A.noiseP, 'lowpass', 600, 0.4); A.wind.g.connect(A.busAmb); A.road = mk(A.noiseB, 'lowpass', 160, 0.5); A.road.g.connect(A.busAmb); A.squeal = mk(A.noiseW, 'bandpass', 1400, 6); A.squeal.g.connect(A.busSfx); A.squeal2 = mk(A.noiseW, 'bandpass', 2300, 8); A.squeal2.g.connect(A.busSfx);
  A.gravel = mk(A.noiseP, 'lowpass', 900, 0.5); A.gravel.g.connect(A.busSfx); A.rainN = mk(A.noiseW, 'highpass', 2400, 0.4); A.rainN.g.connect(A.busAmb); A.rainL = mk(A.noiseB, 'lowpass', 500, 0.4); A.rainL.g.connect(A.busAmb); A.city = mk(A.noiseB, 'lowpass', 220, 0.6); A.city.g.connect(A.busAmb); A.scrape = mk(A.noiseW, 'bandpass', 1800, 2); A.scrape.g.connect(A.busSfx);
  A.nitroN = mk(A.noiseW, 'bandpass', 800, 0.8); A.nitroN.g.connect(A.busSfx);
}
A.updateAmbient = function (dt, st) {
  if (!A.ctx || !A.wind) return; const t = A.ctx.currentTime; const cockpit = A.view === 'cockpit' || A.view === 'hood'; const v = st.speed, sp = clamp(v / 90, 0, 1); const set = (n, val, tc) => n.g.gain.setTargetAtTime(val, t, tc || 0.08);
  set(A.wind, (0.02 + 0.5 * sp * sp) * (cockpit ? 0.7 : 1) * (1 - st.tunnel * 0.2)); A.wind.fl.frequency.setTargetAtTime(300 + 1800 * sp, t, 0.1);
  set(A.road, Math.min(0.42, v / 70) * (st.surface === 'asphalt' || st.surface === 'concrete' ? 1 : 0.5) * (st.wet ? 1.3 : 1)); A.road.fl.frequency.setTargetAtTime(120 + v * 3.2, t, 0.1);
  const sq = clamp(st.slip, 0, 1.5) * (st.surface === 'asphalt' || st.surface === 'concrete' ? 1 : 0); set(A.squeal, Math.max(0, (sq - 0.25) * 0.22) * (v > 3 ? 1 : 0), 0.03); A.squeal.fl.frequency.setTargetAtTime(1100 + v * 14 + sq * 500, t, 0.05); set(A.squeal2, Math.max(0, (sq - 0.5) * 0.14), 0.03); A.squeal2.fl.frequency.setTargetAtTime(1900 + v * 20, t, 0.05);
  set(A.gravel, (st.surface === 'grass' || st.surface === 'dirt' || st.surface === 'sand' ? 0.4 : 0) * clamp(v / 40, 0, 1), 0.1);
  set(A.rainN, st.rain * 0.14 * (cockpit ? 0.7 : 1) * (1 - st.tunnel), 0.5); set(A.rainL, st.rain * 0.3 * (1 - st.tunnel), 0.5); set(A.city, st.city * 0.22, 0.6); set(A.scrape, st.scrape > 0 ? 0.35 * Math.min(1, st.scrape) : 0, 0.04); A.scrape.fl.frequency.setTargetAtTime(900 + v * 25, t, 0.05);
  set(A.nitroN, st.nitro ? 0.26 : 0, 0.06); A.nitroN.fl.frequency.setTargetAtTime(600 + v * 8, t, 0.1);
  A.revSend.gain.setTargetAtTime(st.tunnel * 0.5, t, 0.2); A.tunnel = st.tunnel;
};
A.impact = function (v, hard) { const ctx = A.ctx; if (!ctx) return; v = clamp(v, 0, 1); const t = ctx.currentTime; const s = noiseSrc(A.noiseW, false); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 300 + Math.random() * 900; bp.Q.value = 0.6; const g = ctx.createGain(); g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25 + 0.4 * v); s.connect(bp); bp.connect(g); g.connect(A.busSfx);
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.25); const og = ctx.createGain(); og.gain.setValueAtTime(0.9 * v, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(og); og.connect(A.busSfx); o.start(t); o.stop(t + 0.35);
  if (hard) for (let i = 0; i < 3; i++) { const m = ctx.createOscillator(); m.type = 'square'; m.frequency.value = 600 + Math.random() * 2200; const mg = ctx.createGain(); mg.gain.setValueAtTime(0.08 * v, t + i * 0.02); mg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); m.connect(mg); mg.connect(A.busSfx); m.start(t); m.stop(t + 0.3); }
  setTimeout(() => { try { s.stop(); } catch (e) { } }, 800); };
A.glass = function () { const ctx = A.ctx; if (!ctx) return; const t = ctx.currentTime; for (let i = 0; i < 9; i++) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 2500 + Math.random() * 5000; const g = ctx.createGain(); g.gain.setValueAtTime(0.06, t + i * 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2 + i * 0.01); o.connect(g); g.connect(A.busSfx); o.start(t + i * 0.012); o.stop(t + 0.4); } };
A.horn = function (on) { const ctx = A.ctx; if (!ctx) return; if (on && !A.hornN) { const g = ctx.createGain(); g.gain.value = 0.0; const t = ctx.currentTime; g.gain.setTargetAtTime(0.28, t, 0.01); const os = [415, 523].map(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; o.connect(lp); lp.connect(g); o.start(); return o; }); g.connect(A.busSfx); A.hornN = { g, os }; } else if (!on && A.hornN) { const h = A.hornN; h.g.gain.setTargetAtTime(0, ctx.currentTime, 0.02); setTimeout(() => h.os.forEach(o => { try { o.stop(); } catch (e) { } }), 120); A.hornN = null; } };
A.thunder = function () { const ctx = A.ctx; if (!ctx) return; const t = ctx.currentTime; const s = noiseSrc(A.noiseB, false); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.0, t + 0.15); g.gain.exponentialRampToValueAtTime(0.35, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5); s.connect(lp); lp.connect(g); g.connect(A.busAmb); setTimeout(() => { try { s.stop(); } catch (e) { } }, 5000); };
A.ui = function (type) { const ctx = A.ctx; if (!ctx) return; const t = ctx.currentTime; const seq = { click: [[880, 0.05]], ok: [[660, 0.06], [990, 0.09]], back: [[520, 0.06], [390, 0.08]], buy: [[880, 0.07], [1175, 0.07], [1568, 0.14]], err: [[220, 0.12], [180, 0.16]], check: [[1318, 0.12]], go: [[1760, 0.5]], count: [[880, 0.18]], win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]], lose: [[392, 0.15], [330, 0.15], [262, 0.3]], radio: [[1500, 0.04], [1100, 0.04], [1800, 0.05]] }[type] || [[600, 0.05]]; let tt = t;
  for (const [f, d] of seq) { const o = ctx.createOscillator(); o.type = type === 'err' || type === 'lose' ? 'sawtooth' : 'square'; o.frequency.value = f; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.18, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + d); o.connect(lp); lp.connect(g); g.connect(A.busUi); o.start(tt); o.stop(tt + d + 0.02); tt += d * 0.9; } };

/* ------------------------------------------------------------ Sirenen & Verkehr */
function buildSirens() { const ctx = A.ctx; A.sirens = []; for (let i = 0; i < 3; i++) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 700; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; const g = ctx.createGain(); g.gain.value = 0; const pan = ctx.createStereoPanner(); o.connect(lp); lp.connect(g); g.connect(pan); pan.connect(A.busSfx); o.start(); A.sirens.push({ o, g, pan }); } }
A.updateSirens = function (list, listener) { // list: [{dx,dz,dist,style,phase}]
  if (!A.ctx || !A.sirens) return; const t = A.ctx.currentTime; for (let i = 0; i < A.sirens.length; i++) { const s = A.sirens[i], c = list[i]; if (!c) { s.g.gain.setTargetAtTime(0, t, 0.1); continue; }
    const ph = (A.ctx.currentTime * (c.style === 1 ? 2.6 : 0.55) + c.phase) % 1; const f = c.style === 1 ? (ph < 0.5 ? 760 : 960) : 650 + 520 * Math.sin(Math.PI * ph); s.o.frequency.setTargetAtTime(f * (1 + c.dop), t, 0.015); s.g.gain.setTargetAtTime(clamp(1 - c.dist / 420, 0, 1) * 0.12 * (1 - A.tunnel * 0.2), t, 0.05); s.pan.pan.setTargetAtTime(clamp(c.px, -1, 1), t, 0.05); } };
function buildTraffic() { const ctx = A.ctx; A.tv = []; for (let i = 0; i < 4; i++) { const o = ctx.createOscillator(); o.type = 'sawtooth'; const o2 = ctx.createOscillator(); o2.type = 'square'; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; const g = ctx.createGain(); g.gain.value = 0; const pan = ctx.createStereoPanner(); o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(pan); pan.connect(A.busEngine); o.start(); o2.start(); A.tv.push({ o, o2, lp, g, pan }); } }
A.updateTraffic = function (list) { if (!A.ctx || !A.tv) return; const t = A.ctx.currentTime; for (let i = 0; i < A.tv.length; i++) { const v = A.tv[i], c = list[i]; if (!c) { v.g.gain.setTargetAtTime(0, t, 0.1); continue; } const f = (c.rpm / 60 * c.cyl / 2) * (1 + c.dop); v.o.frequency.setTargetAtTime(f, t, 0.03); v.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03); v.lp.frequency.setTargetAtTime(400 + c.thr * 900, t, 0.05); v.g.gain.setTargetAtTime(clamp(1 - c.dist / 140, 0, 1) * 0.08 * (0.4 + c.thr), t, 0.05); v.pan.pan.setTargetAtTime(clamp(c.px, -1, 1), t, 0.05); } };

/* ------------------------------------------------------------ Musik (Sequencer) */
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
const STATIONS = [
  { name: 'Neon Drive 98.7', genre: 'Synthwave', bpm: 112, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: [33, 29, 36, 31] },
  { name: 'Bass Underground 104.2', genre: 'Techno', bpm: 132, chords: [[57, 60, 64], [57, 60, 64], [55, 58, 62], [53, 57, 60]], bass: [33, 33, 31, 29] },
  { name: 'Chill Night FM', genre: 'Lo-Fi', bpm: 80, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], bass: [36, 33, 29, 31] },
  { name: 'Radio aus', genre: '', bpm: 0 },
];
A.stations = STATIONS;
A.startMusic = function () { if (!A.ctx) return; A.nextStep = A.ctx.currentTime + 0.2; A.step = 0; A.musicTimer = setInterval(A.musicTick, 60); };
A.setStation = function (i) { A.musicStation = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length; A.step = 0; if (A.ctx) A.nextStep = A.ctx.currentTime + 0.1; return STATIONS[A.musicStation]; };
A.setVolume = function (k, v) { A.vol[k] = v; if (!A.ctx) return; if (k === 'master') A.master.gain.value = v; if (k === 'music') A.busMusic.gain.value = v; if (k === 'ambient') A.busAmb.gain.value = v; };
A.musicTick = function () {
  const ctx = A.ctx; if (!ctx || ctx.state !== 'running') return; const st = STATIONS[A.musicStation]; if (!st.bpm) { A.nextStep = ctx.currentTime + 0.1; return; } const spb = 60 / st.bpm / 4; // 16tel
  while (A.nextStep < ctx.currentTime + 0.25) { A.playStep(st, A.step, A.nextStep); A.nextStep += spb; A.step++; }
};
A.playStep = function (st, step, t) {
  const ctx = A.ctx, out = A.busMusic; const s16 = step % 16, bar = Math.floor(step / 16) % 4; const chord = st.chords[bar], bass = st.bass[bar]; const env = (g, a, d, v) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const tone = (type, f, a, d, v, lpf, dest) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(lpf, t); lp.frequency.exponentialRampToValueAtTime(Math.max(120, lpf * 0.25), t + a + d); const g = ctx.createGain(); env(g, a, d, v); o.connect(lp); lp.connect(g); g.connect(dest || out); o.start(t); o.stop(t + a + d + 0.05); };
  const kick = () => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); const g = ctx.createGain(); g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.32); };
  const noise = (f, q, d, v, type) => { const s = ctx.createBufferSource(); s.buffer = A.noiseW; const fl = ctx.createBiquadFilter(); fl.type = type || 'highpass'; fl.frequency.value = f; fl.Q.value = q || 0.7; const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + d + 0.02); };
  if (st.genre === 'Synthwave') {
    if (s16 % 4 === 0) kick(); if (s16 === 4 || s16 === 12) { noise(1800, 0.6, 0.16, 0.22, 'bandpass'); tone('triangle', 220, 0.001, 0.1, 0.12, 2400); } if (s16 % 2 === 0) noise(7000, 0.7, 0.04, s16 % 4 === 2 ? 0.1 : 0.05);
    if (s16 % 2 === 0) tone('sawtooth', NOTE(bass + (s16 % 8 === 6 ? 12 : 0)), 0.005, 0.2, 0.17, 700);
    if (s16 === 0) for (const n of chord) { tone('sawtooth', NOTE(n), 0.35, 1.8, 0.05, 1600); tone('sawtooth', NOTE(n) * 1.004, 0.35, 1.8, 0.04, 1500); }
    const arp = [0, 1, 2, 1, 2, 1, 0, 2][s16 % 8]; if (s16 % 2 === 1 || s16 % 4 === 0) tone('square', NOTE(chord[arp] + 12), 0.004, 0.18, 0.045, 3200); if (bar === 3 && s16 % 4 === 0) tone('sawtooth', NOTE(chord[2] + 24), 0.02, 0.5, 0.05, 3600);
  } else if (st.genre === 'Techno') {
    if (s16 % 4 === 0) kick(); if (s16 % 4 === 2) noise(8500, 0.6, 0.08, 0.1); if (s16 === 4 || s16 === 12) noise(1400, 0.5, 0.14, 0.16, 'bandpass');
    const acid = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1][s16]; if (acid) { const n = bass + [0, 0, 12, 0, 7, 0, 12, 3][s16 % 8]; tone('sawtooth', NOTE(n), 0.003, 0.16, 0.14, 500 + 2400 * Math.abs(Math.sin(step * 0.07))); }
    if (s16 === 0 && bar % 2 === 0) for (const n of chord) tone('square', NOTE(n + 12), 0.01, 0.6, 0.03, 2000);
  } else {
    if (s16 === 0 || s16 === 10) kick(); if (s16 === 4 || s16 === 12) noise(1600, 0.5, 0.18, 0.12, 'bandpass'); if (s16 % 2 === 0) noise(7500, 0.6, 0.03, 0.04 + (s16 % 4 === 2 ? 0.03 : 0));
    if (s16 === 0 || s16 === 6 || s16 === 11) for (const n of chord) tone('triangle', NOTE(n), 0.005, 1.1, 0.06, 1800); if (s16 % 8 === 0) tone('sine', NOTE(bass), 0.01, 0.6, 0.2, 400);
    if (s16 === 3 || s16 === 14) tone('triangle', NOTE(chord[Math.floor(Math.random() * chord.length)] + 12), 0.005, 0.4, 0.05, 2600);
  }
};

G.Audio = A;
})(window.G = window.G || {});
