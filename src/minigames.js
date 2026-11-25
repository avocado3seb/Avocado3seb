// Minispiele: Blackjack, Spielautomat, Roulette, Snake, Schießbude, Street Racer
import { h } from './ui.js';
import { G } from './state.js';
import { fmtMoney, clamp } from './util.js';

const money = () => G.player.money;
function betBar(ui, state, onChange) {
  const el = h('div', { class: 'sel', style: { margin: '8px 0' } });
  const render = () => el.replaceChildren(h('span', { class: 'd', style: { alignSelf: 'center' } }, 'Einsatz:'), ...[10, 50, 100, 500, 1000, 5000].map((v) => h('button', { class: state.bet === v ? 'on' : '', onClick: () => { state.bet = v; render(); onChange && onChange(); } }, fmtMoney(v))));
  render(); return el;
}

// ---------------- Blackjack ----------------
export function blackjack(ui) {
  const st = { bet: 100 }; let deck = [], pl = [], de = [], over = true, msg = 'Setze deinen Einsatz und gib Karten.';
  const area = h('div'); const info = h('div', { class: 'd', style: { margin: '8px 0', fontSize: '15px' } });
  const val = (hand) => { let t = 0, a = 0; for (const c of hand) { t += c.r === 'A' ? 11 : ['K', 'Q', 'J'].includes(c.r) ? 10 : +c.r; if (c.r === 'A') a++; } while (t > 21 && a--) t -= 10; return t; };
  const newDeck = () => { deck = []; for (const s of ['♠', '♥', '♦', '♣']) for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) deck.push({ s, r }); for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } };
  const card = (c, hide) => hide ? h('div', { class: 'pcard back' }) : h('div', { class: 'pcard' + (c.s === '♥' || c.s === '♦' ? ' red' : '') }, h('div', {}, c.r), h('div', {}, c.s));
  const finish = (res) => { over = true; const P = G.player; if (res === 'win') { P.addMoney(st.bet * (pl.length === 2 && val(pl) === 21 ? 1.5 : 1) + (st.doubled ? st.bet : 0)); G.audio?.cash(); msg = 'Du gewinnst!'; } else if (res === 'lose') { P.addMoney(-st.bet * (st.doubled ? 2 : 1)); msg = 'Das Haus gewinnt.'; } else msg = 'Unentschieden.'; ui.refreshCash(); draw(); };
  const dealerPlay = () => { while (val(de) < 17) de.push(deck.pop()); const p = val(pl), d = val(de); finish(d > 21 || p > d ? 'win' : p < d ? 'lose' : 'push'); };
  const deal = () => { if (money() < st.bet) return ui.toast('Nicht genug Geld!'); if (deck.length < 15) newDeck(); pl = [deck.pop(), deck.pop()]; de = [deck.pop(), deck.pop()]; over = false; st.doubled = false; msg = 'Karte oder halten?'; if (val(pl) === 21) { finish(val(de) === 21 ? 'push' : 'win'); return; } draw(); };
  const draw = () => {
    area.replaceChildren(h('div', {}, 'Dealer ' + (over ? `(${val(de)})` : '')), h('div', { class: 'cards' }, de.map((c, i) => card(c, !over && i === 1))), h('div', {}, `Du (${val(pl)})`), h('div', { class: 'cards' }, pl.map((c) => card(c))),
      h('div', { style: { display: 'flex', gap: '8px' } }, !over && h('button', { class: 'btn small primary', onClick: () => { pl.push(deck.pop()); if (val(pl) > 21) finish('lose'); else draw(); } }, 'Karte'), !over && h('button', { class: 'btn small', onClick: dealerPlay }, 'Halten'), !over && pl.length === 2 && h('button', { class: 'btn small gold', onClick: () => { if (money() < st.bet * 2) return ui.toast('Zu wenig Geld zum Verdoppeln'); st.doubled = true; pl.push(deck.pop()); if (val(pl) > 21) finish('lose'); else dealerPlay(); } }, 'Verdoppeln'), over && h('button', { class: 'btn small primary', onClick: deal }, 'Neue Runde')));
    info.textContent = msg;
  };
  newDeck(); draw();
  ui.modal('Blackjack', h('div', { class: 'body' }, betBar(ui, st), info, area));
}

