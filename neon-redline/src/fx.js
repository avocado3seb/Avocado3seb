/* NEON REDLINE – fx.js : Himmel, Tag/Nacht, Wetter, Licht, Partikel, Reifenspuren, Nachbearbeitung */
(function (G) {
'use strict';
const U = G.U, W = G.World; const { clamp, lerp, sstep } = U; const M = () => G.Mats;
const FX = { hour: 19.4, timeScale: 0.0, weather: 'clear', w: { rain: 0, cloud: 0.25, fog: 0, wet: 0, flash: 0 }, target: { rain: 0, cloud: 0.25, fog: 0 }, night: 0, sunDir: new THREE.Vector3(0, 1, 0), moonDir: new THREE.Vector3(0, -1, 0), tunnel: 0, quality: 2, wipers: false, wipeAuto: true };
const C = U.col;
/* Tageskeyframes: Stunde, Zenit, Horizont, Sonnenfarbe, Sonnenstärke, Himmelslicht, Bodenlicht, Nebel */
const KEYS = [
  [0, '#02040c', '#0b1226', '#7f9cff', 0.0, '#10192f', '#05060a', '#080d1c'],
  [4.6, '#050a1a', '#162040', '#8fa8ff', 0.0, '#18233f', '#07080c', '#0d142a'],
  [5.8, '#1b2a55', '#e08a62', '#ff8a4a', 0.9, '#4a5578', '#2b2420', '#b87868'],
  [7.2, '#3f78c8', '#f2b890', '#ffd2a0', 2.4, '#7aa4d8', '#4a4036', '#cfb9a6'],
  [10, '#2f78d8', '#a8cdf0', '#fff3de', 3.6, '#8fb8ee', '#585048', '#b9d3ea'],
  [13, '#2a72d4', '#a0c8ee', '#fff6e8', 3.9, '#92bcf0', '#5c5448', '#b6d0e8'],
  [16.5, '#2f72ce', '#b8cce0', '#ffe6c0', 3.2, '#86aee2', '#544a40', '#c2cfdc'],
  [18.4, '#2a4f9a', '#f0a070', '#ff9a50', 1.8, '#6a7ca8', '#3a2f28', '#d4a58a'],
  [19.4, '#141f4a', '#c4607a', '#ff6a48', 0.7, '#3a4470', '#201a22', '#8a5a78'],
  [20.4, '#080e26', '#2a2f5a', '#a8a0ff', 0.0, '#1a2244', '#0a0b12', '#1a2040'],
  [22, '#02050f', '#0c1430', '#7f9cff', 0.0, '#10193a', '#05060a', '#0a1022'],
  [24, '#02040c', '#0b1226', '#7f9cff', 0.0, '#10192f', '#05060a', '#080d1c'],
];
const KC = KEYS.map(k => ({ h: k[0], zen: C(k[1]), hor: C(k[2]), sun: C(k[3]), sI: k[4], sky: C(k[5]), gnd: C(k[6]), fog: C(k[7]) }));
function keyAt(h) { let i = 1; while (i < KC.length - 1 && KC[i].h < h) i++; const a = KC[i - 1], b = KC[i]; const t = clamp((h - a.h) / (b.h - a.h), 0, 1); const L = (x, y) => x.clone().lerp(y, t); return { zen: L(a.zen, b.zen), hor: L(a.hor, b.hor), sun: L(a.sun, b.sun), sI: lerp(a.sI, b.sI, t), sky: L(a.sky, b.sky), gnd: L(a.gnd, b.gnd), fog: L(a.fog, b.fog) }; }

/* ---------------------------------------------------------------- Himmel */
const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }`;
const SKY_FS = `varying vec3 vDir; uniform vec3 uZen, uHor, uSunCol, uSunDir, uMoonDir, uFog; uniform float uTime, uCloud, uNight, uFlash, uRain, uSunI;
float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(7.3,1.7); a*=0.5; } return s; }
float stars(vec3 d){ vec3 p = d*160.0; vec3 i=floor(p); float r=fract(sin(dot(i,vec3(12.9898,78.233,37.719)))*43758.5453); vec3 f=fract(p)-0.5; float sz = step(0.9965, r); return sz * smoothstep(0.35,0.0,length(f)) * (0.5+0.5*fract(r*91.7)); }
void main(){ vec3 d = normalize(vDir); float y = d.y; float hz = pow(1.0 - clamp(y,0.0,1.0), 3.2);
  vec3 col = mix(uZen, uHor, hz);
  float sd = max(dot(d,uSunDir),0.0); col += uSunCol * (pow(sd,900.0)*40.0*step(0.0,uSunI-0.05) + pow(sd,12.0)*0.45 + pow(sd,3.0)*0.12) * clamp(uSunI,0.0,1.0);
  float md = max(dot(d,uMoonDir),0.0); col += vec3(0.75,0.82,1.0) * (pow(md,1400.0)*6.0 + pow(md,40.0)*0.18) * uNight;
  float st = stars(d) * uNight * smoothstep(0.02,0.25,y) * (1.0-uCloud*0.8); col += vec3(0.8,0.85,1.0)*st*1.6;
  // Wolken
  float cy = max(y, 0.02); vec2 uv = d.xz / (cy + 0.25) * 1.6 + vec2(uTime*0.004, uTime*0.002); float c = fbm(uv*1.3) ; float cov = mix(0.62, 0.30, uCloud); float cm = smoothstep(cov, cov+0.28, c) * smoothstep(0.0,0.22,y);
  float lit = clamp(dot(d, uSunDir)*0.5+0.5, 0.0, 1.0); vec3 cc = mix(uHor*0.55+vec3(0.03), uSunCol*0.9+uHor*0.5, pow(lit,3.0)*clamp(uSunI*0.5,0.0,1.0)); cc = mix(cc, uZen*0.5+vec3(0.1), uRain*0.7); cc *= 0.55 + 0.45*(1.0-cm*0.5);
  col = mix(col, cc, cm * (0.55 + 0.4*uCloud));
  col = mix(col, uFog, smoothstep(0.12,-0.02,y) );
  col += vec3(0.55,0.6,0.9) * uFlash * (0.5 + cm);
  gl_FragColor = vec4(col, 1.0); }`;

/* ---------------------------------------------------------------- Regen */
function makeRain(n) {
  const pos = new Float32Array(n * 6), ph = new Float32Array(n * 2); const r = U.mulberry(5);
  for (let i = 0; i < n; i++) { const x = (r() - 0.5) * 60, y = r() * 40, z = (r() - 0.5) * 60; pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z; pos[i * 6 + 3] = x; pos[i * 6 + 4] = y; pos[i * 6 + 5] = z; ph[i * 2] = 0; ph[i * 2 + 1] = 1; }
  const endA = new Float32Array(n * 2); for (let i = 0; i < n; i++) endA[i * 2 + 1] = 1;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('end', new THREE.BufferAttribute(endA, 1));
  const mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmount: { value: 0 }, uVel: { value: new THREE.Vector3(2, -32, 1) }, uColor: { value: new THREE.Color(0.7, 0.78, 0.9) } },
    vertexShader: `attribute float end; uniform float uTime; uniform vec3 uCam; uniform vec3 uVel; uniform float uAmount; varying float vA;
      void main(){ vec3 p = position; vec3 box = vec3(60.0,40.0,60.0); vec3 q = p + uVel*uTime; q = mod(q - uCam + box*0.5, box) - box*0.5; float len = 0.55; vec3 w = q + uCam; w -= uVel*0.012*len*end*1.0 * 4.0; float seed = fract(sin(dot(p.xz,vec2(12.9,78.2)))*43758.5); vA = step(seed, uAmount) * (1.0 - smoothstep(10.0,30.0,length(q))) * 0.55; gl_Position = projectionMatrix * viewMatrix * vec4(w,1.0); }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor*1.4, vA); }`, transparent: true, depthWrite: false, fog: false, blending: THREE.NormalBlending });
  const lines = new THREE.LineSegments(g, mat); lines.frustumCulled = false; lines.visible = false; return lines;
}

/* ---------------------------------------------------------------- Partikel (CPU, Punkt-Sprites) */
function makeParticles(n) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('pcol', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('psize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({ uniforms: { uMap: { value: G.Tex.smoke }, uScale: { value: 500 } }, vertexShader: `attribute vec4 pcol; attribute float psize; varying vec4 vC; uniform float uScale; void main(){ vC = pcol; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = psize*uScale/max(-mv.z,0.5); gl_PointSize = min(gl_PointSize, 260.0); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uMap; varying vec4 vC; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a*t.a*1.6); }`, transparent: true, depthWrite: false, fog: false });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  const P = { n, i: 0, pts, pos, col, size, life: new Float32Array(n), maxLife: new Float32Array(n), vel: new Float32Array(n * 3), grow: new Float32Array(n), grav: new Float32Array(n), c0: new Float32Array(n * 4), additive: false };
  return P;
}
FX.emit = function (p, v, life, size, grow, col, grav) {
  const P = FX.P; const i = P.i; P.i = (P.i + 1) % P.n; P.pos[i * 3] = p.x; P.pos[i * 3 + 1] = p.y; P.pos[i * 3 + 2] = p.z; P.vel[i * 3] = v.x; P.vel[i * 3 + 1] = v.y; P.vel[i * 3 + 2] = v.z; P.life[i] = life; P.maxLife[i] = life; P.size[i] = size; P.grow[i] = grow; P.grav[i] = grav || 0; P.c0[i * 4] = col[0]; P.c0[i * 4 + 1] = col[1]; P.c0[i * 4 + 2] = col[2]; P.c0[i * 4 + 3] = col[3];
};
const _p = new THREE.Vector3(), _v = new THREE.Vector3();
FX.smoke = (pos, vel, amount, dark) => { for (let i = 0; i < amount; i++) { _v.set(vel.x * 0.3 + (Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 1.2, vel.z * 0.3 + (Math.random() - 0.5) * 1.2); const g = dark ? 0.25 : 0.82; FX.emit(pos, _v, 1.4 + Math.random() * 1.1, 0.55 + Math.random() * 0.4, 2.4, [g, g, g * 1.02, 0.34 * (FX.night > 0.5 ? 0.6 : 1)], -0.4); } };
FX.spark = (pos, vel, n) => { for (let i = 0; i < n; i++) { _v.set(vel.x * 0.4 + (Math.random() - 0.5) * 6, 1 + Math.random() * 4, vel.z * 0.4 + (Math.random() - 0.5) * 6); FX.emit(pos, _v, 0.25 + Math.random() * 0.45, 0.08 + Math.random() * 0.08, -0.05, [1.0, 0.65 + Math.random() * 0.25, 0.2, 1.4], 14); } };
FX.spray = (pos, vel, n) => { for (let i = 0; i < n; i++) { _v.set(vel.x * 0.25 + (Math.random() - 0.5) * 2.4, 1.2 + Math.random() * 2.2, vel.z * 0.25 + (Math.random() - 0.5) * 2.4); FX.emit(pos, _v, 0.6 + Math.random() * 0.5, 0.28 + Math.random() * 0.2, 1.8, [0.82, 0.88, 0.95, 0.22], 4); } };
FX.dust = (pos, vel, n) => { for (let i = 0; i < n; i++) { _v.set(vel.x * 0.2 + (Math.random() - 0.5) * 1.8, 0.4 + Math.random() * 1.2, vel.z * 0.2 + (Math.random() - 0.5) * 1.8); FX.emit(pos, _v, 1.2 + Math.random() * 0.8, 0.6 + Math.random() * 0.4, 2.2, [0.52, 0.45, 0.36, 0.3], -0.2); } };
FX.flame = (pos, dir, n) => { for (let i = 0; i < n; i++) { _v.set(dir.x * (8 + Math.random() * 6) + (Math.random() - 0.5) * 0.8, dir.y * 6 + (Math.random() - 0.5) * 0.8, dir.z * (8 + Math.random() * 6) + (Math.random() - 0.5) * 0.8); FX.emit(pos, _v, 0.12 + Math.random() * 0.14, 0.22 + Math.random() * 0.2, 1.4, [1.0, 0.55 + Math.random() * 0.3, 0.12, 2.0], 0); } };
FX.updateParticles = function (dt) {
  const P = FX.P; for (let i = 0; i < P.n; i++) { let l = P.life[i]; if (l <= 0) { P.col[i * 4 + 3] = 0; continue; } l -= dt; P.life[i] = l; const t = l / P.maxLife[i]; P.vel[i * 3 + 1] -= P.grav[i] * dt; const damp = 1 - dt * 1.2; P.vel[i * 3] *= damp; P.vel[i * 3 + 2] *= damp; P.pos[i * 3] += P.vel[i * 3] * dt; P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt; P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt; P.size[i] += P.grow[i] * dt;
    const a = P.c0[i * 4 + 3] * (t * (1 - Math.pow(1 - t, 6)) * 1.4); P.col[i * 4] = P.c0[i * 4]; P.col[i * 4 + 1] = P.c0[i * 4 + 1]; P.col[i * 4 + 2] = P.c0[i * 4 + 2]; P.col[i * 4 + 3] = a; }
  P.pts.geometry.attributes.position.needsUpdate = true; P.pts.geometry.attributes.pcol.needsUpdate = true; P.pts.geometry.attributes.psize.needsUpdate = true;
};

/* ---------------------------------------------------------------- Reifenspuren */
function makeSkids(maxQuads) {
  const pos = new Float32Array(maxQuads * 4 * 3), alpha = new Float32Array(maxQuads * 4), idx = new Uint32Array(maxQuads * 6);
  for (let i = 0; i < maxQuads; i++) { const b = i * 4; idx.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('a', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  const m = new THREE.ShaderMaterial({ vertexShader: `attribute float a; varying float vA; void main(){ vA=a; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`, fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(0.02,0.02,0.02, vA*0.72); }`, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 2; return { mesh, pos, alpha, n: maxQuads, i: 0, last: [null, null, null, null], g };
}
FX.skid = function (wi, cp, normal, dir, width, strength) {
  const S = FX.S; const last = S.last[wi]; if (strength < 0.05) { S.last[wi] = null; return; }
  const rx = -dir.z, rz = dir.x; const hw = width / 2; const L = Math.hypot(rx, rz) || 1; const ox = rx / L * hw, oz = rz / L * hw; const y = cp.y + 0.03;
  const cur = { x: cp.x, y, z: cp.z, ox, oz };
  if (last) { const d = Math.hypot(cur.x - last.x, cur.z - last.z); if (d > 6) { S.last[wi] = cur; return; } if (d < 0.35) return; const q = S.i; S.i = (S.i + 1) % S.n; const b = q * 12; const P = S.pos;
    P[b] = last.x - last.ox; P[b + 1] = last.y; P[b + 2] = last.z - last.oz; P[b + 3] = last.x + last.ox; P[b + 4] = last.y; P[b + 5] = last.z + last.oz; P[b + 6] = cur.x + ox; P[b + 7] = y; P[b + 8] = cur.z + oz; P[b + 9] = cur.x - ox; P[b + 10] = y; P[b + 11] = cur.z - oz;
    const a = clamp(strength, 0, 1); S.alpha[q * 4] = S.alpha[q * 4 + 3] = a * 0.9; S.alpha[q * 4 + 1] = S.alpha[q * 4 + 2] = a; S.g.attributes.position.needsUpdate = true; S.g.attributes.a.needsUpdate = true; }
  S.last[wi] = cur;
};

