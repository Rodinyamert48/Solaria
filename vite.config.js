import { defineConfig } from 'vite';
import path from 'node:path';

const SERVER = `http://localhost:${process.env.PORT || 3000}`;

// `vite build --mode pages` -> GitHub Pages: depo adı alt klasörü ve tarayıcı içi tek oyunculu mod (client/.env.pages)
export default defineConfig(({ mode }) => ({
  root: 'client',
  publicDir: 'public',
  base: process.env.BASE_PATH || (mode === 'pages' ? '/Solaria/' : '/'),
  resolve: {
    alias: { '@shared': path.resolve(import.meta.dirname, 'shared') },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/socket.io': { target: SERVER, ws: true },
      '/api': SERVER,
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: { manualChunks: (id) => (id.includes('@babylonjs') ? 'babylon' : undefined) },
    },
  },
}));
