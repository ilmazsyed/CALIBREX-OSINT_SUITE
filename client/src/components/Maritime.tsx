import React, { useEffect, useMemo, useState } from 'react';
import { Ship, Loader2, RefreshCw, AlertTriangle, Flag, FileText, ExternalLink, Anchor, ShieldAlert, Search } from 'lucide-react';
import { getMaritime, MaritimeSnapshot, MaritimeNews } from '../lib/maritime';
import { GeoEvent } from '../lib/geoint';
import { openReader, timeAgo } from '../lib/live';
import WatchTabs from './WatchTabs';
import RapidBriefModal from './RapidBriefModal';

const SEV_CLS: Record<string, string> = {
  CRITICAL: 'text-calibrex-critical border-calibrex-critical/40',
  HIGH: 'text-calibrex-high border-calibrex-high/40',
  MEDIUM: 'text-calibrex-gold border-calibrex-gold/40',
  LOW: 'text-calibrex-low border-calibrex-low/40',
};

const toEvent = (n: MaritimeNews): GeoEvent => ({
  id: n.id, title: n.title, category: 'Maritime', categoryId: 'maritime', severity: n.severity,
  lat: n.lat as number, lng: n.lng as number, date: n.published, magnitude: n.place || '', url: n.url, source: n.source, india: n.india,
});

