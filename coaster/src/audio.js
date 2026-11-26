// Einfache prozedurale Soundkulisse: Wind, Fahrgeräusch, Kettenlift, Donner
export class AudioFx {
  constructor() { this.ctx = null; this.on = true; this.vol = 0.6; this.clackT = 0; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let b0 = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.97 * b0 + 0.03 * w; d[i] = w * 0.6 + b0 * 4; }
      this.buf = buf;
      this.master = ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(ctx.destination);
      const mk = (type, f, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.master); s.start(); return { s, fl, g }; };
      this.wind = mk('bandpass', 600, 0.6); this.rumble = mk('lowpass', 140, 0.8); this.rain = mk('highpass', 2500, 0.3);
    } catch (e) { this.ctx = null; }
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = this.on ? v : 0; }
  toggle() { this.on = !this.on; if (this.master) this.master.gain.value = this.on ? this.vol : 0; return this.on; }
  update(dt, v, mode, lift, rain) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, k = Math.min(1, v / 38);
    const inRide = mode === 'ride';
    this.wind.g.gain.setTargetAtTime(inRide ? k * k * 0.9 + 0.03 : 0.05, t, 0.1);
    this.wind.fl.frequency.setTargetAtTime(300 + k * 1800, t, 0.1);
    this.rumble.g.gain.setTargetAtTime(inRide ? (v > 0.5 ? 0.25 + k * 0.7 : 0) : 0, t, 0.1);
    this.rain.g.gain.setTargetAtTime(rain * 0.25, t, 0.3);
    if (inRide && lift) {
      this.clackT -= dt;
      if (this.clackT <= 0) {
        this.clackT = 0.13;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'square'; o.frequency.value = 110 + Math.random() * 30;
        g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.06);
      }
    }
  }
  thunder() {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime + 0.4, s = this.ctx.createBufferSource(); s.buffer = this.buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.2, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 3.5);
  }
}
