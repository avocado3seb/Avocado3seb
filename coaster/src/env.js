// ============================================================================
//  env.js – Himmel, Sonne, Tag/Nacht, Wetter, Schatten
// ============================================================================
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { textures } from './textures.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export const WEATHERS = {
  clear:  { label: 'Sonnig',     clouds: 0.25, fog: 1.0, rain: 0, snow: 0, dark: 0, turb: 3 },
  cloudy: { label: 'Bewölkt',    clouds: 0.9,  fog: 1.5, rain: 0, snow: 0, dark: 0.25, turb: 10 },
  rain:   { label: 'Regen',      clouds: 1.0,  fog: 2.6, rain: 1, snow: 0, dark: 0.5, turb: 18 },
  storm:  { label: 'Gewitter',   clouds: 1.0,  fog: 3.4, rain: 1.6, snow: 0, dark: 0.7, turb: 20, lightning: true },
  fog:    { label: 'Nebel',      clouds: 0.5,  fog: 9,   rain: 0, snow: 0, dark: 0.2, turb: 6 },
  snow:   { label: 'Schnee',     clouds: 1.0,  fog: 3.0, rain: 0, snow: 1, dark: 0.3, turb: 12 },
};

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.hour = 15.5; this.weatherName = 'clear'; this.w = { ...WEATHERS.clear };
    this.wCur = { ...WEATHERS.clear };
    this.day = 1; this.lamps = []; this.flash = 0; this.shadowOn = true;
    this.sunDir = new THREE.Vector3(0.5, 0.6, 0.3);

    this.sky = new Sky(); this.sky.scale.setScalar(20000); scene.add(this.sky);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 3; u.rayleigh.value = 1.5; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.85;

    try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); } catch (e) { /* ohne IBL weiter */ }
    // Umgebungslicht/Reflexionen aus dem echten Himmel (wird bei Tageszeit-/Wetterwechsel neu berechnet)
    try { this.pm = new THREE.PMREMGenerator(renderer); this.envScene = new THREE.Scene(); this.envSky = new Sky(); this.envSky.scale.setScalar(1); this.envScene.add(this.envSky); this.iblKey = ''; this.iblRT = null; } catch (e) { this.pm = null; }
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6b5f4c, 1.0); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dc, 3); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -170; sc.right = 170; sc.top = 170; sc.bottom = -170; sc.near = 10; sc.far = 900;
    this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun); scene.add(this.sun.target);
    this.moon = new THREE.DirectionalLight(0x8fa8ff, 0.0); this.moon.castShadow = false; this.moon.shadow.mapSize.set(1024, 1024);
    { const mc = this.moon.shadow.camera; mc.left = -150; mc.right = 150; mc.top = 150; mc.bottom = -150; mc.near = 10; mc.far = 800; this.moon.shadow.bias = -0.0004; this.moon.shadow.normalBias = 0.7; }
    scene.add(this.moon); scene.add(this.moon.target);
    scene.fog = new THREE.FogExp2(0xbcd0e6, 0.00035);

    // Sterne
    const sp = [];
    for (let i = 0; i < 2200; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.acos(Math.random() * 0.98 + 0.02);
      const r = 9000; sp.push(r * Math.sin(e) * Math.cos(a), r * Math.cos(e), r * Math.sin(e) * Math.sin(a));
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 14, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.material.size = 1.6; scene.add(this.stars);

    // Wolken
    this.clouds = new THREE.Group(); scene.add(this.clouds);
    const ct = textures.cloud();
    this.cloudMats = [];
    for (let i = 0; i < 70; i++) {
      const m = new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: 0.7, color: 0xffffff });
      const s = new THREE.Sprite(m);
      const a = Math.random() * Math.PI * 2, r = 300 + Math.random() * 3200;
      s.position.set(Math.cos(a) * r, 380 + Math.random() * 280, Math.sin(a) * r);
      const sz = 380 + Math.random() * 700; s.scale.set(sz, sz * 0.45, 1);
      s.userData.k = Math.random(); this.clouds.add(s); this.cloudMats.push(m);
    }

    // Niederschlag
    this.precip = this._makePrecip();
    scene.add(this.precip.rain); scene.add(this.precip.snow);
    this.time = 0;
    this.apply(true);
  }

  _makePrecip() {
    const N = 9000, size = new THREE.Vector3(90, 60, 90);
    const base = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { base[i * 3] = Math.random() * size.x; base[i * 3 + 1] = Math.random() * size.y; base[i * 3 + 2] = Math.random() * size.z; seed[i] = Math.random(); }
    const common = `uniform float uTime; uniform vec3 uCam; uniform vec3 uSize; uniform float uSpeed; uniform float uDrift; attribute float aSeed;
      vec3 place(vec3 b){ vec3 p = b; p.y -= uTime*uSpeed*(0.8+0.4*aSeed); p.x += uTime*uDrift*(0.5+aSeed); p = mod(p - uCam + uSize*0.5, uSize) + uCam - uSize*0.5; return p; }`;
    // Regen: Linien
    const lg = new THREE.BufferGeometry();
    const lp = new Float32Array(N * 2 * 3), lk = new Float32Array(N * 2), ls = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) for (let k = 0; k < 2; k++) { const j = i * 2 + k; lp.set(base.subarray(i * 3, i * 3 + 3), j * 3); lk[j] = k; ls[j] = seed[i]; }
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('aK', new THREE.BufferAttribute(lk, 1)); lg.setAttribute('aSeed', new THREE.BufferAttribute(ls, 1));
    const uni = () => ({ uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSize: { value: size }, uSpeed: { value: 30 }, uDrift: { value: 2 }, uAlpha: { value: 0 } });
    const rainMat = new THREE.ShaderMaterial({
      uniforms: uni(), transparent: true, depthWrite: false,
      vertexShader: common + `attribute float aK; void main(){ vec3 p = place(position); p.y += aK*1.1; p.x -= aK*0.08; gl_Position = projectionMatrix*viewMatrix*vec4(p,1.0);} `,
      fragmentShader: `uniform float uAlpha; void main(){ gl_FragColor = vec4(0.75,0.82,0.95,0.35*uAlpha); }`,
    });
    const rain = new THREE.LineSegments(lg, rainMat); rain.frustumCulled = false; rain.visible = false;
    // Schnee: Punkte
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(base, 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const snowMat = new THREE.ShaderMaterial({
      uniforms: uni(), transparent: true, depthWrite: false,
      vertexShader: common + `void main(){ vec3 p = place(position); p.x += sin(uTime*0.7+aSeed*40.0)*1.5; vec4 mv = viewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = 90.0/ -mv.z + 1.5; }`,
      fragmentShader: `uniform float uAlpha; void main(){ vec2 d = gl_PointCoord-0.5; float a = smoothstep(0.5,0.1,length(d)); gl_FragColor = vec4(1.0,1.0,1.0,a*0.85*uAlpha);} `,
    });
    snowMat.uniforms.uSpeed.value = 2.2; snowMat.uniforms.uDrift.value = 0.8;
    const snow = new THREE.Points(pg, snowMat); snow.frustumCulled = false; snow.visible = false;
    return { rain, snow };
  }

  setTime(h) { this.hour = ((h % 24) + 24) % 24; }
  setWeather(name) { this.weatherName = name; this.w = { ...WEATHERS[name] }; }
  registerLamp(mat) { this.lamps.push(mat); }

  apply(immediate = false) {
    // sanfter Übergang des Wetters
    const k = immediate ? 1 : 0.04;
    for (const key of ['clouds', 'fog', 'rain', 'snow', 'dark', 'turb']) this.wCur[key] = lerp(this.wCur[key], this.w[key], k);
    const a = (this.hour - 6) / 12 * Math.PI;
    const elev = Math.sin(a);
    this.sunDir.set(-Math.cos(a) * 0.9, elev * 0.95 + 0.04, -0.35).normalize();
    const e = this.sunDir.y;
    const day = smooth(-0.12, 0.22, e);
    const dusk = smooth(-0.15, 0.0, e) * (1 - smooth(0.0, 0.3, e));    // Dämmerung/Sonnenuntergang
    this.day = day;
    const dark = this.wCur.dark;
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(this.sunDir);
    u.turbidity.value = lerp(2, 20, Math.min(1, this.wCur.turb / 20)) ;
    u.rayleigh.value = lerp(0.6, 3.2, dusk) * (1 - dark * 0.6) + 0.2;
    u.mieCoefficient.value = 0.005 + dark * 0.02;
    this.renderer.toneMappingExposure = lerp(0.42, 0.5, day) * (1 - dark * 0.35);
    // Licht
    this.scene.environmentIntensity = (this.iblRT ? lerp(0.12, 0.62, day) : lerp(0.28, 0.5, day)) * (1 - dark * 0.4);
    const warm = new THREE.Color(1, 0.55, 0.28), white = new THREE.Color(1, 0.96, 0.9);
    this.sun.color.copy(white).lerp(warm, 1 - smooth(0.0, 0.5, e));
    this.sun.intensity = (3.6 * smooth(-0.02, 0.2, e)) * (1 - dark * 0.8) + this.flash * 3;
    this.hemi.intensity = lerp(0.85, 1.05, day) * (1 - dark * 0.35) + this.flash * 1.5;
    this.hemi.intensity *= (this.ambMul || 1); this.sun.intensity *= 0.5 + 0.5 * (this.ambMul || 1);
    this.hemi.color.setRGB(lerp(0.15, 0.7, day), lerp(0.2, 0.82, day), lerp(0.4, 1.0, day));
    this.moon.intensity = (1 - day) * 2.4 * (1 - dark * 0.5);
    this.moonDir = new THREE.Vector3(-this.sunDir.x, Math.max(0.35, -this.sunDir.y), -this.sunDir.z).normalize();
    // Nebel
    const fogDay = new THREE.Color(0.74, 0.83, 0.93), fogDusk = new THREE.Color(0.95, 0.6, 0.4), fogNight = new THREE.Color(0.025, 0.035, 0.07), fogGray = new THREE.Color(0.55, 0.58, 0.62);
    const fc = fogNight.clone().lerp(fogDay, day).lerp(fogDusk, dusk * 0.7).lerp(fogGray.clone().multiplyScalar(lerp(0.15, 1, day)), Math.min(1, dark * 1.3));
    this.scene.fog.color.copy(fc);
    this.scene.fog.density = 0.00034 * this.wCur.fog * (this.fogMul || 1);
    if (this.fogTint && this.fogTintAmt > 0) this.scene.fog.color.lerp(this.fogTint.clone().multiplyScalar(lerp(0.12, 1, day)), this.fogTintAmt);
    this.scene.background = null;
    // Sterne / Wolken
    this.stars.material.opacity = (1 - smooth(-0.25, 0.02, e)) * (1 - dark);
    const cc = new THREE.Color(1, 1, 1).lerp(new THREE.Color(0.1, 0.12, 0.2), 1 - day).lerp(new THREE.Color(0.45, 0.47, 0.5), dark).lerp(new THREE.Color(1, 0.7, 0.55), dusk * 0.6);
    this.cloudMats.forEach((m, i) => { m.color.copy(cc); m.opacity = Math.min(0.85, this.wCur.clouds * (0.35 + 0.65 * (i % 7) / 7) * 0.9); });
    // Lampen
    const night = 1 - smooth(0.0, 0.3, e);
    for (const m of this.lamps) m.emissiveIntensity = night * 4;
    this.night = night;
    // Niederschlag
    this.precip.rain.visible = this.wCur.rain > 0.05; this.precip.rain.material.uniforms.uAlpha.value = Math.min(1, this.wCur.rain);
    this.precip.snow.visible = this.wCur.snow > 0.05; this.precip.snow.material.uniforms.uAlpha.value = Math.min(1, this.wCur.snow);
    this.refreshIBL(immediate && !this.iblRT);
  }

  refreshIBL(force) { // Himmel → PMREM (Reflexionen + Umgebungslicht passend zu Tageszeit und Wetter)
    if (!this.pm) return; const key = Math.round(this.hour * 4) + '|' + this.weatherName; if (!force && key === this.iblKey) return; this.iblKey = key;
    try {
      const us = this.sky.material.uniforms, ue = this.envSky.material.uniforms; for (const k of ['sunPosition', 'turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) ue[k].value = us[k].value.clone ? us[k].value.clone() : us[k].value;
      const rt = this.pm.fromScene(this.envScene, 0, 0.1, 100); if (this.iblRT) this.iblRT.dispose(); this.iblRT = rt; this.scene.environment = rt.texture;
    } catch (e) { this.pm = null; }
  }
  setShadowSpan(r) { const sc = this.sun.shadow.camera; if (Math.abs(sc.right - r) < 1) return; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.updateProjectionMatrix(); }
  setShadows(on, size = 2048) {
    this.shadowOn = on; this.sun.castShadow = on;
    if (on && this.sun.shadow.mapSize.x !== size) { this.sun.shadow.mapSize.set(size, size); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
  }

  update(dt, camera, focus) {
    this.time += dt;
    this.apply();
    for (const p of [this.precip.rain, this.precip.snow]) {
      const u = p.material.uniforms; u.uTime.value = this.time; u.uCam.value.copy(camera.position);
    }
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    this.clouds.position.set(camera.position.x, 0, camera.position.z);
    this.clouds.rotation.y += dt * 0.002;
    // Blitz
    if (this.w.lightning) {
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 4);
      else if (Math.random() < dt * 0.15) { this.flash = 1; this.onThunder?.(); }
    } else this.flash = 0;
    // Schatten folgt dem Fokus
    const f = focus || camera.position;
    this.sun.position.set(f.x + this.sunDir.x * 400, f.y + this.sunDir.y * 400 + 20, f.z + this.sunDir.z * 400);
    this.sun.target.position.set(f.x, f.y, f.z); this.sun.target.updateMatrixWorld();
    if (this.sunDir.y < 0.02) this.sun.castShadow = false; else this.sun.castShadow = this.shadowOn;
    // Mondlicht mit Schatten in der Nacht
    if (this.moonDir) {
      this.moon.position.set(f.x + this.moonDir.x * 400, f.y + this.moonDir.y * 400 + 20, f.z + this.moonDir.z * 400);
      this.moon.target.position.set(f.x, f.y, f.z); this.moon.target.updateMatrixWorld();
      this.moon.castShadow = this.shadowOn && (this.night || 0) > 0.55;
    }
  }
}
