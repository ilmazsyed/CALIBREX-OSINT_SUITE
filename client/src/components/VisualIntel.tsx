import React, { useEffect, useMemo, useState } from 'react';
import { Images, Loader2, RefreshCw, Satellite, Search } from 'lucide-react';
import { visuals, VisualStory, SatelliteView, CollectedMedia, openVisuals, proxied } from '../lib/visuals';
import { WIRES, WireKey, Severity, timeAgo } from '../lib/live';
import { Threat } from '../types';
import MediaTile from './MediaTile';
import MediaLightbox, { LightboxEntry } from './MediaLightbox';

const SEV_DOT: Record<string, string> = { CRITICAL: 'bg-calibrex-critical', HIGH: 'bg-calibrex-high', MEDIUM: 'bg-calibrex-medium', LOW: 'bg-calibrex-low' };
const SEV_RANK: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
type TypeFilter = 'all' | 'photo' | 'video' | 'social';

/** One place for every picture, video and satellite view gathered from the live reporting. */
const VisualIntel: React.FC<{ threats: Threat[] }> = ({ threats }) => {
  const [stories, setStories] = useState<VisualStory[] | null>(null);
  const [satellite, setSatellite] = useState<(SatelliteView & { threatId: string; title: string; severity: Severity })[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<TypeFilter>('all');
  const [minSev, setMinSev] = useState<Severity>('LOW');
  const [wire, setWire] = useState<'ALL' | WireKey>('ALL');
  const [q, setQ] = useState('');
  const [light, setLight] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    visuals.feed().then(r => { setStories(r.stories); setSatellite(r.satellite); setUpdatedAt(r.updatedAt); setError(null); })
      .catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); const t = setInterval(load, 5 * 60000); return () => clearInterval(t); }, []);

  // One tile per picture or video, newest story first.
  const tiles: CollectedMedia[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (stories || [])
      .filter(s => SEV_RANK[s.severity] >= SEV_RANK[minSev] && (wire === 'ALL' || s.wire === wire) && (type !== 'social' || s.kind === 'social'))
      .filter(s => !needle || `${s.title} ${s.source} ${s.place || ''}`.toLowerCase().includes(needle))
      .flatMap(s => s.media
        .filter(m => type === 'all' || type === 'social' || (type === 'photo' ? m.type === 'image' : m.type !== 'image'))
        .map(m => ({ ...m, from: { title: s.title, source: s.source, url: s.url, published: s.published, kind: s.kind }, _story: s } as CollectedMedia & { _story: VisualStory })));
  }, [stories, type, minSev, wire, q]);

  const storyOf = (m: CollectedMedia) => (m as any)._story as VisualStory;
  const openStory = (s: VisualStory) => openVisuals({
    title: s.title, urls: [s.url], place: s.place || undefined, severity: s.severity,
    preload: s.media.map(m => ({ ...m, from: { title: s.title, source: s.source, url: s.url, published: s.published, kind: s.kind } })),
  });
  const openThreat = (sv: SatelliteView & { threatId: string; title: string }) => {
    const t = threats.find(x => x.id === sv.threatId);
    openVisuals({ title: sv.title, urls: (t?.sources || []).map(x => x.url).slice(0, 8), lat: sv.lat, lng: sv.lng, place: sv.place });
  };
  const entries: LightboxEntry[] = tiles.map(m => ({ kind: 'media', m }));
  const photoCount = (stories || []).reduce((n, s) => n + s.media.filter(m => m.type === 'image').length, 0);
  const videoCount = (stories || []).reduce((n, s) => n + s.media.filter(m => m.type !== 'image').length, 0);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Images size={20} className="text-calibrex-teal" /> Visual Intel</h2>
          <p className="text-sm text-calibrex-muted">Photos, video and satellite imagery gathered from the live reporting of the last 48 hours. {stories ? `${photoCount} photos · ${videoCount} videos from ${stories.length} reports` : ''}{updatedAt ? ` · updated ${timeAgo(updatedAt)}` : ''}</p>
        </div>
        <button onClick={load} disabled={loading} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh</button>
      </div>

      <section aria-label="Satellite watch">
        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Satellite size={15} className="text-calibrex-teal" /> Satellite watch: top threat locations <span className="font-normal text-xs text-calibrex-muted">NASA daily pass, previous day</span></h3>
        {satellite.length === 0 ? <p className="text-sm text-calibrex-muted">{stories ? 'No located threat vectors right now.' : 'Loading…'}</p> : (
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {satellite.map(sv => (
              <button key={sv.threatId} onClick={() => openThreat(sv)} className="shrink-0 w-44 text-left group" title={`Satellite and visuals for ${sv.place}`}>
                <span className="block aspect-square rounded-lg overflow-hidden border border-white/10 group-hover:border-calibrex-teal bg-black/40 relative">
                  <img src={proxied(sv.panels[0]?.src)} alt={`Satellite view of ${sv.place}`} loading="lazy" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                  <span className={`absolute top-2 left-2 w-2.5 h-2.5 rounded-full ${SEV_DOT[sv.severity]}`} />
                </span>
                <span className="block mt-1 text-sm font-bold text-white truncate">{sv.place}</span>
                <span className="block text-xs text-calibrex-muted truncate">{sv.title.replace(/^[^:]+:\s*/, '')}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Type">
          {([['all', 'All'], ['photo', 'Photos'], ['video', 'Video'], ['social', 'Social posts']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setType(id)} className={`px-3 py-1.5 rounded-full text-sm font-bold ${type === id ? 'bg-calibrex-teal text-calibrex-navy' : 'bg-white/5 text-calibrex-muted hover:text-white'}`}>{label}</button>
          ))}
        </div>
        <select aria-label="Minimum severity" value={minSev} onChange={e => setMinSev(e.target.value as Severity)} className="bg-black/30 border border-white/15 rounded px-2 py-1.5 text-sm text-white">
          <option value="LOW">Any severity</option><option value="MEDIUM">Medium and above</option><option value="HIGH">High and above</option><option value="CRITICAL">Critical only</option>
        </select>
        <select aria-label="Wire" value={wire} onChange={e => setWire(e.target.value as any)} className="bg-black/30 border border-white/15 rounded px-2 py-1.5 text-sm text-white">
          <option value="ALL">All wires</option>
          {(Object.keys(WIRES) as WireKey[]).map(k => <option key={k} value={k}>{WIRES[k].label}</option>)}
        </select>
        <label className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-calibrex-muted" />
          <input id="visual-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by place, outlet or words" className="w-full bg-black/30 border border-white/15 rounded pl-8 pr-3 py-1.5 text-sm text-white" />
        </label>
      </div>

      {error && <p className="text-sm text-calibrex-critical">{error}</p>}
      {!stories ? <div className="py-16 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div> : tiles.length === 0 ? (
        <p className="py-16 text-center text-sm text-calibrex-muted">No visuals match these filters yet. Pictures arrive as the server reads new reports every 5 minutes.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {tiles.map((m, i) => {
            const s = storyOf(m);
            return (
              <MediaTile key={`${s.id}-${i}`} m={m} label={s.title} onOpen={() => setLight(i)} className="aspect-[4/3]" footer={
                <>
                  <div className="mt-1.5 text-sm text-white leading-snug line-clamp-2" title={s.title}>{s.title}</div>
                  <div className="mt-0.5 text-xs text-calibrex-muted flex items-center gap-2 min-w-0">
                    <span className="truncate">{s.source}{s.kind === 'social' ? ' · unverified' : ''} · {timeAgo(s.published)}</span>
                    <button onClick={() => openStory(s)} className="ml-auto shrink-0 text-calibrex-teal font-bold hover:underline">All visuals</button>
                  </div>
                </>
              }>
                <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${SEV_DOT[s.severity]}`} title={s.severity} />
              </MediaTile>
            );
          })}
        </div>
      )}
      {light !== null && entries.length > 0 && <MediaLightbox entries={entries} index={Math.min(light, entries.length - 1)} onIndex={setLight} onClose={() => setLight(null)} />}
    </div>
  );
};

export default VisualIntel;
