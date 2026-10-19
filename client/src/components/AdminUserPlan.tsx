import React, { useState } from 'react';
import { Crown, Settings2, Check, Plus, Minus } from 'lucide-react';
import { User, FeatureDef, GroupCount, PlanId } from '../lib/api';

const PLAN_IDS: PlanId[] = ['demo', 'starter', 'professional', 'business', 'enterprise'];
const GROUP_NAME: Record<string, string> = { A: 'Dashboards', B: 'Tools', C: 'Output' };

type Patch = Parameters<typeof import('../lib/api').admin.update>[1];

/** Admin controls for one user's subscription: plan, all-access, enterprise
 *  allowance and per-feature grants. */
const AdminUserPlan: React.FC<{
  user: User; features: FeatureDef[]; busy: boolean;
  onUpdate: (patch: Patch, msg: string) => void;
}> = ({ user, features, busy, onUpdate }) => {
  const e = user.entitlement;
  const plan = (e?.plan || 'demo') as PlanId;
  const entitled = new Set(e?.entitled || []);
  const [open, setOpen] = useState(false);
  const [ent, setEnt] = useState<GroupCount>(e?.entAllow || { A: 0, B: 0, C: 0 });

  return (
    <div className="w-full mt-2 rounded-xl border border-white/10 bg-black/20 p-3 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Plan</span>
        <select value={plan} disabled={busy} onChange={ev => onUpdate({ plan: ev.target.value as PlanId }, `Plan set to ${ev.target.value}: ${user.name}`)}
          className="bg-black/40 border border-white/15 rounded-lg px-2.5 py-1.5 text-[11px] font-black uppercase tracking-widest text-white focus:outline-none focus:border-calibrex-gold">
          {PLAN_IDS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => onUpdate({ allAccess: !e?.allAccess }, `${e?.allAccess ? 'All-Access removed' : 'All-Access granted'}: ${user.name}`)} disabled={busy}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border ${e?.allAccess ? 'bg-calibrex-gold text-calibrex-navy border-calibrex-gold' : 'text-calibrex-gold border-calibrex-gold/40 hover:bg-calibrex-gold/10'}`}>
          <Crown size={13} /> {e?.allAccess ? 'All-Access ON' : 'Grant All-Access'}
        </button>
        <button onClick={() => setOpen(o => !o)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-calibrex-teal border border-calibrex-teal/40 hover:bg-calibrex-teal/10 flex items-center gap-1.5">
          <Settings2 size={13} /> Features
        </button>
      </div>

      {plan === 'enterprise' && (
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="font-black text-white/30 uppercase tracking-widest">Enterprise allowance</span>
          {(['A', 'B', 'C'] as const).map(g => (
            <label key={g} className="flex items-center gap-1 text-white/60">{g}
              <input type="number" min={0} max={20} value={ent[g]} onChange={ev => setEnt(s => ({ ...s, [g]: Math.max(0, +ev.target.value | 0) }))} className="w-12 bg-black/40 border border-white/15 rounded px-1.5 py-1 text-white text-[11px]" />
            </label>
          ))}
          <button onClick={() => onUpdate({ entAllow: ent }, `Enterprise allowance set: ${user.name}`)} disabled={busy} className="px-2.5 py-1 rounded bg-calibrex-teal/15 border border-calibrex-teal/40 text-calibrex-teal text-[10px] font-black uppercase tracking-widest">Save</button>
        </div>
      )}

      {open && (
        <div className="space-y-2 pt-1">
          {(['A', 'B', 'C'] as const).map(g => (
            <div key={g}>
              <div className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">{GROUP_NAME[g]}</div>
              <div className="flex flex-wrap gap-1.5">
                {features.filter(f => f.group === g).map(f => {
                  const have = e?.allAccess || entitled.has(f.id);
                  return (
                    <button key={f.id} disabled={busy || e?.allAccess}
                      onClick={() => have ? onUpdate({ revokeFeatures: [f.id] }, `Revoked ${f.name}: ${user.name}`) : onUpdate({ grantFeatures: [f.id] }, `Granted ${f.name}: ${user.name}`)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border ${have ? 'bg-calibrex-low/10 border-calibrex-low/40 text-calibrex-low' : 'bg-black/30 border-white/10 text-white/60 hover:border-calibrex-teal/40'}`}>
                      {have ? <Check size={11} /> : <Plus size={11} />} {f.name}{have && !e?.allAccess && <Minus size={10} className="opacity-50" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {e?.allAccess && <p className="text-[10px] text-white/40">All-Access is on — every feature is granted. Turn it off to grant individually.</p>}
        </div>
      )}
    </div>
  );
};

export default AdminUserPlan;
