import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    react(),
    topLevelAwait({
      promiseExportName: '__tla',
      promiseImportName: (i) => `__tla_${i}`,
    }),
  ],
  
  // Configuration pour les workers PowerSync
  worker: {
    format: 'es',
    plugins: () => [topLevelAwait({
      promiseExportName: '__tla',
      promiseImportName: (i) => `__tla_${i}`,
    })],
  },

  // Configuration pour Tauri
  build: {
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },

  // Variables d'environnement
  envPrefix: ['VITE_', 'TAURI_'],

  server: {
    port: 1420,
    strictPort: true,
  },

  // Optimisation des dépendances
  optimizeDeps: {
    exclude: ['@powersync/web'],
  },

  // Résolution des alias
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});