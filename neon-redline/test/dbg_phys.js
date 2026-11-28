const load = require('./node_env'); const ctx = load(['util.js','world_data.js','cars_data.js','physics.js']); const G = ctx.G, W = G.World, CD = G.CD; W.init();
const id = process.argv[2]||'stallion_gt'; const spec = CD.byId[id]; const v = new G.Vehicle(spec, CD.defaultCfg(spec));
const y = W.groundAt(-400, 0) + v.cgY + 0.2; v.reset(-400, y, 0, Math.PI/2); const dt=1/120;
for (let i=0;i<120;i++) v.step(dt,0);
console.log('settled y', v.pos.y.toFixed(3), 'groundY', W.groundAt(v.pos.x,v.pos.z).toFixed(3), 'cgY', v.cgY.toFixed(3), 'comp', v.wheels.map(w=>w.comp.toFixed(3)).join(','), 'Fz', v.wheels.map(w=>w.Fz.toFixed(0)).join(','), 'mass', v.m);
v.setInput({throttle:1});
for (let i=0;i<120*4;i++){ v.step(dt,0); if (i%60===0) console.log((i/120).toFixed(1)+'s', 'v', (v.speed*3.6).toFixed(0), 'g', v.gear, 'rpm', v.rpm.toFixed(0), 'tq', v.engTq.toFixed(0), 'wTq', v.wheelTq.toFixed(0), 'omega', v.wheels.map(w=>w.omega.toFixed(1)).join(','), 'kap', v.wheels.map(w=>w.slipRatio.toFixed(2)).join(','), 'Fz', v.wheels.map(w=>w.Fz.toFixed(0)).join(','), 'pitch', (Math.asin(v.forward(new ctx.THREE.Vector3()).y)*57).toFixed(1)); }
