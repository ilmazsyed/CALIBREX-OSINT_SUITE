import React, { useMemo, useState } from 'react';
import { ExternalLink, Search, Github, Network, Wrench } from 'lucide-react';
import { TOOLKIT } from '../lib/toolkit';
import ReconPanel from './ReconPanel';

/** OSINT Tools: a curated directory grouped by what you start with, plus the
 *  built-in Infrastructure Recon panel. */
const Tools: React.FC = () => {
  const [q, setQ] = useState('');
  const [active, setActive] = useState<string>('recon');

  const needle = q.trim().toLowerCase();
  const groups = useMemo(() => TOOLKIT.map(g => ({
    ...g,
    tools: needle ? g.tools.filter(t => `${t.name} ${t.desc}`.toLowerCase().includes(needle)) : g.tools,
  })).filter(g => g.tools.length), [needle]);

  const fill = (t: { url: string; search?: string }) => (needle && t.search ? t.search.replace('{q}', encodeURIComponent(q.trim())) : t.url);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1"><Wrench size={20} className="text-calibrex-teal" /><h2 className="text-xl font-bold text-white">OSINT Tools</h2></div>
      <p className="text-sm text-calibrex-muted mb-5">A working toolkit grouped by what you start with — a domain, an IP, an image, a company. Sites open in a new tab; where supported, your search term is carried across. Tools marked <Github size={11} className="inline" /> are code you run on your own machine.</p>

      <div className="relative mb-5 max-w-xl">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-calibrex-muted" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Type a term to carry into search tools, or filter the toolkit…" className="w-full bg-black/30 border border-white/15 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-calibrex-teal" />
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setActive('recon')} className={`px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 ${active === 'recon' ? 'bg-calibrex-gold text-calibrex-navy' : 'bg-white/5 text-calibrex-muted hover:text-white'}`}><Network size={14} /> Infrastructure Recon</button>
        {groups.map(g => (
          <button key={g.id} onClick={() => setActive(g.id)} className={`px-3 py-1.5 rounded-full text-sm font-bold ${active === g.id ? 'bg-calibrex-teal text-calibrex-navy' : 'bg-white/5 text-calibrex-muted hover:text-white'}`}>{g.label}</button>
        ))}
      </div>

      {active === 'recon' ? <ReconPanel initial={needle && /\.|:/.test(needle) ? q.trim() : ''} /> : (
        groups.filter(g => g.id === active).map(g => (
          <section key={g.id}>
            <p className="text-sm text-calibrex-muted mb-3">{g.hint}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {g.tools.map(t => t.url === '#recon' ? (
                <button key={t.name} onClick={() => setActive('recon')} className="text-left bg-calibrex-gold/10 border border-calibrex-gold/40 p-4 rounded-lg hover:bg-calibrex-gold/15">
                  <div className="font-bold text-calibrex-gold flex items-center gap-1.5"><Network size={14} /> {t.name}</div>
                  <p className="text-xs text-calibrex-muted mt-1">{t.desc}</p>
                  <span className="mt-3 inline-block text-xs font-black uppercase tracking-wide text-calibrex-gold">Open panel →</span>
                </button>
              ) : (
                <a key={t.name} href={fill(t)} target="_blank" rel="noopener noreferrer" className="block bg-calibrex-surface-light border border-white/10 p-4 rounded-lg hover:border-calibrex-teal group">
                  <div className="font-bold text-white flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">{t.gh && <Github size={13} className="text-calibrex-muted shrink-0" />} {t.name}</span>
                    <ExternalLink size={13} className="opacity-0 group-hover:opacity-100 text-calibrex-teal shrink-0" />
                  </div>
                  <p className="text-xs text-calibrex-muted mt-1">{t.desc}</p>
                  <span className="mt-3 inline-block text-xs font-black uppercase tracking-wide text-calibrex-teal">{needle && t.search ? `Search "${q.trim()}"` : t.gh ? 'View on GitHub' : 'Open tool'} →</span>
                </a>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
};

export default Tools;
