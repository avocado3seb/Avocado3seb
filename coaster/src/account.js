// ============================================================================
//  account.js – Konto (Name + Passwort) über den Cloudflare-Worker, Sitzung im Browser,
//  Cloud-Speicherstand (ohne Fotos). Passwörter werden nur serverseitig als PBKDF2-Hash gespeichert.
// ============================================================================
const KEY = 'ecs_session';
const BASE = 'https://ecs-relay.jonathanrontgen7.workers.dev';

export class Account {
  constructor() {
    this.name = ''; this.token = ''; this.guest = false; this.syncT = null;
    const q = new URLSearchParams(location.search), local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    this.bypass = navigator.webdriver || (local && !q.has('login')) || q.get('guest') === '1'; // automatisierte Tests / lokale Entwicklung
    this.base = q.get('api') || BASE;
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.token) { this.token = s.token; this.name = s.name; } } catch (e) { /* */ }
  }
  get loggedIn() { return !!this.token || this.guest; }
  get required() { return !this.bypass; }
  async api(path, opt = {}) {
    const r = await fetch(this.base + path, { ...opt, headers: { 'content-type': 'application/json', ...(this.token ? { authorization: 'Bearer ' + this.token } : {}), ...(opt.headers || {}) } });
    let j = {}; try { j = await r.json(); } catch (e) { /* */ }
    if (!r.ok) throw new Error(j.error || 'Fehler ' + r.status);
    return j;
  }
  async verify() { if (!this.token) return false; try { const j = await this.api('/api/me'); this.name = j.name; return true; } catch (e) { if (/Nicht angemeldet/.test(e.message)) { this.clear(); } return !!this.token; /* Server nicht erreichbar → Sitzung behalten */ } }
  async auth(kind, name, password) { const j = await this.api('/api/' + kind, { method: 'POST', body: JSON.stringify({ name, password }) }); this.token = j.token; this.name = j.name; try { localStorage.setItem(KEY, JSON.stringify({ token: this.token, name: this.name })); } catch (e) { /* */ } return j; }
  clear() { this.token = ''; this.name = ''; this.guest = false; try { localStorage.removeItem(KEY); } catch (e) { /* */ } }
  async logout() { try { await this.api('/api/logout', { method: 'POST', body: '{}' }); } catch (e) { /* */ } this.clear(); }
  async cloudLoad() { if (!this.token) return null; try { const j = await this.api('/api/save'); return j.data ? j.data.data : null; } catch (e) { return null; } }
  cloudSave(data) { if (!this.token) return; clearTimeout(this.syncT); this.syncT = setTimeout(() => { this.api('/api/save', { method: 'PUT', body: JSON.stringify({ data }) }).catch(() => { /* offline: nächster Versuch */ }); }, 4000); }
}
