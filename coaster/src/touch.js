// ============================================================================
//  touch.js – Steuerung für Tablet/Smartphone: Joystick (links), Blick per Wischen (Canvas),
//  Pinch-Zoom, Aktionsknöpfe (Springen, Interagieren, Rennen, Karte, Foto, Menü, Abfahrt, Kamera)
// ============================================================================
const $ = (s, r = document) => r.querySelector(s);

export class Touch {
  constructor(app) {
    this.app = app; this.on = false; this.stick = { id: null, x: 0, y: 0 }; this.run = false; this.held = new Set();
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.getElementById('app').insertAdjacentHTML('beforeend', `
      <div id="tc" class="hide">
        <div id="joy"><i id="joyK"></i></div>
        <div id="tbtns">
          <button data-a="jump">⤒<small>Sprung</small></button><button data-a="use">E<small>Aktion</small></button><button data-a="run">»<small>Rennen</small></button>
          <button data-a="map">🗺</button><button data-a="photo">📷</button><button data-a="go">▶<small>Start</small></button><button data-a="cam">🎥</button><button data-a="menu">☰</button>
        </div></div>`);
    this.el = $('#tc'); const joy = $('#joy'), K = $('#joyK');
    const upd = (e) => {
      const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const m = r.width / 2, d = Math.hypot(dx, dy);
      if (d > m) { dx *= m / d; dy *= m / d; } K.style.transform = `translate(${dx}px,${dy}px)`; this.stick.x = dx / m; this.stick.y = dy / m; this.applyKeys();
    };
    joy.addEventListener('pointerdown', e => { joy.setPointerCapture(e.pointerId); this.stick.id = e.pointerId; upd(e); e.preventDefault(); });
    joy.addEventListener('pointermove', e => { if (this.stick.id === e.pointerId) upd(e); });
    const end = e => { if (this.stick.id === e.pointerId) { this.stick.id = null; this.stick.x = this.stick.y = 0; K.style.transform = ''; this.applyKeys(); } };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    this.el.querySelectorAll('#tbtns button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); this.act(b.dataset.a, b); }));
    // Pinch-Zoom auf dem Canvas
    const cv = app.canvas; let pd = 0; const pts = new Map();
    cv.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') pts.set(e.pointerId, [e.clientX, e.clientY]); });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pd) this.pinch(pd - d); pd = d; }
    });
    const up = e => { pts.delete(e.pointerId); pd = 0; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    this.setEnabled(this.isTouch && app.settings.touch !== false);
  }
  setEnabled(on) { this.on = on; document.body.classList.toggle('touch', on); this.refresh(); }
  refresh() {
    const a = this.app, show = this.on && a.state !== 'menu';
    this.el.classList.toggle('hide', !show); if (!show) { this.stick.x = this.stick.y = 0; this.applyKeys(); return; }
    const ride = a.state === 'ride', walk = a.state === 'park' && a.parkMode === 'walk', pl = a.park && a.park.def.name === 'Phantasialand';
    for (const [k, vis] of [['jump', walk], ['use', walk && pl], ['run', a.state === 'park'], ['map', pl], ['photo', pl], ['go', ride], ['cam', ride], ['menu', true]]) { const b = this.el.querySelector(`[data-a="${k}"]`); if (b) b.classList.toggle('hide', !vis); }
    $('#joy').classList.toggle('hide', ride);
  }
  applyKeys() {
    const K = this.app.keys, s = this.stick, want = { KeyW: s.y < -0.35, KeyS: s.y > 0.35, KeyA: s.x < -0.35, KeyD: s.x > 0.35, ShiftLeft: this.run && (Math.hypot(s.x, s.y) > 0.2) };
    for (const [c, v] of Object.entries(want)) { if (v) { K.add(c); this.held.add(c); } else if (this.held.has(c)) { K.delete(c); this.held.delete(c); } }
  }
  act(a, b) {
    const app = this.app;
    if (a === 'jump') app.walk.jump = true;
    else if (a === 'use') app.game.interact();
    else if (a === 'run') { this.run = !this.run; b.classList.toggle('on', this.run); this.applyKeys(); }
    else if (a === 'map') app.ui.openMap();
    else if (a === 'photo') app.game.takePhoto('Foto');
    else if (a === 'go') { if (app.ride && app.ride.sim.state === 'station') app.ride.sim.timer = Math.min(app.ride.sim.timer, 0.3); }
    else if (a === 'cam') app.cycleCamera();
    else if (a === 'menu') app.showMenu();
  }
  pinch(delta) { // delta > 0: Finger zusammen → rauszoomen
    const a = this.app;
    if (a.state === 'park' && a.parkMode === 'walk') a.walkFov = Math.max(28, Math.min(95, a.walkFov + delta * 0.15));
    else if (a.state === 'ride' && a.camMode === 'drone') a.drone.dist = Math.max(8, Math.min(160, a.drone.dist * (1 + delta * 0.004)));
    else if (a.state === 'park' && a.parkMode === 'bird') { a.bird.r = Math.max(60, Math.min(700, a.bird.r * (1 + delta * 0.004))); a.bird.h = Math.max(40, Math.min(600, a.bird.h * (1 + delta * 0.004))); }
    else if (a.state === 'park') a.free.speed = Math.max(8, Math.min(600, a.free.speed * (1 - delta * 0.004)));
  }
}
