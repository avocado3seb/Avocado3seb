// ============================================================================
//  pl_player.js – sichtbare Spielerfigur (Third-Person): echte Vice-City-Figur mit Lauf-/Sprunganimation und Skin
// ============================================================================
import { CharView, defaultLook } from './pl_char.js';

export class Player {
  constructor(scene, look = defaultLook()) {
    this.view = new CharView(look); this.group = this.view.root; this.yaw = 0; this.view.show(false); scene.add(this.group);
  }
  setLook(look) { this.view.setLook(look); }
  // x,y,z = Füße; speed in m/s (tatsächliche Geschwindigkeit); air = in der Luft
  update(dt, x, y, z, faceYaw, speed, air) {
    const g = this.group; g.position.set(x, y, z);
    let d = faceYaw - this.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; this.yaw += d * Math.min(1, dt * 12); g.rotation.y = this.yaw;
    this.view.update(dt, { speed: Math.min(5.6, speed * 0.62), jump: !!air });
  }
  show(v) { this.group.visible = v; }
}
