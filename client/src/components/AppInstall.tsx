import React, { useEffect, useState } from 'react';
import { Download, BellRing, BellOff, Loader2, Check, Send, Share } from 'lucide-react';
import { pushState, enablePush, disablePush, testPush, pushSupported } from '../lib/push';

const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;

/** Install-as-app + push-notifications controls, shown in Settings. */
const AppInstall: React.FC<{ onNotify?: (m: string) => void }> = ({ onNotify }) => {
  const [prompt, setPrompt] = useState<any>(() => (typeof window !== 'undefined' ? (window as any).__cxInstallPrompt : null));
  const [installed, setInstalled] = useState(isStandalone());
  const [push, setPush] = useState<{ supported: boolean; permission: NotificationPermission; subscribed: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onProm = () => setPrompt((window as any).__cxInstallPrompt);
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('cx:installable', onProm);
    window.addEventListener('appinstalled', onInstalled);
    pushState().then(setPush).catch(() => {});
    return () => { window.removeEventListener('cx:installable', onProm); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    try { const { outcome } = await prompt.userChoice; if (outcome === 'accepted') { setInstalled(true); onNotify?.('Installing Calibrex…'); } } catch { /* ignore */ }
    setPrompt(null);
  };

  const toggle = async () => {
    setBusy(true);
    try {
      if (push?.subscribed) { await disablePush(); onNotify?.('Push notifications turned off.'); }
      else { await enablePush(); onNotify?.('Push notifications on — you can test below.'); }
      setPush(await pushState());
    } catch (e: any) { onNotify?.(e.message || 'Could not change push settings.'); }
    finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true);
    try { const r = await testPush(); onNotify?.(r.devices > 0 ? 'Test notification sent.' : 'No device is subscribed yet.'); }
    catch (e: any) { onNotify?.(e.message || 'Test failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {/* Install */}
      {installed ? (
        <div className="flex items-center gap-2 text-sm text-calibrex-low"><Check size={16} /> Installed as an app on this device.</div>
      ) : prompt ? (
        <button onClick={install} className="w-full bg-calibrex-teal hover:bg-[#3aa5b5] text-calibrex-navy font-bold py-3 rounded uppercase tracking-wide text-xs flex justify-center items-center gap-2"><Download size={16} /> Install Calibrex as an app</button>
      ) : isIOS() ? (
        <div className="text-sm text-calibrex-muted flex items-start gap-2"><Share size={16} className="mt-0.5 shrink-0 text-calibrex-teal" /> To install on iPhone/iPad: tap the <b className="text-white">Share</b> button in Safari, then <b className="text-white">Add to Home Screen</b>.</div>
      ) : (
        <div className="text-sm text-calibrex-muted">Use your browser menu → <b className="text-white">Install app</b> / <b className="text-white">Add to Home Screen</b> to install Calibrex.</div>
      )}

      {/* Push */}
      <div className="pt-4 border-t border-white/5">
        {!pushSupported() ? (
          <p className="text-sm text-calibrex-muted">Push notifications aren't supported in this browser{isIOS() ? '. On iPhone, install the app to your Home Screen first, then enable them from inside the installed app.' : '.'}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-white font-bold">{push?.subscribed ? <BellRing size={16} className="text-calibrex-teal" /> : <BellOff size={16} className="text-calibrex-muted" />} Push notifications</div>
              <button onClick={toggle} disabled={busy} className={`px-3 py-1.5 rounded text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50 ${push?.subscribed ? 'bg-white/5 border border-white/15 text-white' : 'bg-calibrex-teal text-calibrex-navy'}`}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : push?.subscribed ? 'Turn off' : 'Turn on'}
              </button>
            </div>
            <p className="text-[11px] text-calibrex-muted mt-2">Get a push on this device when a watchlist term, an aircraft watch, or a market crisis signal fires — even when Calibrex is closed.</p>
            {push?.subscribed && <button onClick={test} disabled={busy} className="mt-3 px-3 py-1.5 rounded border border-calibrex-gold/40 text-calibrex-gold text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"><Send size={13} /> Send test</button>}
            {push?.permission === 'denied' && <p className="text-[11px] text-calibrex-high mt-2">Notifications are blocked for this site — enable them in your browser's site settings first.</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default AppInstall;
