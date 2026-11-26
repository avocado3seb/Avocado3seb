// Cloudflare Worker + Durable Object: WebSocket-Relay für den Online-Modus.
// Ein Raum (Code) = eine Durable-Object-Instanz. Der Host hält die Simulation, Gäste sprechen nur mit dem Host.
// Protokoll:
//   Gast → DO:  beliebige JSON-Nachricht            → Host erhält {c: <gastId>, d: nachricht}
//   Host → DO:  {to: <gastId>|'*', except?: id, d}  → Gast/Gäste erhalten {d: nachricht}
//   DO → Host:  {r:'open', c} / {r:'close', c}      (Gast verbunden / getrennt)
//   DO → Gast:  {r:'nohost'} wenn kein Host im Raum, {r:'full'} wenn voll
const MAX_GUESTS = 11, MAX_MSG = 32 * 1024;
const ORIGIN_OK = /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?|https:\/\/[a-z0-9-]+\.github\.io)$/i;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok', { headers: { 'access-control-allow-origin': '*' } });
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/i);
    if (!m) return new Response('Europa Coaster Simulator relay', { status: 200 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket erwartet', { status: 426 });
    const origin = req.headers.get('Origin');
    if (origin && !ORIGIN_OK.test(origin) && !(env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN)) return new Response('Origin nicht erlaubt', { status: 403 });
    const id = env.ROOM.idFromName(m[1].toUpperCase());
    return env.ROOM.get(id).fetch(req);
  },
};

export class Room {
  constructor(state) { this.state = state; this.host = null; this.guests = new Map(); this.next = 1; }
  async fetch(req) {
    const role = new URL(req.url).searchParams.get('role') === 'host' ? 'host' : 'guest';
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    server.accept();
    const refuse = (msg) => { try { server.send(JSON.stringify(msg)); } catch (e) { /* */ } server.close(1000, msg.r); };
    if (role === 'host') {
      if (this.host) { refuse({ r: 'taken' }); return new Response(null, { status: 101, webSocket: client }); }
      this.host = server;
      server.addEventListener('message', ev => this.fromHost(ev));
      const gone = () => { if (this.host === server) { this.host = null; for (const g of this.guests.values()) { try { g.close(1000, 'host-left'); } catch (e) { /* */ } } this.guests.clear(); } };
      server.addEventListener('close', gone); server.addEventListener('error', gone);
      server.send(JSON.stringify({ r: 'hosting' }));
    } else {
      if (!this.host) { refuse({ r: 'nohost' }); return new Response(null, { status: 101, webSocket: client }); }
      if (this.guests.size >= MAX_GUESTS) { refuse({ r: 'full' }); return new Response(null, { status: 101, webSocket: client }); }
      const cid = this.next++; this.guests.set(cid, server);
      this.hostSend({ r: 'open', c: cid });
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
