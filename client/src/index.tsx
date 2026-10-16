import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import 'leaflet/dist/leaflet.css';
import './tailwind.css';
import './app.css';
import { applyDisplay } from './lib/api';

applyDisplay();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// If the app renders cleanly for a few seconds, allow future crashes to
// self-heal again (clear the one-shot auto-reload guard).
setTimeout(() => { try { sessionStorage.removeItem('cx_recovered'); } catch { /* ignore */ } }, 8000);

// Register the service worker (PWA install + push). Safe no-op where unsupported.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ });
  });
}

// Auto-update: an installed PWA resumes its in-memory page instead of re-fetching,
// so a deploy can go unseen until a manual hard-refresh. On returning to the app,
// check whether the server is serving a newer main bundle (different hash in
// index.html) and reload once if so. The hash comparison self-guards against loops.
(() => {
  let busy = false;
  const currentBundle = () => (document.querySelector('script[type="module"][src*="/assets/index-"]') as HTMLScriptElement | null)?.getAttribute('src') || '';
  const mine = currentBundle();
  async function check() {
    if (busy || document.visibilityState !== 'visible' || !mine) return;
    busy = true;
    try {
      const res = await fetch('/index.html', { cache: 'no-store' });
      if (res.ok) {
        const html = await res.text();
        const m = html.match(/\/assets\/index-[\w-]+\.js/);
        if (m && !mine.includes(m[0])) { window.location.reload(); return; }
      }
    } catch { /* offline — keep running */ }
    busy = false;
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('focus', check);
})();

// Capture the install prompt early (it can fire before Settings mounts).
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).__cxInstallPrompt = e;
  window.dispatchEvent(new Event('cx:installable'));
});