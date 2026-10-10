import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { Network, Search, Loader2, Trash2, Crosshair, Copy, X, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { runPivot, GraphNode, GraphEdge } from '../lib/pivot';
import { copyText, loadRecord, saveRecord, api } from '../lib/api';
import { addBrief } from '../lib/briefs';
import AiAssist from './AiAssist';

interface EntityWatch { id: string; value: string; type: string; label: string; lastIds: string[]; lastRun: number; createdAt: number }
const watchType = (t: string) => t === 'domain' || t === 'subdomain' ? 'domain' : t === 'ip' ? 'ip' : t === 'email' ? 'email' : t === 'person' ? 'entity' : null;

// Node palette by entity type.
const TYPE_COLOR: Record<string, string> = {
  domain: '#39b7c9', subdomain: '#2a7f8c', ip: '#d7b56a', mx: '#8aa0b2', ns: '#8aa0b2',
  registrar: '#9a7bd0', email: '#58c39a', person: '#ffffff', sanction: '#ff5a6e', unknown: '#6f8591',
};
const TYPES = ['auto', 'domain', 'ip', 'email', 'entity'];

const GraphBoard: React.FC<{ onInvestigate: (q: string) => void }> = ({ onInvestigate }) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<any>(null);
  const [seed, setSeed] = useState('');
  const [type, setType] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<{ id: string; label: string; type: string } | null>(null);
  const [counts, setCounts] = useState({ n: 0, e: 0 });

  useEffect(() => {
    if (!boxRef.current || cyRef.current) return;
    const cy = cytoscape({
      container: boxRef.current,
      elements: [],
      style: [
        { selector: 'node', style: {
          'background-color': (el: any) => TYPE_COLOR[el.data('type')] || TYPE_COLOR.unknown,
          'label': 'data(label)', 'color': '#dce6ee', 'font-size': 9, 'font-family': 'IBM Plex Mono, monospace',
          'text-valign': 'bottom', 'text-margin-y': 3, 'width': 16, 'height': 16,
          'text-background-color': '#070d13', 'text-background-opacity': 0.7, 'text-background-padding': 2,
          'border-width': 1, 'border-color': '#070d13',
        } },
        { selector: 'node:selected', style: { 'border-width': 2, 'border-color': '#39b7c9', 'width': 22, 'height': 22 } },
        { selector: 'edge', style: {
          'width': 1, 'line-color': 'rgba(138,160,178,0.35)', 'target-arrow-color': 'rgba(138,160,178,0.35)',
          'target-arrow-shape': 'triangle', 'arrow-scale': 0.7, 'curve-style': 'bezier',
          'label': 'data(label)', 'font-size': 7, 'color': '#6f8591', 'text-rotation': 'autorotate',
        } },
      ],
    });
    cyRef.current = cy;
    cy.on('tap', 'node', (ev: any) => { const d = ev.target.data(); setSel({ id: d.id, label: d.label, type: d.type }); });
    cy.on('tap', (ev: any) => { if (ev.target === cy) setSel(null); });
    const t = setTimeout(() => cy.resize(), 200);
    return () => { clearTimeout(t); cy.destroy(); cyRef.current = null; };
  }, []);

  const sync = () => { const cy = cyRef.current; if (cy) setCounts({ n: cy.nodes().length, e: cy.edges().length }); };

  const merge = (nodes: GraphNode[], edges: GraphEdge[]) => {
    const cy = cyRef.current; if (!cy) return;
    cy.batch(() => {
      nodes.forEach(nd => { if (cy.getElementById(nd.id).empty()) cy.add({ group: 'nodes', data: { id: nd.id, label: nd.label, type: nd.type } }); });
      edges.forEach(ed => {
        const id = `${ed.source}->${ed.target}:${ed.label}`;
        if (cy.getElementById(ed.source).nonempty() && cy.getElementById(ed.target).nonempty() && cy.getElementById(id).empty())
          cy.add({ group: 'edges', data: { id, source: ed.source, target: ed.target, label: ed.label } });
      });
    });
    cy.layout({ name: 'cose', animate: true, animationDuration: 500, padding: 30, nodeRepulsion: 6000 }).run();
    sync();
  };

  const mapSeed = (e?: React.FormEvent) => {
    e?.preventDefault();
    const v = seed.trim(); if (!v) return;
    setLoading(true); setErr(null);
    runPivot(v, type).then(r => {
      if (!r.nodes.length) { setErr('No entities found for this selector.'); return; }
      merge(r.nodes, r.edges);
    }).catch(() => setErr('Pivot failed — the source may be unreachable.')).finally(() => setLoading(false));
  };

  const expand = (nd: { id: string; type: string }) => {
    setLoading(true); setErr(null);
    const t = ['domain', 'ip', 'email'].includes(nd.type) ? nd.type : nd.type === 'person' ? 'entity' : 'auto';
    runPivot(nd.id, t).then(r => merge(r.nodes, r.edges)).catch(() => setErr('Expand failed.')).finally(() => setLoading(false));
  };

  const reset = () => { const cy = cyRef.current; if (cy) { cy.elements().remove(); setSel(null); sync(); } };

  const [filed, setFiled] = useState(false);
  const graphPayload = () => {
    const cy = cyRef.current;
    const nodes = cy ? cy.nodes() : [];
    if (!nodes || nodes.length < 2) throw new Error('Map at least a seed and one connection first.');
    const entities = nodes.map((n: any) => ({ label: n.data('label'), type: n.data('type') }));
    const relationships = cy.edges().map((e: any) => ({ from: e.data('source'), to: e.data('target'), label: e.data('label') }));
    return { subject: sel?.label || entities[0]?.label || 'graph', entities, relationships };
  };
  const fileDossier = (text: string) => {
    const subject = sel?.label || (cyRef.current?.nodes()?.[0]?.data('label')) || 'Investigation';
    addBrief({ title: `Dossier: ${subject}`, domain: 'Investigation', text }).then(() => { setFiled(true); setTimeout(() => setFiled(false), 2500); });
  };

  // Continuous entity-watch: save a pivotable entity and let the server re-check it.
  const [watches, setWatches] = useState<EntityWatch[]>([]);
  const [reChecking, setReChecking] = useState(false);
  const [reMsg, setReMsg] = useState<string | null>(null);
  useEffect(() => { loadRecord<EntityWatch[]>('entity_watches', []).then(v => setWatches(Array.isArray(v) ? v : [])); }, []);
  const persist = (next: EntityWatch[]) => { setWatches(next); saveRecord('entity_watches', next); };
  const isWatched = (value: string) => watches.some(w => w.value === value);
  const toggleWatch = (node: { id: string; label: string; type: string }) => {
    const wt = watchType(node.type); if (!wt) return;
    if (isWatched(node.id)) persist(watches.filter(w => w.value !== node.id));
    else persist([{ id: Date.now().toString(36), value: node.id, type: wt, label: node.label, lastIds: [], lastRun: 0, createdAt: Date.now() }, ...watches].slice(0, 50));
  };
  const reCheck = () => {
    setReChecking(true); setReMsg(null);
    api<{ changed: number }>('/entitywatch/run', { method: 'POST' })
      .then(r => { setReMsg(r.changed ? `${r.changed} watch${r.changed === 1 ? '' : 'es'} gained new connections — see the bell.` : 'No new connections since last check.'); loadRecord<EntityWatch[]>('entity_watches', []).then(v => setWatches(Array.isArray(v) ? v : [])); })
      .catch(() => setReMsg('Re-check failed.'))
      .finally(() => setReChecking(false));
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2"><Network size={22} className="text-calibrex-teal" /> Link Analysis</h1>
        <p className="text-sm text-calibrex-muted mt-1 max-w-2xl">Start from a domain, IP, email or name and pivot across its connections — certificate transparency, DNS, domain registry and sanctions. All public, passive lookups. Tap any node to expand it.</p>
      </div>

      <form onSubmit={mapSeed} className="flex flex-wrap gap-2">
        <select value={type} onChange={e => setType(e.target.value)} className="bg-calibrex-surface-light border border-calibrex-teal/30 rounded-lg px-2 py-2.5 text-calibrex-text text-sm focus:outline-none">
          {TYPES.map(t => <option key={t} value={t}>{t === 'auto' ? 'Auto-detect' : t[0].toUpperCase() + t.slice(1)}</option>)}
        </select>
        <input value={seed} onChange={e => setSeed(e.target.value)} placeholder="example.com · 8.8.8.8 · name@site.com · a name" aria-label="Seed entity"
          className="flex-1 min-w-[180px] bg-calibrex-surface-light border border-calibrex-teal/30 rounded-lg px-3 py-2.5 text-calibrex-text text-sm focus:outline-none focus:border-calibrex-teal" />
        <button type="submit" disabled={loading || !seed.trim()} className="px-4 py-2.5 rounded-lg bg-calibrex-teal text-calibrex-navy font-black text-sm flex items-center gap-1.5 disabled:opacity-40">{loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Map</button>
        <button type="button" onClick={reset} className="px-3 py-2.5 rounded-lg border border-white/15 text-white text-sm flex items-center gap-1.5" title="Clear graph"><Trash2 size={15} /></button>
      </form>

      {err && <p className="text-sm text-calibrex-high flex items-center gap-1.5"><AlertTriangle size={14} /> {err}</p>}

      {counts.n > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <AiAssist task="dossier" label="AI dossier" getInput={graphPayload} onUse={fileDossier} useLabel="File to Briefs" />
          {filed && <span className="text-[11px] text-calibrex-low font-bold">Filed to Briefs.</span>}
        </div>
      )}

      <div className="relative">
        <div ref={boxRef} className="w-full h-[460px] rounded-lg border border-white/10 bg-[#0a131b]" />
        {counts.n === 0 && !loading && <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm pointer-events-none">Map a seed entity to begin</div>}
        {/* Selected node panel */}
        {sel && (
          <div className="absolute top-3 right-3 w-56 bg-calibrex-surface border border-white/15 rounded-lg p-3 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="text-[9px] font-black uppercase tracking-widest" style={{ color: TYPE_COLOR[sel.type] || '#fff' }}>{sel.type}</div><div className="text-[12px] text-white break-all">{sel.label}</div></div>
              <button onClick={() => setSel(null)} className="text-white/40 hover:text-white shrink-0"><X size={14} /></button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <button onClick={() => expand(sel)} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-calibrex-teal/15 text-calibrex-teal border border-calibrex-teal/30"><Crosshair size={12} /> Expand</button>
              {watchType(sel.type) && <button onClick={() => toggleWatch(sel)} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border ${isWatched(sel.id) ? 'border-calibrex-gold/50 text-calibrex-gold bg-calibrex-gold/10' : 'border-white/15 text-white'}`}>{isWatched(sel.id) ? <><EyeOff size={12} /> Unwatch</> : <><Eye size={12} /> Watch</>}</button>}
              <button onClick={() => onInvestigate(sel.label)} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border border-white/15 text-white"><Search size={12} /> Investigate</button>
              <button onClick={() => copyText(sel.label)} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border border-white/15 text-white"><Copy size={12} /></button>
            </div>
          </div>
        )}
      </div>

      {watches.length > 0 && (
        <div className="rounded-lg border border-calibrex-gold/25 bg-calibrex-gold/5 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-black text-calibrex-gold uppercase tracking-widest flex items-center gap-1.5"><Eye size={13} /> Watched entities ({watches.length})</span>
            <button onClick={reCheck} disabled={reChecking} className="text-[10px] font-bold px-2.5 py-1 rounded border border-calibrex-gold/40 text-calibrex-gold disabled:opacity-40 flex items-center gap-1">{reChecking ? <Loader2 size={11} className="animate-spin" /> : <Crosshair size={11} />} Re-check now</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {watches.map(w => (
              <span key={w.id} className="inline-flex items-center gap-1.5 text-[11px] bg-black/30 border border-white/10 rounded-full pl-2.5 pr-1 py-1">
                <button onClick={() => { setSeed(w.value); setType(w.type); }} className="text-white/80 hover:text-white font-mono" title="Load into search">{w.label}</button>
                <button onClick={() => persist(watches.filter(x => x.id !== w.id))} className="text-white/30 hover:text-calibrex-critical"><X size={12} /></button>
              </span>
            ))}
          </div>
          <p className="text-[10px] text-calibrex-muted mt-2">Re-checked automatically every few hours; you get a notification when new connections appear.{reMsg ? ` ${reMsg}` : ''}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-calibrex-muted">
        <span className="font-mono">{counts.n} nodes · {counts.e} links</span>
        {Object.entries(TYPE_COLOR).filter(([k]) => k !== 'unknown').map(([k, c]) => (
          <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c }} /> {k}</span>
        ))}
      </div>
    </div>
  );
};

export default GraphBoard;
