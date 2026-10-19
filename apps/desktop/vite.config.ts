import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';

const host = process.env.TAURI_DEV_HOST;

// La version affichée vient du manifeste, pas d'une constante recopiée à la main :
// un numéro écrit en dur dans l'interface finit toujours par mentir.
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wasm()],

  define: { __APP_VERSION__: JSON.stringify(version) },

  // PowerSync : SQLite tourne dans un Web Worker (WASM), le worker doit être un module ES.
  worker: {
    format: 'es',
    plugins: () => [wasm()],
  },
  optimizeDeps: {
    exclude: ['@powersync/web'],
    include: ['@powersync/web > js-logger'],
  },

  resolve: {
    alias: { '@': '/src' },
  },

  // Tauri : port fixe, pas d'ouverture de navigateur, cibles WebView2 / WebKit.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // Top-level await (requis par PowerSync/WASM) : WebView2 evergreen sur Windows, WebKit ≥ Safari 15 sur macOS (macOS 12+).
    target: ['es2022', 'chrome105', 'safari15'],
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