const Maritime: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [d, setD] = useState<MaritimeSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'incidents' | 'fleet'>('incidents');
  const [indiaOnly, setIndiaOnly] = useState(false);
  const [q, setQ] = useState('');
  const [brief, setBrief] = useState<{ title: string; text: string; sources: { title: string; source: string; url: string; published?: number }[] } | null>(null);

  const load = () => { setLoading(true); getMaritime().then(x => { setD(x); setError(null); }).catch(e => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); const t = setInterval(load, 5 * 60000); return () => clearInterval(t); }, []);

  const news = useMemo(() => (d?.news || []).filter(n => !indiaOnly || n.india), [d, indiaOnly]);
  const events = useMemo(() => (d?.events || []).filter(n => !indiaOnly || n.india).map(toEvent), [d, indiaOnly]);
  const fleet = useMemo(() => {
    const list = d?.vessels || [];
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(v =>
      v.name.toLowerCase().includes(s) ||
      (v.program || '').toLowerCase().includes(s) ||
      (v.imo || '').includes(s) ||
      (v.flag || '').toLowerCase().includes(s) ||
      (v.owner || '').toLowerCase().includes(s) ||
      (v.callSign || '').toLowerCase().includes(s));
  }, [d, q]);

  const open = (n: MaritimeNews) => { if (n.url) openReader({ url: n.url, title: n.title, source: n.source }); };

  const compileBrief = () => {
    const list = news.slice(0, 20);
    const lines = [
      `MARITIME SITUATION BRIEF${indiaOnly ? ' (INDIA)' : ''}`,
      `${list.length} maritime incidents in view · ${d?.counts.sanctioned || 0} sanctioned vessels on file. Compiled ${new Date().toLocaleString()}.`,
      'Source: Calibrex live wires (maritime/sanctions filter) + OFAC vessel lists. Observed reporting, not a forecast.',
      '', 'INCIDENTS',
      ...list.map((n, i) => `${i + 1}. ${n.title}${n.place ? ` — ${n.place}` : ''} (${n.source})`),
      '', 'SOURCES',
      ...list.filter(n => n.url).map((n, i) => `[${i + 1}] ${n.url}`),
    ];
    setBrief({ title: `Maritime Situation Brief${indiaOnly ? ' (India)' : ''}`, text: lines.join('\n'), sources: list.filter(n => n.url).map(n => ({ title: n.title, source: n.source, url: n.url, published: n.published })) });
  };

  const tabBtn = (id: 'incidents' | 'fleet', label: string, n?: number) => (
    <button onClick={() => setTab(id)} className={`px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest border ${tab === id ? 'bg-calibrex-teal/15 border-calibrex-teal/50 text-calibrex-teal' : 'border-white/10 text-calibrex-muted hover:text-white'}`}>{label}{n != null ? ` (${n})` : ''}</button>
  );

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <WatchTabs current="maritime" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Ship size={22} className="text-calibrex-teal" /> Maritime</h1>
          <p className="text-sm text-calibrex-muted mt-1 max-w-2xl">Maritime incident &amp; sanctions intelligence — shipping, naval and chokepoint reporting from the live wires, plus the sanctioned-vessel registry{d?.updatedAt ? ` · updated ${timeAgo(d.updatedAt)}` : ''}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={compileBrief} disabled={!d?.news.length} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-calibrex-teal text-calibrex-navy hover:bg-white active:scale-95 disabled:opacity-40"><FileText size={14} /> Rapid Brief</button>
          <button onClick={load} disabled={loading} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
        </div>
      </div>

      {error && <p className="text-sm text-calibrex-critical flex items-center gap-1.5"><AlertTriangle size={14} /> {error}</p>}

      {!d ? <div className="py-20 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/10 bg-calibrex-surface p-3"><div className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1"><Anchor size={11} /> Incidents</div><div className="text-2xl font-black text-white">{d.counts.news}</div></div>
            <div className="rounded-xl border border-white/10 bg-calibrex-surface p-3"><div className="text-[9px] font-black text-white/40 uppercase tracking-widest">On map</div><div className="text-2xl font-black text-white">{d.counts.mapped}</div></div>
            <button onClick={() => setTab('fleet')} className="rounded-xl border border-calibrex-critical/30 bg-calibrex-surface p-3 text-left hover:bg-white/5"><div className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1"><ShieldAlert size={11} className="text-calibrex-critical" /> Sanctioned</div><div className="text-2xl font-black text-calibrex-critical">{d.counts.sanctioned}</div></button>
            <button onClick={() => setIndiaOnly(v => !v)} className={`rounded-xl border p-3 text-left transition-colors ${indiaOnly ? 'border-calibrex-gold/60 bg-calibrex-gold/10' : 'border-white/10 bg-calibrex-surface hover:bg-white/5'}`}><div className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1"><Flag size={11} className="text-calibrex-gold" /> India {indiaOnly ? '· on' : ''}</div><div className="text-2xl font-black text-calibrex-gold">{d.counts.india}</div></button>
          </div>

          <div className="flex gap-2">{tabBtn('incidents', 'Incidents')}{tabBtn('fleet', 'Sanctioned fleet', d.counts.sanctioned)}</div>

          {tab === 'incidents' ? (
            <>
              {events.length > 0 && <GeoMapLazy events={events} onPick={(e: GeoEvent) => { if (e.url) openReader({ url: e.url, title: e.title, source: e.source }); }} />}
              <div className="space-y-2">
                {news.length === 0 ? <p className="text-[11px] text-white/40 py-6 text-center">No maritime incidents in the current feed window.</p> : news.slice(0, 120).map(n => (
                  <div key={n.id} className="flex items-center gap-3 p-3 bg-calibrex-surface border border-white/5 rounded-lg hover:border-white/20 transition-colors">
                    <span className={`shrink-0 text-[8px] font-black uppercase px-2 py-1 rounded-full border ${SEV_CLS[n.severity]}`}>{n.severity}</span>
                    <button onClick={() => onInvestigate(n.title)} className="min-w-0 flex-1 text-left" title="Investigate">
                      <span className="block text-[13px] text-white truncate">{n.title}{n.india && <Flag size={11} className="inline ml-1 text-calibrex-gold" />}</span>
                      <span className="block text-[10px] font-mono text-white/35">{n.place ? n.place + ' · ' : ''}{n.source} · {timeAgo(n.published)}</span>
                    </button>
                    {n.url && <button onClick={() => open(n)} className="shrink-0 p-1.5 text-calibrex-muted hover:text-calibrex-teal" title="Read"><ExternalLink size={14} /></button>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by vessel name, IMO, flag, owner, call sign or program…" className="w-full bg-calibrex-surface-light border border-calibrex-teal/30 rounded-lg pl-9 pr-3 py-2.5 text-calibrex-text text-sm focus:outline-none focus:border-calibrex-teal" />
              </div>
              <p className="text-[11px] text-calibrex-muted">{d.counts.sanctioned === 0 ? 'Sanctions lists still loading on the server — check back shortly.' : `${fleet.length.toLocaleString()} of ${d.counts.sanctioned.toLocaleString()} sanctioned vessels. Verify any match against the official OFAC record.`}</p>
              <div className="space-y-1.5 max-h-[32rem] overflow-y-auto custom-scrollbar pr-1">
                {fleet.slice(0, 300).map((v, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 bg-calibrex-surface border border-white/10 rounded-lg">
                    <ShieldAlert size={14} className="text-calibrex-critical shrink-0 mt-0.5" />
                    <button onClick={() => onInvestigate(v.name)} className="min-w-0 flex-1 text-left">
                      <span className="block text-[13px] font-bold text-white truncate">{v.name}</span>
                      {(v.imo || v.flag || v.vesselType) && (
                        <span className="flex flex-wrap gap-1.5 mt-1">
                          {v.imo && <span className="text-[9px] font-mono bg-calibrex-teal/10 text-calibrex-teal border border-calibrex-teal/25 rounded px-1.5 py-0.5">IMO {v.imo}</span>}
                          {v.flag && <span className="text-[9px] font-mono bg-white/5 text-white/60 border border-white/10 rounded px-1.5 py-0.5 flex items-center gap-1"><Flag size={9} /> {v.flag}</span>}
                          {v.vesselType && <span className="text-[9px] font-mono bg-white/5 text-white/60 border border-white/10 rounded px-1.5 py-0.5">{v.vesselType}</span>}
                          {v.tonnage && <span className="text-[9px] font-mono bg-white/5 text-white/50 border border-white/10 rounded px-1.5 py-0.5">{v.tonnage} DWT</span>}
                        </span>
                      )}
                      <span className="block text-[10px] font-mono text-white/40 mt-1">{v.owner ? `Owner: ${v.owner} · ` : ''}{v.program || '—'} · {v.list}</span>
                    </button>
                    <a href={`https://sanctionssearch.ofac.treas.gov/`} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 text-calibrex-muted hover:text-calibrex-teal" title="Verify on OFAC"><ExternalLink size={14} /></a>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <RapidBriefModal open={!!brief} onClose={() => setBrief(null)} domain="Maritime" accent="teal" title={brief?.title || ''} text={brief?.text || ''} sources={brief?.sources || []} />
    </div>
  );
};

const GeoMapInner = React.lazy(() => import('./GeoMap'));
const GeoMapLazy: React.FC<{ events: GeoEvent[]; onPick: (e: GeoEvent) => void }> = ({ events, onPick }) => (
  <React.Suspense fallback={<div className="w-full h-[420px] rounded-lg border border-white/10 bg-[#0c1a24] flex items-center justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>}>
    <GeoMapInner events={events} onPick={onPick} />
  </React.Suspense>
);

export default Maritime;
