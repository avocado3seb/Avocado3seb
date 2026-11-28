/* NEON REDLINE – game.js : Start, Hauptschleife, Kamera, Eingabe, Fahrzeug, Schaden, Effekte */
(function (G) {
'use strict';
const U = G.U, W = G.World, CD = G.CD, CM = G.CM, FX = G.FX, AI = G.AI, A = G.Audio; const { clamp, lerp, sstep } = U; const V3 = THREE.Vector3;
const Game = { mode: 'boot', paused: false, cam: 0, camNames: ['Verfolger', 'Nah', 'Motorhaube', 'Cockpit', 'Stoßstange', 'Dynamisch'], keys: {}, pad: null, touch: { steer: 0, gas: 0, brake: 0, hb: 0, nitro: 0 }, time: 0, settings: null, dt: 0, fps: 60, lookBack: false, shake: 0, distance: 0, stats: {}, camPos: new V3(), camLook: new V3(), camTmp: new V3(), speedKmh: 0 };
G.Game = Game;
const DEF_SET = { quality: 2, volMaster: 0.8, volEngine: 1, volMusic: 0.55, volAmb: 0.8, volSfx: 1, assist: 1, abs: true, tcs: 1, difficulty: 1, traffic: 1, police: 1, shake: 1, fov: 70, autoWeather: false, autoTime: true, hudMode: 0, auto: true, units: 0, sens: 1 };
Game.loadSettings = function () { let s = {}; try { s = JSON.parse(localStorage.getItem('nr_settings') || '{}'); } catch (e) { } Game.settings = Object.assign({}, DEF_SET, s); };
Game.saveSettings = function () { try { localStorage.setItem('nr_settings', JSON.stringify(Game.settings)); } catch (e) { } };

/* ------------------------------------------------------------------ Boot */
Game.boot = async function () {
  Game.loadSettings(); const S = Game.settings; const canvas = document.getElementById('game');
  const setMsg = (t, p) => { document.getElementById('loadmsg').textContent = t; if (p !== undefined) document.getElementById('loadbar').style.width = (p * 100) + '%'; };
  const tick = () => new Promise(r => setTimeout(r, 0));
  try {
    setMsg('Initialisiere Renderer …', 0.03); await tick();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }); Game.renderer = renderer; Game.dprMax = Math.min(window.devicePixelRatio || 1, [1, 1.25, 1.5, 2][S.quality] || 1.25); Game.dpr = Game.dprMax; renderer.setPixelRatio(Game.dpr); renderer.setSize(window.innerWidth, window.innerHeight, false);
    Game.scene = new THREE.Scene(); Game.camera = new THREE.PerspectiveCamera(S.fov, window.innerWidth / window.innerHeight, 0.25, 6200); Game.camera.position.set(0, 30, 0);
    setMsg('Erzeuge Straßennetz und Gelände …', 0.1); await tick(); W.init(); G.Gen.prepare(); G.Gen.R = [4, 5, 7, 8][S.quality] || 6;
    setMsg('Baue Beleuchtung und Effekte …', 0.2); await tick(); FX.init(renderer, Game.scene, Game.camera, S.quality); Game.scene.add(G.Gen.root);
    const envTex = FX.initEnv(S.quality >= 2 ? 192 : 128); FX.applyEnv(envTex);
    AI.init(Game.scene); Game.initHelpers(); G.UI.init(); G.Career.init();
    window.addEventListener('resize', Game.onResize); Game.bindInput();
    setMsg('Lade Spielstand …', 0.3); await tick(); G.Career.load(); const start = G.Career.garageSpawn(0); Game.spawnPos = start;
    setMsg('Streame Stadt …', 0.35); FX.hour = 19.3; FX.setWeather('clear', true); await tick();
    Game.createPlayer(G.Career.currentCar(), start.x, start.z, start.yaw); Game.menuCam = true; G.Gen.update(start.x, start.z, 0, true); const total = G.Gen.queue.length; let guard = 0;
    while (G.Gen.queue.length && guard++ < 4000) { G.Gen.update(start.x, start.z, 14); setMsg('Streame Stadt …', 0.35 + 0.6 * (1 - G.Gen.queue.length / total)); await tick(); }
    setMsg('Bereit', 1); await tick(); document.getElementById('loading').classList.add('hidden'); G.UI.showMainMenu(); Game.mode = 'menu'; Game.running = true; Game.last = performance.now(); requestAnimationFrame(Game.frame);
  } catch (err) { console.error(err); const m = document.getElementById('loadmsg'); m.innerHTML = 'Fehler beim Start: ' + (err && err.message ? err.message : err) + '<br><small>Bitte WebGL2/Hardwarebeschleunigung prüfen.</small>'; m.style.color = '#ff6a6a'; }
};
Game.onResize = function () { const r = Game.renderer; r.setSize(window.innerWidth, window.innerHeight, false); Game.camera.aspect = window.innerWidth / window.innerHeight; Game.camera.updateProjectionMatrix(); FX.resize(); G.UI.resizeMap && G.UI.resizeMap(); };
Game.applyQuality = function (q) { const S = Game.settings; S.quality = q; Game.dprMax = Math.min(window.devicePixelRatio || 1, [1, 1.25, 1.5, 2][q] || 1.25); Game.dpr = Game.dprMax; Game.renderer.setPixelRatio(Game.dpr); Game.renderer.shadowMap.enabled = q > 0; FX.sun.castShadow = q > 0; G.Gen.R = [4, 5, 7, 8][q]; if (FX.bloom) FX.bloom.enabled = q >= 1; if (FX.fxaa) FX.fxaa.enabled = q >= 2; Game.onResize(); Game.saveSettings(); };
Game.initHelpers = function () {
  // Checkpoint-Strahl & Event-Marker (instanziert)
  const mk = (color) => new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 90, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); Game.beamGeo = mk;
  Game.markers = new THREE.Group(); Game.scene.add(Game.markers); Game.markerPool = []; Game.cpBeams = [mk(0x18e6ff), mk(0xff2a6d)]; for (const b of Game.cpBeams) { b.visible = false; Game.scene.add(b); }
  const nav = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x18e6ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide })); nav.frustumCulled = false; nav.renderOrder = 3; Game.nav = nav; Game.scene.add(nav);
  Game.debris = []; Game.speedLines = null;
};

