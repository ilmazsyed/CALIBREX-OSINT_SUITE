import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { api } from '../lib/api';
import { Network, RefreshCw, AlertTriangle } from 'lucide-react';

type GraphNode = { id: string; type: string; label: string; resolution?: string; status?: string };
type GraphEdge = { id: string; source: string; target: string; type: string; status: string; reviewRequired?: boolean; independentCorroboration?: boolean };
type GraphData = { nodes: GraphNode[]; edges: GraphEdge[]; summary: Record<string, number>; limitations: string[] };

const COLOURS: Record<string, string> = { ENTITY: '#39b7c9', EVIDENCE: '#d7b56a', HYPOTHESIS: '#a78bfa', PIR: '#58c39a' };

const InvestigationGraphPanel: React.FC<{ investigationId: string; workspaceId?: string }> = ({ investigationId, workspaceId }) => {
  const container = useRef<HTMLDivElement | null>(null);
  const cy = useRef<any>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ label: string; type: string } | null>(null);

  const scoped=(path:string)=>workspaceId?path+'?workspaceId='+encodeURIComponent(workspaceId):path;
  const load = async () => {
    setLoading(true); setError('');
    try {
      const result = await api<GraphData & { investigationId: string }>scoped('/investigations/' + encodeURIComponent(investigationId) + '/graph');
      setData(result);
    } catch (e: any) { setError(e.message || 'Could not load the investigation graph.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [investigationId]);

  useEffect(() => {
    if (!container.current || !data) return;
    cy.current?.destroy();
    const graph = cytoscape({
      container: container.current,
      elements: [
        ...data.nodes.map(node => ({ group: 'nodes', data: { id: node.id, label: node.label, type: node.type, resolution: node.resolution || node.status || '' } })),
        ...data.edges.map(edge => ({ group: 'edges', data: { id: edge.id, source: edge.source, target: edge.target, label: edge.type, status: edge.status } }))
      ],
      style: [
        { selector: 'node', style: { 'background-color': (el: any) => COLOURS[el.data('type')] || '#8aa0b2',
          label: 'data(label)', color: '#dce6ee', 'font-size': 9, 'font-family': 'IBM Plex Mono, monospace',
          'text-wrap': 'wrap', 'text-max-width': 110, 'text-valign': 'bottom', 'text-margin-y': 5,
          width: 18, height: 18, 'border-width': 1, 'border-color': '#07111a' } },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#39b7c9', width: 24, height: 24 } },
        { selector: 'edge', style: { width: 1.4, 'line-color': '#6b8798', 'target-arrow-color': '#6b8798',
          'target-arrow-shape': 'triangle', 'curve-style': 'bezier', label: 'data(label)',
          color: '#9aabb7', 'font-size': 7, 'text-rotation': 'autorotate' } },
        { selector: 'edge[status = "MACHINE_SUGGESTED"]', style: { 'line-style': 'dashed',
          'line-color': '#d7b56a', 'target-arrow-color': '#d7b56a', color: '#d7b56a' } }
      ],
      layout: { name: 'cose', animate: false, padding: 28, nodeRepulsion: 6500, idealEdgeLength: 90 }
    });
    graph.on('tap', 'node', (event: any) => setSelected({ label: event.target.data('label'), type: event.target.data('type') }));
    graph.on('tap', (event: any) => { if (event.target === graph) setSelected(null); });
    cy.current = graph;
    return () => { graph.destroy(); if (cy.current === graph) cy.current = null; };
  }, [data]);

  useEffect(() => () => { cy.current?.destroy(); cy.current = null; }, []);

  return <section className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-black text-sm flex items-center gap-2"><Network size={15} className="text-calibrex-teal"/> Investigation relationship graph</h3>
        <p className="text-[10px] text-white/40 mt-1">Case evidence, entities, hypotheses and analyst-recorded links. Dashed amber edges are machine-suggested review leads.</p></div>
      <button onClick={load} disabled={loading} className="text-[10px] rounded border border-white/15 px-3 py-2 disabled:opacity-40"><RefreshCw size={12} className="inline mr-1"/>{loading ? 'Refreshing…' : 'Refresh graph'}</button><button onClick={()=>window.open(scoped('/investigations/'+encodeURIComponent(investigationId)+'/graph.graphml'),'_blank','noopener,noreferrer')} className="text-[10px] rounded border border-white/15 px-3 py-2">Export GraphML</button>
    </div>
    {error && <p className="text-xs text-amber-300">{error}</p>}
    {data && <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {['entityCount','evidenceCount','hypothesisCount','candidateEdges'].map(key => <div key={key} className="rounded-lg border border-white/10 p-2"><div className="text-[9px] text-white/40">{key.replace(/([A-Z])/g,' $1')}</div><div className="text-lg font-black">{data.summary?.[key] ?? 0}</div></div>)}
      </div>
      <div ref={container} className="w-full h-[340px] rounded-lg border border-white/10 bg-[#050b11]" role="img" aria-label="Investigation relationship graph"/>
      {selected && <div className="text-[10px] text-white/65">Selected: <strong>{selected.label}</strong> · {selected.type}</div>}
      <div className="flex flex-wrap gap-3 text-[9px] text-white/45">{Object.entries(COLOURS).map(([type, colour]) => <span key={type} className="flex items-center gap-1"><i className="inline-block w-2 h-2 rounded-full" style={{ background: colour }}/>{type}</span>)}<span className="text-amber-300">Dashed amber = candidate only</span></div>
      <div className="rounded-lg border border-amber-400/15 bg-amber-400/5 p-2 text-[9px] text-white/55"><AlertTriangle size={12} className="inline mr-1 text-amber-300"/>Candidate links do not establish identity, event equivalence, coordination, truth or independent corroboration.</div>
      <ul className="text-[9px] text-white/35 list-disc pl-4 space-y-1">{(data.limitations || []).slice(0,3).map((item,i)=><li key={i}>{item}</li>)}</ul>
    </>}
  </section>;
};

export default InvestigationGraphPanel;
