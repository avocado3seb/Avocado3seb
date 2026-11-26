// Deployt den Relay-Worker per Cloudflare-API (ohne wrangler).
// Benötigt: CF_API_TOKEN (Berechtigung „Workers Scripts: Edit“) und CF_ACCOUNT_ID als Umgebungsvariablen – niemals ins Repo schreiben.
//   CF_API_TOKEN=… CF_ACCOUNT_ID=… node coaster/cloudflare/deploy.mjs [workerName]
import { readFileSync } from 'fs';
const T = process.env.CF_API_TOKEN, A = process.env.CF_ACCOUNT_ID, NAME = process.argv[2] || 'ecs-relay';
if (!T || !A) { console.error('CF_API_TOKEN und CF_ACCOUNT_ID setzen'); process.exit(1); }
const api = (p, o = {}) => fetch('https://api.cloudflare.com/client/v4' + p, { ...o, headers: { authorization: 'Bearer ' + T, ...(o.headers || {}) } }).then(r => r.json());
const code = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
const meta = { main_module: 'worker.js', compatibility_date: '2025-01-01', bindings: [{ type: 'durable_object_namespace', name: 'ROOM', class_name: 'Room' }], migrations: { new_tag: 'v1', new_sqlite_classes: ['Room'] } };
const fd = new FormData();
fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
fd.append('worker.js', new Blob([code], { type: 'application/javascript+module' }), 'worker.js');
let r = await api(`/accounts/${A}/workers/scripts/${NAME}`, { method: 'PUT', body: fd });
if (!r.success && JSON.stringify(r.errors).includes('migration')) { delete meta.migrations; const f2 = new FormData(); f2.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' })); f2.append('worker.js', new Blob([code], { type: 'application/javascript+module' }), 'worker.js'); r = await api(`/accounts/${A}/workers/scripts/${NAME}`, { method: 'PUT', body: f2 }); }
if (!r.success) { console.error('Upload fehlgeschlagen', JSON.stringify(r.errors)); process.exit(1); }
const s = await api(`/accounts/${A}/workers/scripts/${NAME}/subdomain`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true, previews_enabled: false }) });
const sd = await api(`/accounts/${A}/workers/subdomain`);
console.log('Deployt:', `https://${NAME}.${sd.result && sd.result.subdomain}.workers.dev`, s.success ? '(workers.dev aktiv)' : JSON.stringify(s.errors));
