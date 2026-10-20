import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // GitHub Pages serves from /<repo>/ — set BASE_PATH in CI; locally it is '/'.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  resolve: {
    alias: { '@fom/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)) },
  },
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 2500 },
});
