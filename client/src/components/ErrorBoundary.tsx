import React from 'react';

// App-wide safety net. A render crash (e.g. a stale code chunk after a deploy,
// or a bad component) must never leave a blank screen. On the first crash we
// reload once to pull a fresh bundle; if it still crashes we show a recovery
// panel with a hard reset (clears caches + unregisters the service worker).
interface State { crashed: boolean }

// `isolate`: a local boundary that renders `fallback` (default: nothing) instead
// of the full recovery panel, and never reloads — used to quarantine a single
// widget so its crash can't take the whole app down.
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode; isolate?: boolean; fallback?: React.ReactNode }, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State { return { crashed: true }; }

  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.error('[app] render crashed', err);
    if (this.props.isolate) return;                        // quarantined widget: no reload
    try {
      if (!sessionStorage.getItem('cx_recovered')) {
        sessionStorage.setItem('cx_recovered', '1');
        setTimeout(() => window.location.reload(), 150);   // self-heal once (fresh bundle)
      }
    } catch { /* storage blocked */ }
  }

  hardReset = async () => {
    try { localStorage.clear(); } catch { /* ignore */ }
    try { sessionStorage.clear(); } catch { /* ignore */ }
    try { if ('caches' in window) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch { /* ignore */ }
    try { if ('serviceWorker' in navigator) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } } catch { /* ignore */ }
    window.location.reload();
  };

  render() {
    if (!this.state.crashed) return this.props.children;
    if (this.props.isolate) return this.props.fallback ?? null;   // quarantine: hide this widget only
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0f14', color: '#e8eef2', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: '#2a8a9a', fontWeight: 900, marginBottom: 10 }}>Calibrex</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Something interrupted the app.</div>
          <div style={{ fontSize: 13, color: '#9bb0bd', lineHeight: 1.5, marginBottom: 18 }}>This is usually a half-finished update. Reload to get the latest version — your data is safe on the server.</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => window.location.reload()} style={{ background: '#e9c46a', color: '#0a0f14', border: 0, borderRadius: 10, padding: '10px 16px', fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>Reload</button>
            <button onClick={this.hardReset} style={{ background: 'transparent', color: '#9bb0bd', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 16px', fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>Reset &amp; reload</button>
          </div>
        </div>
      </div>
    );
  }
}