/* ------------------------------------------------------------------ Spieler */
Game.createPlayer = function (car, x, z, yaw) {
  if (Game.player) { Game.destroyPlayer(); } const spec = CD.byId[car.id]; const cfg = car.cfg; const veh = new G.Vehicle(spec, cfg); const y = W.groundAt(x, z) + veh.cgY + 0.35; veh.reset(x, y, z, yaw || 0); veh.auto = Game.settings.auto; veh.tcs = Game.settings.tcs; veh.stableAssist = [0, 0.5, 0.9][Game.settings.assist] || 0.5; veh.assistABS = Game.settings.abs; veh.dmg = Object.assign({}, car.dmg || { front: 0, rear: 0, left: 0, right: 0, top: 0 }); veh.health = car.health === undefined ? 1 : car.health;
  const model = CM.build(spec, cfg, { lod: 0 }); model.group.position.set(0, 0, 0); Game.scene.add(model.group); model.group.userData.player = true; Game.player = veh; Game.model = model; Game.carRef = car;
  if (veh.health < 1) Game.restoreDamageVisual(); veh.surf = {}; Game.headOn = FX.night > 0.4; Game.sync(0); if (A.ctx) A.setEngine(spec.engineSnd);
  Game.nitroT = 0; Game.skidAcc = 0; Game.airT = 0; Game.lastSpeedHeat = 0; Game.distance = 0;
  FX.head.forEach(h => { h.intensity = 0; });
};
Game.destroyPlayer = function () { if (Game.model) CM.dispose(Game.model); Game.model = null; Game.player = null; };
Game.restoreDamageVisual = function () { const v = Game.player, m = Game.model; const d = v.dmg; const dent = (x, y, z, n, k) => CM.deform(m, new V3(x, y, z), new V3(-Math.sign(x) * 0 + 0, 0, n), 0.8, k); const L = v.e.L / 2, Wd = v.e.W / 2; if (d.front > 0.05) CM.deform(m, new V3(0, 0.5, L), new V3(0, 0, -1), 0.9, d.front * 0.3); if (d.rear > 0.05) CM.deform(m, new V3(0, 0.5, -L), new V3(0, 0, 1), 0.9, d.rear * 0.3); if (d.left > 0.05) CM.deform(m, new V3(Wd, 0.5, 0), new V3(-1, 0, 0), 0.9, d.left * 0.3); if (d.right > 0.05) CM.deform(m, new V3(-Wd, 0.5, 0), new V3(1, 0, 0), 0.9, d.right * 0.3); };
Game.respawnAt = function (x, z, yaw) { const v = Game.player; if (!v) return; v.reset(x, W.groundAt(x, z) + v.cgY + 0.4, z, yaw || 0); v.auto = Game.settings.auto; v.tcs = Game.settings.tcs; v.stableAssist = [0, 0.5, 0.9][Game.settings.assist] || 0.5; Game.sync(0); };
Game.resetToRoad = function () { const v = Game.player; if (!v) return; const sn = W.snapToRoad(v.pos.x, v.pos.z, 300); if (!sn) return; const p = W.posAtS(sn.road, sn.s, {}); const f = v.forward(new V3()); const dir = (p.tx * f.x + p.tz * f.z) >= 0 ? 1 : -1; const off = sn.road.T.median / 2 + sn.road.T.lane * 0.5; Game.respawnAt(p.x - p.tz * dir * off * -1 * 0 + (-p.tz * dir) * off, p.z + p.tx * dir * off, Math.atan2(p.tx * dir, p.tz * dir)); v.vel.set(p.tx * dir * 6, 0, p.tz * dir * 6); G.UI.toast('Auf die Straße zurückgesetzt', '#ffc83d'); };

