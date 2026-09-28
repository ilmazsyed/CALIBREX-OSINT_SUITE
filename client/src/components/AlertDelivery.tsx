import React, { useEffect, useState } from 'react';
import { Send, Loader2, Plus, Trash2, MapPin, Check } from 'lucide-react';
import { getDelivery, saveDelivery, testDelivery, DeliveryConfig, Geofence } from '../lib/workbench';

const blank: DeliveryConfig = { enabled: false, minSeverity: 'HIGH', telegram: null, webhook: null, geofences: [] };

/** Push high-severity alerts to Telegram / a webhook, optionally geofenced. Lives in Settings. */
const AlertDelivery: React.FC<{ onNotify?: (m: string) => void }> = ({ onNotify }) => {
  const [cfg, setCfg] = useState<DeliveryConfig>(blank);
  const [botToken, setBotToken] = useState(''); // never returned by the server; blank keeps the stored one
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getDelivery().then(d => setCfg(d || blank)).catch(() => {}).finally(() => setLoading(false)); }, []);

  const payload = () => ({
    enabled: cfg.enabled,
    minSeverity: cfg.minSeverity,
    telegram: cfg.telegram?.chatId ? { chatId: cfg.telegram.chatId, botToken } : null,
    webhook: cfg.webhook?.url ? { url: cfg.webhook.url } : null,
    geofences: cfg.geofences,
  });

  const save = async () => {
    setBusy('save');
    try { const d = await saveDelivery(payload()); setCfg(d); setBotToken(''); setSaved(true); setTimeout(() => setSaved(false), 2000); onNotify?.('Alert delivery saved.'); }
    catch (e: any) { onNotify?.(e.message || 'Could not save.'); }
    finally { setBusy(null); }
  };
  const test = async () => {
    setBusy('test');
    try { await testDelivery(payload()); onNotify?.('Test alert sent — check your channel.'); }
    catch (e: any) { onNotify?.(e.message || 'Test failed.'); }
    finally { setBusy(null); }
  };

  const setTg = (chatId: string) => setCfg(c => ({ ...c, telegram: chatId || botToken ? { ...(c.telegram || { chatId: '' }), chatId } : null }));
  const setHook = (url: string) => setCfg(c => ({ ...c, webhook: url ? { url } : null }));
  const addFence = () => setCfg(c => ({ ...c, geofences: [...c.geofences, { id: Math.random().toString(36).slice(2, 10), name: 'Area', lat: 0, lng: 0, radiusKm: 200 }] }));
  const setFence = (i: number, patch: Partial<Geofence>) => setCfg(c => ({ ...c, geofences: c.geofences.map((g, j) => j === i ? { ...g, ...patch } : g) }));
  const delFence = (i: number) => setCfg(c => ({ ...c, geofences: c.geofences.filter((_, j) => j !== i) }));

  const num = (v: string) => v === '' || v === '-' ? 0 : Number(v);

  if (loading) return <div className="py-6 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={cfg.enabled} onChange={e => setCfg(c => ({ ...c, enabled: e.target.checked }))} className="accent-calibrex-teal" />
          <span className="text-sm text-calibrex-text font-bold">Enable outbound delivery</span>
        </label>
        <select value={cfg.minSeverity} onChange={e => setCfg(c => ({ ...c, minSeverity: e.target.value as DeliveryConfig['minSeverity'] }))} className="bg-calibrex-surface-light border border-calibrex-teal/30 rounded px-2 py-1.5 text-xs text-calibrex-text focus:outline-none focus:border-calibrex-teal">
          <option value="MEDIUM">Medium and up</option>
          <option value="HIGH">High and up</option>
          <option value="CRITICAL">Critical only</option>
        </select>
      </div>

      {/* Telegram */}
      <div className="p-3 bg-black/20 rounded border border-white/5 space-y-2">
        <div className="text-[11px] font-black text-calibrex-gold uppercase tracking-widest">Telegram</div>
        <input value={cfg.telegram?.chatId || ''} onChange={e => setTg(e.target.value)} placeholder="Chat ID (e.g. 123456789)" className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-calibrex-teal" />
        <input value={botToken} onChange={e => setBotToken(e.target.value)} placeholder={cfg.telegram?.configured ? 'Bot token — stored (type to replace)' : 'Bot token from @BotFather'} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-calibrex-teal" />
        <p className="text-[10px] text-calibrex-muted">Create a bot with @BotFather, send it a message, then use your numeric chat ID.</p>
      </div>

      {/* Webhook */}
      <div className="p-3 bg-black/20 rounded border border-white/5 space-y-2">
        <div className="text-[11px] font-black text-calibrex-gold uppercase tracking-widest">Webhook</div>
        <input value={cfg.webhook?.url || ''} onChange={e => setHook(e.target.value)} placeholder="https://your-endpoint.example.com/hook" className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-calibrex-teal" />
        <p className="text-[10px] text-calibrex-muted">Receives a JSON POST per batch. Public https only (private addresses are refused).</p>
      </div>

      {/* Geofences */}
      <div className="p-3 bg-black/20 rounded border border-white/5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-black text-calibrex-gold uppercase tracking-widest flex items-center gap-1.5"><MapPin size={12} /> Geofences</div>
          <button onClick={addFence} className="text-calibrex-teal hover:text-white flex items-center gap-1 text-[11px] font-bold"><Plus size={13} /> Add</button>
        </div>
        {cfg.geofences.length === 0 && <p className="text-[10px] text-calibrex-muted">No geofences — every alert above the threshold is delivered. Add one to only deliver alerts within a radius.</p>}
        {cfg.geofences.map((g, i) => (
          <div key={g.id} className="flex flex-wrap items-center gap-2">
            <input value={g.name} onChange={e => setFence(i, { name: e.target.value })} placeholder="Name" className="w-24 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white" />
            <input value={String(g.lat)} onChange={e => setFence(i, { lat: num(e.target.value) })} placeholder="lat" inputMode="decimal" className="w-20 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white" />
            <input value={String(g.lng)} onChange={e => setFence(i, { lng: num(e.target.value) })} placeholder="lng" inputMode="decimal" className="w-20 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white" />
            <div className="flex items-center gap-1"><input value={String(g.radiusKm)} onChange={e => setFence(i, { radiusKm: num(e.target.value) })} inputMode="numeric" className="w-16 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white" /><span className="text-[10px] text-calibrex-muted">km</span></div>
            <button onClick={() => delFence(i)} className="text-calibrex-muted hover:text-calibrex-critical"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={save} disabled={busy !== null} className="flex-1 bg-calibrex-teal hover:bg-[#3aa5b5] text-calibrex-navy font-bold py-2.5 rounded uppercase tracking-wide text-xs flex justify-center items-center gap-2 disabled:opacity-50">{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null} Save delivery</button>
        <button onClick={test} disabled={busy !== null} className="px-4 border border-calibrex-gold/40 text-calibrex-gold font-bold py-2.5 rounded uppercase tracking-wide text-xs flex items-center gap-2 disabled:opacity-50">{busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Test</button>
      </div>
    </div>
  );
};

export default AlertDelivery;
