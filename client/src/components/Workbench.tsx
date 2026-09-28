import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Clock, FolderOpen, Loader2, ExternalLink, FolderPlus, Trash2, Plus, Copy, Check, X } from 'lucide-react';
import { WIRES, WIRE_KEYS, WireKey, Severity, timeAgo } from '../lib/live';
import { getLibrary, LibraryItem, addToCase, getCases, saveCases, newCase, Board } from '../lib/workbench';
import { copyText } from '../lib/api';

const SEV_DOT: Record<string, string> = { CRITICAL: 'bg-calibrex-critical', HIGH: 'bg-calibrex-high', MEDIUM: 'bg-calibrex-medium', LOW: 'bg-calibrex-low' };
const SEV_ORDER: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/** A compact result row, reused by Search and Timeline. */
const ItemRow: React.FC<{ it: LibraryItem; onInvestigate: (q: string) => void }> = ({ it, onInvestigate }) => (
  <div className="flex items-start gap-3 py-2.5 px-3 border-b border-white/5 hover:bg-white/5 group">
    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${SEV_DOT[it.severity] || 'bg-calibrex-low'}`} title={it.severity} />
    <div className="min-w-0 flex-1">
      <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-sm text-white hover:text-calibrex-teal font-medium block truncate">{it.title}</a>
      <div className="text-[11px] text-calibrex-muted mt-0.5 flex flex-wrap items-center gap-x-2">
        <span>{it.source}</span>
        <span className="opacity-40">·</span><span>{WIRES[it.wire]?.label || it.wire}</span>
        {it.place?.name && <><span className="opacity-40">·</span><span>{it.place.name}</span></>}
        <span className="opacity-40">·</span><span>{timeAgo(it.published)}</span>
      </div>
    </div>
    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={() => onInvestigate(it.title)} title="Research this" className="p-1 text-calibrex-gold hover:text-white"><Search size={14} /></button>
      <button onClick={() => addToCase({ id: it.id, title: it.title, url: it.url, source: it.source, wire: it.wire, severity: it.severity, published: it.published, place: it.place?.name || null })} title="Add to case" className="p-1 text-calibrex-teal hover:text-white"><FolderPlus size={14} /></button>
    </div>
  </div>
);

const Filters: React.FC<{
  q: string; setQ: (v: string) => void; wires: WireKey[]; toggleWire: (w: WireKey) => void;
  minSeverity: Severity; setMinSeverity: (s: Severity) => void; source: string; setSource: (v: string) => void;
}> = ({ q, setQ, wires, toggleWire, minSeverity, setMinSeverity, source, setSource }) => (
  <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search everything ingested…" className="flex-1 min-w-[200px] bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-calibrex-teal" />
      <input value={source} onChange={e => setSource(e.target.value)} placeholder="Source…" className="w-32 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-calibrex-teal" />
      <select value={minSeverity} onChange={e => setMinSeverity(e.target.value as Severity)} className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-calibrex-teal">
        {SEV_ORDER.map(s => <option key={s} value={s}>{s === 'LOW' ? 'Any severity' : `${s}+`}</option>)}
      </select>
    </div>
    <div className="flex flex-wrap gap-1.5">
      {WIRE_KEYS.map(w => (
        <button key={w} onClick={() => toggleWire(w)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${wires.includes(w) ? 'bg-calibrex-teal/15 border-calibrex-teal text-calibrex-teal' : 'border-white/10 text-calibrex-muted hover:text-white'}`}>{WIRES[w].label}</button>
      ))}
    </div>
  </div>
);

