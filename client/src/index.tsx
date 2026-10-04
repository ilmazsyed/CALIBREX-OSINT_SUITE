import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
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
    <App />
  </React.StrictMode>
);

// Register the service worker (PWA install + push). Safe no-op where unsupported.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ });
  });
}

// Capture the install prompt early (it can fire before Settings mounts).
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).__cxInstallPrompt = e;
  window.dispatchEvent(new Event('cx:installable'));
});