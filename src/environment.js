// Umgebung: Himmel, Sonne/Mond, Wolken, Wetter, Regen, Blitze, Wasser, Nachbearbeitung
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp, smoothstep, damp, RNG } from './util.js';
import { makeWaterNormal, makeMoon } from './textures.js';
import { updateMaterialsForEnv } from './materials.js';

export const WEATHER = {
  clear: { label: 'Sonnig', cover: 0.3, rain: 0, fog: 0, dark: 0, lightning: 0, wind: 0.3, turb: 2.2 },
  cloudy: { label: 'Bewölkt', cover: 0.62, rain: 0, fog: 0.12, dark: 0.25, lightning: 0, wind: 0.5, turb: 4 },
  overcast: { label: 'Bedeckt', cover: 0.92, rain: 0, fog: 0.25, dark: 0.55, lightning: 0, wind: 0.6, turb: 8 },
  rain: { label: 'Regen', cover: 0.97, rain: 0.7, fog: 0.4, dark: 0.7, lightning: 0, wind: 0.8, turb: 10 },
  storm: { label: 'Gewitter', cover: 1.0, rain: 1.0, fog: 0.5, dark: 0.92, lightning: 1, wind: 1.0, turb: 14 },
  fog: { label: 'Nebel', cover: 0.75, rain: 0, fog: 1.0, dark: 0.35, lightning: 0, wind: 0.1, turb: 6 },
};
const QUALITY = {
  low: { pr: 0.75, shadow: 1024, bloom: false, view: 650, samples: 0, lamps: 2 },
  medium: { pr: 1, shadow: 2048, bloom: false, view: 950, samples: 2, lamps: 4 },
  high: { pr: 1.25, shadow: 3072, bloom: true, view: 1300, samples: 4, lamps: 6 },
  ultra: { pr: 1.75, shadow: 4096, bloom: true, view: 1700, samples: 4, lamps: 8 },
};
export { QUALITY };

const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

const CLOUD_VERT = `varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }`;
const CLOUD_FRAG = `
varying vec3 vDir; uniform float uTime, uCover, uDark, uFlash, uNight; uniform vec3 uSunDir, uSunColor, uAmbient;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(7.1,3.3); a*=0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  if (d.y < 0.015 && uNight < 0.02) discard;
  vec2 uv = d.xz / (d.y + 0.12) * 1.25 + uTime * vec2(0.006, 0.003);
  float base = fbm(uv);
  float detail = fbm(uv * 3.1 + 11.0);
  float dens = base * 0.72 + detail * 0.28;
  float th = 1.0 - uCover * 0.82;
  float c = smoothstep(th, th + 0.22, dens);
  float edge = smoothstep(th, th + 0.5, dens);
  float sd = max(dot(d, uSunDir), 0.0);
  vec3 lit = uSunColor * (0.55 + 0.9 * pow(sd, 4.0));
  vec3 shade = uAmbient * 0.9;
  vec3 col = mix(lit, shade, clamp(edge * 0.8 + uDark * 0.7, 0.0, 1.0));
  col = mix(col, col * vec3(0.4, 0.42, 0.47), uDark * 0.7);
  col += vec3(uFlash) * 1.2;
  float fade = smoothstep(0.015, 0.22, d.y);
  float ca = c * fade * 0.96;
  vec3 nightCol = mix(vec3(0.006, 0.01, 0.03), vec3(0.012, 0.025, 0.07), pow(1.0 - clamp(d.y, 0.0, 1.0), 2.5));
  nightCol += vec3(uFlash) * 0.6;
  gl_FragColor = vec4(mix(nightCol, col, ca), max(ca, uNight * 0.93));
}`;

export class Environment {
  constructor(G) {
    this.G = G;
    this.time = 18.2;              // Uhrzeit (h)
    this.dayLen = 24;              // Spielminuten pro Tag (real)
    this.w = { ...WEATHER.clear }; // aktuelle Wetterwerte
    this.weatherName = 'clear'; this.target = 'clear';
    this.nextChange = 90;
    this.night = 0; this.sunDir = new THREE.Vector3(0, 1, 0); this.sunElev = 1;
    this.wet = 0; this.flash = 0; this.nextBolt = 10; this.bolts = []; this.lockWeather = false;
    this.rng = new RNG(5);
    this._envT = 0;
    this._tmp = new THREE.Vector3();
  }

