import React, { useState } from 'react';
import { ReportHistoryItem } from '../types';
import { Download, FileText, FileDown, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { copyText, dossierHtml, plainText, printDossier } from '../lib/api';

interface HistoryProps {
    items: ReportHistoryItem[];
    onDownload: (item: ReportHistoryItem) => void;
    onNotify?: (msg: string) => void;
    currentUser: any;
}

const btn = "flex items-center gap-2 bg-transparent border border-calibrex-teal text-calibrex-teal hover:bg-calibrex-teal/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded text-[10px] font-bold uppercase tracking-wide transition-colors whitespace-nowrap";

const History: React.FC<HistoryProps> = ({ items, onDownload, onNotify, currentUser }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleDossier = async (item: ReportHistoryItem) => {
    if (!item.content) return;
    const html = dossierHtml(item.title, plainText(item.content), {
      DATE: item.date,
      FORMAT: item.format,
      ...(item.verification ? { AUDIT: `${item.verification.verdict} (${item.verification.score}% corroboration)` } : {}),
    });
    if (!printDossier(html)) onNotify?.('Allow pop-ups for this site to print the dossier.');
  };

  const handleCopy = async (item: ReportHistoryItem) => {
    if (!item.content) return;
    if (await copyText(plainText(item.content))) {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } else onNotify?.('Copy was blocked by the browser. Open the report and select the text.');
  };

  const userReports = items.filter(item => currentUser && item.userId === currentUser.id);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="bg-calibrex-surface border border-calibrex-surface-light rounded-lg p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-calibrex-gold mb-4 sm:mb-6 flex items-center gap-2">
          📋 Report History
          {userReports.length > 0 && <span className="text-[10px] font-mono text-white/40 ml-auto">{userReports.length} ARCHIVED</span>}
        </h2>

        {userReports.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-calibrex-muted border border-dashed border-calibrex-surface-light rounded">
                <p className="text-sm">No reports archived yet.</p>
                <p className="text-xs mt-2 opacity-70">Generate a Brief from the Dashboard, or compile one in the Report Generator.</p>
            </div>
        ) : (
            <div className="space-y-3">
            {userReports.map((item) => (
                <div key={item.id} className="bg-calibrex-surface-light p-3 sm:p-4 rounded border border-transparent hover:border-calibrex-teal/30 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 sm:p-2 bg-calibrex-navy rounded text-calibrex-teal shrink-0">
                            <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-calibrex-text font-bold text-sm mb-1 break-words">{item.title}</p>
                            <p className="text-calibrex-muted text-[10px] uppercase tracking-wider">
                                Generated: {item.date} | Format: {item.format}
                                {item.verification && <> | Audit: {item.verification.verdict} {item.verification.score}%</>}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                        <button onClick={() => setOpenId(openId === item.id ? null : item.id)} className={btn} title="Read report">
                            {openId === item.id ? <EyeOff size={12} /> : <Eye size={12} />}
                            {openId === item.id ? 'Close' : 'View'}
                        </button>
                        <button onClick={() => handleCopy(item)} className={btn} title="Copy report text">
                            {copiedId === item.id ? <Check size={12} /> : <Copy size={12} />}
                            Copy
                        </button>
                        <button onClick={() => handleDossier(item)} className={btn} title="Print the dossier or save it as PDF">
                            <FileDown size={12} />
                            Print / PDF
                        </button>
                        <button onClick={() => onDownload(item)} className={btn} title="Download text file">
                            <Download size={12} />
                            TXT
                        </button>
                    </div>
                  </div>
                  {openId === item.id && (
                    <div className="mt-4 bg-black/40 border border-white/10 rounded-lg p-4 sm:p-6 max-h-[420px] overflow-y-auto custom-scrollbar text-sm text-white/85 leading-relaxed whitespace-pre-wrap select-text animate-in fade-in">
                      {plainText(item.content || '')}
                    </div>
                  )}
                </div>
            ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default History;