/* ------------------------------------------------------------------ Eingabe */
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'hb', ShiftLeft: 'nitro', ShiftRight: 'nitro', ControlLeft: 'down2', KeyE: 'shiftUp', KeyQ: 'shiftDn' };
Game.bindInput = function () {
  window.addEventListener('keydown', e => { if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; const k = KEYMAP[e.code]; if (k) { Game.keys[k] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); } if (!e.repeat) Game.onKey(e.code, e); if (A.ctx === null && Game.mode !== 'boot') { /* Audio startet beim ersten Klick */ } });
  window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) Game.keys[k] = false; if (e.code === 'KeyH') A.horn(false); if (e.code === 'KeyB') Game.lookBack = false; });
  window.addEventListener('blur', () => { Game.keys = {}; });
  document.addEventListener('pointerdown', () => { A.start(); if (Game.player && A.ctx && !Game._engineSet) { A.setEngine(Game.player.spec.engineSnd); Game._engineSet = true; } }, { once: false });
  window.addEventListener('gamepadconnected', e => { Game.pad = e.gamepad.index; });
  // Touch
  if ('ontouchstart' in window || navigator.maxTouchPoints > 1) Game.initTouch();
};
Game.initTouch = function () {
  const t = document.getElementById('touch'); t.style.display = 'block'; const defs = [['L', 'left', '4vw', '22vh', 'steer', -1], ['R', 'right', '4vw + 90px', '22vh', 'steer', 1], ['GAS', 'gas', 'auto', '16vh', 'gas', 1], ['BRK', 'brk', 'auto', '34vh', 'brake', 1], ['NOS', 'nos', 'auto', '52vh', 'nitro', 1], ['HB', 'hb', '4vw', '6vh', 'hb', 1]];
  defs.forEach(([lbl, id, left, bottom, key, val], i) => { const b = document.createElement('div'); b.className = 'tb'; b.textContent = lbl; b.style.bottom = bottom; if (left === 'auto') b.style.right = '3vw'; else b.style.left = `calc(${left})`; t.appendChild(b); const on = e => { e.preventDefault(); if (key === 'steer') Game.touch.steer = val; else Game.touch[key] = 1; b.classList.add('on'); }; const off = e => { e.preventDefault(); if (key === 'steer') { if (Game.touch.steer === val) Game.touch.steer = 0; } else Game.touch[key] = 0; b.classList.remove('on'); }; b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off); });
};
Game.onKey = function (code, e) {
  if (Game.mode === 'menu' || Game.mode === 'garage') return; const U_ = G.UI;
  if (code === 'Escape' || code === 'KeyP') { if (Game.mode === 'drive') U_.togglePause(); else if (Game.mode === 'pause') U_.togglePause(); else if (Game.mode === 'map') U_.toggleMap(); return; }
  if (Game.mode === 'map') { if (code === 'KeyM') U_.toggleMap(); return; }
  if (Game.mode !== 'drive') return;
  if (code === 'KeyC') { Game.cam = (Game.cam + 1) % Game.camNames.length; U_.toast('Kamera: ' + Game.camNames[Game.cam], '#05d9e8', 1); }
  else if (code === 'KeyM') U_.toggleMap(); else if (code === 'KeyH') A.horn(true); else if (code === 'KeyL') { Game.headOn = !Game.headOn; U_.toast(Game.headOn ? 'Licht an' : 'Licht aus', '#fff', 1); }
  else if (code === 'KeyR') { Game.resetToRoad(); } else if (code === 'KeyB') Game.lookBack = true;
  else if (code === 'Tab') { e.preventDefault(); const st = A.setStation(A.musicStation + 1); U_.toast('📻 ' + st.name, '#05d9e8', 1.4); A.ui('radio'); U_.updateRadioName(); }
  else if (code === 'KeyV') { const v = Game.player; v.auto = !v.auto; Game.settings.auto = v.auto; U_.toast(v.auto ? 'Automatik' : 'Manuell (Q/E schalten)', '#fff', 1.4); }
  else if (code === 'KeyF' || code === 'Enter') G.Career.interact(); else if (code === 'KeyG') { Game.wipeOverride = !Game.wipeOverride; U_.toast('Scheibenwischer: ' + (Game.wipeOverride ? 'an' : 'Automatik'), '#fff', 1.2); }
  else if (code === 'KeyT') { G.Career.toggleNav(); } else if (code === 'KeyN') FX.hour = (FX.hour + 1.5) % 24;
};
Game.readInput = function (dt) {
  const k = Game.keys, tc = Game.touch; let thr = (k.up ? 1 : 0) + tc.gas, brk = (k.down || k.down2 ? 1 : 0) + tc.brake, st = (k.left ? 1 : 0) - (k.right ? 1 : 0) + (-tc.steer), hb = (k.hb ? 1 : 0) + tc.hb, nitro = !!(k.nitro || tc.nitro), analog = false;
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; const gp = Game.pad !== null && pads[Game.pad] ? pads[Game.pad] : null; if (gp) { const ax = gp.axes[0] || 0; if (Math.abs(ax) > 0.08) { st = -ax; analog = true; } const rt = gp.buttons[7] ? gp.buttons[7].value : 0, lt = gp.buttons[6] ? gp.buttons[6].value : 0; if (rt > 0.05) thr = Math.max(thr, rt); if (lt > 0.05) brk = Math.max(brk, lt); if (gp.buttons[0] && gp.buttons[0].pressed) hb = 1; if (gp.buttons[1] && gp.buttons[1].pressed) nitro = true; if (gp.buttons[5] && gp.buttons[5].pressed && !Game._p5) { Game.player.input.up = true; } Game._p5 = gp.buttons[5] && gp.buttons[5].pressed; if (gp.buttons[4] && gp.buttons[4].pressed && !Game._p4) { Game.player.input.down = true; } Game._p4 = gp.buttons[4] && gp.buttons[4].pressed; if (gp.buttons[3] && gp.buttons[3].pressed && !Game._p3) { Game.onKey('KeyC', { preventDefault() { } }); } Game._p3 = gp.buttons[3] && gp.buttons[3].pressed; }
  const sens = Game.settings.sens; Game.player.setInput({ throttle: clamp(thr, 0, 1), brake: clamp(brk, 0, 1), steer: clamp(st * sens, -1, 1), hb: clamp(hb, 0, 1), nitro, analog });
  if (k.shiftUp) { Game.player.input.up = true; k.shiftUp = false; } if (k.shiftDn) { Game.player.input.down = true; k.shiftDn = false; }
};

