// ============================================================================
//  pl_player.js – sichtbare Spielerfigur für die Third-Person-Ansicht (Laufanimation, Farbwahl)
// ============================================================================
import * as THREE from 'three';

const mat = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
const box = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; };

export class Player {
  constructor(scene, color = '#1e88e5') {
    this.group = new THREE.Group(); this.yaw = 0; this.t = 0; this.amp = 0;
    this.shirt = mat(color), this.pants = mat(0x37474f), this.skin = mat(0xe0ac86, 0.8), this.hair = mat(0x2b1d14), this.shoe = mat(0x1a1a1c, 0.7), this.belt = mat(0x2a2218);
    const g = this.group;
    g.add(box(0.46, 0.6, 0.27, 0, 1.08, 0, this.shirt)); g.add(box(0.52, 0.1, 0.29, 0, 1.34, 0, this.shirt)); g.add(box(0.48, 0.06, 0.29, 0, 0.79, 0, this.belt));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), this.skin); head.scale.set(1, 1.1, 1.02); head.position.set(0, 1.6, 0); head.castShadow = true; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), this.hair); hair.position.set(0, 1.62, -0.012); g.add(hair);
    g.add(box(0.04, 0.06, 0.06, 0, 1.57, 0.16, this.skin)); for (const s of [-1, 1]) g.add(box(0.03, 0.03, 0.02, s * 0.06, 1.63, 0.155, this.hair));
    g.add(box(0.1, 0.08, 0.1, 0, 1.41, 0, this.skin));
    this.arms = [-1, 1].map(s => { const p = new THREE.Group(); p.position.set(s * 0.3, 1.32, 0); p.add(box(0.12, 0.5, 0.14, 0, -0.25, 0, this.shirt)); const h = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), this.skin); h.position.set(0, -0.54, 0); p.add(h); g.add(p); return p; });
    this.legs = [-1, 1].map(s => { const p = new THREE.Group(); p.position.set(s * 0.11, 0.78, 0); p.add(box(0.17, 0.7, 0.19, 0, -0.35, 0, this.pants)); p.add(box(0.19, 0.1, 0.32, 0, -0.74, 0.05, this.shoe)); g.add(p); return p; });
    g.visible = false; scene.add(g);
  }
  setColor(c) { this.shirt.color.set(c); }
  // pos = Füße; moving = Geschwindigkeit (m/s), air = in der Luft
  update(dt, x, y, z, faceYaw, speed, air) {
    const g = this.group; g.position.set(x, y, z);
    let d = faceYaw - this.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; this.yaw += d * Math.min(1, dt * 12); g.rotation.y = this.yaw;
    const target = air ? 0.9 : Math.min(1, speed / 6); this.amp += (target - this.amp) * Math.min(1, dt * 10); this.t += dt * (4 + speed * 0.9);
    const sw = Math.sin(this.t) * 0.85 * (air ? 0.4 : this.amp);
    this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw; this.arms[0].rotation.x = -sw * 0.8; this.arms[1].rotation.x = sw * 0.8;
    if (air) { this.arms[0].rotation.z = 0.5; this.arms[1].rotation.z = -0.5; } else { this.arms[0].rotation.z = 0.05; this.arms[1].rotation.z = -0.05; }
  }
  show(v) { this.group.visible = v; }
}
