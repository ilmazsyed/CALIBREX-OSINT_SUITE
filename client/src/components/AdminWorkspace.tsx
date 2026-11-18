import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Rss, Plus, Trash2, Loader2, FlaskConical, Save, ExternalLink, Layers } from 'lucide-react';
import { adminExtra, CustomFeed, CatalogueSource, SourceHealth, SourceType, SourceIntelligenceReport, SourceNetworkReport, CommercialOverview, reloadAiStatus } from '../lib/features';
import { WIRES, WireKey, timeAgo } from '../lib/live';
import AdminSubject from './AdminSubject';
import AdminBackup from './AdminBackup';

const TYPE_LABEL: Record<SourceType, string> = { rss: 'RSS / Atom feed', search: 'Public news search', telegram: 'Telegram channel', bluesky: 'Bluesky account', mastodon: 'Mastodon account', };
const PLACEHOLDER: Record<SourceType, string> = {
  rss: 'https://example.com/rss.xml',
  search: 'Search words, e.g. site:indiatoday.in OSINT',
  telegram: 'Public channel name, e.g. osintlive',
  bluesky: 'Handle, e.g. geoconfirmed.org',
  mastodon: 'user@instance, e.g. someone@infosec.exchange',
};
const CATEGORY_LABEL: Record<string,string> = { STRATEGIC:'Strategic', LOGISTICS_SUPPLY_CHAIN:'Logistics & Supply Chain', MARKETS:'Markets', GEOPOLITICS:'Geopolitics', SECURITY:'Security', CYBER:'Cyber', POLITICS:'Politics', GOVERNANCE:'Governance', CRISIS:'Crisis', OTHER:'Other' };
const KIND_LABEL: Record<string, string> = { news: 'News', official: 'Official', analysis: 'Analysis', social: 'Social' };

const Health: React.FC<{ h: SourceHealth | null; enabled?: boolean }> = ({ h, enabled = true }) => {
  if (!enabled) return <span className="text-xs text-calibrex-muted">Off</span>;
  if (!h) return <span className="text-xs text-calibrex-muted">Not pulled yet</span>;
  const st = h.state || (h.ok ? 'ok' : 'error');
  const failed = !h.ok && !!h.error;
  const colour = failed ? 'text-calibrex-critical' : st === 'ok' ? 'text-calibrex-low' : st === 'cached' ? 'text-calibrex-gold' : 'text-calibrex-muted';
  const dot = failed ? 'bg-calibrex-critical' : st === 'ok' ? 'bg-calibrex-low' : st === 'cached' ? 'bg-calibrex-gold' : 'bg-calibrex-muted';
  const reason = h.failureClass === 'access_restricted' ? 'restricted'
    : h.failureClass === 'endpoint_missing' ? 'endpoint missing'
    : h.failureClass === 'rate_limited' ? 'rate limited'
    : h.failureClass === 'upstream_unavailable' ? 'upstream unavailable'
    : h.failureClass === 'feed_invalid' ? 'invalid feed'
    : h.failureClass === 'fetch_error' ? 'fetch error' : (h.error || 'fetch failed');
  const retry = h.retryAfter && h.retryAfter > Date.now() ? ` · retry ${new Date(h.retryAfter).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';
  const label = st === 'ok' ? `${h.count} items`
    : st === 'cached' ? failed ? `${h.count} cached · ${reason}${retry}` : `${h.count} items · cached`
    : st === 'empty' ? 'No items yet'
    : `Failed: ${reason}${retry}`;
  const title = [
    h.error ? `Last error: ${h.error}` : null,
    h.lastSuccessAt ? `Last success: ${new Date(h.lastSuccessAt).toLocaleString()}` : 'No successful fetch recorded',
    h.consecutiveFailures ? `Consecutive failures: ${h.consecutiveFailures}` : null,
    h.retryAfter ? `Next retry after: ${new Date(h.retryAfter).toLocaleString()}` : null,
    `Last checked: ${timeAgo(h.at)}`,
  ].filter(Boolean).join(' · ');
  return (
    <span className={`text-xs tabular-nums ${colour}`} title={title}>
      <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${dot}`} />
      {label}
    </span>
  );
};

