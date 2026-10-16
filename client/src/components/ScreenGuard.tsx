import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/**
 * ScreenGuard — the realistic web-side screen-capture deterrent layer.
 *
 * The web platform cannot BLOCK an OS screenshot or screen recording (no
 * browser API exists for that — only a native Android/Electron wrapper can).
 * What this layer does instead:
 *   1. Obscure-on-blur — cover sensitive content the instant the app loses
 *      focus or is hidden (snip tools & many recorders trigger this).
 *   2. Capture detection + audit — report the PrintScreen key to the server
 *      audit trail.
 *   3. Lockdown — disable the context menu, text selection and drag-copy of
 *      content (form fields still work).
 */
const ScreenGuard: React.FC<{ currentView: string }> = ({ currentView }) => {
  const [covered, setCovered] = useState(false);
  const lastSent = useRef<Record<string, number>>({});
  const viewRef = useRef(currentView);
  viewRef.current = currentView;

  // Report a capture signal to the audit trail (throttled per kind).
  const report = (kind: string) => {
    const now = Date.now();
    if (now - (lastSent.current[kind] || 0) < 8000) return;
    lastSent.current[kind] = now;
    api('/security/capture-event', { body: { kind, view: viewRef.current } }).catch(() => { /* best-effort */ });
  };

  // Obscure-on-blur + PrintScreen detection.
  useEffect(() => {
    // Obscure on hide/blur (visual only — normal backgrounding isn't a capture
    // and must not flood the audit trail).
    const onHide = () => { if (document.hidden) setCovered(true); };
    const onBlur = () => setCovered(true);
    const onFocus = () => setCovered(false);
    const onVis = () => setCovered(document.hidden);
    const onKey = (e: KeyboardEvent) => {
      // PrintScreen (desktop) — can't prevent the OS grab, but flag it, flash
      // the cover, and best-effort scrub the clipboard.
      if (e.key === 'PrintScreen') {
        report('printscreen');
        setCovered(true);
        try { navigator.clipboard?.writeText('Calibrex — protected view').catch(() => {}); } catch { /* ignore */ }
        setTimeout(() => { if (!document.hidden) setCovered(false); }, 1200);
      }
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('keyup', onKey);
    };
  }, []);

  // Lockdown: block context menu / selection / copy / drag on content (but
  // leave real form fields usable).
  useEffect(() => {
    const inField = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.closest('input,textarea,[contenteditable="true"],[data-allow-select]') != null);
    };
    const noMenu = (e: Event) => { if (!inField(e.target)) e.preventDefault(); };
    const noSelect = (e: Event) => { if (!inField(e.target)) e.preventDefault(); };
    const noCopy = (e: Event) => { if (!inField(e.target)) e.preventDefault(); };
    const noDrag = (e: Event) => { if (!inField(e.target)) e.preventDefault(); };
    document.addEventListener('contextmenu', noMenu);
    document.addEventListener('selectstart', noSelect);
    document.addEventListener('copy', noCopy);
    document.addEventListener('cut', noCopy);
    document.addEventListener('dragstart', noDrag);
    document.body.classList.add('cx-guard-noselect');
    return () => {
      document.removeEventListener('contextmenu', noMenu);
      document.removeEventListener('selectstart', noSelect);
      document.removeEventListener('copy', noCopy);
      document.removeEventListener('cut', noCopy);
      document.removeEventListener('dragstart', noDrag);
      document.body.classList.remove('cx-guard-noselect');
    };
  }, []);

  if (!covered) return null;
  return (
    <div aria-hidden style={{
      position: 'fixed', inset: 0, zIndex: 2147483001, pointerEvents: 'none',
      background: 'rgba(5,10,15,0.98)', backdropFilter: 'blur(26px)', WebkitBackdropFilter: 'blur(26px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#2a8a9a', fontWeight: 900 }}>Calibrex</div>
        <div style={{ fontSize: 13, color: '#9bb0bd', marginTop: 8 }}>Content hidden while the app isn’t in focus.</div>
      </div>
    </div>
  );
};

export default ScreenGuard;
