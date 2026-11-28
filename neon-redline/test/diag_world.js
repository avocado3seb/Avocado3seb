const load = require('./node_env');
const ctx = load(['util.js','world_data.js']);
const G = ctx.G, W = G.World;
let t0 = Date.now(); W.init(); console.log('init ms', Date.now()-t0, 'roads', W.Roads.list.length, 'nodes', W.nodes.length, 'tunnels', W.tunnels.length);
const roads = W.Roads.list;
for (const r of roads) {
  if (r.def.grid) continue;
  let maxG=0, minH=1e9, maxH=-1e9, water=0, hasTun=0, hasBr=0;
  for (let i=1;i<r.n;i++){ const g=Math.abs(r.h[i]-r.h[i-1])/Math.max(0.1,r.s[i]-r.s[i-1]); if(g>maxG)maxG=g; minH=Math.min(minH,r.h[i]); maxH=Math.max(maxH,r.h[i]);
    if(r.flags[i]&1)hasTun++; if(r.flags[i]&2)hasBr++;
    if(!(r.flags[i]&2)){ const sd=W.seaDepth(r.x[i],r.z[i]); if (sd>1.5 && r.h[i] - sd < 0.5) water++; } }
  console.log(r.name.padEnd(26), r.type, 'len', r.len.toFixed(0).padStart(5), 'n', String(r.n).padStart(4), 'grade', (maxG*100).toFixed(1)+'%', 'h', minH.toFixed(0)+'..'+maxH.toFixed(0), 'waterpts', water, 'tun', hasTun, 'br', hasBr);
}
// Tunnelüberdeckung
for (const t of W.tunnels) { let minCover=1e9; for (let i=t.a;i<=t.b;i++){ const c=W.terrainH(t.r.x[i],t.r.z[i]) - t.r.h[i]; minCover=Math.min(minCover,c);} console.log('tunnel', t.r.name, 'len', (t.s1-t.s0).toFixed(0), 'minCover', minCover.toFixed(1)); }
// Höhen
for (const [n,x,z] of [['city',0,0],['harbor',-1900,0],['ind',900,1500],['kalmar top',1650,-1950],['ostwand',2250,0],['nord',-100,-2150],['bay',0,2150],['sea',-2500,0]]) console.log(n, W.terrainH(x,z).toFixed(1), W.zoneAt(x,z));
// Performance terrain
t0 = Date.now(); let s=0; for(let i=0;i<20000;i++){ s+=W.terrainH(-700+Math.random()*1400,-700+Math.random()*1400);} console.log('city terrainH us', (Date.now()-t0)/20*1000/1000, 'us/call'); 
t0 = Date.now(); for(let i=0;i<20000;i++){ s+=W.terrainH(1000+Math.random()*1400,-2500+Math.random()*1000);} console.log('mount terrainH us', (Date.now()-t0)/20, 'us/call');
// Route
const r1 = W.findRoute(0,0,-1900,40); console.log('route city->harbor', r1 && r1.map(p=>p.road.name+':'+p.s0.toFixed(0)+'>'+p.s1.toFixed(0)).join(' | '));
const poly = W.routePolyline(r1,8); console.log('polylen', poly[poly.length-1].s.toFixed(0), 'pts', poly.length);
const r2 = W.findRoute(0,0,1650,-1900); console.log('route city->kalmar', r2 && r2.length, W.routePolyline(r2,8).slice(-1)[0].s.toFixed(0));
const r3 = W.findRoute(-1900,0,2600,0); console.log('route harbor->hochwald', r3 && r3.length, r3 && W.routePolyline(r3,8).slice(-1)[0].s.toFixed(0));
