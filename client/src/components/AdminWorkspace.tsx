import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Rss, Plus, Trash2, Loader2, FlaskConical, Save, ExternalLink, Layers } from 'lucide-react';
import { adminExtra, CustomFeed, CatalogueSource, SourceHealth, SourceType, reloadAiStatus } from '../lib/features';
import { WIRES, WireKey, timeAgo } from '../lib/live';

const TYPE_LABEL: Record<SourceType, string> = { rss: 'RSS / Atom feed', telegram: 'Telegram channel', bluesky: 'Bluesky account', mastodon: 'Mastodon account' };
const PLACEHOLDER: Record<SourceType, string> = {
  rss: 'https://example.com/rss.xml',
  telegram: 'Public channel name, e.g. osintlive',
  bluesky: 'Handle, e.g. geoconfirmed.org',
  mastodon: 'user@instance, e.g. someone@infosec.exchange',
};
const KIND_LABEL: Record<string, string> = { news: 'News', official: 'Official', analysis: 'Analysis', social: 'Social' };

const Health: React.FC<{ h: SourceHealth | null; enabled?: boolean }> = ({ h, enabled = true }) => {
  if (!enabled) return <span className="text-xs text-calibrex-muted">Off</span>;
  if (!h) return <span className="text-xs text-calibrex-muted">Not pulled yet</span>;
  return (
    <span className={`text-xs tabular-nums ${h.ok ? 'text-calibrex-low' : 'text-calibrex-critical'}`} title={h.error || `Last pulled ${timeAgo(h.at)}`}>
      <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${h.ok ? 'bg-calibrex-low' : 'bg-calibrex-critical'}`} />
      {h.ok ? `${h.count} items` : `Failed: ${String(h.error).slice(0, 40)}`}
    </span>
  );
};

/** Owner controls: AI switch, the source catalogue, and custom sources. */
const AdminWorkspace: React.FC<{ onNotify: (m: string) => void }> = ({ onNotify }) => {
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [catalogue, setCatalogue] = useState<{ groups: string[]; sources: CatalogueSource[]; customHealth: Record<string, SourceHealth> } | null>(null);
  const [feeds, setFeeds] = useState<CustomFeed[]>([]);
  const [saved, setSaved] = useState<string>('[]');
  const [draft, setDraft] = useState<{ name: string; type: SourceType; value: string; wire: string; kind: string }>({ name: '', type: 'rss', value: '', wire: 'auto', kind: 'news' });
  const [test, setTest] = useState<{ busy: boolean; result: string | null; ok: boolean }>({ busy: false, result: null, ok: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCatalogue = () => adminExtra.catalogue().then(setCatalogue).catch(e => setError(e.message));
  useEffect(() => {
    adminExtra.settings().then(r => setAiEnabled(r.aiEnabled)).catch(e => setError(e.message));
    adminExtra.feeds().then(r => { setFeeds(r.feeds); setSaved(JSON.stringify(r.feeds)); }).catch(e => setError(e.message));
    loadCatalogue();
  }, []);

  const toggleAi = async () => {
    try {
      const r = await adminExtra.setAiEnabled(!aiEnabled);
      setAiEnabled(r.aiEnabled);
      reloadAiStatus();
      onNotify(r.aiEnabled ? 'AI features switched on for all users' : 'AI features switched off for all users');
    } catch (e: any) { setError(e.message); }
  };

  const toggleSource = async (id: string) => {
    if (!catalogue) return;
    const sources = catalogue.sources.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    setCatalogue({ ...catalogue, sources });
    try {
      await adminExtra.setDisabled(sources.filter(s => !s.enabled).map(s => s.id));
      const src = sources.find(s => s.id === id)!;
      onNotify(`${src.name} ${src.enabled ? 'switched on' : 'switched off'} from the next refresh`);
    } catch (e: any) { setError(e.message); loadCatalogue(); }
  };

  const draftSource = (): Partial<CustomFeed> => ({
    name: draft.name.trim() || 'test', type: draft.type, wire: draft.wire, kind: draft.type === 'rss' ? draft.kind : 'social',
    ...(draft.type === 'rss' ? { url: draft.value.trim() } : { handle: draft.value.trim().replace(/^@/, '') }),
  });

  const runTest = async () => {
    setTest({ busy: true, result: null, ok: false });
    try {
      const r = await adminExtra.testFeed(draftSource());
      setTest({ busy: false, ok: r.items > 0, result: r.items > 0
        ? `Works: ${r.entries} entries, ${r.items} would be added. Example: “${r.sample[0]?.title}” (${r.sample[0]?.wire}, ${r.sample[0]?.severity})`
        : `Reachable with ${r.entries} entries, but none match a wire right now. Choose a specific wire instead of Auto to keep every item.` });
    } catch (e: any) { setTest({ busy: false, ok: false, result: e.message }); }
  };

  const add = () => {
    const v = draft.value.trim();
    if (!draft.name.trim() || !v) { setError('Give the source a name and an address or handle.'); return; }
    if (draft.type === 'rss' && !/^https?:\/\//i.test(v)) { setError('Feed addresses start with https://'); return; }
    setError(null);
    setFeeds(f => [...f, { id: Date.now().toString(36), ...draftSource(), name: draft.name.trim() } as CustomFeed]);
    setDraft({ name: '', type: draft.type, value: '', wire: 'auto', kind: 'news' });
    setTest({ busy: false, result: null, ok: false });
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const r = await adminExtra.saveFeeds(feeds);
      setFeeds(r.feeds); setSaved(JSON.stringify(r.feeds));
      onNotify('Sources saved. They are pulled on the next refresh (within 5 minutes).');
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };
  const dirty = JSON.stringify(feeds) !== saved;

  const grouped = useMemo(() => {
    const m = new Map<string, CatalogueSource[]>();
    catalogue?.sources.forEach(s => m.set(s.group, [...(m.get(s.group) || []), s]));
    return (catalogue?.groups || []).filter(g => m.has(g)).map(g => [g, m.get(g)!] as const);
  }, [catalogue]);

  return (
    <div className="space-y-6 mt-6">
      <section className="bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5">
        <h3 className="text-base font-bold text-calibrex-gold flex items-center gap-2 mb-1"><Sparkles size={16} /> AI features</h3>
        <p className="text-sm text-calibrex-muted mb-3">When on, each user can connect their own Claude, ChatGPT or Gemini account under Settings. Usage is billed to their account, not yours.</p>
        {aiEnabled === null ? <Loader2 size={16} className="animate-spin text-calibrex-teal" /> : (
          <button id="admin-ai-toggle" role="switch" aria-checked={aiEnabled} onClick={toggleAi} className={`flex items-center gap-3 px-3 py-2 rounded border text-sm font-bold ${aiEnabled ? 'border-calibrex-teal text-calibrex-teal bg-calibrex-teal/10' : 'border-white/15 text-calibrex-muted'}`}>
            <span className={`w-9 h-5 rounded-full relative transition-colors ${aiEnabled ? 'bg-calibrex-teal' : 'bg-white/20'}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${aiEnabled ? 'left-[18px]' : 'left-0.5'}`} /></span>
            {aiEnabled ? 'On for all users' : 'Off for all users'}
          </button>
        )}
      </section>

      <section id="admin-sources" className="bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-base font-bold text-calibrex-gold flex items-center gap-2"><Layers size={16} /> Sources</h3>
          <button onClick={loadCatalogue} className="text-xs font-bold text-calibrex-teal hover:underline">Refresh status</button>
        </div>
        <p className="text-sm text-calibrex-muted mb-4">Everything Calibrex pulls every 5 minutes. Switch off any source you don't want. Social accounts are shown to users as unverified claims and never raise alerts on their own.</p>
        {!catalogue ? <Loader2 size={16} className="animate-spin text-calibrex-teal" /> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {grouped.map(([group, list]) => (
              <div key={group} className="rounded-lg border border-white/10 bg-black/20">
                <div className="px-3 py-2 border-b border-white/10 text-sm font-bold text-white flex justify-between">
                  <span>{group}</span><span className="text-xs text-calibrex-muted font-normal">{list.filter(s => s.enabled).length}/{list.length} on</span>
                </div>
                <ul className="divide-y divide-white/5">
                  {list.map(src => (
                    <li key={src.id} className="px-3 py-2 flex items-center gap-3">
                      <button role="switch" aria-checked={src.enabled} aria-label={`${src.name} ${src.enabled ? 'on' : 'off'}`} onClick={() => toggleSource(src.id)} className={`shrink-0 w-9 h-5 rounded-full relative transition-colors ${src.enabled ? 'bg-calibrex-teal' : 'bg-white/20'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${src.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm truncate ${src.enabled ? 'text-white' : 'text-calibrex-muted'}`}>
                          {src.name}{src.handle && <span className="text-calibrex-muted"> @{src.handle}</span>}
                        </div>
                        <div className="text-xs text-calibrex-muted">{KIND_LABEL[src.kind] || src.kind}{src.type === 'telegram' ? ' · Telegram' : src.type === 'bluesky' ? ' · Bluesky' : ''}</div>
                      </div>
                      <Health h={src.health} enabled={src.enabled} />
                      {src.home && <a href={src.home} target="_blank" rel="noopener noreferrer" className="text-calibrex-muted hover:text-calibrex-teal" title="Visit source"><ExternalLink size={13} /></a>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5">
        <h3 className="text-base font-bold text-calibrex-gold flex items-center gap-2 mb-1"><Rss size={16} /> Your own sources</h3>
        <p className="text-sm text-calibrex-muted mb-4">Add a news site's RSS feed, a public Telegram channel, or a Bluesky or Mastodon account you trust. X (Twitter) has no free feed; if you use a paid X-to-RSS service, paste its RSS address here.</p>

        <ul className="space-y-2 mb-4">
          {feeds.length === 0 && <li className="text-sm text-calibrex-muted">None added yet.</li>}
          {feeds.map(f => (
            <li key={f.id} className="flex items-center gap-3 p-2.5 rounded bg-black/25 border border-white/5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{f.name} <span className="text-xs font-normal text-calibrex-muted">· {TYPE_LABEL[f.type] || 'RSS'} → {f.wire === 'auto' ? 'Auto (by keyword)' : WIRES[f.wire as WireKey]?.label || f.wire}</span></div>
                <div className="text-xs text-calibrex-muted truncate">{f.type === 'rss' ? f.url : `@${f.handle}`}</div>
              </div>
              <Health h={catalogue?.customHealth[`custom-${f.id}`] || null} />
              <button onClick={() => setFeeds(list => list.filter(x => x.id !== f.id))} className="p-1.5 text-calibrex-muted hover:text-calibrex-critical" title="Remove source"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <select id="feed-type" aria-label="Source type" value={draft.type} onChange={e => { setDraft({ ...draft, type: e.target.value as SourceType, value: '' }); setTest({ busy: false, result: null, ok: false }); }} className="sm:col-span-2 bg-black/30 border border-white/15 rounded px-2 py-2 text-sm text-white">
            {(Object.keys(TYPE_LABEL) as SourceType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <input id="feed-name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Name, e.g. Dawn" maxLength={60} className="sm:col-span-4 bg-black/30 border border-white/15 rounded px-3 py-2 text-sm text-white" />
          <input id="feed-url" value={draft.value} onChange={e => { setDraft({ ...draft, value: e.target.value }); setTest({ busy: false, result: null, ok: false }); }} placeholder={PLACEHOLDER[draft.type]} className="sm:col-span-6 bg-black/30 border border-white/15 rounded px-3 py-2 text-sm text-white" />
          <select aria-label="Wire" value={draft.wire} onChange={e => setDraft({ ...draft, wire: e.target.value })} className="sm:col-span-2 bg-black/30 border border-white/15 rounded px-2 py-2 text-sm text-white">
            <option value="auto">Wire: auto (by keyword)</option>
            {(Object.keys(WIRES) as WireKey[]).map(k => <option key={k} value={k}>{WIRES[k].label}</option>)}
          </select>
          {draft.type === 'rss' ? (
            <select aria-label="Kind" value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value })} className="sm:col-span-2 bg-black/30 border border-white/15 rounded px-2 py-2 text-sm text-white">
              <option value="news">News outlet</option>
              <option value="official">Official / government</option>
              <option value="analysis">Analysis / OSINT research</option>
            </select>
          ) : <div className="sm:col-span-2 text-xs text-calibrex-medium self-center">Posts are marked as unverified social claims.</div>}
          <div className="sm:col-span-2 grid grid-cols-2 gap-2">
            <button onClick={runTest} disabled={!draft.value.trim() || test.busy} className="px-2 py-2 rounded border border-calibrex-teal text-calibrex-teal text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40">
              {test.busy ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />} Test
            </button>
            <button id="feed-add" onClick={add} disabled={!draft.value.trim() || !draft.name.trim()} className="px-2 py-2 rounded bg-white/10 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"><Plus size={14} /> Add</button>
          </div>
        </div>
        {test.result && <p className={`mt-2 text-sm ${test.ok ? 'text-calibrex-low' : 'text-calibrex-high'}`}>{test.result}</p>}

        <div className="mt-4 flex items-center justify-end gap-3">
          {dirty && <span className="text-xs text-calibrex-gold">Unsaved changes</span>}
          <button id="feeds-save" onClick={save} disabled={!dirty || saving} className="px-4 py-2 rounded bg-calibrex-teal text-calibrex-navy text-sm font-black flex items-center gap-1.5 disabled:opacity-40">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save sources
          </button>
        </div>
        {error && <div role="alert" className="mt-3 text-sm text-calibrex-critical">{error}</div>}
      </section>
    </div>
  );
};

export default AdminWorkspace;
