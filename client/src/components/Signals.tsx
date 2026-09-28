import React, { useEffect, useState } from 'react';
import { RadioTower, Plane, Sun, TrendingUp, Loader2, RefreshCw, AlertTriangle, ExternalLink, Search } from 'lucide-react';
import { getSignals, SignalsSnapshot } from '../lib/signals';
import { timeAgo } from '../lib/live';

const kpColor = (kp: number) => kp >= 7 ? 'text-calibrex-critical' : kp >= 5 ? 'text-calibrex-high' : 'text-calibrex-low';

/** Public transponder & telemetry layers. Not comms interception. */
const Signals: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [d, setD] = useState<SignalsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => { setLoading(true); getSignals().then(x => { setD(x); setError(null); }).catch(e => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); const t = setInterval(load, 3 * 60000); return () => clearInterval(t); }, []);

  const failed = d ? Object.entries(d.sources).filter(([, s]) => !s.ok).map(([k]) => k) : [];
  const emerg = d?.aircraft.aircraft.filter(a => a.emergency) || [];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><RadioTower size={20} className="text-calibrex-teal" /> Signals</h2>
          <p className="text-sm text-calibrex-muted">Public transponders and telemetry — broadcast aircraft, the space-weather environment, and public attention{d?.updatedAt ? ` · updated ${timeAgo(d.updatedAt)}` : ''}.</p>
        </div>
        <button onClick={load} disabled={loading} className="px-3 py-2 rounded border border-white/15 text-sm text-white flex items-center gap-1.5 disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh</button>
      </div>
      {error && <p className="text-sm text-calibrex-critical">{error}</p>}
      {failed.length > 0 && <p className="text-xs text-calibrex-high flex items-center gap-1.5"><AlertTriangle size={13} /> Not reachable this cycle: {failed.join(', ')}. These feeds throttle cloud servers; data may be stale.</p>}

      {!d ? <div className="py-16 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Aircraft */}
          <section className="lg:col-span-2 bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest flex items-center gap-2"><Plane size={15} /> Aircraft (ADS-B)</h3>
              <span className="text-xs text-calibrex-muted">{d.aircraft.region} · {d.aircraft.aircraft.length} airborne{d.aircraft.military ? ` · ${d.aircraft.military} military` : ''}{d.aircraft.at ? ` · ${timeAgo(d.aircraft.at)}` : ''}</span>
            </div>
            <p className="text-xs text-calibrex-muted mb-3">Live transponder positions broadcast openly by aircraft (via adsb.lol). Emergency squawks and military aircraft are pulled to the top.</p>
            {emerg.length > 0 && (
              <div className="mb-3 p-2.5 rounded border border-calibrex-critical/40 bg-calibrex-critical/10 text-sm text-calibrex-critical">
                {emerg.length} aircraft squawking emergency: {emerg.slice(0, 6).map(a => `${a.callsign} (${a.emergency})`).join(', ')}
              </div>
            )}
            <div className="max-h-72 overflow-y-auto custom-scrollbar rounded border border-white/5">
              <table className="w-full text-sm">
                <thead className="text-calibrex-muted text-left sticky top-0 bg-calibrex-surface"><tr><th className="py-1.5 px-3 font-bold">Callsign</th><th className="px-3 font-bold">Type / Unit</th><th className="px-3 font-bold text-right">Alt (m)</th><th className="px-3 font-bold text-right">Speed</th><th className="px-3 font-bold">Position</th></tr></thead>
                <tbody>
                  {d.aircraft.aircraft.slice(0, 120).map(a => (
                    <tr key={a.id} className={`border-t border-white/5 ${a.emergency ? 'bg-calibrex-critical/10' : a.mil ? 'bg-calibrex-gold/5' : ''}`}>
                      <td className="py-1.5 px-3 font-mono text-white">{a.callsign}{a.emergency && <span className="ml-1 text-calibrex-critical text-xs">⚠ {a.emergency}</span>}</td>
                      <td className="px-3 text-calibrex-muted truncate max-w-[140px]">{a.mil && <span className="mr-1 text-[9px] font-black text-calibrex-gold border border-calibrex-gold/40 rounded px-1">MIL</span>}{a.tag}</td>
                      <td className="px-3 text-right tabular-nums text-white">{a.altM?.toLocaleString() ?? '—'}</td>
                      <td className="px-3 text-right tabular-nums text-calibrex-muted">{a.speedMs != null ? `${a.speedMs} m/s` : '—'}</td>
                      <td className="px-3"><a href={`https://www.google.com/maps/@${a.lat},${a.lng},9z/data=!3m1!1e3`} target="_blank" rel="noopener noreferrer" className="text-calibrex-teal hover:underline tabular-nums">{a.lat.toFixed(2)}, {a.lng.toFixed(2)}</a></td>
                    </tr>
                  ))}
                  {d.aircraft.aircraft.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-calibrex-muted">No aircraft data this cycle.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {/* Space weather */}
          <section className="bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5">
            <h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest flex items-center gap-2 mb-1"><Sun size={15} /> Space weather</h3>
            <p className="text-xs text-calibrex-muted mb-3">Geomagnetic activity affects GPS accuracy and HF (shortwave) radio.</p>
            {d.space.kp ? (
              <div className="flex items-baseline gap-3 mb-3">
                <span className={`text-4xl font-black tabular-nums ${kpColor(d.space.kp.kp)}`}>Kp {d.space.kp.kp.toFixed(1)}</span>
                <span className={`text-sm font-bold ${kpColor(d.space.kp.kp)}`}>{d.space.kp.level}</span>
              </div>
            ) : <p className="text-sm text-calibrex-muted mb-3">No K-index reading.</p>}
            <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar">
              {d.space.alerts.length === 0 ? <p className="text-sm text-calibrex-muted">No recent SWPC alerts.</p> :
                d.space.alerts.map((a, i) => <div key={i} className="text-xs text-calibrex-text border-l-2 border-calibrex-teal/40 pl-2"><span className="text-calibrex-muted">{timeAgo(a.at)}: </span>{a.head}</div>)}
            </div>
          </section>

          {/* Wikipedia trending */}
          <section className="bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5">
            <h3 className="text-sm font-black text-calibrex-gold uppercase tracking-widest flex items-center gap-2 mb-1"><TrendingUp size={15} /> Public attention</h3>
            <p className="text-xs text-calibrex-muted mb-3">Most-read English Wikipedia articles{d.wiki.date ? ` on ${d.wiki.date}` : ''} — what the world was looking up.</p>
            <ol className="space-y-1">
              {d.wiki.top.slice(0, 20).map((w, i) => (
                <li key={w.title} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-right text-xs text-calibrex-muted tabular-nums">{i + 1}</span>
                  <a href={w.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-white hover:text-calibrex-teal">{w.title}</a>
                  <button onClick={() => onInvestigate(w.title)} className="text-calibrex-gold hover:text-white shrink-0" title="Research this"><Search size={13} /></button>
                  <span className="w-16 text-right text-xs text-calibrex-muted tabular-nums">{(w.views / 1000).toFixed(0)}k</span>
                </li>
              ))}
              {d.wiki.top.length === 0 && <li className="text-sm text-calibrex-muted">No data this cycle.</li>}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
};

export default Signals;
