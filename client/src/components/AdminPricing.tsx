import React, { useEffect, useState } from 'react';
import { Tag, Loader2, Check } from 'lucide-react';
import { admin, GroupCount } from '../lib/api';

const LABEL: Record<string, string> = { A: 'Dashboards (A)', B: 'Tools (B)', C: 'Output (C)' };

/** Master-admin editor for a-la-carte prices (monthly, per feature). Plan
 *  bundle prices are computed from these automatically. */
const AdminPricing: React.FC<{ onNotify: (m: string) => void }> = ({ onNotify }) => {
  const [p, setP] = useState<GroupCount>({ A: 0, B: 0, C: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { admin.pricing().then(r => setP(r.pricing)).catch(() => {}).finally(() => setLoading(false)); }, []);

  const save = async () => {
    setSaving(true);
    try { const r = await admin.setPricing(p); setP(r.pricing); onNotify('Prices updated. Plan bundles recomputed.'); }
    catch (e: any) { onNotify(e?.message || 'Could not save prices.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="mt-8 bg-calibrex-surface border border-calibrex-teal/15 rounded-[2rem] p-5 sm:p-8">
      <div className="flex items-center gap-4 mb-5 border-b border-white/5 pb-5">
        <div className="p-3 bg-calibrex-teal/10 rounded-2xl border border-calibrex-teal/30"><Tag className="text-calibrex-teal" size={24} /></div>
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-[0.15em]">A-la-carte pricing</h2>
          <p className="text-[11px] text-white/45 mt-0.5">Monthly price per feature, by group. Bundle prices = sum of the plan’s features; annual = 10× monthly (2 months free).</p>
        </div>
      </div>
      {loading ? <div className="py-8 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div> : (
        <div className="flex flex-wrap items-end gap-4">
          {(['A', 'B', 'C'] as const).map(g => (
            <label key={g} className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{LABEL[g]}</span>
              <div className="flex items-center gap-1">
                <span className="text-white/50 text-sm">₹</span>
                <input type="number" min={0} value={p[g]} onChange={e => setP(s => ({ ...s, [g]: Math.max(0, +e.target.value | 0) }))} className="w-28 bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-calibrex-teal" />
                <span className="text-white/40 text-[11px]">/mo</span>
              </div>
            </label>
          ))}
          <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-lg bg-calibrex-teal text-calibrex-navy text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save prices
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminPricing;
