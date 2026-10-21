import React from 'react';
import { Gauge, ShieldAlert, LineChart, Briefcase, Building2, Vote, RadioTower, Globe2, Swords, Ship } from 'lucide-react';
import { navigateTo } from './AiAssist';

const TABS = [
  { id: 'command', label: 'Command', Icon: Gauge },
  { id: 'dashboard', label: 'Security', Icon: ShieldAlert },
  { id: 'markets', label: 'Markets', Icon: LineChart },
  { id: 'business', label: 'Business', Icon: Briefcase },
  { id: 'government', label: 'Government', Icon: Building2 },
  { id: 'politics', label: 'Politics', Icon: Vote },
  { id: 'signals', label: 'Signals', Icon: RadioTower },
  { id: 'geoint', label: 'Earth', Icon: Globe2 },
  { id: 'conflict', label: 'Conflict', Icon: Swords },
  { id: 'maritime', label: 'Maritime', Icon: Ship },
] as const;

/**
 * Shared tab strip across the six live-monitoring dashboards, so operators can
 * move between them directly — one connected "Watch" hub instead of six
 * separate sidebar trips. Sticky at the top of the view. The sidebar links
 * still work; this is an additional, faster path.
 */
const WatchTabs: React.FC<{ current: string }> = ({ current }) => (
  <div data-no-swipe style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }} className="sticky top-0 z-30 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 px-3 sm:px-6 pt-3 pb-2 bg-calibrex-dark border-b border-white/10">
    <div className="cx-eyebrow mb-1.5">Watch</div>
    <div className="flex gap-1.5 overflow-x-auto lg:flex-wrap lg:overflow-x-visible -mx-1 px-1">
      {TABS.map(({ id, label, Icon }) => {
        const on = current === id;
        return (
          <button key={id} onClick={() => navigateTo(id)} aria-current={on ? 'page' : undefined}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all active:scale-95 ${on ? 'bg-calibrex-teal/15 border-calibrex-teal/50 text-calibrex-teal' : 'border-white/10 text-calibrex-muted hover:text-white hover:border-white/25'}`}>
            <Icon size={13} /> {label}
          </button>
        );
      })}
    </div>
  </div>
);

export default WatchTabs;
