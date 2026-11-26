// ============================================================================
//  pl_editor.js – Achterbahn-Editor: Bausteine (Lift, Abfahrt, Loop, Korkenzieher, Helix, Launch,
//  Bremse …) aneinanderreihen, Parameter einstellen, Vorschau + Kennzahlen, Testfahrt,
//  Speichern / Laden / Löschen, Undo / Redo. Intern wird die Layout-Sprache der Streckenengine erzeugt.
// ============================================================================
import { buildTrack } from './track.js';
import { Sim } from './physics.js';
import { CATS } from './specs.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// key: Token, label, Gruppe, Parameter [Name, min, max, Schritt, Standard]
const DEFS = [
  ['S', 'Gerade', 'Strecke', [['Länge m', 4, 150, 2, 20]], '↔'],
  ['LIFT', 'Kettenlift', 'Antrieb', [['Höhe m', 6, 100, 1, 40], ['Winkel °', 15, 60, 1, 38], ['Tempo m/s', 1.5, 6, .1, 3.2]], '⛓'],
  ['LAUNCH', 'Launch (Katapult)', 'Antrieb', [['Länge m', 20, 120, 2, 60], ['km/h', 30, 160, 2, 90]], '🚀'],
  ['BRAKE', 'Bremse', 'Antrieb', [['Länge m', 8, 80, 2, 24], ['m/s', 1, 10, .5, 4]], '🛑'],
  ['DROP', 'Abfahrt', 'Strecke', [['Höhe m', 4, 100, 1, 35], ['Winkel °', 20, 85, 1, 58]], '⤵'],
  ['CLIMB', 'Anstieg', 'Strecke', [['Höhe m', 3, 60, 1, 18], ['Winkel °', 10, 50, 1, 28]], '⤴'],
  ['HILL', 'Airtime-Hügel', 'Strecke', [['Höhe m', -12, 40, 1, 12], ['Länge m', 20, 140, 2, 70]], '⛰'],
  ['TR', 'Kurve rechts', 'Kurven', [['Grad', 20, 360, 5, 90], ['Radius m', 10, 120, 1, 40], ['Neigung °', 0, 80, 1, 40]], '↱'],
  ['TL', 'Kurve links', 'Kurven', [['Grad', 20, 360, 5, 90], ['Radius m', 10, 120, 1, 40], ['Neigung °', 0, 80, 1, 40]], '↰'],
  ['HELR', 'Helix rechts', 'Kurven', [['Umdrehungen', 0.5, 3, .25, 1], ['Radius m', 10, 60, 1, 24], ['Neigung °', 0, 75, 1, 50], ['Höhenverlust m', 0, 40, 1, 8]], '🌀'],
  ['HELL', 'Helix links', 'Kurven', [['Umdrehungen', 0.5, 3, .25, 1], ['Radius m', 10, 60, 1, 24], ['Neigung °', 0, 75, 1, 50], ['Höhenverlust m', 0, 40, 1, 8]], '🌀'],
  ['LOOP', 'Looping', 'Inversionen', [['Höhe m', 14, 60, 1, 28]], '⭕'],
  ['CORK', 'Korkenzieher', 'Inversionen', [['Länge m', 24, 90, 2, 48], ['Radius m', 3, 12, .5, 6]], '🔩'],
  ['BARREL', 'Zero-G-Roll', 'Inversionen', [['Länge m', 24, 100, 2, 52], ['Höhe m', 2, 12, .5, 6]], '🌌'],
  ['IMM', 'Immelmann', 'Inversionen', [['Höhe m', 12, 50, 1, 24]], '↺'],
  ['DIVE', 'Dive Loop', 'Inversionen', [['Höhe m', 12, 50, 1, 24]], '⤵'],
  ['COBRA', 'Cobra Roll', 'Inversionen', [['Höhe m', 12, 40, 1, 24]], '🐍'],
  ['TOPHAT', 'Top Hat', 'Strecke', [['Höhe m', 25, 90, 1, 55], ['Radius m', 8, 25, 1, 14]], '🎩'],
  ['ROLL', 'Schräglage', 'Strecke', [['Neigung °', -90, 90, 5, 0], ['Länge m', 8, 60, 2, 20]], '⟲'],
  ['HOME', 'Rückführung + Bremse', 'Antrieb', [['Neigung °', 0, 70, 1, 45], ['Bremse m', 10, 60, 2, 30]], '🏠'],
];
const BY = Object.fromEntries(DEFS.map(d => [d[0], d]));
const TEMPLATES = {
  'Familienbahn': { cat: 'family', e: [['LIFT', [14, 30, 2.4]], ['DROP', [14, 40]], ['TR', [180, 22, 30]], ['HILL', [3, 40]], ['HOME', [22, 30]]] },
  'Looping-Bahn': { cat: 'sitdown', e: [['LIFT', [30, 35, 3.2]], ['DROP', [30, 52]], ['LOOP', [22]], ['CORK', [60, 5.5]], ['HILL', [5, 60]], ['TR', [180, 36, 55]], ['HILL', [6, 70]], ['BARREL', [70, 5]], ['HOME', [36, 50]]] },
  'Launch-Coaster': { cat: 'launch', e: [['LAUNCH', [45, 90]], ['CLIMB', [20, 40, 40]], ['DROP', [20, 50]], ['HILL', [10, 100]], ['TR', [90, 40, 55]], ['HILL', [12, 100]], ['TL', [90, 40, 55]], ['TR', [180, 45, 55]], ['HILL', [12, 100]], ['HOME', [45, 50]]] },
};
const CAT_LIST = Object.entries(CATS);

