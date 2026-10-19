import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Check, Lock, Plus, Crown, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';
import { sub, Catalogue, Entitlement, FeatureDef, PlanDef, PlanId, GroupCount } from '../lib/api';

const GROUP_NAME: Record<string, string> = { A: 'Dashboards', B: 'Investigation tools', C: 'Output & reporting' };
const money = (n: number | null) => (n == null ? 'Custom' : '₹' + n.toLocaleString('en-IN'));

/** Plans & Features — pricing, the locked first selection, and a-la-carte requests. */
const PlansFeatures: React.FC<{ onNotify: (m: string) => void }> = ({ onNotify }) => {
  const [cat, setCat] = useState<Catalogue | null>(null);
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [c, e] = await Promise.all([sub.catalogue(), sub.mine()]);
      setCat(c); setEnt(e.entitlement);
      setPick(new Set(e.entitlement.selected));
      setError(null);
    } catch (err: any) { setError(err?.message || 'Could not load plans.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const byGroup = useMemo(() => {
    const g: Record<string, FeatureDef[]> = { A: [], B: [], C: [] };
    (cat?.features || []).forEach(f => g[f.group].push(f));
    return g;
  }, [cat]);

  if (loading) return <div className="py-24 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>;
  if (error || !cat || !ent) return <div className="p-8 text-center text-calibrex-critical text-sm">{error || 'Unavailable.'}</div>;

  const allow = ent.allowance;
  const picked = { A: 0, B: 0, C: 0 } as GroupCount;
  pick.forEach(id => { const f = cat.features.find(x => x.id === id); if (f) picked[f.group]++; });
  const overAny = picked.A > allow.A || picked.B > allow.B || picked.C > allow.C;
  const needResearch = ent.plan === 'starter' && !pick.has('research');
  const canConfirm = !ent.locked && !overAny && !needResearch && (picked.A + picked.B + picked.C > 0);

  const togglePick = (f: FeatureDef) => {
    if (ent.locked) return;
    setPick(prev => {
      const n = new Set(prev);
      if (n.has(f.id)) n.delete(f.id);
      else { if (picked[f.group] >= allow[f.group]) return prev; n.add(f.id); }
      return n;
    });
  };

  const confirm = async () => {
    setSaving(true);
    try { const r = await sub.select([...pick]); setEnt(r.entitlement); onNotify('Your plan features are set.'); }
    catch (e: any) { onNotify(e?.message || 'Could not save selection.'); }
    finally { setSaving(false); }
  };

  const requestFeature = async (f: FeatureDef) => {
    try { await sub.request({ featureId: f.id }); setRequested(p => new Set(p).add(f.id)); onNotify(`Requested ${f.name} — pending admin approval.`); }
    catch (e: any) { onNotify(e?.message || 'Could not send request.'); }
  };
  const requestPlan = async (p: PlanDef) => {
    try { await sub.request({ plan: p.id }); onNotify(`Requested the ${p.name} plan — pending admin approval.`); }
    catch (e: any) { onNotify(e?.message || 'Could not send request.'); }
  };

  const entitled = new Set(ent.entitled);
  const price = (p: PlanDef) => (cycle === 'annual' ? p.annual : p.monthly);
  const perItem = (g: string) => (cycle === 'annual' ? (cat.groupPrice as any)[g] * cat.annualMonths : (cat.groupPrice as any)[g]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-8">
      {/* Header + current plan */}
      <div>
        <div className="text-[10px] font-mono font-black text-calibrex-gold uppercase tracking-[0.25em] mb-1">Subscription</div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Plans &amp; Features</h1>
        <p className="text-sm text-calibrex-muted mt-2">You’re on the <b className="text-white capitalize">{ent.plan}</b> plan{ent.allAccess ? ' · all-access granted' : ''}. {ent.monthly != null && ent.plan !== 'demo' && <>Bundle price <b className="text-calibrex-teal">{money(cycle === 'annual' ? ent.annual : ent.monthly)}/{cycle === 'annual' ? 'yr' : 'mo'}</b>.</>}</p>
      </div>

      {/* Billing cycle toggle */}
      <div className="inline-flex rounded-xl border border-white/10 overflow-hidden text-[11px] font-black uppercase tracking-widest">
        <button onClick={() => setCycle('monthly')} className={`px-4 py-2 ${cycle === 'monthly' ? 'bg-calibrex-teal text-calibrex-navy' : 'text-calibrex-muted'}`}>Monthly</button>
        <button onClick={() => setCycle('annual')} className={`px-4 py-2 ${cycle === 'annual' ? 'bg-calibrex-teal text-calibrex-navy' : 'text-calibrex-muted'}`}>Annual · 2 months free</button>
      </div>

      {/* First selection picker (while unlocked) */}
      {!ent.allAccess && !ent.locked && (allow.A + allow.B + allow.C > 0) && (
        <div className="rounded-2xl border border-calibrex-gold/30 bg-calibrex-surface p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-1"><Sparkles size={16} className="text-calibrex-gold" /><h2 className="text-base font-black text-white uppercase tracking-widest">Choose your features</h2></div>
          <p className="text-[12px] text-calibrex-muted mb-4">Pick within your plan’s allowance, then confirm. <b className="text-white">Your selection locks</b> — to change later you add features a-la-carte or request an upgrade.</p>
          {(['A', 'B', 'C'] as const).map(g => allow[g] > 0 && (
            <div key={g} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-white uppercase tracking-widest">{GROUP_NAME[g]}</span>
                <span className={`text-[10px] font-mono ${picked[g] > allow[g] ? 'text-calibrex-critical' : 'text-white/45'}`}>{picked[g]}/{allow[g]} chosen</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {byGroup[g].map(f => {
                  const on = pick.has(f.id);
                  const full = !on && picked[f.group] >= allow[f.group];
                  const must = g === 'B' && f.id === 'research' && ent.plan === 'starter';
                  return (
                    <button key={f.id} onClick={() => togglePick(f)} disabled={full} className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left text-[13px] transition ${on ? 'border-calibrex-gold/60 bg-calibrex-gold/10 text-white' : full ? 'border-white/5 bg-black/20 text-white/30' : 'border-white/10 bg-black/30 text-white/80 hover:border-calibrex-gold/40'}`}>
                      <span className={`w-4 h-4 rounded shrink-0 flex items-center justify-center border ${on ? 'bg-calibrex-gold border-calibrex-gold text-calibrex-navy' : 'border-white/25'}`}>{on && <Check size={12} />}</span>
                      <span className="flex-1">{f.name}{must && <span className="ml-1 text-[9px] text-calibrex-gold font-black uppercase">· required</span>}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {needResearch && <p className="text-[11px] text-calibrex-gold mb-2">Intelligence Research is required on Starter.</p>}
          <button onClick={confirm} disabled={!canConfirm || saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-calibrex-gold text-calibrex-navy font-black text-[11px] uppercase tracking-widest disabled:opacity-40">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} Confirm &amp; lock selection
          </button>
        </div>
      )}

      {/* Your features (locked view) + a-la-carte */}
      {(ent.locked || ent.allAccess) && (
        <div className="rounded-2xl border border-white/10 bg-calibrex-surface p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4"><ShieldCheck size={16} className="text-calibrex-teal" /><h2 className="text-base font-black text-white uppercase tracking-widest">Your features</h2></div>
          {(['A', 'B', 'C'] as const).map(g => (
            <div key={g} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-white uppercase tracking-widest">{GROUP_NAME[g]}</span>
                <span className="text-[10px] font-mono text-white/45">add-on {money(perItem(g))}/{cycle === 'annual' ? 'yr' : 'mo'} each</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {byGroup[g].map(f => {
                  const have = ent.allAccess || entitled.has(f.id);
                  const req = requested.has(f.id);
                  return (
                    <div key={f.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-[13px] ${have ? 'border-calibrex-low/30 bg-calibrex-low/5 text-white' : 'border-white/10 bg-black/30 text-white/70'}`}>
                      {have ? <Check size={15} className="text-calibrex-low shrink-0" /> : <Lock size={13} className="text-white/35 shrink-0" />}
                      <span className="flex-1">{f.name}</span>
                      {!have && (req
                        ? <span className="text-[9px] font-black uppercase tracking-widest text-calibrex-gold">Requested</span>
                        : <button onClick={() => requestFeature(f)} className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-calibrex-teal hover:text-white"><Plus size={12} /> Add</button>)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-white/40">Add-ons and upgrades are reviewed by your administrator. Billing is handled by Calibrex directly.</p>
        </div>
      )}

      {/* Pricing table */}
      <div>
        <h2 className="text-base font-black text-white uppercase tracking-widest mb-3">All plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {cat.plans.map(p => {
            const current = p.id === ent.plan;
            return (
              <div key={p.id} className={`rounded-2xl border p-5 flex flex-col ${current ? 'border-calibrex-gold/50 bg-calibrex-gold/5' : 'border-white/10 bg-calibrex-surface'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white">{p.name}</h3>
                  {current && <span className="text-[9px] font-black uppercase tracking-widest text-calibrex-gold bg-calibrex-gold/15 border border-calibrex-gold/30 rounded px-2 py-0.5">Current</span>}
                </div>
                <div className="mt-2 mb-3">
                  <span className="text-2xl font-black text-white">{p.free ? 'Free' : money(price(p))}</span>
                  {!p.free && p.monthly != null && <span className="text-[11px] text-white/45">/{cycle === 'annual' ? 'yr' : 'mo'}</span>}
                  {p.custom && <span className="text-[11px] text-white/45"> — contact us</span>}
                </div>
                <ul className="text-[12px] text-calibrex-muted space-y-1 flex-1">
                  {p.allow ? (
                    <>
                      <li>{p.allow.A} dashboard{p.allow.A === 1 ? '' : 's'} (A)</li>
                      <li>{p.allow.B} tool{p.allow.B === 1 ? '' : 's'} (B){p.requireB?.includes('research') ? ' · incl. Research' : ''}</li>
                      <li>{p.allow.C} output{p.allow.C === 1 ? '' : 's'} (C)</li>
                    </>
                  ) : <li>Custom allowance, up to the full platform</li>}
                  <li className="text-white/40">+ a-la-carte any time</li>
                </ul>
                {!current && !p.free && (
                  <button onClick={() => requestPlan(p)} className="mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-calibrex-teal/40 text-calibrex-teal text-[10px] font-black uppercase tracking-widest hover:bg-calibrex-teal/10">
                    {p.id === 'enterprise' ? 'Request a quote' : 'Request this plan'} <ArrowRight size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/45"><Crown size={13} className="text-calibrex-gold" /> All-Access is granted at the administrator’s discretion. Annual billing = pay for 10 months (2 months free).</div>
      </div>
    </div>
  );
};

export default PlansFeatures;
