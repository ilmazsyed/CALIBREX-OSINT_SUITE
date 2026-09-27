import React, { useEffect, useRef, useState } from 'react';
import { Bell, ExternalLink } from 'lucide-react';
import { Notification } from '../lib/features';
import { timeAgo } from '../lib/live';

interface Props {
  items: Notification[];
  unread: number;
  onMarkRead: (ids?: string[]) => void;
  onOpenWatchlists: () => void;
}

/** Header bell: latest watchlist matches, with a link through to the Watchlists screen. */
const NotificationBell: React.FC<Props> = ({ items, unread, onMarkRead, onOpenWatchlists }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button id="notif-bell" onClick={() => setOpen(o => !o)} aria-label={`Watchlist alerts${unread ? `, ${unread} unread` : ''}`} title="Watchlist alerts" className="relative p-2 rounded-lg hover:bg-white/10 text-calibrex-teal">
        <Bell size={19} />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-calibrex-critical text-white text-[10px] font-black flex items-center justify-center tabular-nums">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,380px)] bg-[#0b1522] border border-white/15 rounded-lg shadow-2xl z-[90] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-sm font-bold text-white">Watchlist alerts</span>
            {unread > 0 && <button onClick={() => onMarkRead()} className="text-xs font-bold text-calibrex-teal hover:underline">Mark all read</button>}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {items.length === 0 && <li className="px-4 py-8 text-sm text-calibrex-muted text-center">No alerts yet. Add terms under Watchlists to be told when they appear in the news.</li>}
            {items.slice(0, 12).map(n => (
              <li key={n.id + n.at} className={`px-4 py-3 border-b border-white/5 ${n.read ? '' : 'bg-calibrex-teal/5'}`}>
                <div className="text-xs text-calibrex-muted mb-0.5">{!n.read && <span className="text-calibrex-teal font-black mr-1">NEW</span>}“{n.term}” · {n.source} · {timeAgo(n.published)}</div>
                <a href={n.url} target="_blank" rel="noopener noreferrer" onClick={() => !n.read && onMarkRead([n.id])} className="text-sm text-white hover:text-calibrex-gold leading-snug inline-flex gap-1">{n.title}<ExternalLink size={11} className="shrink-0 mt-1 opacity-60" /></a>
              </li>
            ))}
          </ul>
          <button onClick={() => { setOpen(false); onOpenWatchlists(); }} className="w-full px-4 py-3 text-sm font-bold text-calibrex-teal hover:bg-white/5">Open Watchlists</button>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