export class Editor {
  constructor(app) { this.app = app; this.d = { name: 'Meine Bahn', cat: 'sitdown', tc: '#e8202e', sc: '#e8e8ee', tr: '#e8202e', elems: TEMPLATES['Looping-Bahn'].e.map(([k, p]) => ({ k, p: p.slice() })) }; this.undoS = []; this.redoS = []; this.drop = null; }

  layout() { return 'ST ' + this.d.elems.map(e => e.k + (e.p.length ? ':' + e.p.join(':') : '')).join(' '); }
  snap() { this.undoS.push(JSON.stringify(this.d.elems)); if (this.undoS.length > 80) this.undoS.shift(); this.redoS = []; }
  undo() { if (!this.undoS.length) return; this.redoS.push(JSON.stringify(this.d.elems)); this.d.elems = JSON.parse(this.undoS.pop()); this.refresh(); }
  redo() { if (!this.redoS.length) return; this.undoS.push(JSON.stringify(this.d.elems)); this.d.elems = JSON.parse(this.redoS.pop()); this.refresh(); }

  analyse() {
    const d = this.d, spec = CATS[d.cat], out = { err: null };
    try {
      const tr = buildTrack(this.layout(), { trainLen: spec.cars * spec.spacing });
      const sim = new Sim(tr, { cars: spec.cars, spacing: spec.spacing, crr: spec.crr }); sim.timer = 0.1; let t = 0;
      while (sim.lap < 1 && t < 600) { sim.step(1 / 30); t += 1 / 30; }
      const st = sim.lastLapStats || sim.stats;
      Object.assign(out, { tr, len: tr.L, h: tr.bounds.maxY - tr.bounds.minY, v: st.maxV * 3.6, gmax: st.maxG, gmin: st.minG, inv: tr.inversions, t: t, assist: st.assist, conn: tr.connLen, warn: tr.warn || [], stalled: t >= 600 });
    } catch (e) { out.err = e.message || String(e); }
    return out;
  }
  verdict(m) {
    const o = [];
    if (m.err) return [['bad', 'Fehler im Layout: ' + m.err]];
    if (m.stalled) o.push(['bad', 'Der Zug schafft die Runde nicht (zu wenig Energie) – Lift/Launch erhöhen oder Elemente verkleinern.']);
    else if (m.assist > 3) o.push(['warn', `Der Zug muss ${m.assist.toFixed(0)} s „angeschoben“ werden – mehr Anfangshöhe oder Launch nötig.`]);
    if (m.gmax > 6.5) o.push(['warn', `Hohe Belastung: ${m.gmax.toFixed(1)} G (Looping/Kurven weiter machen).`]);
    if (m.gmin < -1.8) o.push(['warn', `Starke negative G: ${m.gmin.toFixed(1)} G.`]);
    if (m.conn > 160) o.push(['warn', `Der automatische Rückweg ist ${m.conn.toFixed(0)} m lang – füge eine Rückführung (HOME) ein.`]);
    if (m.tr && m.tr.bounds.minY < -0.5) o.push(['warn', 'Teile der Strecke liegen unter dem Boden.']);
    for (const w of m.warn) o.push(['warn', w]);
    if (!o.length) o.push(['ok', 'Layout gültig – bereit für die Testfahrt.']);
    return o;
  }