/* ---------------------------------------------------------------- Initialisierung */
FX.init = function (renderer, scene, camera, quality) {
  FX.renderer = renderer; FX.scene = scene; FX.camera = camera; FX.quality = quality === undefined ? 2 : quality;
  renderer.outputEncoding = THREE.LinearEncoding; renderer.toneMapping = THREE.NoToneMapping; renderer.shadowMap.enabled = FX.quality > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.setClearColor(0x05060a, 1);
  scene.fog = new THREE.FogExp2(0x101820, 0.0004);
  // Himmel
  FX.skyU = { uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) }, uFog: { value: new THREE.Color() }, uTime: { value: 0 }, uCloud: { value: 0.3 }, uNight: { value: 0 }, uFlash: { value: 0 }, uRain: { value: 0 }, uSunI: { value: 1 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3500, 32, 16), new THREE.ShaderMaterial({ uniforms: FX.skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false })); sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky); FX.sky = sky;
  // Lichter
  FX.hemi = new THREE.HemisphereLight(0x88aaff, 0x222233, 0.6); scene.add(FX.hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = FX.quality > 0; const sz = [0, 1024, 2048, 4096][FX.quality] || 1024; sun.shadow.mapSize.set(sz, sz); const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 500; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.3; scene.add(sun); scene.add(sun.target); FX.sun = sun;
  FX.lamps = []; for (let i = 0; i < (FX.quality >= 2 ? 3 : 1); i++) { const l = new THREE.PointLight(0xffc880, 0, 38, 1.6); scene.add(l); FX.lamps.push(l); }
  FX.police = []; if (FX.quality >= 1) for (const c of [0xff1a1a, 0x2a4cff]) { const l = new THREE.PointLight(c, 0, 55, 1.4); scene.add(l); FX.police.push(l); }
  FX.tunnelLight = new THREE.PointLight(0xffb060, 0, 60, 1.3); scene.add(FX.tunnelLight);
  FX.head = []; for (const sx of [1, -1]) { const s = new THREE.SpotLight(0xfff0d8, 0, 120, 0.52, 0.55, 1.2); s.castShadow = false; scene.add(s); scene.add(s.target); s.userData.side = sx; FX.head.push(s); }
  // Regen, Partikel, Spuren
  FX.rain = makeRain(FX.quality >= 2 ? 6000 : 3000); scene.add(FX.rain); FX.P = makeParticles(FX.quality >= 2 ? 2400 : 1200); scene.add(FX.P.pts); FX.S = makeSkids(4200); scene.add(FX.S.mesh);
  // Wasser
  const wm = M().water; wm.normalMap.repeat.set(70, 70); const water = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000, 1, 1), wm); water.rotation.x = -Math.PI / 2; water.position.y = 0; water.receiveShadow = false; water.renderOrder = 1; scene.add(water); FX.water = water;
  FX.setupPost(); FX.resize();
};

