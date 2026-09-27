import React, { useEffect, useState } from 'react';
import {
  X, Compass, Shield, LayoutGrid, Search, FileText, Radio, Eye, BarChart3, Wrench, UserSearch, Settings as Cog,
  Images, Zap, ShieldCheck, ScrollText, Sparkles, MapPin,
} from 'lucide-react';

export type GuideTab = 'guide' | 'overview';
/** Open the in-app guide popup from anywhere. */
export const openGuide = (tab: GuideTab = 'guide') => window.dispatchEvent(new CustomEvent('cx:guide', { detail: tab }));

const flow = [
  { n: '01', h: 'Spot', p: 'An event surfaces on the map or the live wire feed, rated by severity.' },
  { n: '02', h: 'Read & see', p: 'Open the full article inside Calibrex, with its photos, video and satellite views.' },
  { n: '03', h: 'Verify', p: 'Check how many independent outlets carry the same story right now.' },
  { n: '04', h: 'Investigate', p: 'Trace the infrastructure behind a site, or dig with the OSINT toolkit.' },
  { n: '05', h: 'Report', p: 'Compile a sourced brief and hand it to your desk from Dispatch Studio.' },
];
const capabilities = [
  { icon: MapPin, h: 'Live threat map', p: 'Every located event as a marker, grouped by place, colour-coded by severity, with hazard overlays.' },
  { icon: Images, h: 'Visual Intel', p: 'Every photo, video and satellite view from the reporting in one gallery, with NASA imagery of each hot spot.' },
  { icon: ShieldCheck, h: 'Research & Verify', p: 'Live news search plus a one-click check of how many independent outlets carry a story.' },
  { icon: FileText, h: 'Reports & dispatch', p: 'Turn pinned reports into an editable, fully sourced brief and export it.' },
  { icon: Eye, h: 'Watchlists & alerts', p: 'Save the names, places or groups you track and get told the moment they appear.' },
  { icon: BarChart3, h: 'Trends', p: 'Daily volume by topic, severity and place, and the locations getting unusual attention.' },
];
const steps = [
  { n: 1, h: 'Request access, then wait for activation', p: 'Choose Request access on the sign-in page and enter your details. Your account starts as pending until an administrator approves you — you’ll see an awaiting-activation screen with a contact. Once approved, sign in normally.' },
  { n: 2, h: 'Get your bearings on the Dashboard', p: 'Markers are events, grouped by place and coloured by severity. The feed refreshes every five minutes; new items are marked NEW. Click any item, then use Read for the full article and Visual intel for its photos, video and satellite views.' },
  { n: 3, h: 'Research a topic and verify it', p: 'Open Intelligence Research and search any place, group, vessel or event. Click Verify to see how widely a report is confirmed — three or more independent outlets means corroborated. Pin the reports you want to keep.' },
  { n: 4, h: 'Compile a report', p: 'In Report Generator your pinned reports become an editable draft with every source attached. Run a corroboration audit, then format and export from Dispatch Studio. Saved reports land in Report History.' },
  { n: 5, h: 'Set a watchlist so the news finds you', p: 'In Watchlists add the terms you track. Calibrex checks every new report against them and alerts you from the bell in the header when one matches.' },
];
const screens = [
  { icon: LayoutGrid, name: 'Dashboard', desc: 'Live map, wire feed and headline counts.' },
  { icon: Zap, name: 'Crisis Monitor', desc: 'Conflict view plus earthquake and disaster overlays.' },
  { icon: Images, name: 'Visual Intel', desc: 'All photos, video and satellite imagery in one gallery.' },
  { icon: Search, name: 'Research', desc: 'Live news search, verification and pinning.' },
  { icon: FileText, name: 'Report Generator', desc: 'Build a sourced brief from pinned reports.' },
  { icon: Radio, name: 'Dispatch Studio', desc: 'Format and export the finished report.' },
  { icon: Eye, name: 'Watchlists', desc: 'Track terms and get in-app alerts.' },
  { icon: BarChart3, name: 'Trends', desc: 'Daily volume by topic, severity and place.' },
  { icon: Wrench, name: 'OSINT Tools', desc: 'A curated toolkit plus built-in domain/IP recon.' },
  { icon: UserSearch, name: 'Subject Lookup', desc: 'Gated phone/username lookups, if your provider enables it.' },
  { icon: Cog, name: 'Settings', desc: 'Connect AI, text size, and your alert preferences.' },
];

