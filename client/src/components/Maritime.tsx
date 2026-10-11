import React, { useEffect, useMemo, useState } from 'react';
import { Ship, Loader2, RefreshCw, AlertTriangle, Flag, FileText, ExternalLink, KeyRound, Anchor, EyeOff } from 'lucide-react';
import { getMaritime, MaritimeSnapshot, Vessel } from '../lib/maritime';
import { GeoEvent } from '../lib/geoint';
import { timeAgo } from '../lib/live';
import WatchTabs from './WatchTabs';
import RapidBriefModal from './RapidBriefModal';

type Filter = 'all' | 'sanctioned' | 'dark' | 'india';

const toEvent = (v: Vessel): GeoEvent => ({
  id: String(v.mmsi), title: v.name || `MMSI ${v.mmsi}`, category: v.type || 'Vessel', categoryId: 'vessel',
  severity: v.sanctioned ? 'CRITICAL' : v.dark ? 'HIGH' : v.flag === 'India' ? 'MEDIUM' : 'LOW',
  lat: v.lat, lng: v.lng, date: v.lastSeen, magnitude: `${v.flag}${v.sog != null ? ` · ${v.sog} kn` : ''}`, url: '', source: 'AIS', india: v.flag === 'India',
});

const Maritime: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [d, setD] = useState<MaritimeSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [brief, setBrief] = useState<{ title: string; text: string; sources: { title: string; source: string; url: string }[] } | null>(null);

  const load = () => { setLoading(true); getMaritime().then(x => { setD(x); setError(null); }).catch(e => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const vessels = useMemo(() => {
    const v = d?.vessels || [];
    if (filter === 'sanctioned') return v.filter(x => x.sanctioned);
    if (filter === 'dark') return v.filter(x => x.dark);
    if (filter === 'india') return v.filter(x => x.flag === 'India');
    return v;
  }, [d, filter]);
  const events = useMemo(() => vessels.filter(v => Number.isFinite(v.lat) && Number.isFinite(v.lng)).map(toEvent), [vessels]);

  const compileBrief = () => {
    const list = vessels.slice(0, 25);
    const lines = [
      'MARITIME SITUATION BRIEF',
      `${d?.counts.total || 0} vessels tracked · ${d?.counts.sanctioned || 0} sanctioned · ${d?.counts.dark || 0} signal-lost · ${d?.counts.india || 0} India-flagged. Compiled ${new Date().toLocaleString()}.`,
      'Source: AISStream live AIS. Positions are self-reported transponder data; "signal lost" means no update recently, which can be benign or deliberate.',
      '', 'VESSELS OF INTEREST',
      ...list.map((v, i) => `${i + 1}. ${v.name || 'MMSI ' + v.mmsi} (${v.flag}, ${v.type})${v.sanctioned ? ' — SANCTIONS NAME MATCH' : ''}${v.dark ? ' — signal lost' : ''}${v.dest ? ` → ${v.dest}` : ''}`),
    ];
    setBrief({ title: 'Maritime Situation Brief', text: lines.join('\n'), sources: [] });
  };

  const notConfigured = d && !d.configured;
  const waiting = d && d.configured && d.counts.total === 0;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <WatchTabs current="maritime" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Ship size={22} className="text-calibrex-teal" /> Maritime</h1>
          <p className="text-sm text-calibrex-muted mt-1 max-w-2xl">Live vessel positions across India's maritime theatre (AIS via AISStream), with sanctions-name flags and "signal lost" (dark) detection{d?.updatedAt ? ` · updated ${timeAgo(d.updatedAt)}` : ''}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={compileBrief} disabled={!d?.counts.total} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-calibrex-teal text-calibrex-navy hover:bg-white active:scale-95 disabled:opacity-40"><FileText size={14} /> Rapid Brief</button>
          <button onClick={load} disabled={loading} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}</button>
        </div>
      </div>

      {error && <p className="text-sm text-calibrex-critical flex items-center gap-1.5"><AlertTriangle size={14} /> {error}</p>}

      {!d ? <div className="py-20 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>
      : notConfigured ? (
        <div className="rounded-xl border border-calibrex-gold/30 bg-calibrex-gold/5 p-5 flex items-start gap-3">
          <KeyRound size={20} className="text-calibrex-gold shrink-0 mt-0.5" />
          <div><div className="text-sm font-bold text-calibrex-gold">AIS source not configured</div><p className="text-[12px] text-calibrex-muted mt-1">Add your free AISStream key as <code className="font-mono">AISSTREAM_API_KEY</code> in Render → Environment, then redeploy. The vessel stream fills in within a minute.</p></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([['all', 'Tracked', d.counts.total, 'text-white', Anchor], ['sanctioned', 'Sanctioned', d.counts.sanctioned, 'text-calibrex-critical', AlertTriangle], ['dark', 'Signal lost', d.counts.dark, 'text-calibrex-high', EyeOff], ['india', 'India', d.counts.india, 'text-calibrex-gold', Flag]] as const).map(([f, label, n, cls, Icon]) => (
              <button key={f} onClick={() => setFilter(f as Filter)} className={`rounded-xl border p-3 text-left transition-colors ${filter === f ? 'border-calibrex-teal/50 bg-calibrex-teal/5' : 'border-white/10 bg-calibrex-surface hover:bg-white/5'}`}>
                <div className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1"><Icon size={11} className={cls} /> {label}</div>
                <div className={`text-2xl font-black ${cls}`}>{n}</div>
              </button>
            ))}
          </div>

          {waiting ? (
            <div className="rounded-xl border border-white/10 bg-calibrex-surface p-6 text-center text-calibrex-muted text-sm"><Loader2 className="animate-spin inline mr-2" size={15} /> Connected to AISStream — waiting for vessels to report in this region…</div>
          ) : (
            <>
              <GeoMapLazy events={events} />
              <div className="space-y-2">
                {vessels.length === 0 ? <p className="text-[11px] text-white/40 py-6 text-center">No vessels match this filter.</p> : vessels.slice(0, 150).map(v => (
                  <div key={v.mmsi} className="flex items-center gap-3 p-3 bg-calibrex-surface border border-white/5 rounded-lg hover:border-white/20 transition-colors">
                    {v.sanctioned && <span className="shrink-0 text-[8px] font-black uppercase px-2 py-1 rounded-full border border-calibrex-critical/40 text-calibrex-critical">Sanctions</span>}
                    {v.dark && !v.sanctioned && <span className="shrink-0 text-[8px] font-black uppercase px-2 py-1 rounded-full border border-calibrex-high/40 text-calibrex-high">Dark</span>}
                    <button onClick={() => onInvestigate(v.name || `vessel ${v.mmsi}`)} className="min-w-0 flex-1 text-left" title="Investigate">
                      <span className="block text-[13px] text-white truncate">{v.name || `MMSI ${v.mmsi}`}{v.flag === 'India' && <Flag size={11} className="inline ml-1 text-calibrex-gold" />}</span>
                      <span className="block text-[10px] font-mono text-white/35">{v.flag} · {v.type}{v.sog != null ? ` · ${v.sog} kn` : ''}{v.dest ? ` → ${v.dest}` : ''} · {timeAgo(v.lastSeen)}</span>
                    </button>
                    <a href={`https://www.marinetraffic.com/en/ais/details/ships/mmsi:${v.mmsi}`} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 text-calibrex-muted hover:text-calibrex-teal" title="Open on MarineTraffic"><ExternalLink size={14} /></a>
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
const GeoMapLazy: React.FC<{ events: GeoEvent[] }> = ({ events }) => (
  <React.Suspense fallback={<div className="w-full h-[420px] rounded-lg border border-white/10 bg-[#0c1a24] flex items-center justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>}>
    <GeoMapInner events={events} />
  </React.Suspense>
);

export default Maritime;