/** Owner controls: AI switch, the source catalogue, and custom sources. */
const AdminWorkspace: React.FC<{ onNotify: (m: string) => void }> = ({ onNotify }) => {
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [catalogue, setCatalogue] = useState<{ groups: string[]; sources: CatalogueSource[]; customHealth: Record<string, SourceHealth> } | null>(null);
  const [sourceReport, setSourceReport] = useState<SourceIntelligenceReport | null>(null);
  const [sourceNetwork, setSourceNetwork] = useState<SourceNetworkReport | null>(null);
  const [commercial, setCommercial] = useState<CommercialOverview | null>(null);
  const [feeds, setFeeds] = useState<CustomFeed[]>([]);
  const [saved, setSaved] = useState<string>('[]');
  const [draft, setDraft] = useState<{ name: string; type: SourceType; value: string; wire: string; kind: string; category: string }>({ name: '', type: 'rss', value: '', wire: 'auto', kind: 'news', category: 'OTHER' });
  const [test, setTest] = useState<{ busy: boolean; result: string | null; ok: boolean }>({ busy: false, result: null, ok: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCatalogue = () => adminExtra.catalogue().then(setCatalogue).catch(e => setError(e.message));
  const loadSourceReport = () => adminExtra.sourceIntelligence().then(setSourceReport).catch(e => setError(e.message));
  const loadSourceNetwork = () => adminExtra.sourceNetwork().then(setSourceNetwork).catch(e => setError(e.message));
  const loadCommercial = () => adminExtra.commercialOverview().then(setCommercial).catch(e => setError(e.message));
  useEffect(() => {
    adminExtra.settings().then(r => setAiEnabled(r.aiEnabled)).catch(e => setError(e.message));
    adminExtra.feeds().then(r => { setFeeds(r.feeds); setSaved(JSON.stringify(r.feeds)); }).catch(e => setError(e.message));
    loadCatalogue();
    loadSourceReport();
    loadSourceNetwork();
    loadCommercial();
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
    name: draft.name.trim() || 'test', type: draft.type, wire: draft.wire, category: draft.category, kind: ['rss','search'].includes(draft.type) ? draft.kind : 'social',
    ...(draft.type === 'rss' ? { url: draft.value.trim() } : draft.type === 'search' ? { query: draft.value.trim() } : { handle: draft.value.trim().replace(/^@/, '') }),
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
    setDraft({ name: '', type: draft.type, value: '', wire: 'auto', kind: 'news', category: draft.category });
    setTest({ busy: false, result: null, ok: false });
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const r = await adminExtra.saveFeeds(feeds);
      setFeeds(r.feeds); setSaved(JSON.stringify(r.feeds));
      onNotify('Sources saved. Direct feeds refresh on the next one-minute cycle; news searches refresh on the five-minute cycle.');
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

      <section id="admin-commercial-overview" className="bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-base font-bold text-calibrex-gold">Commercial operations</h3>
          <button onClick={loadCommercial} className="text-xs font-bold text-calibrex-teal hover:underline">Refresh</button>
        </div>
        <p className="text-sm text-calibrex-muted mb-4">Account, trial and licensing overview for internal operations.</p>
        {!commercial ? <Loader2 size={16} className="animate-spin text-calibrex-teal" /> : <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {[[ 'Accounts', commercial.accounts.total ], [ 'Active trials', commercial.accounts.trialsActive ], [ 'Expired trials', commercial.accounts.trialsExpired ], [ 'Pending requests', commercial.licensing.pendingRequests ]].map(([label,value]) => <div key={label} className="rounded border border-white/10 bg-black/20 p-3"><div className="text-xs text-calibrex-muted">{label}</div><div className="text-xl font-bold text-white tabular-nums">{value}</div></div>)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {Object.entries(commercial.accounts.plans).map(([plan,count]) => <div key={plan} className="rounded border border-white/10 p-2 flex justify-between gap-2"><span className="capitalize text-calibrex-muted">{plan}</span><strong className="text-white tabular-nums">{count}</strong></div>)}
          </div>
          <div className="mt-3 text-xs text-calibrex-muted">Process uptime {Math.floor(commercial.platform.processUptimeSeconds / 3600)}h · Requests {commercial.platform.requests.requests} · Server errors {commercial.platform.requests.errors} · In flight {commercial.platform.inFlight}</div>
          <div className="mt-3 rounded border border-calibrex-gold/20 bg-calibrex-gold/5 p-3 text-xs text-calibrex-muted"><strong className="text-calibrex-gold">Billing limitation:</strong> this is an operational account summary, not billable usage metering. AI tokens, storage, ingestion volume and seats are not measured here. Do not calculate invoices or promise usage-based billing from these counters.</div>
        </>}
      </section>

      <section id="admin-source-intelligence" className="bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-base font-bold text-calibrex-gold flex items-center gap-2"><Layers size={16} /> Source intelligence health</h3>
          <button onClick={() => { loadCatalogue(); loadSourceReport(); loadSourceNetwork(); }} className="text-xs font-bold text-calibrex-teal hover:underline">Recalculate</button>
        </div>
        <p className="text-sm text-calibrex-muted mb-4">Regional coverage and ingestion reliability. A source is not counted as healthy until a recent successful fetch is recorded. Unmeasured sources are shown separately, not assumed to work.</p>
        {!sourceReport ? <Loader2 size={16} className="animate-spin text-calibrex-teal" /> : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {[[ 'Configured', sourceReport.summary.configured ], [ 'Measured', sourceReport.summary.measured ], [ 'Healthy', sourceReport.summary.healthy ], [ 'Needs attention', sourceReport.summary.degraded + sourceReport.summary.stale + sourceReport.summary.failed ]].map(([label,value]) => <div key={label} className="rounded border border-white/10 bg-black/20 p-3"><div className="text-xs text-calibrex-muted">{label}</div><div className="text-xl font-bold text-white tabular-nums">{value}</div></div>)}
            </div>
            <div className="flex flex-wrap gap-2 mb-3 text-xs text-calibrex-muted">
              <span>Unmeasured: {sourceReport.summary.unmeasured}</span><span>·</span>
              <span>Average measured score: {sourceReport.summary.averageScore === null ? '—' : sourceReport.summary.averageScore + '/100'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {sourceReport.regions.filter(r => r.configured > 0).map(region => (
                <div key={region.region} className="rounded border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2"><span className="text-sm font-bold text-white">{region.region}</span><span className="text-xs text-calibrex-muted">{region.configured} configured</span></div>
                  <div className="flex items-baseline gap-2"><span className="text-lg font-bold text-white tabular-nums">{region.healthy}</span><span className="text-xs text-calibrex-muted">healthy</span><span className="ml-auto text-xs text-calibrex-muted">{region.averageScore === null ? "Not measured" : region.averageScore + "/100"}</span></div>
                  <div className="h-1.5 rounded bg-white/10 overflow-hidden mt-2"><div className="h-full bg-calibrex-teal" style={{ width: (region.configured ? (region.healthy / region.configured) * 100 : 0) + "%" }} /></div>
                  <div className="text-[11px] text-calibrex-muted mt-2">Degraded {region.degraded} · Stale {region.stale} · Failed {region.failed} · Unmeasured {region.unmeasured}</div>
                </div>
              ))}
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-calibrex-teal">View sources needing attention ({sourceReport.sources.filter(s => s.enabled && s.status !== "healthy").length})</summary>
              <div className="mt-2 max-h-80 overflow-y-auto divide-y divide-white/5">
                {sourceReport.sources.filter(s => s.enabled && s.status !== "healthy").slice(0,80).map(source => (
                  <div key={source.id} className="py-2 flex items-start gap-3">
                    <div className="min-w-0 flex-1"><div className="text-xs text-white">{source.name}</div><div className="text-[11px] text-calibrex-muted">{source.region} · {source.status} · {source.score === null ? "not measured" : source.score + "/100"}{source.ageMinutes === null ? "" : " · last success " + source.ageMinutes + "m ago"}{source.failureClass ? " · " + source.failureClass : ""}</div></div>
                    {source.error && <span className="text-[11px] text-calibrex-critical max-w-[40%] truncate" title={source.error}>{source.error}</span>}
                  </div>
                ))}
              </div>
            </details>
            <p className="text-[11px] text-calibrex-muted mt-3">{sourceReport.scoring}</p>
          </>
        )}
      </section>

      <section id="admin-source-network" className="bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-base font-bold text-calibrex-gold flex items-center gap-2"><Layers size={16} /> Global Source Intelligence Network</h3>
          <button onClick={loadSourceNetwork} className="text-xs font-bold text-calibrex-teal hover:underline">Refresh network</button>
        </div>
        <p className="text-sm text-calibrex-muted mb-4">Six-layer expansion programme: 1,000 distinct source records per layer. Only measured, successful sources count as healthy. The target is not represented as already achieved.</p>
        {!sourceNetwork ? <Loader2 size={16} className="animate-spin text-calibrex-teal" /> : <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[[ 'Target', sourceNetwork.target ], [ 'Catalogued', sourceNetwork.configured ], [ 'Measured healthy', sourceNetwork.healthy ], [ 'Unverified', sourceNetwork.unverified ]].map(([label,value]) => <div key={label} className="rounded border border-white/10 bg-black/20 p-3"><div className="text-xs text-calibrex-muted">{label}</div><div className="text-xl font-bold text-white tabular-nums">{value}</div></div>)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {sourceNetwork.layers.map(layer => (
              <div key={layer.id} className="rounded border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-2"><span className="text-sm font-bold text-white">{layer.label}</span><span className="text-xs text-calibrex-muted tabular-nums">{layer.configured.toLocaleString()} / {layer.target.toLocaleString()}</span></div>
                <div className="h-1.5 rounded bg-white/10 overflow-hidden mt-2"><div className="h-full bg-calibrex-teal" style={{ width: Math.min(100, layer.configured / layer.target * 100) + "%" }} /></div>
                <div className="text-[11px] text-calibrex-muted mt-2">Healthy {layer.healthy} · Degraded {layer.degraded} · Stale {layer.stale} · Failed {layer.failed} · Unverified {layer.unverified}</div>
                <div className="text-[11px] text-calibrex-gold mt-1">{layer.remaining.toLocaleString()} more distinct records required</div>
              </div>
            ))}
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-calibrex-teal">Geographic coverage and country groupings</summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 mt-3">
              {sourceNetwork.regions.map(region => (
                <div key={region.id} className="rounded border border-white/10 p-3">
                  <div className="flex justify-between gap-2"><strong className="text-sm text-white">{region.region}</strong><span className="text-xs text-calibrex-muted">{region.configured} sources</span></div>
                  <div className="text-[11px] text-calibrex-muted mt-1">Countries / territories: {region.countries.length ? region.countries.join(', ') : 'Global and multilateral coverage'}</div>
                  <div className="text-[11px] text-calibrex-muted mt-1">Healthy {region.healthy} · Unverified {region.unverified}</div>
                </div>
              ))}
            </div>
          </details>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-calibrex-teal">View source records, provenance and access status ({sourceNetwork.sources.length})</summary>
            <div className="mt-2 max-h-96 overflow-y-auto divide-y divide-white/5">
              {sourceNetwork.sources.map(source => (
                <div key={source.id} className="py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs text-white">{source.name}</strong><span className="text-[10px] text-calibrex-muted uppercase">{source.health} · {source.enabled ? 'enabled' : 'disabled'}</span></div>
                  <div className="text-[11px] text-calibrex-muted">{source.layerLabel} · {source.region}{source.country ? ' · ' + source.country : ''} · {source.type} · {source.accessModel} · licence: {source.licence}</div>
                </div>
              ))}
            </div>
          </details>
          <p className="text-[11px] text-calibrex-muted mt-3">{sourceNetwork.qualityPolicy}</p>
        </>}
      </section>

      <section id="admin-sources" className="bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-base font-bold text-calibrex-gold flex items-center gap-2"><Layers size={16} /> Sources</h3>
          <button onClick={loadCatalogue} className="text-xs font-bold text-calibrex-teal hover:underline">Refresh status</button>
        </div>
        <p className="text-sm text-calibrex-muted mb-4">Direct RSS and public social sources are polled about every minute; news-search and API enrichment run on a separate five-minute cycle. Failed sources retain last-good items and show the reason and retry time. Social posts remain unverified claims and never raise alerts on their own.</p>
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
                        <div className="text-xs text-calibrex-muted">{KIND_LABEL[src.kind] || src.kind} · {CATEGORY_LABEL[src.category || 'OTHER'] || src.category}{src.type === 'telegram' ? ' · Telegram' : src.type === 'bluesky' ? ' · Bluesky' : src.type === 'search' ? ' · public search feed' : ''}</div>
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
        <p className="text-sm text-calibrex-muted mb-4">Add a news site's RSS feed, a news search (use site:example.com to follow one website's coverage), a public Telegram channel, or a Bluesky or Mastodon account you trust. For other platforms, add only a lawful public RSS feed you are authorised to use.</p>

        <ul className="space-y-2 mb-4">
          {feeds.length === 0 && <li className="text-sm text-calibrex-muted">None added yet.</li>}
          {feeds.map(f => (
            <li key={f.id} className="flex items-center gap-3 p-2.5 rounded bg-black/25 border border-white/5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{f.name} <span className="text-xs font-normal text-calibrex-muted">· {TYPE_LABEL[f.type] || 'RSS'} · {CATEGORY_LABEL[f.category || 'OTHER'] || 'Other'} → {f.wire === 'auto' ? 'Auto (by keyword)' : WIRES[f.wire as WireKey]?.label || f.wire}</span></div>
                <div className="text-xs text-calibrex-muted truncate">{f.type === 'rss' ? f.url : f.type === 'search' ? `Search: ${f.query}` : `@${f.handle}`}</div>
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
          <select aria-label="Source category" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} className="sm:col-span-2 bg-black/30 border border-white/15 rounded px-2 py-2 text-sm text-white">
            <option value="STRATEGIC">Strategic</option>
            <option value="LOGISTICS_SUPPLY_CHAIN">Logistics &amp; Supply Chain</option>
            <option value="MARKETS">Markets</option>
            <option value="GEOPOLITICS">Geopolitics</option>
            <option value="SECURITY">Security</option>
            <option value="CYBER">Cyber</option>
            <option value="POLITICS">Politics</option>
            <option value="GOVERNANCE">Governance</option>
            <option value="CRISIS">Crisis</option>
            <option value="OTHER">Other</option>
          </select>
          <select aria-label="Wire" value={draft.wire} onChange={e => setDraft({ ...draft, wire: e.target.value })} className="sm:col-span-2 bg-black/30 border border-white/15 rounded px-2 py-2 text-sm text-white">
            <option value="auto">Wire: auto (by keyword)</option>
            {(Object.keys(WIRES) as WireKey[]).map(k => <option key={k} value={k}>{WIRES[k].label}</option>)}
          </select>
          {['rss','search'].includes(draft.type) ? (
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

      <AdminSubject onNotify={onNotify} />
      <AdminBackup onNotify={onNotify} />
    </div>
  );
};

export default AdminWorkspace;
