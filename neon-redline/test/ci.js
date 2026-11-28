/* Headless-Prüfungen für CI: Welt, Routen, Fahrzeugdaten, Fahrphysik. Beendet mit Exit-Code 1 bei Fehlern. */
const load = require('./node_env');
const ctx = load(['util.js', 'world_data.js', 'cars_data.js', 'physics.js']); const G = ctx.G, W = G.World, CD = G.CD; W.init();
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHL ') + m); if (!c) fails++; };
ok(W.Roads.list.length > 50, `Straßennetz: ${W.Roads.list.length} Straßen`);
ok(W.tunnels.length === 2, `Tunnel: ${W.tunnels.length}`);
for (const t of W.tunnels) { const i = (t.a + t.b) >> 1; ok(W.terrainH(t.r.x[i], t.r.z[i]) - t.r.h[i] > 12, `Tunnelüberdeckung ${t.r.name}`); }
for (const r of W.Roads.list) { let g = 0; for (let i = 1; i < r.n; i++) g = Math.max(g, Math.abs(r.h[i] - r.h[i - 1]) / Math.max(0.1, r.s[i] - r.s[i - 1])); if (!r.def.grid) ok(g < 0.16, `Steigung ${r.name}: ${(g * 100).toFixed(1)} %`); }
const route = W.findRoute(0, 0, -1900, 40); ok(route && route.length > 0, 'Route Stadt → Hafen');
ok(W.findRoute(-1900, 0, 2600, 0) !== null, 'Route Hafen → Hochwald');
for (const s of CD.PLAYER) { const st = CD.stats(s, CD.defaultCfg(s)); ok(st.vmax > 200 && st.vmax < 460 && st.t100 > 1 && st.t100 < 8, `Werte ${s.name}: ${st.hp} PS, 0-100 ${st.t100.toFixed(1)} s, ${st.vmax.toFixed(0)} km/h, PI ${st.pi}${st.cls}`); }
function drive(id, steer) { const spec = CD.byId[id]; const v = new G.Vehicle(spec, CD.defaultCfg(spec)); v.reset(-400, W.groundAt(-400, 0) + v.cgY + 0.2, 0, Math.PI / 2); for (let i = 0; i < 60; i++) v.step(1 / 120, 0); v.setInput({ throttle: 1, steer: steer || 0, analog: true }); let t100 = 0; for (let i = 0; i < 120 * 20; i++) { v.step(1 / 120, 0); if (!t100 && v.speed * 3.6 >= 100) t100 = i / 120; if (v.pos.x > 650) v.pos.x -= 1000; } return { t100, v: v.speed * 3.6, up: v.up(new ctx.THREE.Vector3()).y }; }
for (const id of ['zephyr_s15', 'corsa_f8', 'voltra_zenith']) { const r = drive(id); ok(r.t100 > 1.5 && r.t100 < 9 && r.up > 0.9, `Physik ${id}: 0-100 in ${r.t100.toFixed(1)} s, ${r.v.toFixed(0)} km/h nach 20 s`); }
ok(drive('evo_tora_x', 0.15).up > 0.9, 'Fahrzeug kippt bei Lenkeinschlag nicht um');
console.log(fails ? `\n${fails} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden'); process.exit(fails ? 1 : 0);
