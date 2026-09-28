import React, { useState } from 'react';
import { FileText, Archive } from 'lucide-react';
import { IntelligenceNode, ReportHistoryItem } from '../types';
import ReportGenerator from './ReportGenerator';
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
      <div className="px-4 sm:px-6 pt-5 flex items-center gap-2">
        {tabBtn('compose', 'Compose', <FileText size={14} />)}
        {tabBtn('archive', 'Archive', <Archive size={14} />, archived)}
      </div>
      {tab === 'compose' ? (
        <ReportGenerator
          pinnedNodes={pinnedNodes}
          onRemoveNode={onRemoveNode}
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
