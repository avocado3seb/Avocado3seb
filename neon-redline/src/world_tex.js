/* NEON REDLINE – world_tex.js : prozedurale Texturen & Materialien */
(function (G) {
'use strict';
const U = G.U; const T = {}; const M = {};
const rnd = U.mulberry(2024);
function tex(canvas, opt) {
  opt = opt || {}; const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = opt.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.encoding = opt.linear ? THREE.LinearEncoding : THREE.sRGBEncoding; t.anisotropy = opt.aniso || 8; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; return t;
}
function speckle(ctx, w, h, n, light, dark, minA, maxA) {
  for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h; const s = 0.6 + rnd() * 1.6; const l = rnd() < 0.5; ctx.fillStyle = (l ? light : dark).replace('A', (minA + rnd() * (maxA - minA)).toFixed(3)); ctx.fillRect(x, y, s, s); }
}

/* ---------------- Straßen ---------------- */
const ROAD_LAYOUT = {
  hw: { W: 26, m: [[1.6, 'edge'], [3.6, 'dash'], [3.6, 'dash'], [3.6, 'solid'], [1.2, 'median'], [3.6, 'solid'], [3.6, 'dash'], [3.6, 'dash'], [1.6, 'edge']] },
  ar: { W: 22, m: [[3.5, 'park'], [3.4, 'solidw'], [3.4, 'dbl'], [3.4, 'dbl2'], [3.4, 'solidw'], [4.9, 'park']] },
  st: { W: 16, m: [[4.2, 'park'], [3.5, 'dashc'], [3.5, 'dashc2'], [4.8, 'park']] },
  ind: { W: 14, m: [[3.5, 'edge'], [3.5, 'dashc'], [3.5, 'dashc2'], [3.5, 'edge']] },
  co: { W: 9.6, m: [[1.3, 'edge'], [3.5, 'dashc'], [3.5, 'dashc2'], [1.3, 'edge']] },
  mt: { W: 9.8, m: [[1.3, 'edge'], [3.6, 'dashc'], [3.6, 'dashc2'], [1.3, 'edge']] },
};
T.road = function (type) {
  const L = ROAD_LAYOUT[type]; const PXM = 18; const w = Math.round(L.W * PXM), h = 12 * PXM; const c = U.canvas(w, h); const g = c.getContext('2d');
  g.fillStyle = '#3b3b3f'; g.fillRect(0, 0, w, h);
  // Spurrillen & Grundton
  for (let x = 0; x < w; x += 2) { const u = x / w; const v = 0.5 + 0.5 * Math.sin(u * L.W / 3.5 * Math.PI * 2 + 0.6); g.fillStyle = `rgba(20,20,22,${0.10 * v})`; g.fillRect(x, 0, 2, h); }
  speckle(g, w, h, 9000, 'rgba(150,150,155,A)', 'rgba(10,10,12,A)', 0.08, 0.4);
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${28 + rnd() * 14},${28 + rnd() * 14},${30 + rnd() * 14},0.35)`; g.fillRect(rnd() * w, rnd() * h, 20 + rnd() * 110, 10 + rnd() * 60); }
  g.strokeStyle = 'rgba(15,15,17,0.55)'; g.lineWidth = 1; for (let i = 0; i < 7; i++) { g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 30; y += rnd() * 26; g.lineTo(x, y); } g.stroke(); }
  // Markierungen
  const white = 'rgba(232,232,226,0.95)', yellow = 'rgba(236,196,60,0.95)';
  let x = 0; const lw = 0.14 * PXM; const line = (xm, col, dash, wmul) => { g.fillStyle = col; const xx = xm * PXM - lw * (wmul || 1) / 2; if (!dash) g.fillRect(xx, 0, lw * (wmul || 1), h); else { g.fillRect(xx, 0, lw * (wmul || 1), dash * PXM); } };
  const lines = [];
  for (const [wm, kind] of L.m) {
    const x0 = x, x1 = x + wm; x = x1;
    if (kind === 'edge') { if (x0 < 0.1) line(x1 - 0.1, white); else line(x0 + 0.1, white); }
    else if (kind === 'dash') { line(x1, white, 3); }
    else if (kind === 'solid') { line(x1, white); }
    else if (kind === 'solidw') { line(x1, white); }
    else if (kind === 'median') { g.fillStyle = 'rgba(120,120,118,0.9)'; g.fillRect(x0 * PXM, 0, wm * PXM, h); line(x0 + 0.08, yellow); line(x1 - 0.08, yellow); }
    else if (kind === 'dbl') { line(x1 - 0.1, yellow); }
    else if (kind === 'dbl2') { line(x0 + 0.1, yellow); }
    else if (kind === 'dashc') { line(x1 - 0.04, white, 3); }
    else if (kind === 'dashc2') { }
    else if (kind === 'park') { const edgeRight = x0 > L.W / 2; line(edgeRight ? x0 + 0.1 : x1 - 0.1, white); g.fillStyle = white; for (let k = 0; k < 2; k++) { const y = k * 6 * PXM; if (edgeRight) g.fillRect(x0 * PXM, y, wm * PXM, 0.1 * PXM); else g.fillRect(x0 * PXM, y, wm * PXM, 0.1 * PXM); } }
  }
  if (type === 'hw') { /* Randstreifen breiter */ }
  // Abnutzung der Markierungen
  speckle(g, w, h, 2400, 'rgba(60,60,64,A)', 'rgba(60,60,64,A)', 0.4, 0.9);
  const t = tex(c, { aniso: 16 }); return t;
};
T.roadBump = function () { const c = U.canvas(256, 256); const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256); speckle(g, 256, 256, 9000, 'rgba(255,255,255,A)', 'rgba(0,0,0,A)', 0.1, 0.5); return tex(c, { linear: true }); };

/* ---------------- Fassaden ---------------- */
function facade(kind) {
  const S = 512, TG = 8, TS = S / TG; const c = U.canvas(S, S), e = U.canvas(S, S); const g = c.getContext('2d'), ge = e.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  const r = U.mulberry(kind.length * 977 + 5);
  for (let ty = 0; ty < TG; ty++) for (let tx = 0; tx < TG; tx++) {
    const x0 = tx * TS, y0 = ty * TS;
    if (kind === 'A') {
      g.fillStyle = '#d9d5cc'; g.fillRect(x0, y0, TS, TS);
      for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(${120 + r() * 80},${115 + r() * 80},${105 + r() * 80},0.07)`; g.fillRect(x0 + r() * TS, y0 + r() * TS, 2 + r() * 12, 2 + r() * 12); }
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x0, y0 + TS - 4, TS, 4);
      const wx = x0 + 14, wy = y0 + 12, ww = 36, wh = 38;
      g.fillStyle = '#9ea4a8'; g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
      const gr = g.createLinearGradient(wx, wy, wx + ww, wy + wh); const tone = r(); gr.addColorStop(0, tone < 0.2 ? '#c8c0aa' : '#2c3b4c'); gr.addColorStop(1, tone < 0.2 ? '#a89f8a' : '#10161e'); g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = 'rgba(160,190,220,0.18)'; g.beginPath(); g.moveTo(wx, wy + wh * 0.55); g.lineTo(wx + ww * 0.6, wy); g.lineTo(wx + ww, wy); g.lineTo(wx, wy + wh * 0.9); g.fill();
      g.fillStyle = '#c4c4c0'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh);
      const p = r(); if (p < 0.4) { const col = p < 0.28 ? 'rgba(255,214,150,0.95)' : p < 0.34 ? 'rgba(190,225,255,0.9)' : 'rgba(255,170,200,0.85)'; ge.fillStyle = col; ge.fillRect(wx, wy, ww, wh); ge.fillStyle = 'rgba(0,0,0,0.5)'; ge.fillRect(wx + ww / 2 - 1, wy, 2, wh); if (r() < 0.4) { ge.fillStyle = 'rgba(0,0,0,0.55)'; ge.fillRect(wx, wy, ww, wh * (0.25 + r() * 0.4)); } }
    } else if (kind === 'B') {
      g.fillStyle = '#58606a'; g.fillRect(x0, y0, TS, TS); // Brüstung
      g.fillStyle = '#434b55'; g.fillRect(x0, y0, TS, 10);
      const gr = g.createLinearGradient(x0, y0 + 10, x0 + TS, y0 + TS); const k = r(); gr.addColorStop(0, `rgb(${40 + k * 30},${70 + k * 40},${100 + k * 40})`); gr.addColorStop(0.55, `rgb(${20 + k * 15},${34 + k * 20},${52 + k * 20})`); gr.addColorStop(1, `rgb(${46 + k * 20},${80 + k * 30},${110 + k * 30})`);
      g.fillStyle = gr; g.fillRect(x0 + 1, y0 + 12, TS - 2, TS - 14);
      g.fillStyle = 'rgba(190,215,235,0.16)'; g.fillRect(x0 + 1, y0 + 12, TS * 0.35, TS - 14);
      g.fillStyle = 'rgba(200,205,210,0.7)'; g.fillRect(x0 + TS / 2 - 1, y0 + 10, 2, TS - 10); g.fillRect(x0, y0 + 10, 1.5, TS - 10);
      const p = r(); if (p < 0.42) { const warm = r() < 0.6; ge.fillStyle = warm ? 'rgba(255,226,170,0.9)' : 'rgba(200,230,255,0.9)'; const half = r() < 0.5; ge.fillRect(x0 + (half ? TS / 2 + 1 : 2), y0 + 14, half ? TS / 2 - 3 : TS - 4, TS - 18); if (!half && r() < 0.5) { ge.fillStyle = '#000'; ge.fillRect(x0 + TS / 2 - 1, y0 + 14, 2, TS - 18); } }
    } else { // C: Industrie – Wellblech
      g.fillStyle = '#b9bcbd'; g.fillRect(x0, y0, TS, TS);
      for (let i = 0; i < TS; i += 4) { g.fillStyle = (i / 4) % 2 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'; g.fillRect(x0 + i, y0, 2, TS); }
      if (ty % 4 === 1) { g.fillStyle = '#242c33'; g.fillRect(x0 + 6, y0 + 16, TS - 12, 14); g.fillStyle = 'rgba(150,180,200,0.2)'; g.fillRect(x0 + 6, y0 + 16, (TS - 12) / 2, 14); if (r() < 0.3) { ge.fillStyle = 'rgba(255,225,150,0.95)'; ge.fillRect(x0 + 6, y0 + 16, TS - 12, 14); } }
      g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(x0, y0 + TS - 3, TS, 3);
    }
  }
  const t = tex(c, { aniso: 8 }); const te = tex(e, { aniso: 4 }); return [t, te];
}
T.facades = {}; ['A', 'B', 'C'].forEach(k => { T.facades[k] = facade(k); });

