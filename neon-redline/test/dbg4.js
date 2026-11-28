const load = require('./node_env'); const ctx = load(['util.js','world_data.js','cars_data.js','physics.js']); const G = ctx.G, W = G.World, CD = G.CD; W.init();
const spec = CD.byId['voltra_zenith']; const v = new G.Vehicle(spec, CD.defaultCfg(spec)); const y = W.groundAt(-400, 0) + v.cgY + 0.2; v.reset(-400, y, 0, Math.PI/2); const dt=1/120;
for (let i=0;i<120;i++) v.step(dt,0);
v.setInput({throttle:1});
for (let i=0;i<120*1.5;i++){ v.step(dt,0); if (i%45===0) console.log((i/120).toFixed(2), 'wheelTq', v.wheelTq.toFixed(0), 'sh', v._sh.map(x=>x.toFixed(0)).join(','), 'fwFrac', v.fwFrac, 'Gt', (v.gearRatios[0]*v.finalDrive).toFixed(2), 'Fx', v.wheels.map(w=>w.Fx.toFixed(0)).join(','), 'kap', v.wheels.map(w=>w.slipRatio.toFixed(2)).join(',')); }