/** In-app, branded Overview and Getting-Started popup. Works before sign-in too. */
const GuidePopup: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<GuideTab>('guide');

  useEffect(() => {
    const show = (e: Event) => { setTab((e as CustomEvent).detail === 'overview' ? 'overview' : 'guide'); setOpen(true); };
    window.addEventListener('cx:guide', show);
    return () => window.removeEventListener('cx:guide', show);
  }, []);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/85 flex items-stretch sm:items-center justify-center sm:p-6" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Calibrex guide" onClick={e => e.stopPropagation()} className="bg-calibrex-dark border border-white/10 sm:rounded-2xl w-full max-w-3xl max-h-full flex flex-col shadow-2xl">
        <header className="flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-white/10 bg-calibrex-navy/40">
          <Compass size={18} className="text-calibrex-teal shrink-0" />
          <div className="flex gap-1 flex-1">
            <button onClick={() => setTab('guide')} className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest ${tab === 'guide' ? 'bg-calibrex-teal text-calibrex-navy' : 'text-calibrex-muted hover:text-white'}`}>Getting started</button>
            <button onClick={() => setTab('overview')} className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest ${tab === 'overview' ? 'bg-calibrex-gold text-calibrex-navy' : 'text-calibrex-muted hover:text-white'}`}>Overview</button>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 text-calibrex-muted hover:text-white shrink-0"><X size={20} /></button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-7">
          {tab === 'guide' ? (
            <div className="space-y-6">
              <div>
                <div className="text-[10px] font-mono font-black text-calibrex-teal uppercase tracking-[0.22em] mb-2">New operator guide</div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Your first hour in Calibrex.</h2>
                <p className="text-sm text-calibrex-muted mt-2 leading-relaxed max-w-xl">Calibrex watches world events from public sources and helps you verify and report them. Here is the path from your first sign-in to your first dispatch.</p>
              </div>
              <ol className="space-y-3">
                {steps.map(s => (
                  <li key={s.n} className="flex gap-4 items-start bg-calibrex-surface border border-white/10 rounded-xl p-4">
                    <span className={`w-9 h-9 shrink-0 rounded-lg grid place-items-center font-black text-sm ${s.n === 1 ? 'bg-calibrex-gold text-calibrex-navy' : 'bg-calibrex-teal text-calibrex-navy'}`}>{s.n}</span>
                    <div><h3 className="text-sm font-black text-white mb-1">{s.h}</h3><p className="text-[13px] text-calibrex-muted leading-relaxed">{s.p}</p></div>
                  </li>
                ))}
              </ol>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-3">Every screen at a glance</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {screens.map(s => { const I = s.icon; return (
                    <div key={s.name} className="flex items-start gap-3 bg-black/20 border border-white/5 rounded-lg p-3">
                      <I size={16} className="text-calibrex-teal shrink-0 mt-0.5" />
                      <div><div className="text-[13px] font-bold text-white">{s.name}</div><div className="text-[12px] text-calibrex-muted">{s.desc}</div></div>
                    </div>
                  ); })}
                </div>
              </div>
              <div className="bg-calibrex-navy/60 border border-calibrex-gold/20 rounded-xl p-4 flex items-start gap-3">
                <Sparkles size={18} className="text-calibrex-gold shrink-0 mt-0.5" />
                <div><h3 className="text-sm font-black text-white mb-1">Optional: connect your own AI</h3><p className="text-[13px] text-calibrex-muted leading-relaxed">In Settings → AI Connection, link your own Claude, ChatGPT or Gemini account to draft reports and summarise findings — always from the sources on screen. Calibrex works fully without it.</p></div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="text-[10px] font-mono font-black text-calibrex-teal uppercase tracking-[0.22em] mb-2">Platform overview</div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">See the world’s events — then verify and report them.</h2>
                <p className="text-sm text-calibrex-muted mt-2 leading-relaxed max-w-xl">Calibrex pulls live, public information from the web every five minutes, sorts it by threat and severity, maps it, and gives your analysts the tools to confirm and write it up. Real sources only.</p>
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-3">What your team gets</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {capabilities.map(c => { const I = c.icon; return (
                    <div key={c.h} className="bg-calibrex-surface border border-white/10 rounded-xl p-4">
                      <div className="flex items-center gap-2.5 mb-1.5"><I size={17} className="text-calibrex-teal" /><h4 className="text-[13.5px] font-black text-white">{c.h}</h4></div>
                      <p className="text-[12.5px] text-calibrex-muted leading-relaxed">{c.p}</p>
                    </div>
                  ); })}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-3">How a story flows</h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {flow.map(f => (
                    <div key={f.n} className="bg-black/20 border border-white/5 rounded-lg p-3">
                      <div className="text-[11px] font-mono font-black text-calibrex-teal">{f.n}</div>
                      <div className="text-[13px] font-black text-white mt-1.5">{f.h}</div>
                      <div className="text-[11.5px] text-calibrex-muted mt-1 leading-snug">{f.p}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-calibrex-navy/60 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2.5 mb-3"><Shield size={17} className="text-calibrex-gold" /><h3 className="text-sm font-black text-white uppercase tracking-widest">Built for control and trust</h3></div>
                <ul className="space-y-2 text-[13px] text-calibrex-muted leading-relaxed">
                  <li className="flex gap-2"><ShieldCheck size={15} className="text-calibrex-teal shrink-0 mt-0.5" /> Approved access only — new users stay pending until an administrator activates them; accounts can be suspended or restored at any time.</li>
                  <li className="flex gap-2"><ShieldCheck size={15} className="text-calibrex-teal shrink-0 mt-0.5" /> Verification, not assumption — three or more independent outlets marks a story corroborated; social posts are flagged unverified.</li>
                  <li className="flex gap-2"><ScrollText size={15} className="text-calibrex-teal shrink-0 mt-0.5" /> Auditable by design — sensitive lookups are off by default, need an accepted agreement on every use, and are logged for the administrator.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuidePopup;
