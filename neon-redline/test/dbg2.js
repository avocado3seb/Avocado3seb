const load = require('./node_env'); const ctx = load(['util.js','world_data.js','cars_data.js','physics.js']); const G = ctx.G, W = G.World, CD = G.CD; W.init();
const id = process.argv[2]||'stallion_gt'; const tcs = +(process.argv[3]||1); const spec = CD.byId[id]; const v = new G.Vehicle(spec, CD.defaultCfg(spec)); v.tcs = tcs;
const y = W.groundAt(-400, 0) + v.cgY + 0.2; v.reset(-400, y, 0, Math.PI/2); v.tcs=tcs; const dt=1/120;
for (let i=0;i<120;i++) v.step(dt,0);
v.setInput({throttle:1});
for (let i=0;i<120*3;i++){ v.step(dt,0); if (i%30===0) console.log((i/120).toFixed(2)+'s', 'v', (v.speed*3.6).toFixed(0), 'g', v.gear, 'rpm', v.rpm.toFixed(0), 'tq', v.engTq.toFixed(0), 'cut', (v.tcsCut||0).toFixed(2), 'om', v.wheels.map(w=>w.omega.toFixed(0)).join(','), 'kap', v.wheels.map(w=>w.slipRatio.toFixed(2)).join(','), 'Fx', v.wheels.map(w=>(w.Fx||0).toFixed(0)).join(',')); }
