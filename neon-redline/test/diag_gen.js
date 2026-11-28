const load = require('./node_env');
const ctx = load(['util.js','world_data.js']);
const G = ctx.G;
// stubs für Texturen/Materialien
const stub = {}; G.Tex = { signColors: ['#ff3d8b','#35e0ff','#b36bff','#ffb02e','#6bff9a','#ff5a3d','#ffd23d','#3dffd9','#ff4de0','#ff6a6a','#59a5ff','#ffa63d','#7dff4d','#ff7ad9','#ff3d3d','#ffe08a'], signCount: 16 };
G.Mats = { terrain: {}, road: { hw:{}, ar:{}, st:{}, ind:{}, co:{}, mt:{} }, solid: {}, metal: {}, bldg: { A:{}, B:{}, C:{} }, neon: {}, sign: {}, ad: {}, tunnel: {}, glowPoints: {} };
const fs=require('fs'), vm=require('vm');
for (const f of ['world_gen.js','world_zones.js']) vm.runInContext(fs.readFileSync(__dirname+'/../src/'+f,'utf8'), ctx, {filename:f});
const W = G.World, Gen = G.Gen; W.init(); Gen.prepare();
function tri(ch){ let t=0, v=0; for(const g of ch.geos){ if(g.index) t+=g.index.count/3; else if (g.attributes.position) v+=g.attributes.position.count; } return Math.round(t); }
const spots = { city:[60,60], core:[300,300], harbor:[-1900,0], industrial:[900,1500], rural:[-1200,1300], mountain:[1500,-1500], tunnelA1:[2200,10], bridge:[0,2100], kalmar:[1300,-1300], suburb:[-900,-900] };
for (const [name,[x,z]] of Object.entries(spots)) {
  const cx=Math.floor(x/250), cz=Math.floor(z/250);
  for (const lod of [0,1,2]) {
    const t0=Date.now(); const gen = require('vm').runInContext('(function(cx,cz,lod){ return G.Gen.__build(cx,cz,lod); })', ctx);
    const g = G.Gen.__build ? G.Gen.__build(cx,cz,lod) : null; if(!g){ console.log('no __build'); process.exit(); }
    let r; let steps=0; while(!(r=g.next()).done) steps++; const ch=r.value;
    console.log(name.padEnd(11),'lod',lod,'ms',String(Date.now()-t0).padStart(4),'tris',String(tri(ch)).padStart(7),'meshes',ch.meshes.length,'cols',ch.cols.length,'lamps',ch.lamps.length/3, 'steps', steps);
    ch.dispose();
  }
}
