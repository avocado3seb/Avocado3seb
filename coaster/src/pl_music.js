// ============================================================================
//  pl_music.js – Hintergrundmusik der Themenwelten, komplett prozedural (WebAudio, keine Dateien, eigene Stücke – keine Nachbildung echter Musik).
//  Berlin: Salon-Walzer · Rookburgh: Maschinen & Dampf · Mexico: Fiesta · Mystery: Drohnen & ferne Glocke · Klugheim: Laute & Rahmentrommel
//  Deep in Africa: Trommeln & Dschungel · China Town: Zupfklänge in Pentatonik · Fantasy: Spieluhr.
//  Wird nur beim Laufen im Park gespielt (nicht im Menü, nicht in der Bahn) und blendet beim Zonenwechsel weich über.
// ============================================================================
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const pickOf = (a, r) => a[Math.floor(r() * a.length)];
export const MUSIC_KEYS = ['berlin', 'rookburgh', 'mexico', 'mystery', 'klugheim', 'africa', 'china', 'fantasy'];
const KEYS = new Set(MUSIC_KEYS);

export class ZoneMusic {
  constructor(audio) {
    this.audio = audio; this.vol = 0.5; this.key = null; this.want = null; this.level = 0; this.next = 0; this.step = 0; this.bar = 0; this.t2 = 0; this.walk = 0;
    this.seed = 1234567; this.r = () => (this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  }
  setVolume(v) { this.vol = Math.max(0, Math.min(1, v)); }
  ready() {
    const ctx = this.audio.ctx; if (!ctx || !this.audio.master) return false;
    if (!this.bus) {
      this.bus = ctx.createGain(); this.bus.gain.value = 0; this.bus.connect(this.audio.master);
      const len = ctx.sampleRate * 1; this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return true;
  }
  // ---- Bausteine
  tone(t, f, dur, type = 'sine', vol = 0.2, o = {}) {
    const ctx = this.audio.ctx, osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = type; osc.frequency.setValueAtTime(f, t); if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur * (o.slideT || 0.6)); if (o.detune) osc.detune.value = o.detune;
    let node = osc; if (o.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; osc.connect(fl); node = fl; }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.att || 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); node.connect(g); g.connect(this.bus); osc.start(t); osc.stop(t + dur + 0.05);
  }
  noise(t, dur, f = 3000, vol = 0.1, type = 'bandpass', q = 1) {
    const ctx = this.audio.ctx, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = this.noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(this.bus); s.start(t); s.stop(t + dur + 0.05);
  }
  // ---- Stücke: jede Funktion plant einen Schritt (step) zur Zeit t; Rückgabe = Dauer bis zum nächsten Schritt in s
  scene(key) {
    const r = this.r;
    switch (key) {
      case 'berlin': { // Salon-Walzer in C-Dur, 3 Schläge pro Takt, I – vi – IV – V
        const prog = [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], beat = 60 / 150, pent = [0, 2, 4, 7, 9, 12, 14];
        return (t, s) => { const b = s % 3, bar = Math.floor(s / 3) % 4, ch = prog[bar], root = 60 + ch[0] - 12;
          if (b === 0) this.tone(t, mtof(root - 12), beat * 2.6, 'sine', 0.2, { att: 0.01 });
          else { for (const n of ch) this.tone(t, mtof(60 + n), beat * 0.9, 'triangle', 0.055, { lp: 2400 }); }
          if (b !== 1 && r() < 0.62) this.tone(t + beat * 0.02, mtof(72 + pickOf(pent, r)), beat * 1.3, 'triangle', 0.09, { lp: 3000 });
          return beat; };
      }
      case 'rookburgh': { // Maschinenrhythmus, Dampfzischen, Metall
        const beat = 60 / 118;
        return (t, s) => { const b = s % 8;
          if (b === 0 || b === 4) this.tone(t, 70, 0.32, 'sine', 0.34, { slideTo: 38, slideT: 0.9 });
          if (b === 2 || b === 6) { this.noise(t, 0.22, 3400, 0.1, 'bandpass', 0.7); }
          if (b % 2 === 1 && r() < 0.55) { this.tone(t, 212 + r() * 8, 0.12, 'square', 0.05, { lp: 1800 }); this.tone(t, 318, 0.1, 'square', 0.035, { lp: 1500 }); }
          if (b === 0) this.tone(t, 55, beat * 8 * 0.5, 'sawtooth', 0.045, { lp: 160, att: 0.4 });
          if (b === 5 && r() < 0.35) this.noise(t, 0.7, 1800, 0.06, 'highpass', 0.5);
          return beat / 2; };
      }
      case 'mexico': { // Fiesta: Gitarrenakkorde Am – G – F – E, Rasseln, Zupfbass
        const prog = [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 56, 59]], beat = 60 / 116;
        return (t, s) => { const b = s % 8, ch = prog[Math.floor(s / 8) % 4];
          this.noise(t, 0.06, 7000, 0.05 + (b % 2 ? 0 : 0.03), 'highpass', 0.8);
          if (b === 0 || b === 3 || b === 4 || b === 6) { ch.forEach((n, i) => this.tone(t + i * 0.012, mtof(n + 12), 0.5, 'sawtooth', 0.05, { lp: 2200 })); }
          if (b === 0 || b === 4) this.tone(t, mtof(ch[0] - 12), 0.4, 'triangle', 0.17);
          if (b === 6 && r() < 0.7) this.tone(t, mtof(ch[2] + 24), 0.3, 'square', 0.04, { lp: 2600, slideTo: mtof(ch[1] + 24) });
          return beat / 2; };
      }
      case 'mystery': { // Drohnen, ferne Glocke, Wind
        const beat = 2.4;
        return (t, s) => { const root = [41.2, 43.65, 36.7, 41.2][Math.floor(s / 4) % 4];
          if (s % 4 === 0) { this.tone(t, root, beat * 4.4, 'sawtooth', 0.07, { lp: 220, att: 1.6 }); this.tone(t, root * 1.5, beat * 4.4, 'sawtooth', 0.04, { lp: 260, att: 2, detune: 9 }); }
          if (s % 8 === 3) { const f = [392, 349.2, 311.1][Math.floor(r() * 3)]; this.tone(t, f, 5.5, 'sine', 0.09, { att: 0.01 }); this.tone(t, f * 2.76, 3.5, 'sine', 0.03, { att: 0.01 }); }
          if (r() < 0.4) this.noise(t, 2.2, 500 + r() * 700, 0.045, 'bandpass', 3);
          return beat; };
      }
      case 'klugheim': { // Laute im Dorischen (D), Rahmentrommel
        const sc = [50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69], beat = 60 / 88; let pos = 4;
        return (t, s) => { const b = s % 8; if (b === 0) this.tone(t, mtof(38), beat * 3.5, 'triangle', 0.16, { lp: 600 });
          if (b === 0 || b === 5) this.tone(t, 84, 0.25, 'sine', 0.24, { slideTo: 52 }), this.noise(t, 0.08, 600, 0.05, 'lowpass');
          if (b % 2 === 0 || r() < 0.4) { pos = Math.max(0, Math.min(sc.length - 1, pos + pickOf([-2, -1, -1, 0, 1, 1, 2], r))); this.tone(t, mtof(sc[pos] + 12), 0.6, 'triangle', 0.1, { lp: 2200 }); this.tone(t, mtof(sc[pos] + 24), 0.25, 'sine', 0.02); }
          return beat / 2; };
      }
      case 'africa': { // 12/8-Trommeln, Shaker, Vogelrufe
        const beat = 60 / 138;
        return (t, s) => { const b = s % 12;
          if ([0, 3, 6, 9].includes(b)) this.tone(t, 150, 0.22, 'sine', 0.3, { slideTo: 70 }), this.noise(t, 0.05, 900, 0.07, 'bandpass');
          if ([2, 5, 8, 11].includes(b)) this.tone(t, 230 + (b % 3) * 20, 0.14, 'sine', 0.2, { slideTo: 140 });
          if (b % 2 === 0) this.noise(t, 0.05, 6500, 0.04, 'highpass');
          if (b === 0) this.tone(t, 52, 0.9, 'sine', 0.14, { slideTo: 46 });
          if (r() < 0.07) { const f = 2400 + r() * 1800, n = 2 + Math.floor(r() * 3); for (let k = 0; k < n; k++) this.tone(t + k * 0.11, f * (1 + k * 0.06), 0.09, 'sine', 0.035, { slideTo: f * 1.3 }); }
          return beat / 3; };
      }
      case 'china': { // Zupfklänge, Pentatonik D E F# A B
        const sc = [62, 64, 66, 69, 71, 74, 76, 78, 81], beat = 60 / 76; let pos = 3;
        return (t, s) => { const b = s % 8; if (b === 0) this.tone(t, mtof(50), beat * 3, 'sine', 0.13, { att: 0.02 });
          if (r() < (b % 2 ? 0.35 : 0.8)) { pos = Math.max(0, Math.min(sc.length - 1, pos + pickOf([-2, -1, -1, 1, 1, 2, 3], r))); const f = mtof(sc[pos]); this.tone(t, f, 1.2, 'triangle', 0.1, { lp: 3500 }); this.tone(t, f * 2, 0.5, 'sine', 0.025); }
          if (s % 32 === 16) { this.tone(t, 98, 3.5, 'sine', 0.12, { att: 0.01 }); this.noise(t, 2.5, 700, 0.03, 'bandpass', 2); }
          return beat / 2; };
      }
      case 'fantasy': { // Spieluhr, hohe Glöckchen in C-Dur-Pentatonik
        const sc = [72, 74, 76, 79, 81, 84, 86, 88], beat = 60 / 108; let pos = 2;
        return (t, s) => { const b = s % 8;
          if (r() < (b % 2 ? 0.55 : 0.9)) { pos = Math.max(0, Math.min(sc.length - 1, pos + pickOf([-3, -2, -1, 1, 2, 3], r))); const f = mtof(sc[pos]); this.tone(t, f, 1.1, 'sine', 0.11, { att: 0.004 }); this.tone(t, f * 4.07, 0.35, 'sine', 0.025); }
          if (b === 0) this.tone(t, mtof(60 + [0, 5, 7, 4][Math.floor(s / 8) % 4]), beat * 3, 'sine', 0.07, { att: 0.01 });
          return beat / 2; };
      }
    }
    return null;
  }
  // zone: Weltschlüssel (berlin, rookburgh, …) oder null; active = darf gerade Musik spielen. Beim Wechsel erst ausblenden, dann das neue Stück einblenden.
  update(dt, zone, active) {
    const ctx = this.audio.ctx; if (!ctx || !this.ready()) return;
    let z = active && zone && KEYS.has(zone) && this.vol > 0.001 && this.audio.on !== false ? zone : null;
    if (z && this.key && z !== this.key) z = null;
    const target = z ? this.vol * 0.9 : 0; this.level += (target - this.level) * Math.min(1, dt / (target > this.level ? 1.2 : 0.6)); this.bus.gain.value = this.level;
    if (!z) { if (this.level < 0.02 && this.key) { this.key = null; this.fn = null; } return; }
    if (!this.key) { this.key = z; this.fn = this.scene(z); this.step = 0; this.next = 0; }
    const now = ctx.currentTime; if (this.next < now - 0.1) this.next = now + 0.06;
    let guard = 0; while (this.next < now + 0.35 && guard++ < 24) { const d = this.fn(this.next, this.step++); this.next += d; }
  }
}
