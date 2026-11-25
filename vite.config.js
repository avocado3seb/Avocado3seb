import { defineConfig } from 'vite';

// base './' damit das Spiel auf GitHub Pages (Unterpfad /<repo>/) funktioniert
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
    sourcemap: false,
  },
  server: { host: true, port: 5173 },
});
