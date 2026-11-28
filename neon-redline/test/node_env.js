// Lädt Module in einen vm-Kontext (ohne DOM) für Diagnosen
const vm = require('vm'), fs = require('fs'), path = require('path');
const THREE = require('three');
module.exports = function load(files) {
  const win = { THREE, console, Math, performance: { now: () => Date.now() }, Float64Array, Float32Array, Uint8Array, Uint16Array, Uint32Array, Map, Set };
  win.window = win; win.G = undefined;
  const ctx = vm.createContext(win);
  for (const f of files) { const code = fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'); vm.runInContext(code, ctx, { filename: f }); }
  return ctx;
};