// ---------------- Spielautomat ----------------
export function slots(ui) {
  const st = { bet: 50 }; const sym = ['🍒', '🍋', '🔔', '⭐', '7️⃣', '💎']; const reels = [h('div', { class: 'reel' }, '🍒'), h('div', { class: 'reel' }, '🍋'), h('div', { class: 'reel' }, '🔔')]; const msg = h('div', { class: 'd', style: { textAlign: 'center', fontSize: '16px' } }, 'Dreh das Rad!');
  let spinning = false;
  const spin = () => {
    if (spinning) return; if (money() < st.bet) return ui.toast('Nicht genug Geld!'); spinning = true; G.player.addMoney(-st.bet); ui.refreshCash();
    const res = [0, 0, 0].map(() => { const r = Math.random(); return r < 0.3 ? 0 : r < 0.55 ? 1 : r < 0.75 ? 2 : r < 0.9 ? 3 : r < 0.97 ? 4 : 5; });
    let t = 0; const iv = setInterval(() => { t++; reels.forEach((r, i) => { if (t < 12 + i * 8) r.textContent = sym[Math.floor(Math.random() * 6)]; else r.textContent = sym[res[i]]; }); G.audio?.hover(); if (t > 12 + 16 + 2) { clearInterval(iv); spinning = false; payout(res); } }, 70);
  };
  const payout = (r) => {
    let mult = 0; const [a, b, c] = r;
    if (a === b && b === c) mult = [10, 12, 18, 25, 60, 150][a]; else if (r.filter((x) => x === 0).length === 2) mult = 3; else if (r.includes(0)) mult = 1;
    if (mult) { G.player.addMoney(st.bet * mult); G.audio?.cash(); msg.textContent = `Gewinn: ${fmtMoney(st.bet * mult)} (×${mult})`; } else msg.textContent = 'Leider nichts.';
    ui.refreshCash();
  };
  ui.modal('Spielautomat', h('div', { class: 'body' }, betBar(ui, st), h('div', { class: 'reels' }, reels), msg, h('div', { style: { textAlign: 'center', marginTop: '10px' } }, h('button', { class: 'btn primary', onClick: spin }, '🎰 Drehen'))));
}