/* ---------------------------------------------------------------- Nachbearbeitung */
const FINAL = { uniforms: { tDiffuse: { value: null }, uExposure: { value: 1.0 }, uVig: { value: 0.35 }, uSpeed: { value: 0 }, uTime: { value: 0 }, uAb: { value: 0.0006 }, uGrade: { value: new THREE.Vector3(1, 1, 1) }, uSat: { value: 1.05 }, uWet: { value: 0 }, uHdr: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uExposure, uVig, uSpeed, uTime, uAb, uSat, uWet, uHdr; uniform vec3 uGrade; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec2 c = vUv-0.5; float r = length(c); vec3 col;
      float ab = uAb*(1.0+uSpeed*3.0)*r; col.r = texture2D(tDiffuse, vUv - c*ab*2.0).r; col.g = texture2D(tDiffuse, vUv).g; col.b = texture2D(tDiffuse, vUv + c*ab*2.0).b;
      if(uSpeed > 0.02){ vec3 acc = col; for(int i=1;i<6;i++){ float f = float(i)/6.0; acc += texture2D(tDiffuse, vUv - c*f*uSpeed*0.075).rgb; } col = mix(col, acc/6.0, clamp(uSpeed*1.4*smoothstep(0.1,0.7,r*2.0),0.0,0.85)); }
      col *= uExposure*uGrade; col = aces(col); float l = dot(col, vec3(0.299,0.587,0.114)); col = mix(vec3(l), col, uSat);
      col *= 1.0 - uVig*smoothstep(0.35,0.95,r*1.5); col = pow(col, vec3(1.0/2.2)); col += (hash(vUv*vec2(1920.0,1080.0)+fract(uTime)*10.0)-0.5)*0.018; gl_FragColor = vec4(col,1.0); }` };
FX.setupPost = function () {
  const r = FX.renderer; const size = r.getSize(new THREE.Vector2()); const dpr = r.getPixelRatio();
  const type = r.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType; const rt = new THREE.WebGLRenderTarget(size.x * dpr, size.y * dpr, { type, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
  FX.composer = new THREE.EffectComposer(r, rt); FX.composer.addPass(new THREE.RenderPass(FX.scene, FX.camera));
  if (FX.quality >= 1) { FX.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.6, 0.92); FX.composer.addPass(FX.bloom); }
  FX.finalPass = new THREE.ShaderPass(FINAL); FX.composer.addPass(FX.finalPass);
  if (FX.quality >= 2 && THREE.FXAAShader) { FX.fxaa = new THREE.ShaderPass(THREE.FXAAShader); FX.composer.addPass(FX.fxaa); }
};
FX.resize = function () { const r = FX.renderer; const s = r.getSize(new THREE.Vector2()); const dpr = r.getPixelRatio(); if (FX.composer) { FX.composer.setPixelRatio(dpr); FX.composer.setSize(s.x, s.y); } if (FX.fxaa) FX.fxaa.material.uniforms.resolution.value.set(1 / (s.x * dpr), 1 / (s.y * dpr)); if (FX.bloom) FX.bloom.resolution.set(s.x / 2, s.y / 2); };
FX.render = function () { if (FX.composer) FX.composer.render(); else FX.renderer.render(FX.scene, FX.camera); };

/* ---------------------------------------------------------------- Wetter */
const WEATHER = { clear: { rain: 0, cloud: 0.18, fog: 0 }, cloudy: { rain: 0, cloud: 0.8, fog: 0.1 }, rain: { rain: 0.55, cloud: 0.9, fog: 0.3 }, storm: { rain: 1, cloud: 1, fog: 0.5 }, fog: { rain: 0, cloud: 0.7, fog: 1 } };
FX.setWeather = function (name, instant) { if (!WEATHER[name]) return; FX.weather = name; Object.assign(FX.target, WEATHER[name]); if (instant) Object.assign(FX.w, WEATHER[name], { wet: WEATHER[name].rain > 0.3 ? 0.9 : 0 }); };
FX.weatherLabel = () => ({ clear: 'Klar', cloudy: 'Bewölkt', rain: 'Regen', storm: 'Gewitter', fog: 'Nebel' }[FX.weather]);
FX.timeLabel = function () { const h = FX.hour; const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); const ph = h < 5 ? 'Tiefe Nacht' : h < 6.5 ? 'Früher Morgen' : h < 8 ? 'Sonnenaufgang' : h < 11 ? 'Vormittag' : h < 14 ? 'Mittag' : h < 17.5 ? 'Nachmittag' : h < 19.3 ? 'Sonnenuntergang' : h < 20.5 ? 'Dämmerung' : h < 23 ? 'Abend' : h < 24 ? 'Mitternacht' : 'Nacht'; return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${ph}`; };
FX.autoWeatherT = 120;
FX.update = function (dt, cam, player, opt) {
  opt = opt || {}; FX.hour = (FX.hour + dt * FX.timeScale / 3600 + 24) % 24; const w = FX.w, tg = FX.target;
  // Wetter-Übergang
  const rate = 0.12 * dt; for (const k of ['rain', 'cloud', 'fog']) w[k] += clamp(tg[k] - w[k], -rate, rate); w.wet += clamp((w.rain > 0.15 ? 1 : 0) - w.wet, -dt * 0.015, dt * 0.06);
  if (opt.autoWeather && FX.weather) { FX.autoWeatherT -= dt; if (FX.autoWeatherT <= 0) { FX.autoWeatherT = 150 + Math.random() * 240; const r = Math.random(); FX.setWeather(r < 0.45 ? 'clear' : r < 0.65 ? 'cloudy' : r < 0.82 ? 'rain' : r < 0.92 ? 'fog' : 'storm'); } }
  // Gewitter
  if (FX.weather === 'storm') { FX.nextFlash = (FX.nextFlash === undefined ? 3 : FX.nextFlash) - dt; if (FX.nextFlash <= 0) { FX.nextFlash = 4 + Math.random() * 9; w.flash = 1; FX.thunderIn = 0.4 + Math.random() * 2.2; } } w.flash = Math.max(0, w.flash - dt * (w.flash > 0.5 ? 4.5 : 2.2)); if (FX.thunderIn > 0) { FX.thunderIn -= dt; if (FX.thunderIn <= 0 && G.Audio) G.Audio.thunder(); }
  // Himmel
  const k = keyAt(FX.hour); const az = (FX.hour - 6) / 24 * U.TAU; const el = Math.sin(az) * 1.12; const sd = FX.sunDir.set(Math.cos(az) * 0.55 * Math.cos(el), Math.sin(el), Math.sin(az * 0.5 + 0.7) * 0.55 * Math.cos(el) + 0.25).normalize(); FX.moonDir.copy(sd).multiplyScalar(-1); FX.moonDir.y = Math.abs(FX.moonDir.y) * (sd.y > 0 ? -1 : 1) * (sd.y > 0 ? 1 : 1); FX.moonDir.set(-sd.x, -sd.y, -sd.z);
  const night = 1 - sstep(-0.12, 0.12, sd.y); FX.night = night; const overcast = clamp(w.cloud * 0.55 + w.rain * 0.4, 0, 0.92); const dark = 1 - overcast * 0.62;
  const grey = new THREE.Color(0.45, 0.48, 0.52).multiplyScalar(0.3 + 0.7 * (1 - night)); const zen = k.zen.clone().lerp(grey, overcast * 0.7), hor = k.hor.clone().lerp(grey.clone().multiplyScalar(1.4), overcast * 0.65); const fogC = k.fog.clone().lerp(grey, overcast * 0.6);
  const su = FX.skyU; su.uZen.value.copy(zen); su.uHor.value.copy(hor); su.uSunCol.value.copy(k.sun); su.uSunDir.value.copy(sd); su.uMoonDir.value.copy(FX.moonDir); su.uFog.value.copy(fogC); su.uTime.value += dt; su.uCloud.value = w.cloud; su.uNight.value = night * (1 - overcast * 0.7); su.uFlash.value = w.flash; su.uRain.value = w.rain; su.uSunI.value = k.sI * (1 - overcast * 0.5) / 3;
  FX.sky.position.copy(cam.position);
  // Licht
  const sunUp = sd.y > -0.05; const l = FX.sun; const lightDir = sunUp ? sd : FX.moonDir; const tun = FX.tunnel;
  l.color.copy(sunUp ? k.sun : new THREE.Color(0.55, 0.68, 1.0)); l.intensity = (sunUp ? k.sI * dark * sstep(-0.05, 0.1, sd.y) : 0.55 * (1 - overcast * 0.5)) * (1 - tun) + w.flash * 2; const sp = player ? player.pos : cam.position; l.position.copy(sp).addScaledVector(lightDir, 160); l.target.position.copy(sp);
  const snap = 0.5; l.position.x = Math.round(l.position.x / snap) * snap; l.position.z = Math.round(l.position.z / snap) * snap; l.target.updateMatrixWorld();
  FX.hemi.color.copy(k.sky).lerp(grey, overcast * 0.4); FX.hemi.groundColor.copy(k.gnd); FX.hemi.intensity = (0.55 + 0.5 * (1 - night)) * (1 - tun * 0.88) * (1 - overcast * 0.2) + 0.08 + w.flash * 1.2;
  // Nebel
  const base = lerp(0.00042, 0.0006, night); const fd = base * (1 + w.rain * 0.9) + w.fog * 0.0032 + (opt.indoor ? 0 : 0); scene_fog(fogC, fd * (1 + tun * 2.5), tun);
  // Straßen & Materialien
  const Mt = M(); for (const m of Mt.roadList) { m.roughness = lerp(0.88, 0.38, w.wet); m.color.setScalar(lerp(1, 0.62, w.wet)); m.envMapIntensity = w.wet * 1.5; }
  Mt.terrain.color.setScalar(lerp(1, 0.78, w.wet)); Mt.bldg.A.emissiveIntensity = Mt.bldg.B.emissiveIntensity = Mt.bldg.C.emissiveIntensity = night * 1.6; Mt.glowPoints.uniforms.uNight.value = clamp(night * 1.2 + w.rain * 0.25 + overcast * 0.15 + tun, 0, 1); Mt.glowPoints.uniforms.uTime.value = su.uTime.value; Mt.neon.color.setScalar(0.35 + 0.65 * night);
  Mt.water.color.copy(zen).multiplyScalar(0.22).add(new THREE.Color(0.0, 0.03, 0.05)); FX.water.position.x = cam.position.x; FX.water.position.z = cam.position.z; Mt.water.normalMap.offset.set(su.uTime.value * 0.004, su.uTime.value * 0.0027); Mt.water.normalMap.repeat.set(70, 70);
  // Regen
  const R = FX.rain; R.visible = w.rain > 0.05; if (R.visible) { const u = R.material.uniforms; u.uTime.value = su.uTime.value; u.uCam.value.copy(cam.position); u.uAmount.value = clamp(w.rain, 0, 1); u.uVel.value.set(3 + (opt.speed || 0) * 0.0, -34, 1.5); u.uColor.value.set(0.7, 0.78, 0.9).multiplyScalar(0.35 + 0.8 * (1 - night)); }
  // Nachbearbeitung
  const fu = FX.finalPass.uniforms; fu.uTime.value += dt; fu.uExposure.value = lerp(1.0, 1.25, night) * (1 + (opt.exposureBoost || 0)); fu.uSpeed.value += ((opt.speedBlur || 0) - fu.uSpeed.value) * Math.min(1, dt * 5); fu.uVig.value = 0.3 + 0.2 * night + (opt.damageVig || 0); fu.uSat.value = lerp(1.06, 1.12, night) * (1 - overcast * 0.2); fu.uGrade.value.set(lerp(1.0, 0.92, night), lerp(1.0, 0.98, night), lerp(1.0, 1.12, night));
  if (FX.bloom) { FX.bloom.strength = lerp(0.22, 0.42, night) + w.rain * 0.06 + (opt.bloomBoost || 0); FX.bloom.threshold = lerp(1.2, 1.0, night); FX.bloom.radius = 0.55; }
  FX.updateParticles(dt);
};
function scene_fog(c, d, tun) { const s = FX.scene; s.fog.color.copy(c).multiplyScalar(1 - tun * 0.75); s.fog.density = d; s.background = null; }

