import React, { useState } from 'react';
import { FileText, Archive } from 'lucide-react';
import { IntelligenceNode, ReportHistoryItem } from '../types';
import ReportStudio from './ReportStudio';
import History from './History';

interface ReportsProps {
  pinnedNodes: IntelligenceNode[];
  onRemoveNode: (id: string) => void;
  onArchiveReport: (item: ReportHistoryItem) => void;
  onGoResearch?: () => void;
  isOffline?: boolean;
  currentUser: any;
  historyItems: ReportHistoryItem[];
  onDownload: (item: ReportHistoryItem) => void;
  onNotify?: (msg: string) => void;
}

/** Reports = compose (Report Generator) + archive (Report History) in one screen. */
const Reports: React.FC<ReportsProps> = ({
  pinnedNodes, onRemoveNode, onArchiveReport, onGoResearch, isOffline, currentUser,
  historyItems, onDownload, onNotify,
}) => {
  const [tab, setTab] = useState<'compose' | 'archive'>('compose');
  const archived = historyItems.filter(i => currentUser && i.userId === currentUser.id).length;

  // Archiving from Compose jumps to the Archive tab so the analyst sees it land.
  const handleArchive = (item: ReportHistoryItem) => { onArchiveReport(item); setTab('archive'); };

  const tabBtn = (id: 'compose' | 'archive', label: string, icon: React.ReactNode, badge?: number) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest border transition-all ${
        tab === id ? 'bg-calibrex-teal/15 border-calibrex-teal text-calibrex-teal' : 'border-white/10 text-calibrex-muted hover:text-white'
      }`}
    >
      {icon} {label}
      {badge ? <span className="text-[9px] bg-calibrex-teal/20 text-calibrex-teal rounded-full px-1.5 tabular-nums">{badge}</span> : null}
    </button>
  );

  return (
    <div>
      <div className="px-4 sm:px-6 pt-5">
        <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2"><FileText size={18} className="text-calibrex-gold" /> Reports</h1>
        <p className="text-[11px] text-calibrex-muted mt-1 max-w-2xl">Build a finished, shareable report — pull in filed <b className="text-calibrex-gold">Briefs</b>, pinned research and notes, then export it. For quick single-topic snapshots, file a Rapid Brief under <b className="text-calibrex-gold">Briefs</b> instead.</p>
      </div>
      <div className="px-4 sm:px-6 pt-4 flex items-center gap-2">
        {tabBtn('compose', 'Compose', <FileText size={14} />)}
        {tabBtn('archive', 'Saved reports', <Archive size={14} />, archived)}
      </div>
      {tab === 'compose' ? (
        <ReportStudio
          pinnedNodes={pinnedNodes}
          onArchiveReport={handleArchive}
          onGoResearch={onGoResearch}
          isOffline={isOffline}
          currentUser={currentUser}
        />
      ) : (
        <History items={historyItems} onDownload={onDownload} onNotify={onNotify} currentUser={currentUser} />
      )}
    </div>
  );
};

export default Reports;
