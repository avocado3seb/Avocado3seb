// Partikel, Reifenspuren, Explosionen
import * as THREE from 'three';
import { makeSmoke, makeGlow } from './textures.js';
import { clamp, lerp } from './util.js';

const VS = `attribute vec4 aCol; attribute float aSize; varying vec4 vCol; uniform float uScale;
void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`;
const FS = `uniform sampler2D uMap; varying vec4 vCol; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vCol.rgb, vCol.a * t.a); if(gl_FragColor.a < 0.01) discard; }`;

class Pool {
  constructor(n, tex, additive) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.c0 = new Float32Array(n * 3); this.a0 = new Float32Array(n);
    this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.ca = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.sa = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pa); g.setAttribute('aCol', this.ca); g.setAttribute('aSize', this.sa);
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uMap: { value: tex }, uScale: { value: 800 } } });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 8;
    for (let k = 0; k < n; k++) this.pos[k * 3 + 1] = -9999;
  }
  emit(x, y, z, vx, vy, vz, size0, size1, life, r, g, b, a, grav = 0, drag = 0.5) {
    const k = this.i; this.i = (this.i + 1) % this.n;
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.vel[k * 3] = vx; this.vel[k * 3 + 1] = vy; this.vel[k * 3 + 2] = vz;
    this.life[k] = life; this.max[k] = life; this.s0[k] = size0; this.s1[k] = size1;
    this.c0[k * 3] = r; this.c0[k * 3 + 1] = g; this.c0[k * 3 + 2] = b; this.a0[k] = a; this.grav[k] = grav; this.drag[k] = drag;
  }
  update(dt) {
    for (let k = 0; k < this.n; k++) {
      if (this.life[k] <= 0) { if (this.size[k] !== 0) { this.size[k] = 0; this.col[k * 4 + 3] = 0; } continue; }
      this.life[k] -= dt;
      const t = 1 - this.life[k] / this.max[k];
      const d = Math.max(0, 1 - this.drag[k] * dt);
      this.vel[k * 3] *= d; this.vel[k * 3 + 1] = this.vel[k * 3 + 1] * d - this.grav[k] * dt; this.vel[k * 3 + 2] *= d;
      this.pos[k * 3] += this.vel[k * 3] * dt; this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt; this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      this.size[k] = lerp(this.s0[k], this.s1[k], t);
      this.col[k * 4] = this.c0[k * 3]; this.col[k * 4 + 1] = this.c0[k * 3 + 1]; this.col[k * 4 + 2] = this.c0[k * 3 + 2];
      this.col[k * 4 + 3] = this.a0[k] * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
    }
    this.pa.needsUpdate = this.ca.needsUpdate = this.sa.needsUpdate = true;
  }
}

