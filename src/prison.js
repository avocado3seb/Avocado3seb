// Gefängnis auf Alcatraz: Bei Festnahme 130 s Haft, Hof mit Hantelbank, danach Entlassung aufs Festland.
export const JAIL_TIME = 130;

export class Prison {
  constructor(G) {
    this.G = G; this.active = false; this.t = 0; this.stashWeapon = 'pistol'; this.workT = 0; this.reps = 0;
    this.el = document.createElement('div'); this.el.id = 'prison';
    this.el.innerHTML = '<div class="pt">🔒 ALCATRAZ · HAFT</div><div class="pn">130</div><div class="ps">Hantelbank (E) verkürzt die Strafe · Fliehen unmöglich</div>';
    this.el.style.display = 'none'; document.getElementById('ui')?.appendChild(this.el) || document.body.appendChild(this.el);
    this.nEl = this.el.querySelector('.pn');
  }
  jail(secs = JAIL_TIME) {
    const G = this.G, P = G.player, W = G.world, Y = W.prisonYard || { x: 1000, z: 1260, y: 13 };
    if (P.vehicle) P.exitVehicle(true);
    this.stashWeapon = P.weapon && P.weapon !== 'fist' ? P.weapon : 'pistol';
    this.active = true; this.t = secs; this.workT = 0; this.reps = 0;
    G.police.reset();
    P.respawn(Y.x + (Math.random() - 0.5) * 8, Y.z + 6, Math.PI);
    P.weapon = 'fist'; P.refreshWeaponModel?.(); P.char.state.hands = false;
    G.mission?.onPlayerFail?.('busted');
    this.el.style.display = 'flex';
    G.ui?.toast(`Du wurdest festgenommen! ${secs} Sekunden Haft auf Alcatraz.`);
    G.ui?.fade?.(900); G.ui?.banner(null);
  }
  release(msg = 'Du bist frei! Benimm dich ab jetzt.') {
    if (!this.active) return;
    const G = this.G, P = G.player, W = G.world;
    this.active = false; this.el.style.display = 'none';
    const poi = W.pois.find((p) => p.kind === 'police') || W.pois[0];
    P.respawn(poi.x, poi.z + 4, 0);
    if (P.weapons[this.stashWeapon]?.owned) { P.weapon = this.stashWeapon; P.refreshWeaponModel?.(); }
    G.police.reset(); G.env.time = (G.env.time + 1) % 24;
    G.ui?.toast(msg); G.ui?.fade?.(900); G.eco?.autosave?.();
  }
  workout() {
    const G = this.G, P = G.player;
    if (!this.active) return G.ui?.toast('Hantelbank – nur im Gefängnis benutzbar.');
    if (this.workT > 0) return;
    this.workT = 1.2; this.reps++; this.t = Math.max(0, this.t - 6);
    P.skills.fit = Math.min(5, (P.skills.fit || 0) + 0.2);
    G.audio?.click?.(); G.ui?.toast(`Training! −6 s Haft (Fitness ${P.skills.fit.toFixed(1)})`);
  }
  update(dt) {
    if (!this.active) return;
    const G = this.G, P = G.player, W = G.world, Y = W.prisonYard;
    if (G.mode !== 'play') return;
    this.t -= dt; this.workT = Math.max(0, this.workT - dt);
    this.nEl.textContent = Math.max(0, Math.ceil(this.t));
    if (P.vehicle) P.exitVehicle(true);
    if (Y) { const dx = P.pos.x - Y.cx, dz = P.pos.z - Y.cz, d = Math.hypot(dx, dz); if (d > 55) { P.pos.x = Y.cx + dx / d * 55; P.pos.z = Y.cz + dz / d * 55; } }
    if (P.weapon !== 'fist') { P.weapon = 'fist'; P.refreshWeaponModel?.(); }
    if (G.police.stars) G.police.clear(true);
    if (this.t <= 0) this.release();
  }
}
