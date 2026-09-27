import React, { useEffect, useState } from 'react';
import { UserSearch, Loader2, ScrollText, Save, FileText } from 'lucide-react';
import { subjectAdmin, AdminSubject as AdminSubjectData, AuditEntry } from '../lib/subject';

/** Owner controls for Phase 3: master switch, per-user access, daily limit, audit log. */
const AdminSubject: React.FC<{ onNotify: (m: string) => void }> = ({ onNotify }) => {
  const [data, setData] = useState<AdminSubjectData | null>(null);
  const [limit, setLimit] = useState(25);
  const [agreement, setAgreement] = useState('');
  const [savingAgreement, setSavingAgreement] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => subjectAdmin.get().then(d => { setData(d); setLimit(d.dailyLimit); setAgreement(d.agreementText); }).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const toggle = async () => { if (!data) return; try { const r = await subjectAdmin.set({ enabled: !data.enabled }); setData({ ...data, enabled: r.enabled }); onNotify(r.enabled ? 'Subject lookups switched ON for granted users' : 'Subject lookups switched OFF'); } catch (e: any) { setError(e.message); } };
  const saveLimit = async () => { try { const r = await subjectAdmin.set({ dailyLimit: limit }); setLimit(r.dailyLimit); onNotify('Daily limit saved'); } catch (e: any) { setError(e.message); } };
  const setUser = async (id: string, allowed: boolean) => {
    if (!data) return;
    try { await subjectAdmin.setUser(id, allowed); setData({ ...data, users: data.users.map(u => u.id === id ? { ...u, allowed } : u) }); }
    catch (e: any) { setError(e.message); }
  };
  const saveAgreement = async () => {
    setSavingAgreement(true); setError(null);
    try { const r = await subjectAdmin.set({ agreementText: agreement }); setData(d => d && { ...d, agreementText: r.agreementText, agreementVersion: r.agreementVersion, agreementUpdatedAt: r.agreementUpdatedAt, agreementUpdatedBy: r.agreementUpdatedBy }); onNotify('Agreement saved. Users must accept the new version on their next lookup.'); }
    catch (e: any) { setError(e.message); } finally { setSavingAgreement(false); }
  };
  const openAudit = async () => { setShowAudit(true); if (!audit) subjectAdmin.audit().then(r => setAudit(r.entries)).catch(e => setError(e.message)); };

  if (!data) return <section className="bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5 mt-6"><Loader2 size={16} className="animate-spin text-calibrex-teal" /></section>;

  return (
    <section className="bg-calibrex-surface border border-calibrex-critical/30 rounded-lg p-4 sm:p-5 mt-6">
      <h3 className="text-base font-bold text-calibrex-gold flex items-center gap-2 mb-1"><UserSearch size={16} /> Subject lookups (Phase 3)</h3>
      <p className="text-sm text-calibrex-muted mb-3">Lets granted users look up a phone number (public metadata) or username (candidate profile links). It touches personal data, so keep it off unless you have vetted the user and taken legal advice. Off by default; every search is logged below.</p>

      <div className="flex flex-wrap items-center gap-4">
        <button role="switch" aria-checked={data.enabled} onClick={toggle} className={`flex items-center gap-3 px-3 py-2 rounded border text-sm font-bold ${data.enabled ? 'border-calibrex-critical text-calibrex-critical bg-calibrex-critical/10' : 'border-white/15 text-calibrex-muted'}`}>
          <span className={`w-9 h-5 rounded-full relative transition-colors ${data.enabled ? 'bg-calibrex-critical' : 'bg-white/20'}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${data.enabled ? 'left-[18px]' : 'left-0.5'}`} /></span>
          {data.enabled ? 'ENABLED for granted users' : 'Off for everyone'}
        </button>
        <label className="flex items-center gap-2 text-sm text-calibrex-muted">Daily limit per user
          <input type="number" min={1} max={500} value={limit} onChange={e => setLimit(Number(e.target.value))} className="w-20 bg-black/30 border border-white/15 rounded px-2 py-1.5 text-white" />
          <button onClick={saveLimit} className="px-2 py-1.5 rounded border border-white/15 text-white flex items-center gap-1"><Save size={13} /></button>
        </label>
        <button onClick={openAudit} className="text-sm font-bold text-calibrex-teal flex items-center gap-1.5 hover:underline"><ScrollText size={14} /> View audit log</button>
      </div>

      <div className="mt-4">
        <div className="text-sm font-bold text-white mb-2">Who can use it</div>
        <ul className="divide-y divide-white/5 max-h-64 overflow-y-auto custom-scrollbar">
          {data.users.filter(u => u.status === 'active' || u.isAdmin).map(u => (
            <li key={u.id} className="py-2 flex items-center gap-3">
              <div className="flex-1 min-w-0"><div className="text-sm text-white truncate">{u.name || u.email} {u.isAdmin && <span className="text-xs text-calibrex-gold">(admin)</span>}</div><div className="text-xs text-calibrex-muted truncate">{u.email}</div></div>
              {u.isAdmin ? <span className="text-xs text-calibrex-muted">always</span> : (
                <button role="switch" aria-checked={u.allowed} onClick={() => setUser(u.id, !u.allowed)} className={`shrink-0 w-9 h-5 rounded-full relative transition-colors ${u.allowed ? 'bg-calibrex-teal' : 'bg-white/20'}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${u.allowed ? 'left-[18px]' : 'left-0.5'}`} /></button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 pt-4 border-t border-white/10">
        <div className="text-sm font-bold text-white flex items-center gap-2 mb-1"><FileText size={14} /> Acceptable Use Agreement</div>
        <p className="text-xs text-calibrex-muted mb-2">Users must accept this text on <b>every</b> lookup, and each acceptance is logged. Paste your lawyer's wording here. Editing it means everyone re-accepts the new version. {data.agreementUpdatedAt ? `Last edited ${new Date(data.agreementUpdatedAt).toLocaleString()}${data.agreementUpdatedBy ? ` by ${data.agreementUpdatedBy}` : ''}.` : 'Currently the built-in default.'}</p>
        <textarea value={agreement} onChange={e => setAgreement(e.target.value)} rows={10} spellCheck className="w-full bg-black/30 border border-white/15 rounded px-3 py-2 text-sm text-white font-sans leading-relaxed focus:outline-none focus:border-calibrex-teal" />
        <div className="mt-2 flex items-center justify-end gap-3">
          {data.agreementText !== agreement && <span className="text-xs text-calibrex-gold">Unsaved changes</span>}
          <button onClick={saveAgreement} disabled={savingAgreement || agreement.trim().length < 40 || data.agreementText === agreement} className="px-4 py-2 rounded bg-calibrex-teal text-calibrex-navy text-sm font-black flex items-center gap-1.5 disabled:opacity-40">{savingAgreement ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save agreement</button>
        </div>
      </div>

      {showAudit && (
        <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4" onClick={() => setShowAudit(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#0a1420] border border-white/10 rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10"><span className="font-bold text-white flex items-center gap-2"><ScrollText size={16} /> Subject-lookup audit log</span><button onClick={() => setShowAudit(false)} className="text-calibrex-muted hover:text-white">Close</button></div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {!audit ? <Loader2 size={16} className="animate-spin text-calibrex-teal" /> : audit.length === 0 ? <p className="text-sm text-calibrex-muted">No lookups yet.</p> : (
                <table className="w-full text-xs"><thead><tr className="text-calibrex-muted text-left"><th className="py-1 pr-3">When</th><th className="pr-3">User</th><th className="pr-3">Type</th><th className="pr-3">Query</th><th className="pr-3">Purpose</th><th>Accepted</th></tr></thead>
                  <tbody>{audit.map(e => <tr key={e.id} className="border-t border-white/5 align-top"><td className="py-1.5 pr-3 whitespace-nowrap text-calibrex-muted">{new Date(e.at).toLocaleString()}</td><td className="pr-3 truncate max-w-[120px]">{e.email}</td><td className="pr-3">{e.kind}</td><td className="pr-3 font-mono break-all max-w-[140px]">{e.query}</td><td className="pr-3 text-calibrex-muted">{e.caseRef ? `[${e.caseRef}] ` : ''}{e.purpose}</td><td className="text-calibrex-muted whitespace-nowrap">{e.accepted ? `✓ ${(e.agreementVersion || '').slice(0, 8)}` : (e.kind === 'phone' || e.kind === 'username') ? '—' : ''}</td></tr>)}</tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
      {error && <div role="alert" className="mt-3 text-sm text-calibrex-critical">{error}</div>}
    </section>
  );
};

export default AdminSubject;
