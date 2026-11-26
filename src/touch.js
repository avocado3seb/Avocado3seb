// Touch-Steuerung: virtueller Joystick, Blickfläche, kontextabhängige Tasten
import { h } from './ui.js';

const BTN = {
  // Zu Fuß
  fire: { label: '🔫', cls: 'big', mouse: 0, show: (c) => c.foot && c.armed },
  punch: { label: '👊', cls: 'big', mouse: 0, show: (c) => c.foot && !c.armed },
  aim: { label: '🎯', mouse: 2, toggle: true, show: (c) => c.foot && c.armed },
  jump: { label: '⤒', key: 'Space', show: (c) => c.foot },
  interact: { label: 'E', key: 'KeyE', show: (c) => c.foot, tap: true },
  enter: { label: '🚗', key: 'KeyF', show: (c) => c.foot, tap: true },
  sprint: { label: '⚡', key: 'ShiftLeft', toggle: true, show: (c) => c.foot && !c.fly },
  flyUp: { label: '▲', key: 'Space', cls: 'big', show: (c) => c.foot && c.fly },
  flyDn: { label: '▼', key: 'ControlLeft', show: (c) => c.foot && c.fly },
  flyFast: { label: '⚡', key: 'ShiftLeft', toggle: true, show: (c) => c.foot && c.fly },
  emote: { label: '😀', fn: 'emote', show: (c) => c.mp, tap: true },
  reload: { label: '↻', key: 'KeyR', show: (c) => c.foot && c.armed, tap: true },
  weapon: { label: '🔄', wheel: 1, show: (c) => c.foot, tap: true },
  // Fahrzeug
  gas: { label: 'GAS', cls: 'big', axis: 1, show: (c) => c.car || c.boat },
  brake: { label: 'BREMSE', axis: -1, show: (c) => c.car || c.boat },
  hand: { label: '🅿', key: 'Space', show: (c) => c.car || c.boat },
  horn: { label: '📯', key: 'KeyH', show: (c) => c.car },
  exit: { label: '⏏', key: 'KeyF', show: (c) => c.veh, tap: true },
  cam: { label: '🎥', key: 'KeyV', show: (c) => c.veh, tap: true },
  radio: { label: '📻', key: 'KeyE', show: (c) => c.car, tap: true },
  enterkey: { label: 'OK', key: 'Enter', show: (c) => c.veh && c.poi, tap: true },
  lights: { label: '💡', key: 'KeyG', show: (c) => c.car, tap: true },
  // Flugzeug / Heli
  thrUp: { label: '▲ Schub', key: 'ShiftLeft', cls: 'big', show: (c) => c.plane },
  thrDn: { label: '▼ Schub', key: 'ControlLeft', show: (c) => c.plane },
  up: { label: '▲', key: 'Space', cls: 'big', show: (c) => c.heli },
  down: { label: '▼', key: 'ControlLeft', show: (c) => c.heli },
  yawL: { label: '⟲', key: 'KeyQ', show: (c) => c.air },
  yawR: { label: '⟳', key: 'KeyE', show: (c) => c.air },
  abrake: { label: 'BREMSE', key: 'Space', show: (c) => c.plane },
};