/* ---------------- Neon-Schilder ---------------- */
const SIGNS = [['RAMEN', '#ff3d8b'], ['HOTEL', '#35e0ff'], ['CLUB', '#b36bff'], ['NOVA', '#ffb02e'], ['24/7', '#6bff9a'], ['BAR', '#ff5a3d'], ['DINER', '#ffd23d'], ['TURBO', '#3dffd9'], ['ARCADE', '#ff4de0'], ['SUSHI', '#ff6a6a'], ['MOTEL', '#59a5ff'], ['PIZZA', '#ffa63d'], ['GARAGE', '#7dff4d'], ['KARAOKE', '#ff7ad9'], ['LIQUOR', '#ff3d3d'], ['CAFÉ', '#ffe08a']];
T.signColors = SIGNS.map(s => s[1]); T.signCount = SIGNS.length;
T.signAtlas = (function () {
  const cols = 4, rows = 4, cs = 256; const c = U.canvas(cols * cs, rows * cs); const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  SIGNS.forEach(([txt, col], i) => { const cx = (i % cols) * cs, cy = Math.floor(i / cols) * cs; g.save(); g.translate(cx, cy);
    g.fillStyle = '#05050a'; g.fillRect(8, 8, cs - 16, cs - 16);
    g.shadowColor = col; g.shadowBlur = 22; g.strokeStyle = col; g.lineWidth = 7; g.lineJoin = 'round'; g.strokeRect(22, 22, cs - 44, cs - 44);
    g.fillStyle = '#fff'; g.font = 'bold ' + (txt.length > 5 ? 46 : 62) + 'px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowBlur = 26; g.shadowColor = col; g.strokeStyle = col; g.lineWidth = 3; g.strokeText(txt, cs / 2, cs / 2); g.fillText(txt, cs / 2, cs / 2);
    g.restore(); });
  return tex(c, { clamp: true });
})();
T.adAtlas = (function () {
  const c = U.canvas(1024, 512); const g = c.getContext('2d'); const ads = [['NEON REDLINE', '#ff2a6d', '#05d9e8'], ['VOLTA ENERGY', '#00ffa3', '#0a1a2a'], ['TURBO COLA', '#ff3b30', '#ffd60a'], ['MERIDIAN BANK', '#4da3ff', '#0b1020']];
  ads.forEach(([t, a, b], i) => { const x = (i % 2) * 512, y = Math.floor(i / 2) * 256; const gr = g.createLinearGradient(x, y, x + 512, y + 256); gr.addColorStop(0, b); gr.addColorStop(1, a); g.fillStyle = gr; g.fillRect(x, y, 512, 256);
    g.fillStyle = 'rgba(255,255,255,0.12)'; for (let k = 0; k < 8; k++) g.fillRect(x + k * 70 - 20, y, 22, 256);
    g.fillStyle = '#fff'; g.font = 'italic 900 56px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = a; g.shadowBlur = 20; g.fillText(t, x + 256, y + 128); g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '600 20px Arial'; g.fillText('JETZT FAHREN. NIE ANHALTEN.', x + 256, y + 196); });
  return tex(c, { clamp: true });
})();
T.glow = (function () { const c = U.canvas(64, 64); const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
T.soft = (function () { const c = U.canvas(128, 128); const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
T.smoke = (function () { const c = U.canvas(128, 128); const g = c.getContext('2d'); for (let i = 0; i < 26; i++) { const x = 64 + (rnd() - 0.5) * 50, y = 64 + (rnd() - 0.5) * 50, r = 14 + rnd() * 22; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } return new THREE.CanvasTexture(c); })();
T.detail = (function () {
  const N = 256, c = U.canvas(N, N); const g = c.getContext('2d'); const im = g.createImageData(N, N); const grids = [8, 16, 32, 64].map(n => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rnd(); return [n, a]; });
  const samp = (u, v, n, a) => { const x = u * n, y = v * n; const x0 = Math.floor(x) % n, y0 = Math.floor(y) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n; const fx = x - Math.floor(x), fy = y - Math.floor(y); const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return U.lerp(U.lerp(a[y0 * n + x0], a[y0 * n + x1], sx), U.lerp(a[y1 * n + x0], a[y1 * n + x1], sx), sy); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let v = 0, amp = 0.5, tot = 0; for (const [n, a] of grids) { v += samp(x / N, y / N, n, a) * amp; tot += amp; amp *= 0.6; } v = v / tot; const o = (y * N + x) * 4; const b = 150 + (v - 0.5) * 190 + (rnd() - 0.5) * 22; im.data[o] = im.data[o + 1] = im.data[o + 2] = b; im.data[o + 3] = 255; }
  g.putImageData(im, 0, 0); return tex(c, { aniso: 8 });
})();
T.waterNormal = (function () {
  const N = 256, c = U.canvas(N, N); const g = c.getContext('2d'); const im = g.createImageData(N, N); const hgt = new Float32Array(N * N);
  const waves = []; for (let i = 0; i < 14; i++) { const k = 2 + Math.floor(rnd() * 9), a = rnd() * U.TAU; waves.push([Math.round(Math.cos(a) * k), Math.round(Math.sin(a) * k), rnd() * U.TAU, 1 / (1 + k * 0.5)]); }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let h = 0; for (const [kx, ky, ph, am] of waves) h += Math.sin((kx * x + ky * y) / N * U.TAU + ph) * am; hgt[y * N + x] = h; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = hgt[y * N + (x + 1) % N] - hgt[y * N + (x + N - 1) % N], dy = hgt[((y + 1) % N) * N + x] - hgt[((y + N - 1) % N) * N + x]; const o = (y * N + x) * 4; im.data[o] = 128 + dx * 22; im.data[o + 1] = 128 + dy * 22; im.data[o + 2] = 255; im.data[o + 3] = 255; }
  g.putImageData(im, 0, 0); return tex(c, { linear: true });
})();
T.concrete = (function () { const c = U.canvas(128, 128); const g = c.getContext('2d'); g.fillStyle = '#8c8c8c'; g.fillRect(0, 0, 128, 128); speckle(g, 128, 128, 2500, 'rgba(255,255,255,A)', 'rgba(0,0,0,A)', 0.05, 0.2); return tex(c); })();

/* ---------------- Materialien ---------------- */
M.envMaps = []; // Materialien, die die Reflexions-Cubemap nutzen
M.wet = 0; M.night = 0;
M.terrain = new THREE.MeshStandardMaterial({ vertexColors: true, map: T.detail, roughness: 0.96, metalness: 0 });
M.road = {}; M.roadList = [];
['hw', 'ar', 'st', 'ind', 'co', 'mt'].forEach(t => { const m = new THREE.MeshStandardMaterial({ map: T.road(t), roughness: 0.88, metalness: 0.0, envMapIntensity: 0.0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }); M.road[t] = m; M.roadList.push(m); M.envMaps.push(m); });
M.solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.08, map: T.concrete });
M.metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.7 });
M.bldg = {};
Object.keys(T.facades).forEach(k => { const [map, em] = T.facades[k]; const m = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0, vertexColors: true, roughness: k === 'B' ? 0.28 : 0.75, metalness: k === 'B' ? 0.5 : 0.05, envMapIntensity: k === 'B' ? 0.9 : 0.15 }); M.bldg[k] = m; M.envMaps.push(m); });
M.neon = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
M.sign = new THREE.MeshBasicMaterial({ map: T.signAtlas, vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
M.ad = new THREE.MeshBasicMaterial({ map: T.adAtlas, vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
M.glass = new THREE.MeshStandardMaterial({ color: 0x1b2733, roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.55, envMapIntensity: 1.0 }); M.envMaps.push(M.glass);
M.tunnel = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0, side: THREE.FrontSide, map: T.concrete });
M.water = new THREE.MeshStandardMaterial({ color: 0x0b2236, roughness: 0.06, metalness: 0.55, normalMap: T.waterNormal, normalScale: new THREE.Vector2(0.9, 0.9), transparent: true, opacity: 0.93, envMapIntensity: 1.3 }); M.envMaps.push(M.water);
M.glowPoints = new THREE.ShaderMaterial({
  uniforms: { uMap: { value: T.glow }, uScale: { value: 400 }, uNight: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `attribute float size; attribute vec3 color; attribute float phase; varying vec3 vC; varying float vA; uniform float uScale; uniform float uNight; uniform float uTime;
    void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); float d = -mv.z; vA = clamp(uNight,0.0,1.0); if(phase>0.0){ vA *= 0.5+0.5*step(0.0, sin(uTime*phase*3.0)); } gl_PointSize = size * uScale / max(d,1.0); gl_PointSize = min(gl_PointSize, 96.0); vA *= smoothstep(3.0, 22.0, d); gl_Position = projectionMatrix * mv; if(d > 900.0) gl_PointSize = 0.0; }`,
  fragmentShader: `uniform sampler2D uMap; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb * 1.1, t.a * vA); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });

G.Tex = T; G.Mats = M;
})(window.G = window.G || {});