/* ------------------------------------------------------------------ Kamera */
Game.updateCamera = function (dt) {
  const cam = Game.camera, v = Game.player, m = Game.model; if (!v) return; const f = v.forward(new V3()), up = v.up(new V3()), lft = v.left(new V3()); const sp = v.speed; const S = Game.settings;
  const vis = m.group; vis.visible = true; const mode = Game.mode === 'drive' || Game.mode === 'pause' || Game.mode === 'map' ? Game.cam : 0; const ref = Game.model.group;
  let fov = S.fov + clamp(sp / 90, 0, 1) * 16 + (v.nitroOn ? 9 : 0);
  if (Game.mode === 'menu' || Game.menuCam) { const t = performance.now() / 1000 * 0.18; const c = v.pos; const r = 6.5; cam.position.set(c.x + Math.cos(t) * r, c.y + 1.7 + Math.sin(t * 0.6) * 0.4, c.z + Math.sin(t) * r); cam.lookAt(c.x, c.y + 0.1, c.z); cam.fov = 38; cam.updateProjectionMatrix(); Game.cockpit = false; if (m.parts.interior) m.parts.interior.visible = true; return; }
  if (Game.cinematic) { Game.cinematic(dt); return; }
  // Modellsichtbarkeit je Perspektive
  const cockpit = mode === 3 || mode === 2 && false; Game.cockpit = mode === 3; Game.viewName = ['chase', 'chase', 'hood', 'cockpit', 'hood', 'chase'][mode]; A.view = Game.viewName;
  const alignVel = new V3(v.vel.x, 0, v.vel.z); let heading = new V3(f.x, 0, f.z).normalize(); if (sp > 8) { const vd = alignVel.clone().normalize(); heading.lerp(vd, clamp(0.35 * (sp / 60), 0, 0.4)).normalize(); }
  if (mode === 0 || mode === 1 || mode === 5) {
    const dist = mode === 1 ? 5.6 : mode === 0 ? 7.8 + clamp(sp / 80, 0, 1) * 2.5 : 8.2; const h = mode === 1 ? 1.75 : mode === 0 ? 2.6 : 1.9; let tgt = new V3(v.pos.x, v.pos.y - v.cgY, v.pos.z).addScaledVector(heading, -dist).add(new V3(0, h, 0));
    if (mode === 5) { const t = Game.time * 0.4; tgt = new V3(v.pos.x, v.pos.y, v.pos.z).addScaledVector(heading, 4.5 + Math.sin(t * 0.7) * 3).addScaledVector(new V3(-heading.z, 0, heading.x), Math.sin(t) * 7).add(new V3(0, 1.7 + Math.sin(t * 1.3) * 0.7, 0)); }
    if (Game.lookBack) tgt = new V3(v.pos.x, v.pos.y - v.cgY, v.pos.z).addScaledVector(heading, dist).add(new V3(0, h, 0));
    const k = 1 - Math.exp(-dt * (mode === 1 ? 9 : 6.5)); if (!Game.camInit) { Game.camPos.copy(tgt); Game.camInit = true; } Game.camPos.lerp(tgt, k); const gh = W.groundAt(Game.camPos.x, Game.camPos.z, Game.camPos.y) + 0.45; if (Game.camPos.y < gh) Game.camPos.y = gh;
    cam.position.copy(Game.camPos); const look = new V3(v.pos.x, v.pos.y - v.cgY + 1.1, v.pos.z).addScaledVector(heading, Game.lookBack ? -6 : 5 + sp * 0.05); Game.camLook.lerp(look, 1 - Math.exp(-dt * 12)); cam.lookAt(Game.camLook); cam.rotateZ(clamp(-v.w.dot(up) * 0.012 * clamp(sp / 40, 0, 1), -0.05, 0.05));
    ref.visible = true; if (m.parts.interior) m.parts.interior.visible = true; if (m.steerWheel) { m.steerWheel.parent.visible = true; }
  } else {
    // Cockpit / Haube / Stoßstange: an Fahrzeug gebunden
    const e = m.eye.clone(); let local; if (mode === 3) { local = e.clone(); local.x += clamp(-v.gForce.dot(lft) * 0.002, -0.04, 0.04); local.z += clamp(-v.gForce.dot(f) * 0.0015, -0.04, 0.04); } else if (mode === 2) local = new V3(0, m.B.yTopAt(m.B.zF * 0.2) + 0.45, m.B.zF * 0.12); else local = new V3(0, 0.38, m.B.zF - 0.05);
    const base = new V3(local.x, local.y - v.cgY, local.z - v.zcg).applyQuaternion(v.quat).add(v.pos); cam.position.copy(base); const dir = new V3(0, 0, 1).applyQuaternion(v.quat); if (Game.lookBack) dir.negate(); cam.lookAt(base.clone().add(dir.multiplyScalar(10))); if (mode === 3) cam.up.copy(up); else cam.up.set(0, 1, 0);
    cam.rotateZ(0); Game.camPos.copy(cam.position); Game.camInit = false; ref.visible = mode !== 3 ? true : true; if (m.parts.interior) m.parts.interior.visible = true; fov = mode === 3 ? 72 + clamp(sp / 100, 0, 1) * 10 : fov; if (mode === 3 && m.steerWheel) m.steerWheel.parent.visible = true;
    // Rückspiegel-/Schein-Leuchte: nichts
  }
  if (mode !== 3) cam.up.set(0, 1, 0);
  // Schütteln
  Game.shake = Math.max(0, Game.shake - dt * 3); const shk = (Game.shake + clamp(sp / 120, 0, 1) * 0.004 * (v.surfaceType === 'asphalt' ? 1 : 3)) * S.shake; cam.position.x += (Math.random() - 0.5) * shk * 0.2; cam.position.y += (Math.random() - 0.5) * shk * 0.2;
  cam.fov += (fov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix();
  // Tunnel & Innenraum: Modell im Cockpit - Karosserie sichtbar lassen (Spiegelungen), Fahrer-Perspektive
};

/* ------------------------------------------------------------------ Modell/Physik Sync, Schaden, Effekte */
Game.sync = function (dt) {
  const v = Game.player, m = Game.model; if (!v || !m) return; const g = m.group; g.position.copy(v.pos); g.quaternion.copy(v.quat); const off = new V3(0, -v.cgY, -v.zcg).applyQuaternion(v.quat); g.position.add(off);
  const spins = [], comp = []; for (const w of v.wheels) { spins.push((w._spinAcc = (w._spinAcc || 0) + w.omega * (dt || 0))); comp.push(clamp(w.x - v.xRest, -0.12, 0.2) * 0 + (w.contact ? (w.x - w.xFree) * 1 : 0.12) * 0 + (w.contact ? -(w.comp) * 1 : 0.1) + 0); }
  const cs = v.wheels.map(w => w.contact ? clamp(-(w.comp), -0.15, 0.1) + 0.0 : 0.08); CM.applyWheels(m, spins, v.steer, cs);
  if (dt) CM.setLights(m, Game.headOn, v.input.brake > 0.1 && v.fwdSpeed > -0.5 || (v.gear < 0 ? false : false), v.gear < 0, FX.night);
};
Game.onPlayerHit = function (P, n, speed, energy, other, soft) {
  const v = Game.player, m = Game.model; if (!v || energy < 300) return; const diff = Game.settings.difficulty; const k = clamp(energy / 80000, 0, 0.5) * (diff === 0 ? 0.55 : diff === 2 ? 1.25 : 1); const loc = P.clone().sub(v.pos).applyQuaternion(v.quat.clone().invert()); const dirLocal = loc.clone().normalize(); v.applyDamage(dirLocal, k * 0.9);
  const lp = new V3(loc.x, loc.y + v.cgY * 0.5, loc.z + v.zcg); const inward = dirLocal.clone().multiplyScalar(-1); CM.deform(m, lp, inward, clamp(0.6 + k * 1.4, 0.6, 1.4), clamp(k * 0.9, 0.02, 0.34));
  Game.shake = Math.max(Game.shake, clamp(speed / 20, 0.1, 1.0)); A.impact(clamp(speed / 22, 0.15, 1), energy > 15000); FX.spark(P, v.vel, Math.min(24, 4 + energy / 4000)); if (energy > 9000) FX.dust(P, v.vel, 6); if (energy > 22000) { Game.flashT = 0.15; }
  // Scheiben & Lichter & Teile
  if (energy > 28000 && !v.glassBroken) { v.glassBroken = true; m.glassMat.opacity = Math.max(m.glassMat.opacity, 0.88); m.glassMat.color.set(0x273038); A.glass(); G.UI.toast('Scheibe gebrochen', '#ff4d4d', 1.2); }
  if (Math.abs(lp.z) > v.e.L * 0.3 && energy > 12000) { if (lp.z > 0 && m.headMat) { v.headBroken = (v.headBroken || 0) + 1; if (v.headBroken > 1) { m.headMat.emissiveIntensity = 0; m.headMat.color.set(0x111111); } } if (lp.z < 0 && m.tailMat) { v.tailBroken = (v.tailBroken || 0) + 1; if (v.tailBroken > 1) { m.tailMat.emissiveIntensity = 0; m.tailMat.color.set(0x111111); } } }
  if (energy > 18000) Game.detach(lp);
  G.Career.onCrash(speed, energy, other, soft);
  if (v.health <= 0.02 && !Game.totaled) { Game.totaled = true; G.UI.toast('Totalschaden', '#ff4d4d', 2); }
};
Game.detach = function (lp) { const m = Game.model; const cands = ['mirror', 'wing']; if (lp.x > 0.4 && m.mirrors && m.mirrors[0] && m.mirrors[0].visible) Game.shed(m.mirrors[0]); else if (lp.x < -0.4 && m.mirrors && m.mirrors[1] && m.mirrors[1].visible) Game.shed(m.mirrors[1]); else if (lp.z < -0.5 && m.parts.wing && m.parts.wing.visible && Math.random() < 0.6) Game.shed(m.parts.wing); };
Game.shed = function (mesh) { const v = Game.player; mesh.visible = false; const d = mesh.clone(); d.visible = true; const wp = new V3(); mesh.getWorldPosition(wp); const wq = new THREE.Quaternion(); mesh.getWorldQuaternion(wq); d.position.copy(wp); d.quaternion.copy(wq); d.scale.set(1, 1, 1); d.updateMatrixWorld(); d.matrixAutoUpdate = true; Game.scene.add(d); Game.debris.push({ m: d, vel: v.vel.clone().add(new V3((Math.random() - 0.5) * 6, 3 + Math.random() * 3, (Math.random() - 0.5) * 6)), spin: new V3(Math.random() * 8, Math.random() * 8, Math.random() * 8), t: 0 }); };
Game.updateDebris = function (dt) { for (let i = Game.debris.length - 1; i >= 0; i--) { const d = Game.debris[i]; d.t += dt; d.vel.y -= 9.8 * dt; d.m.position.addScaledVector(d.vel, dt); d.m.rotation.x += d.spin.x * dt; d.m.rotation.y += d.spin.y * dt; const gh = W.groundAt(d.m.position.x, d.m.position.z, d.m.position.y); if (d.m.position.y < gh + 0.1) { d.m.position.y = gh + 0.1; d.vel.multiplyScalar(0.5); d.vel.y = Math.abs(d.vel.y) * 0.3; d.spin.multiplyScalar(0.6); } if (d.t > 14) { Game.scene.remove(d.m); Game.debris.splice(i, 1); } } };
Game.repairAll = function () { const v = Game.player, m = Game.model; v.dmg = { front: 0, rear: 0, left: 0, right: 0, top: 0 }; v.health = 1; v.glassBroken = false; v.headBroken = 0; v.tailBroken = 0; v.tirePop = [0, 0, 0, 0]; CM.repair(m); m.glassMat.opacity = [0.28, 0.5, 0.72, 0.92][Game.carRef.cfg.tint | 0] || 0.5; m.glassMat.color.set(0x0a1118); if (m.mirrors) m.mirrors.forEach(x => x.visible = true); if (m.parts.wing) m.parts.wing.visible = true; if (m.headMat) { m.headMat.color.set(0xffffff); } if (m.tailMat) { m.tailMat.color.set(0x300000); } Game.totaled = false; };

const _dir = new V3(), _pp = new V3();
Game.effects = function (dt) {
  const v = Game.player, m = Game.model; if (!v) return; const f = v.forward(_dir); const wet = FX.w.wet; let slipMax = 0; let scrape = v.bodyScrape > 0.03 ? clamp(v.speed / 20, 0, 1) : 0;
  for (let i = 0; i < 4; i++) { const w = v.wheels[i]; if (!w.contact) { FX.skid(i, w.cp, null, f, 0.3, 0); continue; } const sl = w.slide || 0; const speed = v.speed; const hard = (sl > 1.25 && speed > 4) || (w.slipRatio > 0.6 && speed < 20 && v.input.throttle > 0.6) ; slipMax = Math.max(slipMax, hard ? sl : 0);
    const surf = w.surf; const road = surf === 'asphalt' || surf === 'concrete'; _pp.copy(w.cp); const vd = _dir.set(v.vel.x, 0, v.vel.z); if (vd.lengthSq() > 0.5) vd.normalize(); else vd.copy(f);
    if (hard && road) { FX.skid(i, w.cp, null, vd, 0.26 + 0.02 * (v.e.tw * 10), clamp((sl - 1) * 0.9, 0.2, 1)); Game.smokeAcc = (Game.smokeAcc || 0) + dt * 40 * clamp(sl - 0.9, 0, 1.5); while (Game.smokeAcc >= 1) { FX.smoke(w.cp, v.vel, 1, false); Game.smokeAcc -= 1; } } else FX.skid(i, w.cp, null, vd, 0.26, 0);
    if (!road && speed > 8 && Math.random() < dt * 30) FX.dust(w.cp, v.vel, 1); if (road && wet > 0.4 && speed > 14 && Math.random() < dt * 26 * wet) FX.spray(w.cp, v.vel, 1); }
  Game.slipMax = slipMax; Game.scrape = scrape; if (scrape > 0 && Math.random() < dt * 40) FX.spark(_pp.copy(v.pos), v.vel, 3);
  // Auspuff: Knallen, Feuer, Nitro
  const ex = m.exhaust || []; if (v.exhaustPop > 0 && ex.length) { const p = v.exhaustPop; v.exhaustPop = 0; A.pops(p, v.rpm / v.e.red); Game.popFlames = 6; } if (v.blowoff) { A.blowoff(v.e.turboLevel); v.blowoff = 0; }
  if ((Game.popFlames > 0 || v.nitroOn) && ex.length) { Game.popFlames = Math.max(0, (Game.popFlames || 0) - 1); for (const e of ex) { const wp = new V3(e.x, e.y, e.z).applyQuaternion(m.group.quaternion).add(m.group.position); const dir = new V3(0, 0.05, -1).applyQuaternion(m.group.quaternion); FX.flame(wp, dir, v.nitroOn ? 3 : 2); } }
  if (v.nitroOn && !Game.nitroPrev) { A.ui('go'); } Game.nitroPrev = v.nitroOn;
  // Schaden: Rauch
  if (v.health < 0.45 && Math.random() < dt * (12 * (1 - v.health))) { const fw = new V3(0, 0.8, m.B.zF * 0.7).applyQuaternion(m.group.quaternion).add(m.group.position); FX.smoke(fw, v.vel, 1, v.health < 0.2); }
  if (v.health < 0.15 && Math.random() < dt * 14) { const fw = new V3((Math.random() - 0.5), 0.8, m.B.zF * 0.7).applyQuaternion(m.group.quaternion).add(m.group.position); FX.flame(fw, new V3(0, 1, 0), 1); }
  // Spritzwasser-/Windeffekt: Linien bei Tempo (Post-FX)
};
Game.updateLights = function (dt) {
  const v = Game.player, m = Game.model; if (!v) return; const on = Game.headOn; const night = FX.night; if (Game.autoHead !== false) { const want = night > 0.38 || FX.w.rain > 0.35 || FX.tunnel > 0.4; if (Game.autoHeadState !== want) { Game.autoHeadState = want; Game.headOn = want; } }
  const q = new V3(); for (let i = 0; i < 2; i++) { const s = FX.head[i]; const hp = m.headPos[i] || m.headPos[0]; const wp = new V3(hp.x * 0.9, hp.y, hp.z).applyQuaternion(m.group.quaternion).add(m.group.position); s.position.copy(wp); const dir = new V3(0, -0.04, 1).applyQuaternion(v.quat); s.target.position.copy(wp).addScaledVector(dir, 30); s.target.updateMatrixWorld(); s.intensity = Game.headOn && !(v.headBroken > 1 && i === 0) ? 3.4 : 0; s.distance = FX.w.fog > 0.4 ? 80 : 130; }
  // Straßenlaternen (Lichtpool)
  const lamps = G.Gen.nearLamps(v.pos.x, v.pos.z, FX.lamps.length, []); for (let i = 0; i < FX.lamps.length; i++) { const L = FX.lamps[i], c = lamps[i]; if (c) { L.position.set(c[1], c[2], c[3]); L.intensity = clamp(night * 1.0 + FX.w.rain * 0.3 + FX.tunnel * 0.5, 0, 1.3); } else L.intensity = 0; }
  // Tunnel
  const q2 = W.queryRoad(v.pos.x, v.pos.z, 16); const inT = q2.r && (q2.flags & 1) && q2.d < q2.r.T.half + 3 && Math.abs(v.pos.y - q2.h) < 9; FX.tunnel += ((inT ? 1 : 0) - FX.tunnel) * Math.min(1, dt * 3); FX.tunnelLight.intensity = FX.tunnel * 1.3; FX.tunnelLight.position.set(v.pos.x, v.pos.y + 4.2, v.pos.z); Game.inTunnel = inT;
  // Polizeilichter (Pool): nächstes Polizeiauto
  let near = null, nd = 1e9; for (const c of AI.cars) if (c.kind === 'cop' && c.state !== 'wreck') { const d = (c.x - v.pos.x) ** 2 + (c.z - v.pos.z) ** 2; if (d < nd) { nd = d; near = c; } } if (near && nd < 90000 && FX.police.length) { const ph = ((AI.time * 4 + near.flash) % 2) < 1; FX.police[0].position.set(near.x, near.y + 2.4, near.z); FX.police[0].intensity = ph ? 3.6 : 0; FX.police[1].position.set(near.x, near.y + 2.4, near.z); FX.police[1].intensity = ph ? 0 : 3.6; } else for (const l of FX.police) l.intensity = 0;
  // Schatten nur nahe
  const px = v.pos.x, pz = v.pos.z; const cx = Math.floor(px / 250), cz = Math.floor(pz / 250); for (const ch of G.Gen.chunks.values()) { const near2 = Math.abs(ch.cx - cx) <= 1 && Math.abs(ch.cz - cz) <= 1 && ch.lod === 0; if (ch.bMeshes) for (const bm of ch.bMeshes) bm.castShadow = near2 && Game.settings.quality > 0; if (ch.solidMesh) ch.solidMesh.castShadow = near2 && Game.settings.quality > 1; }
};
Game.tireWater = function () { };

/* ------------------------------------------------------------------ Hauptschleife */
Game.frame = function (now) {
  requestAnimationFrame(Game.frame); if (!Game.running) return; let dt = (now - Game.last) / 1000; Game.last = now; dt = clamp(dt, 0, 0.1); Game.dt = dt; Game.fps = lerp(Game.fps, 1 / Math.max(dt, 0.0001), 0.05);
  Game.time += dt; const v = Game.player; const S = Game.settings;
  // Dynamische Auflösung
  Game.perfT = (Game.perfT || 0) + dt; if (Game.perfT > 1.5 && Game.mode !== 'menu') { Game.perfT = 0; if (Game.fps < 34 && Game.dpr > 0.55) { Game.dpr = Math.max(0.55, Game.dpr - 0.1); Game.renderer.setPixelRatio(Game.dpr); Game.onResize(); } else if (Game.fps > 58 && Game.dpr < Game.dprMax) { Game.dpr = Math.min(Game.dprMax, Game.dpr + 0.05); Game.renderer.setPixelRatio(Game.dpr); Game.onResize(); } }
  const live = Game.mode === 'drive' || Game.mode === 'menu' && false; const paused = Game.mode === 'pause' || Game.mode === 'garage' || Game.mode === 'overlay';
  if (Game.mode === 'garage') { G.UI.garageFrame(dt); return; }
  if (v && !paused) {
    if (Game.mode === 'drive' || Game.mode === 'map') {
      Game.readInput(dt); if (Game.mode === 'map') { /* Fahrzeug läuft weiter */ }
      const steps = Math.min(5, Math.max(1, Math.round(dt * 120))); const h = dt / steps; const wetv = FX.w.wet; v.updateSurfaces(wetv);
      for (let i = 0; i < steps; i++) { v.step(h, wetv); const e = G.Collide.vehicleVsWorld(v, Game.onPlayerHit); if (e > 0) v.crashImpulse = e; }
      Game.worldLimits(); if (v.pos.y < -4 && v.inWater) G.Career.onWater(); if (v.flipTimer > 2.5 && v.speed < 3) { Game.resetToRoad(); v.flipTimer = 0; }
      if (v.shifted) { if (A.ctx) A.shift(v.e.turboLevel); v.shifted = 0; }
    } else if (Game.mode === 'menu') { v.input.throttle = 0; v.step(dt, 0); }
    // Sync, Effekte, Welt
    Game.sync(dt); Game.speedKmh = v.speed * 3.6; Game.distance += v.speed * dt;
    G.Gen.update(v.pos.x, v.pos.z, Game.mode === 'menu' ? 6 : 4.5); Game.updateLights(dt); Game.effects(dt); Game.updateDebris(dt);
    const camStatic = Game.mode === 'menu'; FX.update(dt, Game.camera, v, { autoWeather: S.autoWeather && Game.mode === 'drive', speedBlur: clamp((v.speed - 38) / 90, 0, 1) * 0.9 + (v.nitroOn ? 0.35 : 0), bloomBoost: v.nitroOn ? 0.2 : 0, damageVig: (1 - v.health) * 0.35, exposureBoost: FX.tunnel * 0.15 });
    FX.timeScale = Game.mode === 'drive' && S.autoTime ? 90 : 0; if (Game.mode === 'menu') FX.timeScale = 0; FX.rain.material.uniforms.uCam.value.copy(Game.camera.position);
    AI.density = S.traffic; AI.copDensity = S.police; AI.enabled = S.police > 0; if (Game.mode === 'drive' || Game.mode === 'map') { AI.update(dt, v, Game.camera, { freeze: Game.eventFreeze }); G.Career.update(dt); } else if (Game.mode === 'menu') AI.update(dt, v, Game.camera, { freeze: false, noHeli: true });
    Game.updateCamera(dt); Game.audio(dt); G.UI.update(dt);
    // Reflexionen
    Game.envT = (Game.envT || 0) + 1; FX.updateEnv(Game.camera.position, Game.cam === 3 ? null : null, 1);
    Game.flashT = Math.max(0, (Game.flashT || 0) - dt);
  } else if (v) { Game.updateCamera(dt); FX.update(dt * 0, Game.camera, v, {}); }
  FX.render();
};
Game.worldLimits = function () { const v = Game.player; const lim = 2950; let out = false; if (Math.abs(v.pos.x) > lim) { v.pos.x = Math.sign(v.pos.x) * lim; v.vel.x *= -0.4; out = true; } if (Math.abs(v.pos.z) > lim) { v.pos.z = Math.sign(v.pos.z) * lim; v.vel.z *= -0.4; out = true; } if (out && Game.time - (Game.limitT || 0) > 4) { Game.limitT = Game.time; G.UI.toast('Ende der Karte', '#ffc83d', 1.5); } };
Game.audio = function (dt) {
  if (!A.ctx) return; const v = Game.player, e = v.e; const st = { rpm: v.rpm, red: e.red, thr: v.rThr || v.thr, load: v.engTq, boost: v.boost, turbo: e.turboLevel > 0 ? Math.min(1.5, e.turboLevel) : 0, speed: v.speed, gear: v.gear, nitro: v.nitroOn, blowoff: false, on: true };
  if (A.eng) A.updateEngine(dt, st); const surf = v.surfaceType; A.updateAmbient(dt, { speed: v.speed, slip: Game.slipMax || 0, surface: surf, wet: FX.w.wet > 0.4, rain: FX.w.rain, tunnel: FX.tunnel, city: Math.abs(v.pos.x) < 900 && Math.abs(v.pos.z) < 900 ? 1 : 0.2, scrape: Game.scrape, nitro: v.nitroOn });
  const right = new V3(1, 0, 0).applyQuaternion(Game.camera.quaternion); const [sir, tr] = AI.audioLists(v, Game.camera.position, right); A.updateSirens(sir); A.updateTraffic(tr);
};

window.addEventListener('load', () => { Game.boot(); });
})(window.G = window.G || {});
