import React, { useEffect, useState } from 'react';
import { UserCog, Save, Loader2, Check } from 'lucide-react';
import { api, ApiError } from '../lib/api';

interface Profile { title?: string; phone?: string; location?: string; bio?: string }
interface MeProfile { user: { name: string; org: string; email: string; role: string }; profile: Profile }

const FIELDS: { key: keyof Profile; label: string; placeholder: string; textarea?: boolean }[] = [
  { key: 'title', label: 'Title / designation', placeholder: 'e.g. Senior Intelligence Analyst' },
  { key: 'location', label: 'Location', placeholder: 'e.g. New Delhi, India' },
  { key: 'phone', label: 'Contact (phone / Signal)', placeholder: 'e.g. +91…' },
  { key: 'bio', label: 'About you', placeholder: 'A line or two about your focus areas.', textarea: true },
];

/** Self-service profile editing. Changes are audited server-side and visible to the master admin. */
const ProfileEditor: React.FC<{ onNotify?: (m: string) => void }> = ({ onNotify }) => {
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [ext, setExt] = useState<Profile>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<MeProfile>('/me/profile').then(r => {
      setName(r.user.name || ''); setOrg(r.user.org || ''); setEmail(r.user.email || '');
      setExt(r.profile || {});
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const save = () => {
    if (!name.trim()) { setErr('Name cannot be empty.'); return; }
    setSaving(true); setErr(null);
    api<{ changed: number }>('/me/profile', { method: 'PUT', body: { name, org, ...ext } })
      .then(r => {
        setSaved(true); setTimeout(() => setSaved(false), 2000);
        onNotify?.(r.changed ? 'Profile updated.' : 'No changes to save.');
        if (r.changed) window.dispatchEvent(new Event('cx:user-updated'));
      })
      .catch((e: unknown) => setErr(e instanceof ApiError ? e.message : 'Could not save your profile.'))
      .finally(() => setSaving(false));
  };

  const input = 'w-full bg-calibrex-surface-light border border-calibrex-teal/30 rounded px-3 py-2 text-calibrex-text text-sm focus:outline-none focus:border-calibrex-teal';

  return (
    <section className="bg-calibrex-surface border border-calibrex-teal/30 rounded-lg p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-bold text-calibrex-teal mb-1 flex items-center gap-2"><UserCog size={18} /> Your profile</h2>
      <p className="text-sm text-calibrex-muted mb-5">Keep your operator details current. Changes are logged and visible to your administrator.</p>

      {!loaded ? <div className="flex justify-center py-8 text-calibrex-teal"><Loader2 className="animate-spin" /></div> : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-calibrex-text text-sm font-bold mb-2">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={80} className={input} />
            </div>
            <div>
              <label className="block text-calibrex-text text-sm font-bold mb-2">Organisation</label>
              <input value={org} onChange={e => setOrg(e.target.value)} maxLength={120} className={input} placeholder="e.g. Independent" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {FIELDS.filter(f => !f.textarea).map(f => (
              <div key={f.key}>
                <label className="block text-calibrex-text text-sm font-bold mb-2">{f.label}</label>
                <input value={ext[f.key] || ''} onChange={e => setExt(p => ({ ...p, [f.key]: e.target.value }))} className={input} placeholder={f.placeholder} />
              </div>
            ))}
          </div>

          {FIELDS.filter(f => f.textarea).map(f => (
            <div key={f.key}>
              <label className="block text-calibrex-text text-sm font-bold mb-2">{f.label}</label>
              <textarea value={ext[f.key] || ''} onChange={e => setExt(p => ({ ...p, [f.key]: e.target.value }))} rows={3} maxLength={500} className={input + ' resize-none'} placeholder={f.placeholder} />
            </div>
          ))}

          <div className="flex items-center gap-3 text-xs text-calibrex-muted">
            <span className="font-bold">Sign-in email:</span> <span className="font-mono">{email}</span>
            <span className="text-white/30">(managed by your administrator)</span>
          </div>

          {err && <div className="text-[12px] text-calibrex-critical font-bold">{err}</div>}

          <button onClick={save} disabled={saving} className={`w-full font-bold py-3 rounded uppercase tracking-wide transition-colors flex justify-center items-center gap-2 text-sm ${saved ? 'bg-calibrex-low/20 text-calibrex-low border border-calibrex-low/40' : 'bg-calibrex-teal hover:bg-[#3aa5b5] text-calibrex-navy'}`}>
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving</> : saved ? <><Check size={16} /> Saved</> : <><Save size={16} /> Save profile</>}
          </button>
        </div>
      )}
    </section>
  );
};

export default ProfileEditor;
