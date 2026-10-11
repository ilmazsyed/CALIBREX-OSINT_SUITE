import React, { useEffect, useState } from 'react';
import { ShieldAlert, Loader2, RefreshCw, History } from 'lucide-react';
import { getGate, setGate, getSensitiveAudit, Gate, SensitiveAudit } from '../lib/sensitive';
import { ApiError } from '../lib/api';
import { timeAgo } from '../lib/live';

/** Master-admin control for the gated sensitive tools + their query audit. */
const AdminSensitive: React.FC<{ onNotify?: (m: string) => void }> = ({ onNotify }) => {
  const [gate, setGateState] = useState<Gate | null>(null);
  const [audit, setAudit] = useState<SensitiveAudit[] | null>(null);
  const [ack, setAck] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => { getGate().then(setGateState).catch(() => {}); getSensitiveAudit().then(r => setAudit(r.entries)).catch(() => setAudit([])); };
  useEffect(load, []);

  const toggle = (enable: boolean) => {
    if (enable && ack.trim().length < 10) { setErr('Type a short authorization acknowledgment to enable.'); return; }
    setBusy(true); setErr(null);
    setGate(enable, enable ? ack.trim() : undefined)
      .then(g => { setGateState(g); setAck(''); onNotify?.(enable ? 'Sensitive tools enabled.' : 'Sensitive tools disabled.'); load(); })
      .catch((e: unknown) => setErr(e instanceof ApiError ? e.message : 'Could not update.'))
      .finally(() => setBusy(false));
  };

  return (
    <div className="mt-6 bg-calibrex-surface border border-calibrex-high/25 rounded-[2rem] p-5 sm:p-8">
      <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-[0.2em] flex items-center gap-2 mb-1"><ShieldAlert size={16} className="text-calibrex-high" /> Sensitive tools</h3>
      <p className="text-[11px] text-calibrex-muted mb-4 max-w-2xl">Social footprint (SOCMINT) and dark-web search. These carry policy and ToS weight, so they are off until you authorize them, and every query is logged below. No facial recognition is or will be included.</p>

      {!gate ? <div className="py-6 flex justify-center text-calibrex-high"><Loader2 className="animate-spin" /></div> : (
        <div className={`rounded-xl border p-4 ${gate.enabled ? 'border-calibrex-low/40 bg-calibrex-low/5' : 'border-white/10 bg-black/20'}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className={`text-sm font-black uppercase tracking-widest ${gate.enabled ? 'text-calibrex-low' : 'text-white/60'}`}>{gate.enabled ? 'Enabled' : 'Disabled'}</div>
              {gate.enabled && gate.acknowledgedBy && <div className="text-[11px] text-calibrex-muted mt-0.5">Authorized by {gate.acknowledgedBy}{gate.acknowledgedAt ? ` · ${timeAgo(gate.acknowledgedAt)}` : ''}</div>}
            </div>
            {gate.enabled
              ? <button onClick={() => toggle(false)} disabled={busy} className="px-4 py-2 rounded-lg border border-calibrex-critical/40 text-calibrex-critical text-xs font-black uppercase tracking-widest disabled:opacity-40">{busy ? <Loader2 size={13} className="animate-spin" /> : 'Disable'}</button>
              : null}
          </div>
          {!gate.enabled && (
            <div className="mt-3 space-y-2">
              <label className="block text-[11px] font-bold text-calibrex-text">Authorization acknowledgment</label>
              <textarea value={ack} onChange={e => setAck(e.target.value)} rows={2} placeholder="e.g. I confirm these lookups are legally authorized for our investigations under applicable law." className="w-full bg-calibrex-surface-light border border-calibrex-teal/30 rounded px-3 py-2 text-calibrex-text text-sm focus:outline-none resize-none" />
              <button onClick={() => toggle(true)} disabled={busy} className="px-4 py-2 rounded-lg bg-calibrex-high text-calibrex-navy text-xs font-black uppercase tracking-widest disabled:opacity-40">{busy ? <Loader2 size={13} className="animate-spin" /> : 'Enable sensitive tools'}</button>
            </div>
          )}
          {err && <p className="text-[12px] text-calibrex-critical mt-2">{err}</p>}
        </div>
      )}

      <div className="flex items-center justify-between mt-6 mb-2">
        <h4 className="text-[11px] font-black text-calibrex-muted uppercase tracking-widest flex items-center gap-1.5"><History size={13} /> Query audit</h4>
        <button onClick={load} className="text-white/40 hover:text-calibrex-high"><RefreshCw size={13} /></button>
      </div>
      {audit === null ? <div className="py-4 flex justify-center text-white/30"><Loader2 size={16} className="animate-spin" /></div>
        : audit.length === 0 ? <p className="text-[11px] text-white/30 py-3 text-center uppercase tracking-widest">No sensitive queries yet</p>
        : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar pr-1">
            {audit.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-[11px] bg-black/25 border border-white/5 rounded-lg px-3 py-2">
                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-calibrex-high/10 text-calibrex-high border border-calibrex-high/20 shrink-0">{a.tool}</span>
                <span className="font-mono text-white/80 truncate flex-1">{a.query}</span>
                <span className="text-white/40 truncate shrink-0">{a.email}</span>
                <span className="text-white/30 font-mono shrink-0">{timeAgo(a.at)}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
};

export default AdminSensitive;
