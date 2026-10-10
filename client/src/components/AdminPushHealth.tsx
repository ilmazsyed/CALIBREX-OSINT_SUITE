import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { api, ApiError } from '../lib/api';

interface Health {
  ready: boolean; subject: string | null; hasPublicKey: boolean; keySource: string;
  publicUrlSet: boolean; users: number; usersWithPush: number; totalSubscriptions: number;
  stats: { sent: number; failed: number; byStatus: Record<string, number>; lastError: { code: number; message: string; at: number } | null; lastSentAt: number | null };
}

/**
 * Admin-only push diagnostics. Hidden (renders nothing) only for genuine
 * non-admins (403). For an admin it always renders a visible state —
 * loading, an explicit error with the reason, or the data — so the panel
 * never silently disappears when the server is mid-deploy or erroring.
 */
const AdminPushHealth: React.FC = () => {
  const [h, setH] = useState<Health | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const load = () => {
    setLoading(true); setError(null);
    api<Health>('/admin/push/health')
      .then(d => { setH(d); setHidden(false); })
      .catch((e: unknown) => {
        // Only a true "not an admin" response hides the panel. Anything else
        // (deploy in progress → 404, server error → 500, network) is shown so
        // the operator knows the panel exists and why it can't load yet.
        if (e instanceof ApiError && e.status === 403) { setHidden(true); return; }
        if (e instanceof ApiError) {
          setError(e.status === 404
            ? 'Not available yet — the server is still deploying this update. Try again in a minute.'
            : e.status === 0 ? 'Can’t reach the server. Check your connection.'
            : `Server returned ${e.status}: ${e.message}`);
        } else setError('Could not load push status.');
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const sendTest = () => {
    setTesting(true); setTestMsg(null);
    api<{ ok: boolean; devices: number; registered: number; ready: boolean }>('/push/test', { method: 'POST' })
      .then(r => {
        setTestMsg(r.ok
          ? `Sent to ${r.devices} device${r.devices === 1 ? '' : 's'} — check your notification tray.`
          : r.registered === 0
            ? 'This device isn’t subscribed. Turn on push above (and install the app on iOS) first.'
            : !r.ready ? 'Delivery engine is not ready — see the status below.'
            : 'Send failed — refresh the status below for the error code.');
      })
      .catch((e: unknown) => setTestMsg(e instanceof ApiError ? `Test failed: ${e.message}` : 'Test failed.'))
      .finally(() => { setTesting(false); load(); });
  };

  if (hidden) return null;

  const when = (ms: number | null) => ms ? new Date(ms).toLocaleString() : '—';
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0"><span className="text-[11px] text-calibrex-muted uppercase tracking-wide">{k}</span><span className="text-[12px] text-white font-mono text-right break-all">{v}</span></div>
  );

  return (
    <div className="mt-5 pt-5 border-t border-white/10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-calibrex-text flex items-center gap-2"><Activity size={15} /> Push delivery status <span className="text-[10px] font-mono text-calibrex-muted">(admin)</span></h3>
        <button onClick={load} disabled={loading} className="text-white/40 hover:text-calibrex-teal disabled:opacity-40 p-1" aria-label="Refresh">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button onClick={sendTest} disabled={testing} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-calibrex-teal/15 text-calibrex-teal border border-calibrex-teal/30 text-xs font-bold disabled:opacity-40 hover:bg-calibrex-teal/25">
          {testing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send test push to this device
        </button>
      </div>
      {testMsg && <p className="text-[11px] text-calibrex-text mb-3">{testMsg}</p>}

      {loading && !h ? <p className="text-xs text-calibrex-muted">Checking…</p>
      : error ? <p className="text-[12px] text-calibrex-high flex items-start gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" /> {error}</p>
      : h ? (
        <>
          <div className={`flex items-center gap-2 mb-3 text-sm font-bold ${h.ready ? 'text-calibrex-low' : 'text-calibrex-critical'}`}>
            {h.ready ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {h.ready ? 'Delivery engine active' : 'Delivery engine NOT ready — push is off'}
          </div>
          <div className="bg-black/20 rounded-lg border border-white/5 p-3">
            {row('Devices subscribed', `${h.totalSubscriptions} across ${h.usersWithPush} of ${h.users} users`)}
            {row('Notifications sent', h.stats.sent)}
            {row('Send failures', <span className={h.stats.failed ? 'text-calibrex-high' : ''}>{h.stats.failed}</span>)}
            {Object.keys(h.stats.byStatus).length > 0 && row('Failures by code', Object.entries(h.stats.byStatus).map(([c, n]) => `${c}×${n}`).join('  '))}
            {row('Last sent', when(h.stats.lastSentAt))}
            {h.stats.lastError && row('Last error', `${h.stats.lastError.code}: ${h.stats.lastError.message}`)}
            {row('VAPID subject', h.subject || '—')}
            {row('Server address (PUBLIC_URL)', h.publicUrlSet ? 'set' : 'NOT set — set it on Render')}
          </div>
          {h.ready && h.totalSubscriptions === 0 && <p className="text-[11px] text-calibrex-high mt-2 flex items-start gap-1.5"><AlertTriangle size={12} className="shrink-0 mt-0.5" /> No devices are subscribed yet. Operators must turn on push (and install the app) above to receive anything.</p>}
          {h.ready && h.stats.failed > h.stats.sent && h.stats.sent === 0 && <p className="text-[11px] text-calibrex-critical mt-2 flex items-start gap-1.5"><AlertTriangle size={12} className="shrink-0 mt-0.5" /> Every send is failing — check the Last error code above (403/400 usually means devices subscribed under old VAPID keys; have operators re-enable push).</p>}
        </>
      ) : null}
    </div>
  );
};

export default AdminPushHealth;