/* Reflexions-Cube: zwei Ziele im Wechsel (kein Lesen/Schreiben derselben Textur), pro Frame eine Fläche */
FX.initEnv = function (size) {
  const mk = () => new THREE.WebGLCubeRenderTarget(size || 192, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  FX.envRTs = [mk(), mk()]; FX.envW = 0; FX.envFace = 0; FX.envRT = FX.envRTs[1]; FX.envCams = [];
  const dirs = [[1, 0, 0, 0, -1, 0], [-1, 0, 0, 0, -1, 0], [0, 1, 0, 0, 0, 1], [0, -1, 0, 0, 0, -1], [0, 0, 1, 0, -1, 0], [0, 0, -1, 0, -1, 0]];
  for (const d of dirs) { const c = new THREE.PerspectiveCamera(90, 1, 0.5, 2500); c.up.set(d[3], d[4], d[5]); c.lookAt(d[0], d[1], d[2]); FX.envCams.push(c); }
  return FX.envRT.texture;
};
FX.applyEnv = function (tex) { G.CM.envTex = tex; G.CM.setEnv(tex); for (const m of M().envMaps) m.envMap = tex; };
FX.updateEnv = function (pos, hide, faces) {
  if (!FX.envRTs) return; const r = FX.renderer; const old = r.getRenderTarget(); const sh = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false; const rainVis = FX.rain.visible; FX.rain.visible = false; if (hide) hide.visible = false; const wr = FX.envRTs[FX.envW];
  for (let k = 0; k < (faces || 1); k++) { const c = FX.envCams[FX.envFace]; c.position.copy(pos); c.updateMatrixWorld(); r.setRenderTarget(wr, FX.envFace); r.render(FX.scene, c); FX.envFace++; if (FX.envFace >= 6) { FX.envFace = 0; FX.envRT = wr; FX.envW = 1 - FX.envW; FX.applyEnv(wr.texture); } }
  r.setRenderTarget(old); r.shadowMap.autoUpdate = sh; FX.rain.visible = rainVis; if (hide) hide.visible = true;
};

G.FX = FX;
})(window.G = window.G || {});
