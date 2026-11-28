#!/usr/bin/env node
/* Bündelt Spiel + three.js zu einer einzelnen, eigenständigen HTML-Datei (dist/index.html). */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const man = JSON.parse(fs.readFileSync(path.join(root, 'src/manifest.json'), 'utf8'));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const wrap = (name, code) => `<script>/* ${name} */\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>`;
const vendor = man.vendor.map(f => wrap(f, read(f))).join('\n');
const source = man.src.map(f => wrap('src/' + f, read('src/' + f))).join('\n');
const html = read(man.template).replace('<!--VENDOR-->', () => vendor).replace('<!--SOURCE-->', () => source);
fs.mkdirSync(path.dirname(path.join(root, man.out)), { recursive: true });
fs.writeFileSync(path.join(root, man.out), html);
console.log(`gebaut: ${man.out} (${(html.length / 1024).toFixed(0)} KB, ${man.vendor.length} Vendor- und ${man.src.length} Spiel-Module)`);