// ---------------- Roulette ----------------
export function roulette(ui) {
  const st = { bet: 100 }; const out = h('div', { style: { textAlign: 'center', fontSize: '42px', margin: '14px 0' } }, '🎡'); const msg = h('div', { class: 'd', style: { textAlign: 'center' } }, 'Wähle Rot, Schwarz oder die Null (×14).');
  const red = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const play = (choice) => {
    if (money() < st.bet) return ui.toast('Nicht genug Geld!'); const n = Math.floor(Math.random() * 37); const col = n === 0 ? 'green' : red.has(n) ? 'red' : 'black';
    out.textContent = n; out.style.color = col === 'red' ? '#ff5252' : col === 'green' ? '#69f0ae' : '#fff';
    if (col === choice) { const w = choice === 'green' ? st.bet * 14 : st.bet; G.player.addMoney(w); msg.textContent = `Gewonnen: ${fmtMoney(w)}`; G.audio?.cash(); } else { G.player.addMoney(-st.bet); msg.textContent = 'Verloren.'; }
    ui.refreshCash();
  };
  ui.modal('Roulette', h('div', { class: 'body' }, betBar(ui, st), out, msg, h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px' } }, h('button', { class: 'btn', style: { background: '#c62828' }, onClick: () => play('red') }, 'Rot'), h('button', { class: 'btn', style: { background: '#111' }, onClick: () => play('black') }, 'Schwarz'), h('button', { class: 'btn', style: { background: '#2e7d32' }, onClick: () => play('green') }, 'Null'))));
}

// ---------------- Arcade ----------------
function arcadeShell(ui, title, w, h2, run) {
  const cv = h('canvas', { width: w, height: h2 }); const info = h('div', { class: 'd', style: { textAlign: 'center' } }, 'Startet gleich …');
  const body = h('div', { class: 'body arcade' }, cv, info);
  let stop = null; const keys = new Set(); const kd = (e) => { keys.add(e.code); if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); }; const ku = (e) => keys.delete(e.code);
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  ui.modal(title, body, { onClose: () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); stop && stop(); } });
  stop = run(cv.getContext('2d'), cv, info, keys);
}
export function snake(ui) {
  arcadeShell(ui, 'Neon Snake', 400, 400, (ctx, cv, info, keys) => {
    const N = 20, S = 20; let sn = [{ x: 10, y: 10 }], dir = { x: 1, y: 0 }, food = { x: 5, y: 5 }, score = 0, alive = true, iv;
    const loop = () => {
      if (keys.has('ArrowUp') || keys.has('KeyW')) { if (dir.y === 0) dir = { x: 0, y: -1 }; } if (keys.has('ArrowDown') || keys.has('KeyS')) { if (dir.y === 0) dir = { x: 0, y: 1 }; }
      if (keys.has('ArrowLeft') || keys.has('KeyA')) { if (dir.x === 0) dir = { x: -1, y: 0 }; } if (keys.has('ArrowRight') || keys.has('KeyD')) { if (dir.x === 0) dir = { x: 1, y: 0 }; }
      if (alive) { const hd = { x: sn[0].x + dir.x, y: sn[0].y + dir.y }; if (hd.x < 0 || hd.y < 0 || hd.x >= N || hd.y >= N || sn.some((s) => s.x === hd.x && s.y === hd.y)) { alive = false; const win = score * 15; G.player.addMoney(win); ui.refreshCash(); info.textContent = `Game Over – Punkte ${score}, Gewinn ${fmtMoney(win)}`; clearInterval(iv); } else { sn.unshift(hd); if (hd.x === food.x && hd.y === food.y) { score++; food = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }; G.audio?.pickup(); } else sn.pop(); } }
      ctx.fillStyle = '#05020f'; ctx.fillRect(0, 0, 400, 400); ctx.strokeStyle = 'rgba(0,229,255,.12)'; for (let i = 0; i <= N; i++) { ctx.beginPath(); ctx.moveTo(i * S, 0); ctx.lineTo(i * S, 400); ctx.moveTo(0, i * S); ctx.lineTo(400, i * S); ctx.stroke(); }
      ctx.fillStyle = '#ff2bd6'; ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 12; ctx.fillRect(food.x * S + 3, food.y * S + 3, S - 6, S - 6);
      ctx.fillStyle = '#00e5ff'; ctx.shadowColor = '#00e5ff'; sn.forEach((s) => ctx.fillRect(s.x * S + 1, s.y * S + 1, S - 2, S - 2)); ctx.shadowBlur = 0;
      if (alive) info.textContent = `Punkte: ${score} · $15 pro Punkt · Pfeiltasten / WASD`;
    };
    iv = setInterval(loop, 110); return () => clearInterval(iv);
  });
}
export function shooting(ui) {
  arcadeShell(ui, 'Schießbude', 480, 320, (ctx, cv, info) => {
    let t = 30, score = 0, tg = [], raf, last = performance.now(), run = true, spawn = 0;
    cv.style.cursor = 'crosshair';
    cv.addEventListener('mousedown', (e) => { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * 480 / r.width, y = (e.clientY - r.top) * 320 / r.height; for (let i = tg.length - 1; i >= 0; i--) { if (Math.hypot(tg[i].x - x, tg[i].y - y) < tg[i].r) { score += tg[i].r < 22 ? 3 : 1; tg.splice(i, 1); G.audio?.hover(); break; } } });
    const loop = (now) => { if (!run) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; t -= dt; spawn -= dt; if (spawn <= 0 && t > 0) { spawn = 0.55; tg.push({ x: Math.random() * 440 + 20, y: Math.random() * 240 + 40, r: Math.random() < 0.3 ? 18 : 30, life: 1.4 }); } tg.forEach((q) => (q.life -= dt)); tg = tg.filter((q) => q.life > 0);
      ctx.fillStyle = '#10062a'; ctx.fillRect(0, 0, 480, 320); tg.forEach((q) => { ctx.fillStyle = q.r < 22 ? '#ffd54f' : '#ff2bd6'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * 0.45, 0, 7); ctx.fill(); });
      if (t <= 0) { run = false; const win = score * 8; G.player.addMoney(win); ui.refreshCash(); info.textContent = `Ende! Punkte ${score} – Gewinn ${fmtMoney(win)}`; return; } info.textContent = `Zeit ${t.toFixed(1)} s · Punkte ${score} · Klicke auf die Ziele`; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => { run = false; cancelAnimationFrame(raf); };
  });
}
export function racer(ui) {
  arcadeShell(ui, 'Street Racer', 300, 420, (ctx, cv, info, keys) => {
    let x = 150, dist = 0, obs = [], run = true, raf, last = performance.now(), sp = 200, spawn = 0;
    const loop = (now) => { if (!run) return; const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 240 * dt; if (keys.has('ArrowRight') || keys.has('KeyD')) x += 240 * dt; x = clamp(x, 25, 275); sp += dt * 6; dist += sp * dt * 0.05; spawn -= dt; if (spawn <= 0) { spawn = clamp(0.8 - sp / 1200, 0.25, 0.8); obs.push({ x: 25 + Math.random() * 250, y: -40, c: ['#ff5252', '#ffd54f', '#69f0ae', '#40c4ff'][Math.floor(Math.random() * 4)] }); }
      obs.forEach((o) => (o.y += sp * dt)); obs = obs.filter((o) => o.y < 460);
      ctx.fillStyle = '#16102e'; ctx.fillRect(0, 0, 300, 420); ctx.strokeStyle = '#fff'; ctx.setLineDash([20, 20]); ctx.lineDashOffset = -dist * 20; ctx.beginPath(); ctx.moveTo(100, 0); ctx.lineTo(100, 420); ctx.moveTo(200, 0); ctx.lineTo(200, 420); ctx.stroke(); ctx.setLineDash([]);
      obs.forEach((o) => { ctx.fillStyle = o.c; ctx.fillRect(o.x - 14, o.y - 24, 28, 48); });
      ctx.fillStyle = '#00e5ff'; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 12; ctx.fillRect(x - 14, 360, 28, 48); ctx.shadowBlur = 0;
      if (obs.some((o) => Math.abs(o.x - x) < 26 && Math.abs(o.y - 384) < 46)) { run = false; const win = Math.min(2000, Math.round(dist * 3)); G.player.addMoney(win); ui.refreshCash(); info.textContent = `Crash! ${Math.round(dist)} m – Gewinn ${fmtMoney(win)}`; return; }
      info.textContent = `Distanz ${Math.round(dist)} m · A/D oder Pfeile`; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => { run = false; cancelAnimationFrame(raf); };
  });
}
