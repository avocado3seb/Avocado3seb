const load = require('./node_env'); const ctx = load(['util.js','world_data.js','cars_data.js','physics.js']); const G = ctx.G, W = G.World, CD = G.CD; W.init();
const ids = process.argv[2] ? process.argv[2].split(',') : ['zephyr_s15','stallion_gt','corsa_f8','tempesta_w16','evo_tora_x','voltra_zenith'];
const start = { x: -400, z: 0 }; // Ost-West 0 Straße (Stadtraster), Richtung +x
function runCar(id, scenario){
  const spec = CD.byId[id]; const v = new G.Vehicle(spec, CD.defaultCfg(spec));
  const y = W.groundAt(start.x, start.z) + v.cgY + 0.2; v.reset(start.x, y, start.z, Math.PI/2); // yaw=+90° => forward=(+x)
  for (let i=0;i<60;i++) v.step(1/120, 0); // settle
  const out = {}; let t=0; const dt=1/120;
  if (scenario==='accel') { v.setInput({throttle:1, brake:0, steer:0}); let t100=0, t200=0, vmax=0, maxSteps=120*60; let gears=new Set();
    for (let i=0;i<maxSteps;i++){ v.step(dt,0); t+=dt; const kmh=v.speed*3.6; if(!t100&&kmh>=100) t100=t; if(!t200&&kmh>=200) t200=t; vmax=Math.max(vmax,kmh); gears.add(v.gear); 
      // auf dem Raster würde es enden; Position zurücksetzen entlang der Straße
      if (v.pos.x > 650) { v.pos.x -= 1000; } if (i%1200===0) out['v'+(i/120)] = kmh.toFixed(0)+'@g'+v.gear+' rpm'+v.rpm.toFixed(0); }
    out.t100=t100.toFixed(2); out.t200=t200.toFixed(2); out.vmax=vmax.toFixed(0); out.pos=[v.pos.x.toFixed(0), v.pos.y.toFixed(2), v.pos.z.toFixed(1)]; }
  if (scenario==='brake') { // beschleunigen auf 160 dann voll bremsen
    v.setInput({throttle:1}); for(let i=0;i<120*40 && v.speed*3.6<160;i++){ v.step(dt,0); if (v.pos.x>650) v.pos.x-=1000; } const s0=v.pos.clone(); const v0=v.speed*3.6; v.setInput({throttle:0, brake:1}); let tt=0; for(let i=0;i<120*12 && v.speed>1;i++){ v.step(dt,0); tt+=dt; } out.from=v0.toFixed(0); out.stopDist=(v.pos.distanceTo(s0)).toFixed(0)+'m'; out.stopT=tt.toFixed(1); out.yaw=(v.yaw*57.3).toFixed(0); out.pitch='' }
  if (scenario==='corner') { v.setInput({throttle:1}); for(let i=0;i<120*25 && v.speed*3.6<120;i++){ v.step(dt,0); if (v.pos.x>650) v.pos.x-=1000; } v.setInput({throttle:0.4, steer:0.6, analog:true}); let maxSlip=0; const p0 = v.pos.clone(); let yaw0=v.yaw; let lat=0; for(let i=0;i<120*6;i++){ v.step(dt,0); lat=Math.max(lat,Math.abs(v.vel.dot(v.left(new ctx.THREE.Vector3())))); } out.speed=(v.speed*3.6).toFixed(0); out.sideSlip=lat.toFixed(1); out.upY=v.up(new ctx.THREE.Vector3()).y.toFixed(2); out.yawRate=(v.w.y*57.3).toFixed(0)+'°/s'; }
  return out;
}
for (const id of ids) for (const sc of ['accel','brake','corner']) { const t0=Date.now(); console.log(id.padEnd(16), sc.padEnd(7), JSON.stringify(runCar(id,sc)), (Date.now()-t0)+'ms'); }