export class TouchControls {
  constructor(G) {
    this.G = G; this.on = false; this.stick = null; this.lookId = null; this.btns = new Map(); this.ctx = {};
    this.build();
    this.apply();
    // Erste Berührung schaltet die Touch-Steuerung automatisch ein (falls nicht ausdrücklich aus)
    addEventListener('touchstart', () => { if (!this.on && (G.settings.touch || 'auto') === 'auto') { G.settings.touch = 'on'; this.apply(); } }, { once: false, passive: true });
    this.rot = h('div', { class: 'trot' }, '📱 Bitte das Gerät quer halten (Querformat) und ⛶ Vollbild nutzen');
    document.getElementById('ui').append(this.rot);
  }
  isTouchDevice() { return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0 || 'ontouchstart' in window; }
  apply() {
    const m = this.G.settings.touch || 'auto';
    const on = m === 'on' || (m === 'auto' && this.isTouchDevice());
    this.on = on; this.G.input.touch = on;
    document.body.classList.toggle('touch', on);
    this.root.style.display = on ? '' : 'none';
    if (!on) { this.G.input.ax = this.G.input.ay = 0; }
  }
  build() {
    const G = this.G, I = G.input;
    this.root = h('div', { class: 'touch-layer' });
    // Blickfläche
    this.pad = h('div', { class: 'tpad' });
    // Joystick
    this.base = h('div', { class: 'tstick' }, (this.knob = h('div', { class: 'tknob' })));
    this.root.append(this.pad, this.base);
    const bind = (el, down, up, move) => {
      el.addEventListener('touchstart', (e) => { e.preventDefault(); for (const t of e.changedTouches) down(t, e); }, { passive: false });
      el.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) move && move(t, e); }, { passive: false });
      const end = (e) => { e.preventDefault(); for (const t of e.changedTouches) up(t, e); };
      el.addEventListener('touchend', end, { passive: false }); el.addEventListener('touchcancel', end, { passive: false });
    };
    // Joystick-Logik
    const R = 56;
    bind(this.base, (t) => { if (this.stick !== null) return; this.stick = t.identifier; this.sx = t.clientX; this.sy = t.clientY; const r = this.base.getBoundingClientRect(); this.cx = r.left + r.width / 2; this.cy = r.top + r.height / 2; this.moveStick(t); },
      (t) => { if (t.identifier === this.stick) { this.stick = null; I.ax = 0; this.stickAy = 0; this.knob.style.transform = 'translate(0,0)'; } },
      (t) => { if (t.identifier === this.stick) this.moveStick(t); });
    // Blick
    bind(this.pad, (t) => { if (this.lookId !== null) return; this.lookId = t.identifier; this.lx = t.clientX; this.ly = t.clientY; this.lt = performance.now(); this.lmoved = 0; },
      (t) => { if (t.identifier === this.lookId) { this.lookId = null; } },
      (t) => { if (t.identifier === this.lookId) { const k = 1.5; I.look((t.clientX - this.lx) * k, (t.clientY - this.ly) * k); this.lmoved += Math.abs(t.clientX - this.lx) + Math.abs(t.clientY - this.ly); this.lx = t.clientX; this.ly = t.clientY; } });
    // Tasten
    this.right = h('div', { class: 'tbtns' });
    this.root.append(this.right);
    for (const [id, d] of Object.entries(BTN)) {
      const el = h('div', { class: 'tbtn ' + (d.cls || ''), 'data-id': id }, d.label); this.right.append(el);
      const act = { el, d, touches: new Set(), on: false };
      const set = (v) => {
        if (v === act.on) return; act.on = v; el.classList.toggle('on', v);
        if (d.key) { if (v) I.press(d.key); else I.release(d.key); }
        if (d.mouse !== undefined) { if (v) I.mpress(d.mouse); else I.mrelease(d.mouse); }
        if (d.axis !== undefined) { this.axisBtn = this.axisBtn || {}; this.axisBtn[id] = v ? d.axis : 0; }
        if (d.wheel && v) I.wheel += d.wheel;
        if (d.fn === 'emote' && v) { this.emoteI = (this.emoteI || 0) + 1; G.mp?.emote(this.emoteI); }
      };
      bind(el, (t) => { act.touches.add(t.identifier); if (d.toggle) { set(!act.on); } else set(true); G.audio?.hover?.(); },
        (t) => { act.touches.delete(t.identifier); if (!d.toggle && act.touches.size === 0) { if (d.tap) setTimeout(() => set(false), 60); else set(false); } });
      this.btns.set(id, act);
    }
    // Systemtasten oben
    const sys = h('div', { class: 'tsys' },
      h('div', { class: 'tsb', onClick: () => G.mode === 'play' && G.ui.openPause() }, '☰'),
      h('div', { class: 'tsb', onClick: () => G.mode === 'play' && G.ui.openPause('map') }, '🗺'),
      h('div', { class: 'tsb', onClick: () => G.mode === 'play' && G.ui.openPause('phone') }, '📱'),
      h('div', { class: 'tsb', onClick: () => G.mp?.active && G.mp.openChat() }, '💬'),
      h('div', { class: 'tsb', onClick: () => this.fullscreen() }, '⛶'));
    this.root.append(sys);
    // Cutscene weiter
    this.skip = h('div', { class: 'tskip', onClick: () => { I.press('Enter'); setTimeout(() => I.release('Enter'), 80); } }, 'Weiter ▶');
    this.root.append(this.skip);
    document.getElementById('ui').append(this.root);
    window.addEventListener('contextmenu', (e) => { if (this.on) e.preventDefault(); });
  }
  fullscreen() { const el = document.documentElement; try { if (document.fullscreenElement) document.exitFullscreen(); else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); } catch (e) { /* ignore */ } try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) { /* ignore */ } }
  moveStick(t) {
    const I = this.G.input, R = 56; let dx = t.clientX - this.cx, dy = t.clientY - this.cy; const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    this.knob.style.transform = `translate(${dx}px,${dy}px)`;
    let ax = dx / R, ay = -dy / R; const m = Math.hypot(ax, ay); const dead = 0.12;
    if (m < dead) { ax = ay = 0; } else { const k = (m - dead) / (1 - dead) / m; ax *= k; ay *= k; }
    I.ax = ax; this.stickAy = ay;
  }
  update() {
    const G = this.G; if (!this.on) return;
    const P = G.player, v = P.vehicle;
    const play = G.mode === 'play' || G.mode === 'cutscene';
    this.root.classList.toggle('hidden', !(G.mode === 'play' || G.mode === 'cutscene'));
    this.skip.style.display = G.mode === 'cutscene' ? '' : 'none';
    if (G.mode === 'cutscene') { for (const a of this.btns.values()) a.el.style.display = 'none'; this.base.style.display = 'none'; return; }
    this.base.style.display = '';
    const w = P.weapons[P.weapon];
    const c = { foot: !v, veh: !!v, car: !!v && (v.kind === 'car' || v.kind === 'bike'), boat: !!v && v.kind === 'boat', plane: !!v && v.kind === 'plane', heli: !!v && v.kind === 'heli', air: !!v && (v.kind === 'plane' || v.kind === 'heli'), armed: P.weapon !== 'fist', poi: !!G.poiNear };
    c.fly = !!P.fly; c.mp = !!G.mp?.active;
    for (const [id, a] of this.btns) { const s = !!a.d.show(c); a.el.style.display = s ? '' : 'none'; if (!s && a.on) { a.on = false; a.el.classList.remove('on'); if (a.d.key) G.input.release(a.d.key); if (a.d.mouse !== undefined) G.input.mrelease(a.d.mouse); if (a.d.axis !== undefined && this.axisBtn) this.axisBtn[id] = 0; } }
    // Gas / Bremse → analoge Achse (zusätzlich zum Joystick)
    const ab = this.axisBtn; const extra = ab ? Object.values(ab).reduce((s, x) => s + x, 0) : 0;
    G.input.ay = clamp2((this.stickAy ?? 0) + extra, -1, 1);
  }
}
const clamp2 = (v, a, b) => Math.max(a, Math.min(b, v));
