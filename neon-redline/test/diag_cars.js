const load = require('./node_env'); const ctx = load(['util.js','cars_data.js']); const CD = ctx.G.CD;
for (const s of CD.SPECS) { const st = CD.stats(s, CD.defaultCfg(s)); const e=CD.effective(s); const gb=CD.gearbox(e);
 console.log(s.name.padEnd(18), s.cls.padEnd(7), 'hp', String(st.hp).padStart(4), 'kg', st.mass, '0-100', st.t100.toFixed(1), 'vmax', st.vmax.toFixed(0), 'brk100', st.brake.toFixed(0)+'m', 'hand', st.handling.toFixed(1), 'PI', st.pi, st.cls, 'gears', gb.ratios.map(x=>x.toFixed(2)).join('/')); }
