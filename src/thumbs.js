// Vorschaubilder für Fahrzeuge und Charaktere (Offscreen-Rendering)
import * as THREE from 'three';
import { instantiate } from './vehicles.js';
import { Character } from './character.js';

export class Thumbs {
  constructor(G) {
    this.G = G; this.cache = new Map(); this.q = [];
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(28, 1.6, 0.1, 200);
    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x403848, 1.1));
    const d = new THREE.DirectionalLight(0xfff0dd, 3.2); d.position.set(6, 8, 7); this.scene.add(d);
    const d2 = new THREE.DirectionalLight(0x88aaff, 1.2); d2.position.set(-6, 3, -4); this.scene.add(d2);
    this.rts = {};
  }
  rt(w, h) { const k = w + 'x' + h; return this.rts[k] || (this.rts[k] = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, samples: 4 })); }
  shoot(obj, w, h, camPos, look, fov) {
    const G = this.G, r = G.renderer;
    const rt = this.rt(w, h); this.cam.aspect = w / h; this.cam.fov = fov; this.cam.position.copy(camPos); this.cam.lookAt(look); this.cam.updateProjectionMatrix();
    this.scene.add(obj);
    this.scene.environment = G.scene.environment; this.scene.environmentIntensity = Math.max(0.5, G.scene.environmentIntensity || 1);
    const old = r.getRenderTarget(); const oc = new THREE.Color(); r.getClearColor(oc); const oa = r.getClearAlpha();
    const shadow = r.shadowMap.enabled; r.shadowMap.enabled = false;
    r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(this.scene, this.cam);
    const buf = new Uint8Array(w * h * 4); r.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    r.setRenderTarget(old); r.setClearColor(oc, oa); r.shadowMap.enabled = shadow;
    this.scene.remove(obj);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const img = x.createImageData(w, h);
    const lut = this.lut || (this.lut = Array.from({ length: 256 }, (_, i) => Math.min(255, Math.round(255 * Math.pow(i / 255, 1 / 2.2) * 1.05))));
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const s = ((h - 1 - j) * w + i) * 4, o = (j * w + i) * 4; const a = buf[s + 3];
      img.data[o] = lut[buf[s]]; img.data[o + 1] = lut[buf[s + 1]]; img.data[o + 2] = lut[buf[s + 2]]; img.data[o + 3] = a;
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }
  vehicle(spec, color) {
    const key = spec.key + '_' + (color ?? spec.color);
    if (this.cache.has(key)) return this.cache.get(key);
    const { group } = instantiate(spec, color ?? spec.color);
    const L = spec.len, W = spec.wid, H = spec.hgt;
    const d = Math.max(L, W, H) * (spec.kind === 'plane' ? 1.5 : spec.kind === 'heli' ? 1.55 : 1.75) + 1.5;
    const url = this.shoot(group, 384, 240, new THREE.Vector3(d * 0.78, d * 0.34 + H * 0.35, d * 0.72), new THREE.Vector3(0, H * 0.4, 0), 28);
    this.cache.set(key, url); return url;
  }
  character(outfit, w = 260, h = 380) {
    const key = 'c' + JSON.stringify(outfit) + w;
    if (this.cache.has(key)) return this.cache.get(key);
    const ch = new Character(outfit); ch.update(0.016, ch.state);
    const url = this.shoot(ch.root, w, h, new THREE.Vector3(1.4, 1.5, 3.6), new THREE.Vector3(0, 0.92, 0), 30);
    if (this.cache.size > 300) this.cache.clear();
    this.cache.set(key, url); return url;
  }
  // verzögert in Bild einsetzen
  lazyVehicle(img, spec, color) { img.dataset.k = '1'; this.q.push({ img, spec, color }); }
  pump() {
    let n = 0;
    while (this.q.length && n < 2) { const it = this.q.shift(); if (!it.img.isConnected) continue; try { it.img.src = this.vehicle(it.spec, it.color); } catch (e) { console.warn('thumb', e); } n++; }
  }
}