  init(renderer, scene, camera, quality) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    const q = QUALITY[quality] || QUALITY.high; this.q = q;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Himmel
    this.sky = new Sky(); this.sky.scale.setScalar(9000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 3; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
    this.skyScene = new THREE.Scene(); this.skyScene.add(this.sky);
    scene.add(this.sky);
    // Wolkenkuppel
    const cg = new THREE.SphereGeometry(8000, 32, 16);
    this.cloudMat = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
      uniforms: { uTime: { value: 0 }, uCover: { value: 0.3 }, uDark: { value: 0 }, uFlash: { value: 0 }, uNight: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() }, uAmbient: { value: new THREE.Color() } },
    });
    this.clouds = new THREE.Mesh(cg, this.cloudMat); this.clouds.renderOrder = -1; this.clouds.frustumCulled = false;
    scene.add(this.clouds);
    // Sterne
    const sp = [], rng = new RNG(99);
    for (let i = 0; i < 1800; i++) { const a = rng.range(0, 6.283), e = Math.acos(rng.range(0.02, 1)); sp.push(Math.sin(e) * Math.cos(a) * 7000, Math.cos(e) * 7000, Math.sin(e) * Math.sin(a) * 7000); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat); this.stars.frustumCulled = false; scene.add(this.stars);
    // Mond
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeMoon(), fog: false, transparent: true, depthWrite: false, toneMapped: false }));
    this.moon.scale.setScalar(520); scene.add(this.moon);
    // Lichter
    this.sun = new THREE.DirectionalLight(0xffffff, 3); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.near = 1; sc.far = 700;
    this.sun.shadow.mapSize.set(q.shadow, q.shadow); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.8;
    scene.add(this.sun); scene.add(this.sun.target);
    this.moonLight = new THREE.DirectionalLight(0x7f9fff, 0.0); scene.add(this.moonLight); scene.add(this.moonLight.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x59503f, 0.9); scene.add(this.hemi);
    // Straßenlaternen-Lichter
    this.lampLights = [];
    for (let i = 0; i < q.lamps; i++) { const l = new THREE.PointLight(0xffc27a, 0, 34, 1.6); l.visible = false; scene.add(l); this.lampLights.push(l); }
    this.fog = new THREE.Fog(0x9fb8d6, 200, 1500); scene.fog = this.fog;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    // Wasser
    const nm = makeWaterNormal(); nm.repeat.set(400, 400);
    const nm2 = nm.clone(); nm2.repeat.set(130, 130); nm2.needsUpdate = true;
    this.waterNormal = nm; this.waterNormal2 = nm2;
    this.waterMat = new THREE.MeshPhysicalMaterial({ color: 0x0a5878, roughness: 0.1, metalness: 0.0, normalMap: nm, normalScale: new THREE.Vector2(0.7, 0.7), transparent: true, opacity: 0.9, specularIntensity: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.25, depthWrite: false });
    this.waterMat.onBeforeCompile = (sh) => {
      sh.uniforms.uNorm2 = { value: nm2 }; sh.uniforms.uT = this._waterT = { value: 0 };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uNorm2; uniform float uT;')
        .replace('#include <normal_fragment_maps>', `
          vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
          vec3 mapN2 = texture2D( uNorm2, vNormalMapUv * 0.33 + vec2(uT*0.004, -uT*0.003) ).xyz * 2.0 - 1.0;
          mapN = normalize(vec3((mapN.xy + mapN2.xy) * normalScale, mapN.z));
          normal = normalize( tbn * mapN );`);
    };
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), this.waterMat);
    this.water.rotation.x = -Math.PI / 2; this.water.position.y = -0.3; this.water.renderOrder = 2; this.water.receiveShadow = false;
    scene.add(this.water);
    // Regen
    this.buildRain(); 
    // Blitz
    this.boltMat = new THREE.LineBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 1, toneMapped: false, fog: false });
    // Nachbearbeitung
    const size = renderer.getSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.samples });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.28, 0.6, 0.96);
    this.bloom.enabled = q.bloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.applyQuality(quality);
    this.update(0, new THREE.Vector3(), true);
  }

  applyQuality(name) {
    const q = QUALITY[name] || QUALITY.high; this.q = q;
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio, q.pr));
    this.resize(window.innerWidth, window.innerHeight);
    this.sun.shadow.mapSize.set(q.shadow, q.shadow);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.bloom.enabled = q.bloom;
    this.viewDist = q.view;
    this.composer.renderTarget1.samples = q.samples; this.composer.renderTarget2.samples = q.samples;
    this.composer.renderTarget1.dispose(); this.composer.renderTarget2.dispose();
    for (const l of this.lampLights) l.visible = false;
    while (this.lampLights.length > q.lamps) { const l = this.lampLights.pop(); this.scene.remove(l); }
    while (this.lampLights.length < q.lamps) { const l = new THREE.PointLight(0xffc27a, 0, 34, 1.6); l.visible = false; this.scene.add(l); this.lampLights.push(l); }
  }
  resize(w, h) {
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  buildRain() {
    const N = 7000, pos = new Float32Array(N * 2 * 3), tip = new Float32Array(N * 2);
    const rng = new RNG(31);
    for (let i = 0; i < N; i++) {
      const x = rng.next(), y = rng.next(), z = rng.next();
      for (let k = 0; k < 2; k++) { pos.set([x, y, z], (i * 2 + k) * 3); tip[i * 2 + k] = k; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('tip', new THREE.BufferAttribute(tip, 1));
    this.rainMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uOpacity: { value: 0 }, uWind: { value: 4 }, uSpeed: { value: 26 }, uColor: { value: new THREE.Color(0.75, 0.82, 0.95) } },
      vertexShader: `attribute float tip; uniform float uTime; uniform vec3 uCam; uniform float uWind, uSpeed; varying float vA;
        void main(){ vec3 box = vec3(70.0,40.0,70.0); vec3 p = position * box; p.y -= uTime * uSpeed; p.x += uTime * uWind;
          p = mod(p, box); vec3 w = uCam + p - box * vec3(0.5,0.35,0.5);
          vec3 v = normalize(vec3(uWind, -uSpeed, 0.0)); w -= v * tip * 0.9; vA = 1.0 - tip * 0.9;
          gl_Position = projectionMatrix * viewMatrix * vec4(w,1.0); }`,
      fragmentShader: `uniform float uOpacity; uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, uOpacity * vA * 0.5); }`,
    });
    this.rain = new THREE.LineSegments(g, this.rainMat); this.rain.frustumCulled = false; this.rain.renderOrder = 10;
    this.scene.add(this.rain);
  }

  setWeather(name, instant = false) {
    if (!WEATHER[name]) return;
    this.target = name;
    if (instant) { this.w = { ...WEATHER[name] }; this.weatherName = name; }
  }
  get weatherLabel() { return WEATHER[this.target].label; }

  // Wellenhöhe (für Boote)
  waveAt(x, z, t = this.G.time) {
    const a = 0.35 + this.w.wind * 0.5;
    return Math.sin(x * 0.07 + t * 1.3) * 0.4 * a + Math.sin(z * 0.09 - t * 1.7 + 1.3) * 0.3 * a + Math.sin((x + z) * 0.19 + t * 2.3) * 0.12 * a;
  }

  update(dt, focus, force = false) {
    const G = this.G;
    // --- Zeit ---
    this.time = (this.time + dt * 24 / (this.dayLen * 60)) % 24;
    // --- Wetter ---
    if (!this.lockWeather) {
      this.nextChange -= dt;
      if (this.nextChange <= 0) {
        const r = this.rng.next();
        this.target = r < 0.45 ? 'clear' : r < 0.62 ? 'cloudy' : r < 0.74 ? 'overcast' : r < 0.86 ? 'rain' : r < 0.93 ? 'storm' : 'fog';
        this.nextChange = this.rng.range(110, 260);
      }
    }
    const tw = WEATHER[this.target];
    const k = 1 - Math.exp(-0.35 * dt);
    for (const key of ['cover', 'rain', 'fog', 'dark', 'lightning', 'wind', 'turb']) this.w[key] += (tw[key] - this.w[key]) * (force ? 1 : k);
    // --- Sonne ---
    const t = this.time;
    const a = t >= 5.5 && t <= 19.5 ? Math.PI * (t - 5.5) / 14 : Math.PI + Math.PI * (((t - 19.5) + 24) % 24) / 10;
    this.sunDir.set(Math.cos(a) * 0.93, Math.sin(a), 0.36).normalize();
    const e = this.sunDir.y; this.sunElev = e;
    const dayF = smoothstep(-0.06, 0.25, e);
    this.night = smoothstep(0.08, -0.14, e);
    const dusk = Math.exp(-Math.pow((e - 0.02) / 0.16, 2));
    const dark = this.w.dark;
    // Himmel
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(this.sunDir);
    u.turbidity.value = this.w.turb; u.rayleigh.value = lerp(1.3, 0.55, dark) + dusk * 1.4; u.mieCoefficient.value = 0.004 + dusk * 0.006 + this.w.fog * 0.01;
    this.sky.position.copy(this.camera.position);
    this.clouds.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.starMat.opacity = this.night * (1 - this.w.cover * 0.9);
    // Mond gegenüber der Sonne
    this.moon.position.copy(this.camera.position).addScaledVector(this.sunDir, -6500);
    this.moon.position.y = Math.max(this.moon.position.y, this.camera.position.y + 400);
    this.moon.material.opacity = this.night * (1 - this.w.cover);
    // Lichtfarben
    const sunCol = srgb(1, 0.96, 0.9).lerp(srgb(1, 0.5, 0.2), dusk);
    this.sun.color.copy(sunCol);
    const sunI = 3.4 * smoothstep(-0.02, 0.22, e) * (1 - dark * 0.8);
    this.sun.intensity = sunI;
    this.moonLight.intensity = 0.55 * this.night * (1 - dark * 0.6);
    // Sonne folgt Fokus (Schatten)
    const fx = Math.round(focus.x), fy = Math.round(focus.y), fz = Math.round(focus.z);
    this.sun.target.position.set(fx, fy, fz);
    const ld = e > 0.03 ? this.sunDir : this._tmp.copy(this.sunDir).multiplyScalar(-1).setY(Math.abs(this.sunDir.y) + 0.2).normalize();
    this.sun.position.set(fx + ld.x * 350, fy + ld.y * 350, fz + ld.z * 350);
    this.sun.castShadow = e > -0.02 || this.night > 0.5 ? true : false;
    if (e <= 0.03) { this.sun.intensity = 0.0; }
    this.moonLight.target.position.set(fx, fy, fz);
    this.moonLight.position.set(fx - this.sunDir.x * 300, fy + Math.max(120, -this.sunDir.y * 300), fz - this.sunDir.z * 300);
    // Blitz
    this.updateLightning(dt, focus);
    const fl = this.flash;
    // Hemisphärenlicht
    const hemiDay = srgb(0.62, 0.78, 1).lerp(srgb(0.7, 0.72, 0.76), dark * 0.8);
    const hemiNight = srgb(0.1, 0.15, 0.32);
    this.hemi.color.copy(hemiNight).lerp(hemiDay, dayF).lerp(srgb(1, 0.6, 0.5), dusk * 0.35);
    this.hemi.groundColor.copy(srgb(0.2, 0.18, 0.15)).lerp(srgb(0.04, 0.04, 0.07), this.night);
    this.hemi.intensity = lerp(0.18, 1.0, dayF) * (1 - dark * 0.3) + fl * 3;
    // Nebel
    const fogDay = srgb(0.66, 0.78, 0.93).lerp(srgb(0.62, 0.64, 0.68), dark * 0.85);
    const fogDusk = srgb(1, 0.62, 0.42);
    const fogNight = srgb(0.02, 0.03, 0.065);
    const fc = fogNight.clone().lerp(fogDay, dayF).lerp(fogDusk, dusk * (1 - dark * 0.7) * 0.75);
    fc.lerp(srgb(0.56, 0.58, 0.6), this.w.fog * 0.5 * dayF).addScalar(fl * 0.4);
    if (this.night > 0.5) fc.lerp(srgb(0.045, 0.05, 0.075), this.w.fog * 0.6);
    this.fog.color.copy(fc);
    const view = this.viewDist;
    const clearF = 1 - this.w.fog * 0.82 - this.w.rain * 0.3;
    this.fog.far = Math.max(90, view * 1.5 * clearF);
    this.fog.near = Math.max(8, this.fog.far * (0.12 + 0.28 * (1 - this.w.fog)));
    this.scene.environmentIntensity = lerp(0.04, 1.0, dayF) * (1 - dark * 0.45) + fl;
    this.renderer.toneMappingExposure = lerp(1.15, 0.7, dayF) + dusk * 0.1;
    // Wolken
    const cu = this.cloudMat.uniforms;
    cu.uTime.value = G.time; cu.uNight.value = clamp(this.night * 1.05 - 0.04, 0, 1); cu.uCover.value = this.w.cover; cu.uDark.value = dark; cu.uFlash.value = fl * 0.6;
    cu.uSunDir.value.copy(this.sunDir);
    cu.uSunColor.value.copy(sunCol).multiplyScalar(lerp(0.0, 1.5, dayF) + 0.04);
    cu.uAmbient.value.copy(this.hemi.color).multiplyScalar(lerp(0.12, 0.9, dayF) + 0.02).lerp(srgb(0.9, 0.5, 0.4), dusk * 0.3);
    // Regen
    const rainI = this.w.rain;
    this.rain.visible = rainI > 0.02;
    this.rainMat.uniforms.uTime.value = G.time; this.rainMat.uniforms.uCam.value.copy(this.camera.position);
    this.rainMat.uniforms.uOpacity.value = clamp(rainI * 1.3, 0, 1) * lerp(0.6, 1, dayF);
    this.rainMat.uniforms.uWind.value = 3 + this.w.wind * 6;
    this.rainMat.uniforms.uColor.value.set(0.8, 0.85, 0.95).multiplyScalar(lerp(0.25, 1, dayF));
    this.wet += (clamp(rainI * 1.5, 0, 1) - this.wet) * (1 - Math.exp(-(rainI > 0.05 ? 0.2 : 0.012) * dt));
    // Wasser
    const sn = 20;
    this.water.position.x = Math.round(this.camera.position.x / sn) * sn; this.water.position.z = Math.round(this.camera.position.z / sn) * sn;
    this.waterNormal.offset.set((G.time * 0.012) % 1, (G.time * 0.007) % 1);
    if (this._waterT) this._waterT.value = G.time;
    const ws = 0.45 + this.w.wind * 0.9; this.waterMat.normalScale.set(ws, ws);
    this.waterMat.color.setRGB(0.0, 0.16, 0.3).multiplyScalar(lerp(0.04, 1, dayF) * (1 - dark * 0.5) + 0.01);
    // Materialien
    if (G.world) updateMaterialsForEnv(G.world.M, this.night, this.wet);
    // Umgebungskarte alle paar Sekunden
    this._envT -= dt;
    if (force || this._envT <= 0) { this._envT = 6; this.refreshEnv(); }
    this.updateLampLights(focus);
  }

  refreshEnv() {
    // Himmel (ohne Wolken) in Umgebungskarte rendern
    const cam = this.sky.position.clone();
    this.sky.position.set(0, 0, 0);
    this.scene.remove(this.sky); this.skyScene.add(this.sky);
    const rt = this.pmrem.fromScene(this.skyScene, 0.02, 100, 20000);
    this.skyScene.remove(this.sky); this.scene.add(this.sky);
    this.sky.position.copy(cam);
    if (this._envRT) this._envRT.dispose();
    this._envRT = rt; this.scene.environment = rt.texture;
  }

  updateLampLights(focus) {
    const W = this.G.world; if (!W || !W.lampHash) return;
    const n = this.night;
    for (const l of this.lampLights) l.visible = false;
    if (n < 0.05) return;
    const cam = this.camera.position;
    const items = W.lampHash.query(cam.x - 55, cam.z - 55, cam.x + 55, cam.z + 55, []);
    items.sort((p, q) => ((p.x - cam.x) ** 2 + (p.z - cam.z) ** 2) - ((q.x - cam.x) ** 2 + (q.z - cam.z) ** 2));
    for (let i = 0; i < this.lampLights.length && i < items.length; i++) {
      const l = this.lampLights[i], it = items[i];
      l.visible = true; l.position.set(it.x, it.y, it.z); l.intensity = 90 * n;
    }
  }

  updateLightning(dt, focus) {
    const G = this.G;
    this.flash = Math.max(0, this.flash - dt * 3.2);
    const L = this.w.lightning;
    if (L > 0.3) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = this.rng.range(3, 12) / L;
        const ang = this.rng.range(0, 6.283), dist = this.rng.range(200, 1600);
        const bx = this.camera.position.x + Math.cos(ang) * dist, bz = this.camera.position.z + Math.sin(ang) * dist;
        this.strike(bx, bz, dist);
      }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t -= dt;
      b.line.material.opacity = clamp(b.t * 6, 0, 1) * (Math.random() > 0.3 ? 1 : 0.4);
      if (b.t <= 0) { this.scene.remove(b.line); b.line.geometry.dispose(); this.bolts.splice(i, 1); }
    }
  }
  strike(x, z, dist) {
    const pts = [];
    let px = x, pz = z;
    for (let y = 900; y >= 0; y -= 45) { px += this.rng.range(-26, 26); pz += this.rng.range(-26, 26); pts.push(new THREE.Vector3(px, y, pz)); }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(g, this.boltMat.clone());
    line.frustumCulled = false; this.scene.add(line);
    this.bolts.push({ line, t: 0.35 });
    this.flash = Math.min(1.5, 0.4 + 900 / (dist + 400));
    this.G.audio?.thunder(dist);
    this.G.emit?.('lightning', { x, z, dist });
  }

  render() { this.composer.render(); }
}
