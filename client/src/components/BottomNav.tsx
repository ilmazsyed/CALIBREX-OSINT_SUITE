import React from 'react';
import { LayoutDashboard, Search, Eye, FileText, Menu } from 'lucide-react';

interface Props {
  currentView: string;
  onNavigate: (v: any) => void;
  onMore: () => void;
  watchUnread: number;
}

const ITEMS = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'research', label: 'Research', icon: Search },
  { id: 'watchlists', label: 'Watch', icon: Eye },
  { id: 'reports', label: 'Reports', icon: FileText },
];

/** Thumb-reach navigation on phones and tablets; the sidebar stays behind "More". */
const BottomNav: React.FC<Props> = ({ currentView, onNavigate, onMore, watchUnread }) => (
  <nav aria-label="Main" className="lg:hidden fixed bottom-0 inset-x-0 z-[55] bg-[#08111b]/95 backdrop-blur border-t border-white/10 grid grid-cols-5" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
    {ITEMS.map(({ id, label, icon: Icon }) => (
      <button key={id} onClick={() => onNavigate(id)} aria-current={currentView === id ? 'page' : undefined} className={`relative flex flex-col items-center justify-center gap-0.5 h-16 text-xs font-bold ${currentView === id ? 'text-calibrex-teal' : 'text-calibrex-muted'}`}>
        <Icon size={20} />
        {label}
        {id === 'watchlists' && watchUnread > 0 && <span className="absolute top-2 right-[calc(50%-18px)] min-w-[16px] h-4 px-1 rounded-full bg-calibrex-critical text-white text-[10px] font-black flex items-center justify-center">{watchUnread > 9 ? '9+' : watchUnread}</span>}
      </button>
    ))}
    <button onClick={onMore} className="flex flex-col items-center justify-center gap-0.5 h-16 text-xs font-bold text-calibrex-muted"><Menu size={20} />More</button>
  </nav>
);

export default BottomNav;