  build(body, back) {
    const a = this.app, g = a.game;
    body.innerHTML = `<div class="card page ed"><div class="pghead">${back}<h3>🛠 Achterbahn-Editor</h3><span class="note">Bausteine aneinanderreihen – die Strecke schließt sich automatisch zur Station.</span></div>
      <div class="edgrid">
        <div class="card edpal"><h4>Bausteine</h4><div id="edPal"></div><h4>Vorlagen</h4><div id="edTpl"></div></div>
        <div class="edmid">
          <div class="edtool"><label>Name <input id="edName" maxlength="24"></label><label>Zugmodell <select id="edCat">${CAT_LIST.map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></label>
            <label>Schiene <input type="color" id="edTc"></label><label>Stützen <input type="color" id="edSc"></label><label>Zug <input type="color" id="edTr"></label></div>
          <div class="edtool"><button class="btn sm" id="edUndo">↶ Undo</button><button class="btn sm" id="edRedo">↷ Redo</button><button class="btn sm" id="edClear">🗑 Leeren</button><button class="btn sm" id="edDup">⎘ Letztes duplizieren</button></div>
          <div class="edlist" id="edList"></div>
          <div class="edtool"><button class="btn pri" id="edTest">▶ Testfahrt</button><button class="btn blue" id="edSave">💾 Speichern</button><button class="btn" id="edCopy">📋 Layout kopieren</button></div>
        </div>
        <div class="edright"><div class="card" style="padding:10px"><h4>Vorschau</h4><canvas id="edTop" width="380" height="190"></canvas><canvas id="edSide" width="380" height="90"></canvas><div class="stats" id="edMet" style="grid-template-columns:repeat(3,1fr)"></div><div id="edVer"></div></div>
          <div class="card" style="padding:10px"><h4>Gespeicherte Bahnen</h4><div id="edSaved"></div></div></div>
      </div></div>`;
    const pal = $('#edPal'); const groups = [...new Set(DEFS.map(d => d[2]))];
    pal.innerHTML = groups.map(gr => `<div class="grp">${gr}</div>` + DEFS.filter(d => d[2] === gr).map(d => `<button class="btn sm pb" data-k="${d[0]}" title="${d[1]}">${d[4]} ${d[1]}</button>`).join('')).join('');
    pal.querySelectorAll('.pb').forEach(b => b.addEventListener('click', () => { const df = BY[b.dataset.k]; this.snap(); this.d.elems.push({ k: df[0], p: df[3].map(x => x[4]) }); this.refresh(); }));
    $('#edTpl').innerHTML = Object.keys(TEMPLATES).map(k => `<button class="btn sm pb" data-tp="${k}">📄 ${k}</button>`).join('');
    $('#edTpl').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { const T = TEMPLATES[b.dataset.tp]; this.snap(); this.d.elems = T.e.map(([k, p]) => ({ k, p: p.slice() })); this.d.cat = T.cat; $('#edCat').value = T.cat; this.refresh(); }));
    const d = this.d; $('#edName').value = d.name; $('#edCat').value = d.cat; $('#edTc').value = d.tc; $('#edSc').value = d.sc; $('#edTr').value = d.tr;
    $('#edName').addEventListener('input', e => d.name = e.target.value); $('#edCat').addEventListener('change', e => { d.cat = e.target.value; this.refreshMetrics(); });
    $('#edTc').addEventListener('input', e => { d.tc = e.target.value; d.tr = e.target.value; $('#edTr').value = d.tr; }); $('#edSc').addEventListener('input', e => d.sc = e.target.value); $('#edTr').addEventListener('input', e => d.tr = e.target.value);
    $('#edUndo').addEventListener('click', () => this.undo()); $('#edRedo').addEventListener('click', () => this.redo());
    $('#edClear').addEventListener('click', () => { this.snap(); d.elems = []; this.refresh(); });
    $('#edDup').addEventListener('click', () => { const l = d.elems[d.elems.length - 1]; if (l) { this.snap(); d.elems.push({ k: l.k, p: l.p.slice() }); this.refresh(); } });
    $('#edTest').addEventListener('click', () => this.test());
    $('#edSave').addEventListener('click', () => this.save());
    $('#edCopy').addEventListener('click', () => { try { navigator.clipboard.writeText(this.layout()); a.ui.toast('Layout kopiert – im Tab „Eigene Bahn“ einsetzbar'); } catch (e) { a.ui.toast(this.layout(), 6000); } });
    this.refresh(); this.refreshSaved();
  }

  refresh() {
    const list = $('#edList'); if (!list) return;
    list.innerHTML = `<div class="el st"><span class="n">0</span><b>🚉 Station</b><span class="note">Start/Ziel – fest</span></div>` + this.d.elems.map((e, i) => {
      const df = BY[e.k];
      return `<div class="el" data-i="${i}"><span class="n">${i + 1}</span><b>${df[4]} ${df[1]}</b>${df[3].map((p, j) => `<label>${p[0]}<input type="number" data-j="${j}" min="${p[1]}" max="${p[2]}" step="${p[3]}" value="${e.p[j]}"></label>`).join('')}<span class="ctl"><button class="btn sm" data-a="up">▲</button><button class="btn sm" data-a="dn">▼</button><button class="btn sm" data-a="del">✖</button></span></div>`;
    }).join('') || '<div class="note" style="padding:12px">Noch keine Bausteine – wähle links welche aus (oder eine Vorlage).</div>';
    list.querySelectorAll('.el[data-i]').forEach(el => {
      const i = +el.dataset.i;
      el.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => { const df = BY[this.d.elems[i].k][3][+inp.dataset.j]; let v = +inp.value; if (Number.isNaN(v)) v = df[4]; v = Math.max(df[1], Math.min(df[2], v)); inp.value = v; this.snap(); this.d.elems[i].p[+inp.dataset.j] = v; this.refreshMetrics(); }));
      el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.a, E = this.d.elems; this.snap();
        if (act === 'del') E.splice(i, 1); else if (act === 'up' && i > 0) [E[i - 1], E[i]] = [E[i], E[i - 1]]; else if (act === 'dn' && i < E.length - 1) [E[i + 1], E[i]] = [E[i], E[i + 1]];
        this.refresh();
      }));
    });
    this.refreshMetrics();
  }

  refreshMetrics() {
    const m = this.analyse(); this.m = m;
    const met = $('#edMet'), ver = $('#edVer'); if (!met) return;
    const f = (v, d = 0) => v === undefined ? '–' : v.toFixed(d);
    met.innerHTML = m.err ? '' : `<div class="stat"><b>${f(m.len)} m</b><small>Länge</small></div><div class="stat"><b>${f(m.h)} m</b><small>Höhe</small></div><div class="stat"><b>${f(m.v)}</b><small>km/h max</small></div><div class="stat"><b>${f(m.gmax, 1)}</b><small>G max</small></div><div class="stat"><b>${m.inv}</b><small>Inversionen</small></div><div class="stat"><b>${Math.floor(m.t / 60)}:${String(Math.round(m.t % 60)).padStart(2, '0')}</b><small>Fahrzeit</small></div>`;
    ver.innerHTML = this.verdict(m).map(([c, t]) => `<div class="vd ${c}">${c === 'ok' ? '✔' : c === 'bad' ? '✖' : '⚠'} ${esc(t)}</div>`).join('');
    this.preview(m);
  }

  preview(m) {
    const top = $('#edTop'), side = $('#edSide'); if (!top) return;
    const g = top.getContext('2d'), w = top.width, h = top.height; g.clearRect(0, 0, w, h);
    const g2 = side.getContext('2d'), w2 = side.width, h2 = side.height; g2.clearRect(0, 0, w2, h2);
    if (m.err || !m.tr) { g.fillStyle = '#ff7a7a'; g.font = '13px sans-serif'; g.fillText('Keine Vorschau', 10, 24); return; }
    const tr = m.tr, b = tr.bounds, sx = (w - 30) / Math.max(10, b.maxX - b.minX), sz = (h - 30) / Math.max(10, b.maxZ - b.minZ), s = Math.min(sx, sz);
    const ox = (w - (b.maxX - b.minX) * s) / 2 - b.minX * s, oz = (h - (b.maxZ - b.minZ) * s) / 2 - b.minZ * s, hmax = Math.max(1, b.maxY);
    g.lineWidth = 2.4; g.lineCap = 'round';
    for (let i = 0; i < tr.N; i += 2) { const j = (i + 2) % tr.N, t = tr.P[i * 3 + 1] / hmax; g.strokeStyle = `hsl(${200 - t * 170},85%,${52 + t * 8}%)`; g.beginPath(); g.moveTo(tr.P[i * 3] * s + ox, tr.P[i * 3 + 2] * s + oz); g.lineTo(tr.P[j * 3] * s + ox, tr.P[j * 3 + 2] * s + oz); g.stroke(); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ox, oz, 3.5, 0, 7); g.fill(); g.font = '11px sans-serif'; g.fillText('Station', ox + 5, oz - 6);
    g2.strokeStyle = 'rgba(255,255,255,.15)'; g2.beginPath(); g2.moveTo(0, h2 - 12.5); g2.lineTo(w2, h2 - 12.5); g2.stroke(); g2.beginPath(); g2.strokeStyle = this.d.tc; g2.lineWidth = 2;
    for (let i = 0; i < tr.N; i++) { const x = i / tr.N * (w2 - 10) + 5, y = h2 - 12 - tr.P[i * 3 + 1] / hmax * (h2 - 24); if (i) g2.lineTo(x, y); else g2.moveTo(x, y); }
    g2.stroke();
  }

  row(name) {
    const m = this.m || this.analyse(), d = this.d;
    return [name, d.cat, 'Eigenbau (Editor)', new Date().getFullYear(), Math.round(m.h || 20), Math.round(m.len || 500), Math.round(m.v || 60), Math.round(m.t || 90), m.inv || 0, { tc: d.tc, sc: d.sc, tr: d.tr, layout: this.layout() }];
  }
  test() {
    const a = this.app, m = this.m || this.analyse();
    if (m.err) return a.ui.toast('Layout fehlerhaft: ' + m.err, 4000);
    const nm = (this.d.name || 'Meine Bahn').trim() || 'Meine Bahn'; a.audio.start();
    a.setCustomRows('Meine Bahnen', [this.row(nm)], nm).then(c => { if (c) a.openRide(c); });
  }
  save() {
    const g = this.app.game, d = this.d, nm = (d.name || 'Meine Bahn').trim() || 'Meine Bahn';
    const rec = { id: Date.now(), name: nm, cat: d.cat, tc: d.tc, sc: d.sc, tr: d.tr, elems: JSON.parse(JSON.stringify(d.elems)), t: new Date().toLocaleString('de-DE') };
    const i = g.designs.findIndex(x => x.name === nm); if (i >= 0) g.designs[i] = rec; else g.designs.unshift(rec);
    g.saveDesigns(); this.refreshSaved(); this.app.ui.toast('💾 Gespeichert: ' + nm);
  }
  refreshSaved() {
    const el = $('#edSaved'); if (!el) return; const g = this.app.game;
    el.innerHTML = g.designs.length ? g.designs.map(r => `<div class="row2"><span style="flex:1"><b>${esc(r.name)}</b><div class="note">${esc(CATS[r.cat] ? CATS[r.cat].label : r.cat)} · ${r.elems.length} Bausteine · ${esc(r.t)}</div></span><button class="btn blue sm" data-l="${r.id}">Laden</button><button class="btn sm" data-x="${r.id}">🗑</button></div>`).join('') : '<div class="note">Noch nichts gespeichert.</div>';
    el.querySelectorAll('[data-l]').forEach(b => b.addEventListener('click', () => { const r = g.designs.find(x => x.id === +b.dataset.l); if (!r) return; this.snap(); Object.assign(this.d, { name: r.name, cat: r.cat, tc: r.tc, sc: r.sc, tr: r.tr, elems: JSON.parse(JSON.stringify(r.elems)) }); $('#edName').value = r.name; $('#edCat').value = r.cat; $('#edTc').value = r.tc; $('#edSc').value = r.sc; $('#edTr').value = r.tr; this.refresh(); }));
    el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => { g.designs = g.designs.filter(x => x.id !== +b.dataset.x); g.saveDesigns(); this.refreshSaved(); }));
  }
}
