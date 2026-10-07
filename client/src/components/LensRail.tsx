import React from 'react';
import { Briefcase, Building2, Vote, LineChart, RadioTower, Images, BarChart3, ChevronRight } from 'lucide-react';
import { LiveIntel, LiveItem, WireKey } from '../lib/live';
import { navigateTo } from './AiAssist';
import { isSignificant as bizSig } from '../lib/business';
import { isSignificant as govSig } from '../lib/gov';
import { isSignificant as polSig } from '../lib/politics';

type Band = 'CALM' | 'ELEVATED' | 'STRESS' | 'CRISIS';
const bandFromCount = (n: number): Band => n >= 6 ? 'CRISIS' : n >= 3 ? 'STRESS' : n >= 1 ? 'ELEVATED' : 'CALM';
const BAND_CLS: Record<Band, string> = {
  CRISIS: 'text-calibrex-critical border-calibrex-critical/40',
  STRESS: 'text-calibrex-high border-calibrex-high/40',
  ELEVATED: 'text-calibrex-medium border-calibrex-medium/40',
  CALM: 'text-calibrex-low border-calibrex-low/40',
};

interface FeedLens { view: string; label: string; sub: string; icon: React.ReactNode; wire: WireKey; sig: (i: LiveItem) => boolean }
interface StaticLens { view: string; label: string; sub: string; icon: React.ReactNode; wire?: undefined }

const FEED_LENSES: FeedLens[] = [
  { view: 'business', label: 'Business Watch', sub: 'M&A · distress · tycoons', icon: <Briefcase size={16} />, wire: 'BUSINESS', sig: bizSig },
  { view: 'government', label: 'Government', sub: 'Orders · policy · foreign', icon: <Building2 size={16} />, wire: 'GOV', sig: govSig },
  { view: 'politics', label: 'Elections & Politics', sub: 'Elections · leaders · parties', icon: <Vote size={16} />, wire: 'POLITICS', sig: polSig },
];
const STATIC_LENSES: StaticLens[] = [
  { view: 'markets', label: 'Markets & Reserves', sub: 'Forex · commodities · crisis', icon: <LineChart size={16} /> },
  { view: 'signals', label: 'Signals', sub: 'Aircraft · space weather', icon: <RadioTower size={16} /> },
  { view: 'visual-intel', label: 'Visual Intel', sub: 'Photos · video · satellite', icon: <Images size={16} /> },
  { view: 'trends', label: 'Trends', sub: '90-day history', icon: <BarChart3 size={16} /> },
];

interface Props { live: LiveIntel; variant?: 'row' | 'stack'; onOpen?: (view: string) => void }

/** Live summary for one feed-backed lens: count, heat band, latest headline. */
function feedSummary(live: LiveIntel, l: FeedLens) {
  const items = live.feeds[l.wire]?.items || [];
  const sig = items.filter(l.sig);
  const latest = (sig[0] || items[0])?.title || null;
  return { count: items.length, band: bandFromCount(sig.length), latest };
}

const LensRail: React.FC<Props> = ({ live, variant = 'row', onOpen }) => {
  const open = onOpen || navigateTo;

  if (variant === 'stack') {
    return (
      <div className="space-y-1.5">
        {FEED_LENSES.map(l => { const s = feedSummary(live, l); return (
          <button key={l.view} onClick={() => open(l.view)} className="w-full text-left flex items-center gap-2.5 p-2.5 rounded-lg bg-black/20 border border-white/5 hover:border-calibrex-teal/50 transition-all">
            <span className="text-calibrex-teal shrink-0">{l.icon}</span>
            <span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-white truncate">{l.label}</span>{s.latest && <span className="block text-[10px] text-white/45 truncate">{s.latest}</span>}</span>
            <span className={`shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border ${BAND_CLS[s.band]}`}>{s.band}</span>
            {s.count > 0 && <span className="shrink-0 text-[11px] font-black tabular-nums text-white/80">{s.count}</span>}
          </button>
        ); })}
        {STATIC_LENSES.map(l => (
          <button key={l.view} onClick={() => open(l.view)} className="w-full text-left flex items-center gap-2.5 p-2.5 rounded-lg bg-black/20 border border-white/5 hover:border-calibrex-teal/50 transition-all">
            <span className="text-calibrex-teal shrink-0">{l.icon}</span>
            <span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-white truncate">{l.label}</span><span className="block text-[10px] text-white/45 truncate">{l.sub}</span></span>
            <ChevronRight size={14} className="text-white/30 shrink-0" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
      {FEED_LENSES.map(l => { const s = feedSummary(live, l); return (
        <button key={l.view} onClick={() => open(l.view)} title={`Open ${l.label}`}
          className="group shrink-0 w-[190px] text-left bg-calibrex-surface border border-white/10 hover:border-calibrex-teal/50 rounded-xl p-3 transition-all active:scale-[0.98]">
          <div className="flex items-center justify-between mb-1.5 text-calibrex-teal">
            {l.icon}
            <div className="flex items-center gap-1.5">
              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border ${BAND_CLS[s.band]}`}>{s.band}</span>
              {s.count > 0 && <span className="text-sm font-black tabular-nums text-white">{s.count}</span>}
            </div>
          </div>
          <div className="text-[11px] font-black text-white uppercase tracking-wide leading-tight">{l.label}</div>
          <div className="text-[9px] text-white/50 mt-1 leading-snug line-clamp-2 normal-case min-h-[1.6em]">{s.latest || l.sub}</div>
        </button>
      ); })}
      {STATIC_LENSES.map(l => (
        <button key={l.view} onClick={() => open(l.view)} title={`Open ${l.label}`}
          className="group shrink-0 w-[160px] text-left bg-calibrex-surface border border-white/10 hover:border-calibrex-teal/50 rounded-xl p-3 transition-all active:scale-[0.98]">
          <div className="flex items-center justify-between mb-1.5 text-calibrex-teal">{l.icon}<ChevronRight size={14} className="text-white/30 group-hover:text-calibrex-teal" /></div>
          <div className="text-[11px] font-black text-white uppercase tracking-wide leading-tight">{l.label}</div>
          <div className="text-[9px] font-mono text-white/40 mt-1 truncate">{l.sub}</div>
        </button>
      ))}
    </div>
  );
};

export default LensRail;