export class FX {
  constructor(G) {
    this.G = G; this.group = new THREE.Group();
    this.smokeP = new Pool(1600, makeSmoke(), false);
    this.glowP = new Pool(1400, makeGlow(), true);
    this.group.add(this.smokeP.points, this.glowP.points);
    this.c = new THREE.Color();
    // Reifenspuren
    const N = 3000;
    this.skN = N; this.skI = 0; this.skPos = new Float32Array(N * 12); this.skLast = new Map();
    const g = new THREE.BufferGeometry();
    this.skAttr = new THREE.BufferAttribute(this.skPos, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.skAttr);
    const idx = []; for (let i = 0; i < N; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    g.setIndex(idx);
    this.skMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8, side: THREE.DoubleSide }));
    this.skMesh.frustumCulled = false; this.skMesh.renderOrder = 4;
    this.group.add(this.skMesh);
    // Licht für Explosionen
    this.light = new THREE.PointLight(0xffa040, 0, 60, 1.8); this.light.visible = false; this.group.add(this.light);
    this.lightT = 0;
    this.shots = []; // Leuchtspuren
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9, toneMapped: false });
  }
  smoke(x, y, z, vx, vy, vz, size = 1, life = 1.5, color = 0x888888, alpha = 0.55) {
    this.c.setHex(color);
    this.smokeP.emit(x, y, z, vx, vy, vz, size * 0.5, size * 2.6, life, this.c.r, this.c.g, this.c.b, alpha, -0.3, 0.8);
  }
  fire(x, y, z, scale = 1) {
    this.glowP.emit(x + (Math.random() - 0.5) * 0.6 * scale, y, z + (Math.random() - 0.5) * 0.6 * scale, (Math.random() - 0.5) * 0.8, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 0.8, 1.4 * scale, 0.2, 0.55 + Math.random() * 0.4, 1, 0.5 + Math.random() * 0.2, 0.1, 0.85, -0.2, 1);
    if (Math.random() < 0.35) this.smoke(x, y + 0.8, z, 0, 2, 0, 1.2 * scale, 2, 0x222222, 0.5);
  }
  sparks(x, y, z, power = 1) {
    const n = Math.floor(4 + power * 14);
    for (let i = 0; i < n; i++) this.glowP.emit(x, y, z, (Math.random() - 0.5) * 8 * power, Math.random() * 4 * power, (Math.random() - 0.5) * 8 * power, 0.22, 0.05, 0.35 + Math.random() * 0.3, 1, 0.8, 0.35, 1, 9, 0.2);
  }
  explosion(x, y, z, scale = 1) {
    for (let i = 0; i < 26; i++) this.glowP.emit(x + (Math.random() - 0.5) * 2, y, z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 14 * scale, Math.random() * 10 * scale, (Math.random() - 0.5) * 14 * scale, 5 * scale, 1, 0.5 + Math.random() * 0.6, 1, 0.55 + Math.random() * 0.25, 0.12, 0.95, -2, 1.5);
    for (let i = 0; i < 22; i++) this.smoke(x + (Math.random() - 0.5) * 3, y + Math.random() * 2, z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6, 2 + Math.random() * 6, (Math.random() - 0.5) * 6, 5 * scale, 4 + Math.random() * 3, 0x1c1c1c, 0.7);
    for (let i = 0; i < 24; i++) this.glowP.emit(x, y, z, (Math.random() - 0.5) * 30, Math.random() * 18, (Math.random() - 0.5) * 30, 0.3, 0.1, 0.8 + Math.random() * 0.8, 1, 0.7, 0.25, 1, 18, 0.3);
    this.light.position.set(x, y + 2, z); this.light.visible = true; this.lightT = 0.9; this.light.intensity = 900 * scale;
    this.G.emit('shake', { x, z, power: 1.2 * scale });
  }
  spray(x, y, z, speed) {
    this.smokeP.emit(x, y, z, (Math.random() - 0.5) * 2, 1.5 + Math.random() * speed * 0.1, (Math.random() - 0.5) * 2, 0.4, 1.4, 0.7, 0.9, 0.95, 1, 0.5, 4, 0.6);
  }
  muzzle(x, y, z) { this.glowP.emit(x, y, z, 0, 0, 0, 0.8, 0.1, 0.06, 1, 0.8, 0.4, 1, 0, 0); }
  puff(x, y, z, color = 0xb8b0a0, n = 4) { for (let i = 0; i < n; i++) this.smoke(x, y, z, (Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2, 0.4, 0.7, color, 0.5); }
  splash(x, y, z, big = 1) { for (let i = 0; i < 10 * big; i++) this.smokeP.emit(x, y, z, (Math.random() - 0.5) * 4, 2 + Math.random() * 4, (Math.random() - 0.5) * 4, 0.4, 0.9, 0.8, 0.9, 0.95, 1, 0.7, 9, 0.5); }
  tracer(ax, ay, az, bx, by, bz) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz)]);
    const l = new THREE.Line(g, this.tracerMat); l.frustumCulled = false; this.group.add(l); this.shots.push({ l, t: 0.05 });
  }
  skid(veh, w, x, y, z, yaw, k) {
    const key = veh.id * 8 + veh.parts.wheels.indexOf(w);
    const last = this.skLast.get(key);
    if (last && Math.hypot(last.x - x, last.z - z) < 3.5 && Math.hypot(last.x - x, last.z - z) > 0.25) {
      const dx = x - last.x, dz = z - last.z, l = Math.hypot(dx, dz), px = -dz / l * 0.11, pz = dx / l * 0.11;
      const i = this.skI; this.skI = (this.skI + 1) % this.skN;
      const p = this.skPos, o = i * 12, y0 = Math.max(y, 0.07) + 0.02;
      p[o] = last.x + px; p[o + 1] = last.y; p[o + 2] = last.z + pz; p[o + 3] = last.x - px; p[o + 4] = last.y; p[o + 5] = last.z - pz;
      p[o + 6] = x - px; p[o + 7] = y0; p[o + 8] = z - pz; p[o + 9] = x + px; p[o + 10] = y0; p[o + 11] = z + pz;
      this.skDirty = true;
      this.skLast.set(key, { x, y: y0, z });
    } else if (!last || Math.hypot(last.x - x, last.z - z) >= 3.5) this.skLast.set(key, { x, y: Math.max(y, 0.07) + 0.02, z });
  }
  skidBreak(veh) { for (let k = 0; k < 8; k++) this.skLast.delete(veh.id * 8 + k); }
  update(dt, cam, vh) {
    this.smokeP.mat.uniforms.uScale.value = this.glowP.mat.uniforms.uScale.value = vh * 0.62;
    this.smokeP.update(dt); this.glowP.update(dt);
    if (this.skDirty) { this.skAttr.needsUpdate = true; this.skDirty = false; }
    if (this.lightT > 0) { this.lightT -= dt; this.light.intensity *= Math.exp(-5 * dt); if (this.lightT <= 0) this.light.visible = false; }
    for (let i = this.shots.length - 1; i >= 0; i--) { const s = this.shots[i]; s.t -= dt; if (s.t <= 0) { this.group.remove(s.l); s.l.geometry.dispose(); this.shots.splice(i, 1); } }
  }
}
