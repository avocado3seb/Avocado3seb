import { defineConfig } from 'vite';
import { resolve } from 'path';

// base './' damit das Spiel auf GitHub Pages (Unterpfad /<repo>/) funktioniert
// Zwei Seiten: Vice City (Wurzel) und der Europa-Achterbahn-Simulator (coaster/)
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        coaster: resolve(__dirname, 'coaster/index.html'),
      },
    },
  },
  server: { host: true, port: 5173 },
});
