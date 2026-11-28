const load = require('./node_env');
const ctx = load(['util.js','world_data.js']);
const G = ctx.G, W = G.World; W.init();
const find = n => W.Roads.list.find(r=>r.name===n);
for (const n of ['Kalmar-Zubringer','Kalmar-Passstraße','Diagonale NO']) { const r=find(n); console.log(n, 'stops', W.roadStops[r.id].map(e=>e.s.toFixed(0)+'@'+e.node.id).join(','), 'start', r.x[0].toFixed(0), r.z[0].toFixed(0), 'end', r.x[r.n-1].toFixed(0), r.z[r.n-1].toFixed(0)); }
const sn = W.snapToRoad(1650,-1900,500); console.log('snap', sn && sn.road.name, sn && sn.s, sn && sn.d);
const sn2 = W.snapToRoad(0,0,500); console.log('snap0', sn2.road.name, sn2.s);
const r2 = W.findRoute(0,0,1075,-1150); console.log('to pass start', r2 && r2.map(p=>p.road.name+':'+p.s0.toFixed(0)+'>'+p.s1.toFixed(0)).join(' | '));
// Brücke Daten
const br=find('A3 Süd (Meridian-Brücke)'); const idx=[]; for(let i=0;i<br.n;i++) if(br.flags[i]&2) idx.push(i); console.log('bridge s', br.s[idx[0]].toFixed(0), br.s[idx[idx.length-1]].toFixed(0), 'h', br.h[idx[0]].toFixed(1), br.h[idx[Math.floor(idx.length/2)]].toFixed(1), br.h[idx[idx.length-1]].toFixed(1));
const tn=W.tunnels[0]; console.log('tunnel0', tn.r.name, 'h in/out', tn.r.h[tn.a].toFixed(1), tn.r.h[tn.b].toFixed(1), 'terrain at portal in', W.terrainH(tn.r.x[tn.a],tn.r.z[tn.a]).toFixed(1), 'mid', W.terrainH(tn.r.x[(tn.a+tn.b)>>1],tn.r.z[(tn.a+tn.b)>>1]).toFixed(1), 'road mid', tn.r.h[(tn.a+tn.b)>>1].toFixed(1));
const tn1=W.tunnels[1]; console.log('tunnel1', tn1.r.name, 'h in/out', tn1.r.h[tn1.a].toFixed(1), tn1.r.h[tn1.b].toFixed(1), 'terrain portal in', W.terrainH(tn1.r.x[tn1.a],tn1.r.z[tn1.a]).toFixed(1), 'mid', W.terrainH(tn1.r.x[(tn1.a+tn1.b)>>1],tn1.r.z[(tn1.a+tn1.b)>>1]).toFixed(1), 'road mid', tn1.r.h[(tn1.a+tn1.b)>>1].toFixed(1));
const hs=find('Hochwald-Schleife'); console.log('loop h', hs.h[0].toFixed(1), 'A1 end', find('A1 Ost').h[find('A1 Ost').n-1].toFixed(1));
