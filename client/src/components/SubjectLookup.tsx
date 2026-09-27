import React, { useEffect, useState } from 'react';
import { UserSearch, Loader2, Phone, AtSign, ShieldAlert, ExternalLink, Lock, FileCheck2, AlertTriangle } from 'lucide-react';
import { subject, SubjectStatus, PhoneResult, UsernameResult } from '../lib/subject';

/** Gated subject-lookup screen. Shows the right state: off, not allowed,
 *  consent required, or the working tool. */
const SubjectLookup: React.FC<{ onNotify: (m: string) => void }> = ({ onNotify }) => {
  const [st, setSt] = useState<SubjectStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'phone' | 'username'>('phone');
  const [value, setValue] = useState('');
  const [purpose, setPurpose] = useState('');
  const [caseRef, setCaseRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState<PhoneResult | null>(null);
  const [user, setUser] = useState<UsernameResult | null>(null);
  const [accepting, setAccepting] = useState(false);

  const load = () => subject.status().then(setSt).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const accept = async () => { setAccepting(true); try { setSt(await subject.consent()); onNotify('Agreement accepted'); } catch (e: any) { setError(e.message); } finally { setAccepting(false); } };

  const run = async () => {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true); setError(null); setPhone(null); setUser(null);
    try {
      if (tab === 'phone') { const r = await subject.phone(v, purpose, caseRef); setPhone(r.result); setSt(s => s && { ...s, usedToday: r.usedToday }); }
      else { const r = await subject.username(v, purpose, caseRef); setUser(r.result); setSt(s => s && { ...s, usedToday: r.usedToday }); }
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  if (!st) return <div className="p-10 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>;

  const Header = (
    <div className="mb-4">
      <div className="flex items-center gap-2"><UserSearch size={20} className="text-calibrex-teal" /><h2 className="text-xl font-bold text-white">Subject Lookup</h2></div>
      <p className="text-sm text-calibrex-muted">Investigative link-building for a phone number or username. It returns public metadata and candidate links to check — never a confirmed identity. Every search is logged.</p>
    </div>
  );

  if (!st.enabled) return <div className="p-4 sm:p-6 max-w-3xl mx-auto">{Header}<div className="p-6 rounded-lg border border-white/10 bg-calibrex-surface text-center"><Lock size={28} className="mx-auto text-calibrex-muted mb-2" /><p className="text-sm text-calibrex-muted">Subject lookups are switched off for this workspace. Everything else in Calibrex works without them.</p></div></div>;
  if (!st.allowed) return <div className="p-4 sm:p-6 max-w-3xl mx-auto">{Header}<div className="p-6 rounded-lg border border-white/10 bg-calibrex-surface text-center"><Lock size={28} className="mx-auto text-calibrex-muted mb-2" /><p className="text-sm text-calibrex-muted">This feature is available but not enabled for your account. Ask your provider to grant access.</p></div></div>;

  if (!st.consented) return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">{Header}
      <div className="p-5 rounded-lg border border-calibrex-gold/40 bg-calibrex-gold/5">
        <div className="flex items-center gap-2 text-calibrex-gold font-bold mb-3"><FileCheck2 size={18} /> Acceptable Use Agreement</div>
        <pre className="text-sm text-calibrex-text whitespace-pre-wrap leading-relaxed font-sans mb-4">{st.agreementText}</pre>
        <button onClick={accept} disabled={accepting} className="px-5 py-2.5 rounded bg-calibrex-teal text-calibrex-navy font-black text-sm flex items-center gap-2 disabled:opacity-50">{accepting ? <Loader2 size={15} className="animate-spin" /> : <FileCheck2 size={15} />} I accept and will comply</button>
        <p className="text-xs text-calibrex-muted mt-3">Your acceptance is recorded with a timestamp. You can be asked to account for any search you run.</p>
      </div>
    </div>
  );

  const remaining = Math.max(0, st.dailyLimit - st.usedToday);
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">{Header}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1">
          <button onClick={() => { setTab('phone'); setValue(''); }} className={`px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 ${tab === 'phone' ? 'bg-calibrex-teal text-calibrex-navy' : 'bg-white/5 text-calibrex-muted'}`}><Phone size={14} /> Phone</button>
          <button onClick={() => { setTab('username'); setValue(''); }} className={`px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 ${tab === 'username' ? 'bg-calibrex-teal text-calibrex-navy' : 'bg-white/5 text-calibrex-muted'}`}><AtSign size={14} /> Username</button>
        </div>
        <span className="ml-auto text-xs text-calibrex-muted">{remaining} of {st.dailyLimit} lookups left today</span>
      </div>

      <div className="p-4 rounded-lg bg-calibrex-surface border border-white/10 space-y-3">
        <input value={value} onChange={e => setValue(e.target.value)} placeholder={tab === 'phone' ? '+91 98xxxxxxxx (include country code)' : 'username or @handle'} className="w-full bg-black/30 border border-white/15 rounded px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-calibrex-teal" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input value={caseRef} onChange={e => setCaseRef(e.target.value)} placeholder="Case reference (optional)" className="bg-black/30 border border-white/15 rounded px-3 py-2 text-sm text-white" />
          <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Purpose (required, logged)" className="sm:col-span-2 bg-black/30 border border-white/15 rounded px-3 py-2 text-sm text-white" />
        </div>
        <button onClick={run} disabled={!value.trim() || busy || remaining === 0} className="w-full px-5 py-2.5 rounded bg-calibrex-teal text-calibrex-navy font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <UserSearch size={15} />} Look up</button>
        <p className="text-xs text-calibrex-muted flex items-start gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5 text-calibrex-medium" /> Results are unverified leads, not identification. The same username or number can belong to different, unrelated people.</p>
      </div>

      {error && <div role="alert" className="mt-3 text-sm text-calibrex-critical">{error}</div>}

      {phone && (
        <div className="mt-4 p-4 rounded-lg bg-calibrex-surface border border-white/10 space-y-2">
          <div className="text-lg font-bold text-white font-mono">{phone.international}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-calibrex-muted">Valid: </span><span className={phone.valid ? 'text-calibrex-low' : 'text-calibrex-high'}>{phone.valid ? 'Yes' : 'No / uncertain'}</span></div>
            <div><span className="text-calibrex-muted">Country: </span>{phone.country || '—'} ({phone.countryCallingCode})</div>
            <div><span className="text-calibrex-muted">Line type: </span>{phone.type.replace('_', ' ')}</div>
            <div><span className="text-calibrex-muted">National: </span><span className="font-mono">{phone.national}</span></div>
          </div>
          <p className="text-xs text-calibrex-muted">{phone.carrierNote}</p>
          <div className="flex flex-wrap gap-2 pt-1">{phone.searchLinks.map(l => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded border border-white/15 text-xs text-calibrex-text hover:border-calibrex-teal flex items-center gap-1.5">{l.label} <ExternalLink size={11} /></a>)}</div>
        </div>
      )}

      {user && (
        <div className="mt-4 p-4 rounded-lg bg-calibrex-surface border border-white/10">
          <div className="text-lg font-bold text-white mb-1">@{user.username}</div>
          <div className="p-2.5 rounded bg-calibrex-medium/10 border border-calibrex-medium/30 text-xs text-calibrex-medium flex items-start gap-1.5 mb-3"><ShieldAlert size={13} className="shrink-0 mt-0.5" /> {user.caution}</div>
          <div className="flex flex-wrap gap-2 mb-3">{user.aggregators.map(a => <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded border border-calibrex-teal/40 text-xs text-calibrex-teal hover:bg-calibrex-teal/10 flex items-center gap-1.5">{a.label} <ExternalLink size={11} /></a>)}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {user.profiles.map(pr => <a key={pr.name} href={pr.url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded bg-black/30 border border-white/10 text-sm text-white hover:border-calibrex-teal flex items-center justify-between gap-2"><span className="truncate">{pr.name}</span><ExternalLink size={12} className="shrink-0 text-calibrex-muted" /></a>)}
          </div>
          <p className="text-xs text-calibrex-muted mt-3">Calibrex builds these links; it does not open them for you. Open the ones relevant to your investigation and verify each independently.</p>
        </div>
      )}
    </div>
  );
};

export default SubjectLookup;
