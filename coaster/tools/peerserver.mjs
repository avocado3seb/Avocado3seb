// Lokaler PeerJS-Signalserver für Tests/CI:  node coaster/tools/peerserver.mjs [port]
import { PeerServer } from 'peer';
const port = +(process.argv[2] || 9000);
PeerServer({ port, host: process.env.PEER_HOST || '0.0.0.0', path: '/', allow_discovery: false });
console.log('PeerServer läuft auf Port', port);
