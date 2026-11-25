// Eingabe: Tastatur, Maus, Pointer-Lock
export class Input {
  constructor(canvas, G) {
    this.G = G; this.canvas = canvas;
    this.keys = new Set(); this.pressed = new Set(); this.released = new Set();
    this.mx = 0; this.my = 0; this.wheel = 0;
    this.mouse = new Set(); this.mousePressed = new Set();
    this.locked = false; this.enabled = true; this.touch = false; this.ax = 0; this.ay = 0;
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F3'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.G.emit('key', e);
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); this.released.add(e.code); });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.clear(); });
    canvas.addEventListener('mousedown', (e) => { this.mouse.add(e.button); this.mousePressed.add(e.button); if (G.mode === 'play' && !this.locked && !this.touch) this.lock(); });
    addEventListener('mouseup', (e) => { this.mouse.delete(e.button); });
    addEventListener('mousemove', (e) => { if (this.locked) { this.mx += e.movementX; this.my += e.movementY; } });
    addEventListener('wheel', (e) => { if (G.mode === 'play') this.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('contextmenu', (e) => { if (G.mode === 'play') e.preventDefault(); });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked; this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked && G.mode === 'play') G.emit('unlock');
    });
  }
  // Touch-Hilfen: virtuelle Tasten / Maustasten
  press(code) { if (!this.keys.has(code)) this.pressed.add(code); this.keys.add(code); }
  release(code) { this.keys.delete(code); this.released.add(code); }
  mpress(b) { if (!this.mouse.has(b)) this.mousePressed.add(b); this.mouse.add(b); }
  mrelease(b) { this.mouse.delete(b); }
  look(dx, dy) { this.mx += dx; this.my += dy; }
  lock() {
    if (this.touch) return; try { const p = this.canvas.requestPointerLock?.(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); this.locked = false; }
  down(c) { return this.keys.has(c); }
  hit(c) { return this.pressed.has(c); }
  mdown(b) { return this.mouse.has(b); }
  mhit(b) { return this.mousePressed.has(b); }
  endFrame() { this.pressed.clear(); this.released.clear(); this.mousePressed.clear(); this.mx = 0; this.my = 0; this.wheel = 0; }
  axis(neg, pos) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }
}
