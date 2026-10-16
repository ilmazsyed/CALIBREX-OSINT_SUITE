import React, { useEffect, useState } from 'react';
import {
  X, Compass, Shield, LayoutGrid, Search, FileText, Eye, BarChart3, Wrench, UserSearch, Settings as Cog,
  Images, ShieldCheck, ScrollText, Sparkles, MapPin, FolderOpen, LineChart, RadioTower, Siren, PlayCircle,
  Gauge, Globe2, Swords, Ship, Network, Users, KeyRound,
} from 'lucide-react';
import { startTour } from './AssistTour';
import { openMission } from '../lib/mission';

export type GuideTab = 'guide' | 'overview';
/** Open the in-app guide popup from anywhere. */
export const openGuide = (tab: GuideTab = 'guide') => window.dispatchEvent(new CustomEvent('cx:guide', { detail: tab }));

const flow = [
  { n: '01', h: 'Scan', p: 'Command gives one risk picture across every monitor, scoped Global, India or World.' },
  { n: '02', h: 'Spot', p: 'An event surfaces on a live board’s map or wire feed, rated by severity.' },
  { n: '03', h: 'Verify', p: 'Check how many independent outlets carry the same story right now.' },
  { n: '04', h: 'Investigate', p: 'Pivot the infrastructure behind it on the graph; screen names against sanctions.' },
  { n: '05', h: 'Organise', p: 'Pin reports, threats and market events into a Case in the Workbench.' },
  { n: '06', h: 'Report', p: 'Export a fully-sourced, hash-stamped brief — or a Rapid Brief in seconds.' },
];
const capabilities = [
  { icon: Gauge, h: 'Command risk picture', p: 'A composite risk index plus a live band for every monitor, re-scoped in one tap between Global, India and World — your home screen.' },
  { icon: MapPin, h: 'Live threat map', p: 'Every located event as a marker, grouped by place, colour-coded by severity, with earthquake and disaster overlays.' },
  { icon: Globe2, h: 'Earth, Conflict & Maritime', p: 'NASA natural-event overlays, conflict hotspots aggregated from the wires, and maritime incidents with the OFAC sanctioned-vessel registry.' },
  { icon: ShieldCheck, h: 'Research & Verify', p: 'Live news search plus a one-click check of how many independent outlets carry a story.' },
  { icon: Network, h: 'Link Analysis', p: 'Pivot a domain, IP, email or name into its connected infrastructure on an interactive graph — all from passive, public sources.' },
  { icon: Shield, h: 'Sanctions screening', p: 'Screen any name or vessel against the OFAC sanctions lists with exact, substring and fuzzy matching.' },
  { icon: Users, h: 'Gated Social Footprint', p: 'Username footprint across public profile sites — off by default, enabled by an admin, agreement-gated and logged on every use.' },
  { icon: FolderOpen, h: 'Workbench & evidence export', p: 'Timeline everything ingested, pin findings into Cases, and export a court-ready report with per-item SHA-256 integrity hashes.' },
  { icon: LineChart, h: 'Markets & crisis engine', p: 'Global indices, the US yield curve and commodities, with plain-language alerts for crashes, currency records and country stress.' },
  { icon: Eye, h: 'Watchlists & alerts', p: 'Save the names, places or groups you track and get told the moment they appear — in-app, or pushed to Telegram / a webhook.' },
];
const steps = [
  { n: 1, h: 'Request access, then wait for activation', p: 'Choose Request access on the sign-in page and enter your details. Your account starts as pending until an administrator approves you — you’ll see an awaiting-activation screen with a contact. Once approved, sign in normally.' },
  { n: 2, h: 'Start on Command', p: 'Command is your home: a composite risk index and a band for every monitor. Use the Global / India / World toggle to re-scope the whole picture, and fire a Rapid Brief straight from the top when something needs writing up.' },
  { n: 3, h: 'Work the Watch boards', p: 'The Watch strip links every live board — Security, Markets, Business, Government, Politics, Signals, Earth, Conflict and Maritime. Markers are events, coloured by severity; feeds refresh every five minutes and new items are marked NEW. Click an item, then Read for the full article and Visual intel for its media.' },
  { n: 4, h: 'Research, verify, and pivot', p: 'In Intelligence Research search any place, group, vessel or event, then Verify to see how widely it is confirmed — three or more independent outlets means corroborated. Take a domain, IP, email or name into Link Analysis to map connected infrastructure, and screen names in Sanctions Screening.' },
  { n: 5, h: 'Organise findings in the Workbench', p: 'Add items — plus threats from the map — into a Case. Cases keep your notes and pinned sources together, export to a brief, and can produce a court-ready evidence report with SHA-256 integrity hashes.' },
  { n: 6, h: 'Compile and brief', p: 'In Reports, pinned reports become an editable draft with every source attached; run a corroboration audit, then export (TXT / print / PDF) or archive it. Rapid Briefs you generate anywhere are saved under Briefs.' },
  { n: 7, h: 'Set alerts and secure your account', p: 'In Watchlists add the terms you track. In Settings → Alert Delivery push high-severity alerts to Telegram or a webhook, optionally geofenced; the bell in the header shows in-app matches. Also in Settings: connect your own AI, edit your profile, and turn on two-factor sign-in.' },
];
const screens = [
  { icon: Gauge, name: 'Command', desc: 'Composite risk index + a band per monitor, scoped Global / India / World.' },
  { icon: LayoutGrid, name: 'Security Dashboard', desc: 'Live map + wire feed with hazard overlays.' },
  { icon: Globe2, name: 'Earth Watch', desc: 'NASA natural-event and disaster overlays on a map.' },
  { icon: Swords, name: 'Conflict Watch', desc: 'Conflict hotspots aggregated from the live wires.' },
  { icon: Ship, name: 'Maritime', desc: 'Shipping incidents + the OFAC sanctioned-vessel registry.' },
  { icon: LineChart, name: 'Markets & Reserves', desc: 'Global markets, yield curve and the crisis/stress engine.' },
  { icon: RadioTower, name: 'Signals', desc: 'Aircraft map, space weather, attention; aircraft watches.' },
  { icon: Images, name: 'Visual Intel', desc: 'All photos, video and satellite imagery in one gallery.' },
  { icon: Search, name: 'Research', desc: 'Live news search, verification and pinning.' },
  { icon: Network, name: 'Link Analysis', desc: 'Pivot entities into connected infrastructure on a graph.' },
  { icon: Shield, name: 'Sanctions Screening', desc: 'Screen names and vessels against the OFAC lists.' },
  { icon: Users, name: 'Social Footprint', desc: 'Gated username footprint across public profile sites.' },
  { icon: FolderOpen, name: 'Workbench', desc: 'Organise findings into Cases; court-ready evidence export.' },
  { icon: FileText, name: 'Briefs & Reports', desc: 'Rapid Briefs and compiled, audited, sourced reports.' },
  { icon: Eye, name: 'Watchlists', desc: 'Track terms; in-app and pushed alerts.' },
  { icon: Wrench, name: 'OSINT Tools', desc: 'A curated toolkit plus built-in domain/IP recon.' },
  { icon: Siren, name: 'Active Alerts', desc: 'Everything currently flagged critical or high.' },
  { icon: KeyRound, name: 'Settings', desc: 'AI, profile, two-factor, text size and alert delivery.' },
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
      <div role="dialog" aria-modal="true" aria-label="Calibrex guide" onClick={e => e.stopPropagation()} className="cx-glass cx-pop border border-white/10 sm:rounded-2xl w-full max-w-3xl max-h-full flex flex-col shadow-2xl">
        <header className="flex items-center gap-2 px-3 sm:px-6 pb-3.5 border-b border-white/10 cx-glass-header sm:rounded-t-2xl" style={{ paddingTop: 'calc(0.875rem + env(safe-area-inset-top, 0px))' }}>
          <Compass size={18} className="text-calibrex-teal shrink-0 hidden sm:block" />
          <div className="flex gap-1.5 flex-1 min-w-0">
            <button onClick={() => setTab('guide')} className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest shrink-0 ${tab === 'guide' ? 'bg-calibrex-teal text-calibrex-navy' : 'text-calibrex-muted hover:text-white'}`}>Guide</button>
            <button onClick={() => setTab('overview')} className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest shrink-0 ${tab === 'overview' ? 'bg-calibrex-gold text-calibrex-navy' : 'text-calibrex-muted hover:text-white'}`}>Overview</button>
          </div>
          <button onClick={() => { setOpen(false); openMission(); }} className="px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest border border-calibrex-gold/40 text-calibrex-gold hover:bg-calibrex-gold/10 flex items-center gap-1.5 shrink-0"><Compass size={14} /> <span className="hidden sm:inline">Guided</span> mission</button>
          <button onClick={() => { setOpen(false); startTour(); }} className="px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest border border-calibrex-teal/40 text-calibrex-teal hover:bg-calibrex-teal/10 flex items-center gap-1.5 shrink-0"><PlayCircle size={14} /> <span className="hidden sm:inline">Take the</span> tour</button>
          <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 -mr-1 text-calibrex-muted hover:text-white shrink-0"><X size={20} /></button>
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
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">One risk picture — then verify, investigate and report.</h2>
                <p className="text-sm text-calibrex-muted mt-2 leading-relaxed max-w-xl">Calibrex pulls live, public information from the web every five minutes, scores it into a single risk picture across every monitor, maps it, and gives your analysts the tools to confirm, investigate and write it up. Real sources only.</p>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
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
