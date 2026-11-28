const load = require('./node_env'); const ctx = load(['util.js','world_data.js','cars_data.js','physics.js']); const G = ctx.G, W = G.World, CD = G.CD; W.init();
const spec = CD.byId['stallion_gt']; const v = new G.Vehicle(spec, CD.defaultCfg(spec)); const y = W.groundAt(-400, 0) + v.cgY + 0.2; v.reset(-400, y, 0, Math.PI/2); const dt=1/120;
for (let i=0;i<120;i++) v.step(dt,0);
v.vel.set(20,0,0); for (const w of v.wheels) w.omega = 20/v.R; v.gear=3;
for (let i=0;i<60;i++){ v.step(dt,0); if (i%10===0) console.log(i, 'v', v.vel.x.toFixed(2), 'om', v.wheels.map(w=>w.omega.toFixed(2)).join(','), 'kap', v.wheels.map(w=>w.slipRatio.toFixed(4)).join(','), 'sa', v.wheels.map(w=>w.slipAngle.toFixed(4)).join(','), 'Fx', v.wheels.map(w=>(w.Fx||0).toFixed(0)).join(','), 'Fy', v.wheels.map(w=>(w.Fy||0).toFixed(0)).join(','), 'steer', v.steer.toFixed(4), 'rpm', v.rpm.toFixed(0), 'brk', v.brk.toFixed(2), 'wy', v.w.y.toFixed(4)); }
