import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Copy Cesium's prebuilt static assets to /cesium in the output. We do NOT use
// vite-plugin-cesium because it injects a ~5MB <script> into index.html that
// loads on every page; instead the Live Earth 3D view loads Cesium on demand at
// runtime (see loadCesium in LiveEarth3D), so the globe never weighs on first
// paint — important for mobile.
function copyCesiumAssets() {
  return {
    name: 'copy-cesium-assets',
    apply: 'build' as const,
    closeBundle() {
      const src = path.resolve(dir, 'node_modules/cesium/Build/Cesium');
      const dest = path.resolve(dir, 'dist/cesium');
      if (fs.existsSync(src)) { fs.rmSync(dest, { recursive: true, force: true }); fs.cpSync(src, dest, { recursive: true }); }
    },
  };
}

export default defineConfig({
  root: 'client',
  plugins: [react(), copyCesiumAssets()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
