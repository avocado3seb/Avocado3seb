// Cloudflare Worker + Durable Object: WebSocket-Relay für den Online-Modus.
// Ein Raum (Code) = eine Durable-Object-Instanz. Der Host hält die Simulation, Gäste sprechen nur mit dem Host.
// Protokoll:
//   Gast → DO:  beliebige JSON-Nachricht            → Host erhält {c: <gastId>, d: nachricht}
//   Host → DO:  {to: <gastId>|'*', except?: id, d}  → Gast/Gäste erhalten {d: nachricht}
//   DO → Host:  {r:'open', c} / {r:'close', c}      (Gast verbunden / getrennt)
//   DO → Gast:  {r:'nohost'} wenn kein Host im Raum, {r:'full'} wenn voll
const MAX_GUESTS = 11, MAX_MSG = 32 * 1024;
const ORIGIN_OK = /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?|https:\/\/[a-z0-9-]+\.github\.io)$/i;

const ORIGIN_RE = ORIGIN_OK;
const cors = (req, env) => { const o = req.headers.get('Origin'); const ok = o && (ORIGIN_RE.test(o) || (env.ALLOWED_ORIGIN && o === env.ALLOWED_ORIGIN)); return ok ? { 'access-control-allow-origin': o, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', 'access-control-max-age': '86400', vary: 'Origin' } : {}; };
const json = (obj, status, h = {}) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json', ...h } });
const isLocal = o => !o || /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/i.test(o);

export default {
  async fetch(req, env) {
    const url = new URL(req.url), origin = req.headers.get('Origin'), ch = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
    if (url.pathname === '/health') return new Response('ok', { headers: { 'access-control-allow-origin': '*' } });
    if (url.pathname.startsWith('/api/')) { // Konten & Cloud-Speicherstände (ein Durable Object)
      if (origin && !ORIGIN_RE.test(origin) && !(env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN)) return json({ error: 'Origin nicht erlaubt' }, 403);
      const r = await env.ACC.get(env.ACC.idFromName('accounts')).fetch(req);
      const h = new Headers(r.headers); for (const [k, v] of Object.entries(ch)) h.set(k, v); return new Response(r.body, { status: r.status, headers: h });
    }
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/i);
    if (!m) return new Response('Europa Coaster Simulator relay', { status: 200 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket erwartet', { status: 426 });
    if (origin && !ORIGIN_RE.test(origin) && !(env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN)) return new Response('Origin nicht erlaubt', { status: 403 });
    // Anmeldung: Token prüfen (nur lokale Tests ohne Konto erlaubt)
    let user = '';
    const token = url.searchParams.get('token');
    if (token) {
      const v = await env.ACC.get(env.ACC.idFromName('accounts')).fetch(new Request('https://acc/internal/verify?token=' + encodeURIComponent(token)));
      if (!v.ok) return new Response('Nicht angemeldet', { status: 401 });
      user = (await v.json()).name;
    } else if (!isLocal(origin)) return new Response('Anmeldung erforderlich', { status: 401 });
    const id = env.ROOM.idFromName(m[1].toUpperCase());
    const h = new Headers(req.headers); h.set('x-user', user);
    return env.ROOM.get(id).fetch(new Request(req, { headers: h }));
  },
};

const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = s => new Uint8Array(s.match(/../g).map(x => parseInt(x, 16)));
async function derive(pw, salt) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']); return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, k, 256)); }
const NAME_RE = /^[A-Za-z0-9ÄÖÜäöüß_.\- ]{3,14}$/;

export class Accounts {
  constructor(state) { this.st = state.storage; }
  async fetch(req) {
    const url = new URL(req.url), p = url.pathname, st = this.st;
    if (p === '/internal/verify') { const t = url.searchParams.get('token') || ''; const s = await st.get('s:' + t); if (!s || s.exp < Date.now()) return json({ error: 'ungültig' }, 401); return json({ name: s.name }); }
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
    if (p === '/api/register' || p === '/api/login') {
      if (req.method !== 'POST') return json({ error: 'POST erwartet' }, 405);
      let b; try { b = await req.json(); } catch (e) { return json({ error: 'Ungültige Anfrage' }, 400); }
      const name = String(b.name || '').trim(), pw = String(b.password || ''), key = 'u:' + name.toLowerCase();
      if (!NAME_RE.test(name)) return json({ error: 'Name: 3–14 Zeichen (Buchstaben, Zahlen, _ . - Leerzeichen)' }, 400);
      if (pw.length < 6 || pw.length > 72) return json({ error: 'Passwort: mindestens 6 Zeichen' }, 400);
      const lock = await st.get('l:' + name.toLowerCase()); if (lock && lock.until > Date.now()) return json({ error: 'Zu viele Versuche – bitte kurz warten' }, 429);
      let acc = await st.get(key);
      if (p === '/api/register') {
        if (acc) return json({ error: 'Name ist schon vergeben' }, 409);
        const salt = crypto.getRandomValues(new Uint8Array(16)); acc = { name, salt: hex(salt), hash: await derive(pw, salt), created: Date.now() }; await st.put(key, acc);
      } else {
        const ok = acc && (await derive(pw, unhex(acc.salt))) === acc.hash;
        if (!ok) { const l = (lock && lock.until > Date.now() - 600000 ? lock.n : 0) + 1; await st.put('l:' + name.toLowerCase(), { n: l, until: l >= 5 ? Date.now() + 30000 : 0 }); return json({ error: 'Name oder Passwort falsch' }, 401); }
        await st.delete('l:' + name.toLowerCase());
      }
      const token = hex(crypto.getRandomValues(new Uint8Array(24))); await st.put('s:' + token, { name: acc.name, exp: Date.now() + 30 * 86400000 });
      return json({ token, name: acc.name });
    }
    const sess = bearer ? await st.get('s:' + bearer) : null;
    if (!sess || sess.exp < Date.now()) return json({ error: 'Nicht angemeldet' }, 401);
    if (p === '/api/me') return json({ name: sess.name });
    if (p === '/api/logout') { await st.delete('s:' + bearer); return json({ ok: true }); }
    if (p === '/api/save') {
      const k = 'd:' + sess.name.toLowerCase();
      if (req.method === 'GET') return json({ data: (await st.get(k)) || null });
      if (req.method === 'PUT') { const t = await req.text(); if (t.length > 300000) return json({ error: 'Zu groß' }, 413); let d; try { d = JSON.parse(t); } catch (e) { return json({ error: 'JSON' }, 400); } await st.put(k, { at: Date.now(), data: d.data }); return json({ ok: true }); }
    }
    return json({ error: 'Nicht gefunden' }, 404);
  }
}

export class Room {
  constructor(state) { this.state = state; this.host = null; this.guests = new Map(); this.next = 1; }
  async fetch(req) {
    const role = new URL(req.url).searchParams.get('role') === 'host' ? 'host' : 'guest', user = req.headers.get('x-user') || '';
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    server.accept();
    const refuse = (msg) => { try { server.send(JSON.stringify(msg)); } catch (e) { /* */ } server.close(1000, msg.r); };
    if (role === 'host') {
      if (this.host) { refuse({ r: 'taken' }); return new Response(null, { status: 101, webSocket: client }); }
      this.host = server;
      server.addEventListener('message', ev => this.fromHost(ev));
      const gone = () => { if (this.host === server) { this.host = null; for (const g of this.guests.values()) { try { g.close(1000, 'host-left'); } catch (e) { /* */ } } this.guests.clear(); } };
      server.addEventListener('close', gone); server.addEventListener('error', gone);
      server.send(JSON.stringify({ r: 'hosting', u: user }));
    } else {
      if (!this.host) { refuse({ r: 'nohost' }); return new Response(null, { status: 101, webSocket: client }); }
      if (this.guests.size >= MAX_GUESTS) { refuse({ r: 'full' }); return new Response(null, { status: 101, webSocket: client }); }
      const cid = this.next++; this.guests.set(cid, server);
      this.hostSend({ r: 'open', c: cid, u: user });
      server.addEventListener('message', ev => {
        if (typeof ev.data !== 'string' || ev.data.length > MAX_MSG) return;
        let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
        this.hostSend({ c: cid, d });
      });
      const gone = () => { if (this.guests.get(cid) === server) { this.guests.delete(cid); this.hostSend({ r: 'close', c: cid }); } };
      server.addEventListener('close', gone); server.addEventListener('error', gone);
    }
    return new Response(null, { status: 101, webSocket: client });
  }
  hostSend(obj) { if (this.host) { try { this.host.send(JSON.stringify(obj)); } catch (e) { /* */ } } }
  fromHost(ev) {
    if (typeof ev.data !== 'string' || ev.data.length > MAX_MSG) return;
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    const out = JSON.stringify({ d: m.d });
    if (m.to === '*') { for (const [id, g] of this.guests) if (id !== m.except) { try { g.send(out); } catch (e) { /* */ } } }
    else { const g = this.guests.get(m.to); if (g) { try { g.send(out); } catch (e) { /* */ } } }
  }
}
