// Builds the single-file Claude artifact: dist/calibrex-osint-studio.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

execSync('npx tailwindcss -c tailwind.config.cjs -i src/tailwind.css -o dist/tw.css --minify', { stdio: 'inherit' });

const result = await build({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  loader: { '.json': 'json' },
  define: { 'process.env.NODE_ENV': '"production"' },
  write: false,
  legalComments: 'none',
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const leafletCss = readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const appCss = readFileSync('src/app.css', 'utf8');
const twCss = readFileSync('dist/tw.css', 'utf8');

const page = `<title>Calibrex OSINT Studio</title>
<meta name="description" content="Calibrex OSINT Studio: threat monitoring, AI research, report synthesis and dispatch, powered by Claude.">
<style>${leafletCss}</style>
<style>${twCss}</style>
<style>${appCss}</style>
<div id="root"></div>
<script>${js}</script>
`;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/calibrex-osint-studio.html', page);
console.log('dist/calibrex-osint-studio.html', (page.length / 1024).toFixed(0) + ' KB');