const Workbench: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [tab, setTab] = useState<'search' | 'timeline' | 'cases'>('search');
  const [q, setQ] = useState('');
  const [wires, setWires] = useState<WireKey[]>([]);
  const [minSeverity, setMinSeverity] = useState<Severity>('LOW');
  const [source, setSource] = useState('');
  const [results, setResults] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggleWire = (w: WireKey) => setWires(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]);

  // Debounced query as the analyst types / changes filters.
  useEffect(() => {
    if (tab === 'cases') return;
    const t = setTimeout(() => {
      setLoading(true);
      getLibrary({ q, wires, minSeverity, source })
        .then(r => { setResults(r.results); setTotal(r.total); setError(null); })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, wires, minSeverity, source, tab]);

  const byDay = useMemo(() => {
    const groups = new Map<string, LibraryItem[]>();
    for (const it of results) {
      const key = new Date(it.published).toISOString().slice(0, 10);
      (groups.get(key) || groups.set(key, []).get(key)!).push(it);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [results]);

  const tabBtn = (id: typeof tab, label: string, icon: React.ReactNode) => (
    <button onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest border transition-all ${tab === id ? 'bg-calibrex-teal/15 border-calibrex-teal text-calibrex-teal' : 'border-white/10 text-calibrex-muted hover:text-white'}`}>{icon} {label}</button>
  );

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><FolderOpen size={20} className="text-calibrex-teal" /> Workbench</h2>
        <p className="text-sm text-calibrex-muted">Search and timeline the live intake, and organise findings into cases.</p>
      </div>
      <div className="flex items-center gap-2">
        {tabBtn('search', 'Search', <Search size={14} />)}
        {tabBtn('timeline', 'Timeline', <Clock size={14} />)}
        {tabBtn('cases', 'Cases', <FolderOpen size={14} />)}
      </div>

      {tab !== 'cases' && (
        <>
          <Filters q={q} setQ={setQ} wires={wires} toggleWire={toggleWire} minSeverity={minSeverity} setMinSeverity={setMinSeverity} source={source} setSource={setSource} />
          {error && <p className="text-sm text-calibrex-critical">{error}</p>}
          <div className="text-xs text-calibrex-muted flex items-center gap-2">{loading && <Loader2 size={13} className="animate-spin" />}{total} match{total === 1 ? '' : 'es'} in the current intake window</div>

          {tab === 'search' ? (
            <div className="bg-calibrex-surface border border-white/10 rounded-lg overflow-hidden">
              {results.length === 0 && !loading ? <p className="p-6 text-sm text-calibrex-muted text-center">Nothing matches. Broaden the query or filters.</p>
                : results.map(it => <ItemRow key={it.id} it={it} onInvestigate={onInvestigate} />)}
            </div>
          ) : (
            <div className="space-y-6">
              {byDay.length === 0 && !loading && <p className="text-sm text-calibrex-muted">No events for this query.</p>}
              {byDay.map(([day, its]) => (
                <div key={day}>
                  <div className="sticky top-0 bg-calibrex-dark/90 backdrop-blur py-1 text-[11px] font-black text-calibrex-gold uppercase tracking-widest border-l-2 border-calibrex-gold pl-2 mb-1">{dayLabel(its[0].published)} · {its.length}</div>
                  <div className="bg-calibrex-surface border border-white/10 rounded-lg overflow-hidden ml-2">
                    {its.map(it => <ItemRow key={it.id} it={it} onInvestigate={onInvestigate} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'cases' && <Cases onInvestigate={onInvestigate} />}
    </div>
  );
};

// ---------------------------------------------------------------- cases tab

const Cases: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const [cases, setCases] = useState<Board[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { getCases().then(c => { setCases(c); setOpenId(c[0]?.id || null); }); }, []);

  // Autosave (debounced) whenever cases change after the first load.
  const persist = useCallback((next: Board[]) => {
    setCases(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveCases(next), 500);
  }, []);

  if (!cases) return <div className="py-16 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>;

  const open = cases.find(c => c.id === openId) || null;
  const create = () => { if (!name.trim()) return; const c = newCase(name); persist([c, ...cases]); setOpenId(c.id); setName(''); };
  const remove = (id: string) => { const next = cases.filter(c => c.id !== id); persist(next); if (openId === id) setOpenId(next[0]?.id || null); };
  const removeItem = (itemId: string) => open && persist(cases.map(c => c.id === open.id ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c));
  const setNotes = (notes: string) => open && persist(cases.map(c => c.id === open.id ? { ...c, notes } : c));

  const exportCase = async () => {
    if (!open) return;
    const txt = [
      `CASE: ${open.name}`, `Created ${new Date(open.createdAt).toLocaleDateString()} · ${open.items.length} item${open.items.length === 1 ? '' : 's'}`, '',
      open.notes ? `NOTES\n${open.notes}\n` : '',
      'ITEMS',
      ...open.items.map((it, i) => `${i + 1}. ${it.title} (${it.source}${it.place ? `, ${it.place}` : ''})\n   ${it.url}`),
    ].filter(Boolean).join('\n');
    if (await copyText(txt)) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Case list */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} placeholder="New case name…" className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-calibrex-teal" />
          <button onClick={create} disabled={!name.trim()} className="px-3 py-2 bg-calibrex-teal/15 border border-calibrex-teal/40 text-calibrex-teal rounded-lg disabled:opacity-40"><Plus size={16} /></button>
        </div>
        {cases.length === 0 && <p className="text-xs text-calibrex-muted">No cases yet. Create one, then pin items from Search or a threat card.</p>}
        {cases.map(c => (
          <button key={c.id} onClick={() => setOpenId(c.id)} className={`w-full text-left px-3 py-2.5 rounded-lg border flex items-center justify-between gap-2 ${openId === c.id ? 'bg-calibrex-teal/10 border-calibrex-teal/40' : 'border-white/10 hover:bg-white/5'}`}>
            <span className="min-w-0"><span className="text-sm text-white font-medium block truncate">{c.name}</span><span className="text-[10px] text-calibrex-muted">{c.items.length} item{c.items.length === 1 ? '' : 's'}</span></span>
            <Trash2 size={14} className="text-calibrex-muted hover:text-calibrex-critical shrink-0" onClick={e => { e.stopPropagation(); remove(c.id); }} />
          </button>
        ))}
      </div>

      {/* Open case */}
      <div className="md:col-span-2">
        {!open ? <p className="text-sm text-calibrex-muted">Select or create a case.</p> : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-white truncate">{open.name}</h3>
              <button onClick={exportCase} className="px-3 py-1.5 border border-white/15 text-white text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5 shrink-0">{copied ? <Check size={13} /> : <Copy size={13} />} Export</button>
            </div>
            <textarea value={open.notes} onChange={e => setNotes(e.target.value)} placeholder="Case notes / working hypothesis…" className="w-full bg-black/40 border border-white/10 rounded-lg p-3 h-28 text-sm text-white/90 focus:outline-none focus:border-calibrex-teal resize-y" />
            <div className="bg-calibrex-surface border border-white/10 rounded-lg overflow-hidden">
              {open.items.length === 0 ? <p className="p-6 text-sm text-calibrex-muted text-center">No items pinned. Use the <FolderPlus size={12} className="inline" /> button on Search results or threat cards.</p>
                : open.items.map(it => (
                  <div key={it.id} className="flex items-start gap-3 py-2.5 px-3 border-b border-white/5 group">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${SEV_DOT[it.severity || 'LOW'] || 'bg-calibrex-low'}`} />
                    <div className="min-w-0 flex-1">
                      <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-sm text-white hover:text-calibrex-teal font-medium block truncate">{it.title}</a>
                      <div className="text-[11px] text-calibrex-muted mt-0.5">{it.source}{it.place ? ` · ${it.place}` : ''}{it.published ? ` · ${timeAgo(it.published)}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => onInvestigate(it.title)} title="Research" className="p-1 text-calibrex-gold hover:text-white"><Search size={14} /></button>
                      <button onClick={() => removeItem(it.id)} title="Remove" className="p-1 text-calibrex-muted hover:text-calibrex-critical"><X size={14} /></button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Workbench;
