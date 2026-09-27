import React, { useEffect, useState } from 'react';
import { Sparkles, Rss, Plus, Trash2, Loader2, FlaskConical, Save, Mail } from 'lucide-react';
import { adminExtra, CustomFeed } from '../lib/features';
import { reloadAiStatus } from '../lib/features';
import { WIRES, WireKey } from '../lib/live';

/** Owner controls: AI switch and extra RSS/Atom feeds merged into the live wires. */
const AdminWorkspace: React.FC<{ onNotify: (m: string) => void }> = ({ onNotify }) => {
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [feeds, setFeeds] = useState<CustomFeed[]>([]);
  const [saved, setSaved] = useState<string>('[]');
  const [draft, setDraft] = useState({ name: '', url: '', wire: 'auto' });
  const [test, setTest] = useState<{ busy: boolean; result: string | null; ok: boolean }>({ busy: false, result: null, ok: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminExtra.settings().then(r => { setAiEnabled(r.aiEnabled); setEmailConfigured(r.emailConfigured); }).catch(e => setError(e.message));
    adminExtra.feeds().then(r => { setFeeds(r.feeds); setSaved(JSON.stringify(r.feeds)); }).catch(e => setError(e.message));
  }, []);

  const toggleAi = async () => {
    try {
      const r = await adminExtra.setAiEnabled(!aiEnabled);
      setAiEnabled(r.aiEnabled);
      reloadAiStatus();
      onNotify(r.aiEnabled ? 'AI features switched on for all users' : 'AI features switched off for all users');
    } catch (e: any) { setError(e.message); }
  };

  const runTest = async () => {
    setTest({ busy: true, result: null, ok: false });
    try {
      const r = await adminExtra.testFeed(draft.url.trim(), draft.wire);
      setTest({ busy: false, ok: r.items > 0, result: r.items > 0
        ? `Works: ${r.entries} entries, ${r.items} would be added. Example: “${r.sample[0]?.title}” (${r.sample[0]?.wire}, ${r.sample[0]?.severity})`
        : `The feed has ${r.entries} entries but none match a wire. Pick a specific wire instead of Auto so every item is kept.` });
    } catch (e: any) { setTest({ busy: false, ok: false, result: e.message }); }
  };

  const add = () => {
    if (!draft.name.trim() || !/^https?:\/\//i.test(draft.url.trim())) { setError('Give the feed a name and a full address starting with https://'); return; }
    setError(null);
    setFeeds(f => [...f, { id: Date.now().toString(36), name: draft.name.trim(), url: draft.url.trim(), wire: draft.wire }]);
    setDraft({ name: '', url: '', wire: 'auto' });
    setTest({ busy: false, result: null, ok: false });
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const r = await adminExtra.saveFeeds(feeds);
      setFeeds(r.feeds); setSaved(JSON.stringify(r.feeds));
      onNotify('Feeds saved. They are pulled on the next refresh (within 5 minutes).');
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };
  const dirty = JSON.stringify(feeds) !== saved;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
      <section className="bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-calibrex-gold flex items-center gap-2 mb-1"><Sparkles size={16} /> AI features</h3>
          <p className="text-sm text-calibrex-muted mb-3">When on, each user can connect their own Claude, ChatGPT or Gemini account under Settings. Usage is billed to their account, not yours.</p>
          {aiEnabled === null ? <Loader2 size={16} className="animate-spin text-calibrex-teal" /> : (
            <button id="admin-ai-toggle" role="switch" aria-checked={aiEnabled} onClick={toggleAi} className={`flex items-center gap-3 px-3 py-2 rounded border text-sm font-bold ${aiEnabled ? 'border-calibrex-teal text-calibrex-teal bg-calibrex-teal/10' : 'border-white/15 text-calibrex-muted'}`}>
              <span className={`w-9 h-5 rounded-full relative transition-colors ${aiEnabled ? 'bg-calibrex-teal' : 'bg-white/20'}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${aiEnabled ? 'left-[18px]' : 'left-0.5'}`} /></span>
              {aiEnabled ? 'On for all users' : 'Off for all users'}
            </button>
          )}
        </div>
        <div className="pt-4 border-t border-white/10">
          <h3 className="text-base font-bold text-calibrex-gold flex items-center gap-2 mb-1"><Mail size={16} /> Email alerts</h3>
          <p className="text-sm text-calibrex-muted">{emailConfigured ? 'Configured. Users can turn on watchlist emails.' : 'Not configured. Add RESEND_API_KEY and EMAIL_FROM in Render → Environment to let users receive watchlist emails.'}</p>
        </div>
      </section>

      <section className="xl:col-span-2 bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5">
        <h3 className="text-base font-bold text-calibrex-gold flex items-center gap-2 mb-1"><Rss size={16} /> Custom feeds</h3>
        <p className="text-sm text-calibrex-muted mb-4">Add any RSS or Atom feed (a ministry, a regional paper, a security blog). Its items join the live wires, map, alerts, watchlists and trends.</p>

        <ul className="space-y-2 mb-4">
          {feeds.length === 0 && <li className="text-sm text-calibrex-muted">No custom feeds yet.</li>}
          {feeds.map(f => (
            <li key={f.id} className="flex items-center gap-3 p-2.5 rounded bg-black/25 border border-white/5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{f.name} <span className="text-xs font-normal text-calibrex-muted">→ {f.wire === 'auto' ? 'Auto (by keyword)' : WIRES[f.wire as WireKey]?.label || f.wire}</span></div>
                <div className="text-xs text-calibrex-muted truncate">{f.url}</div>
              </div>
              <button onClick={() => setFeeds(list => list.filter(x => x.id !== f.id))} className="p-1.5 text-calibrex-muted hover:text-calibrex-critical" title="Remove feed"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <input id="feed-name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Name, e.g. Dawn" maxLength={60} className="sm:col-span-2 bg-black/30 border border-white/15 rounded px-3 py-2 text-sm text-white" />
          <input id="feed-url" value={draft.url} onChange={e => { setDraft({ ...draft, url: e.target.value }); setTest({ busy: false, result: null, ok: false }); }} placeholder="https://example.com/rss.xml" className="sm:col-span-4 bg-black/30 border border-white/15 rounded px-3 py-2 text-sm text-white" />
          <select aria-label="Wire" value={draft.wire} onChange={e => setDraft({ ...draft, wire: e.target.value })} className="sm:col-span-2 bg-black/30 border border-white/15 rounded px-2 py-2 text-sm text-white">
            <option value="auto">Auto (sort by keyword)</option>
            {(Object.keys(WIRES) as WireKey[]).map(k => <option key={k} value={k}>{WIRES[k].label}</option>)}
          </select>
          <button onClick={runTest} disabled={!draft.url.trim() || test.busy} className="sm:col-span-2 px-3 py-2 rounded border border-calibrex-teal text-calibrex-teal text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40">
            {test.busy ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />} Test feed
          </button>
          <button id="feed-add" onClick={add} disabled={!draft.url.trim() || !draft.name.trim()} className="sm:col-span-2 px-3 py-2 rounded bg-white/10 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"><Plus size={14} /> Add to list</button>
        </div>
        {test.result && <p className={`mt-2 text-sm ${test.ok ? 'text-calibrex-low' : 'text-calibrex-high'}`}>{test.result}</p>}

        <div className="mt-4 flex items-center justify-end gap-3">
          {dirty && <span className="text-xs text-calibrex-gold">Unsaved changes</span>}
          <button id="feeds-save" onClick={save} disabled={!dirty || saving} className="px-4 py-2 rounded bg-calibrex-teal text-calibrex-navy text-sm font-black flex items-center gap-1.5 disabled:opacity-40">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save feeds
          </button>
        </div>
        {error && <div role="alert" className="mt-3 text-sm text-calibrex-critical">{error}</div>}
      </section>
    </div>
  );
};

export default AdminWorkspace;
