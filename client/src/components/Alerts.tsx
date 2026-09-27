import React from 'react';
import { Alert } from '../types';
import { Search, X, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';

interface AlertsProps {
    alerts: Alert[];
    onInvestigate: (query: string) => void;
    onDismiss: (id: string) => void;
    hiddenCount?: number;
    status?: { refreshing: boolean; updatedAt: number | null; error: string | null; onRefresh: () => void };
}

const Alerts: React.FC<AlertsProps> = ({ alerts, onInvestigate, onDismiss, hiddenCount = 0, status }) => {

  const getBorderColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'border-l-calibrex-critical';
      case 'HIGH': return 'border-l-calibrex-high';
      case 'MEDIUM': return 'border-l-calibrex-medium';
      case 'LOW': return 'border-l-calibrex-low';
      default: return '';
    }
  };

  const getTextColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-calibrex-critical';
      case 'HIGH': return 'text-calibrex-high';
      case 'MEDIUM': return 'text-calibrex-medium';
      case 'LOW': return 'text-calibrex-low';
      default: return 'text-calibrex-text';
    }
  };

  const getEmoji = (severity: string) => {
    switch (severity) {
        case 'CRITICAL': return '🔴 CRITICAL:';
        case 'HIGH': return '⚠️ HIGH:';
        case 'MEDIUM': return '🟡 MEDIUM:';
        case 'LOW': return '🟢 LOW:';
        default: return '';
      }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="bg-calibrex-surface border border-calibrex-surface-light rounded-lg p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-calibrex-gold flex items-center gap-2">
            🚨 Active Alerts & Monitoring
          </h2>
          {status && (
            <button onClick={status.onRefresh} disabled={status.refreshing} className="flex items-center gap-2 px-3 py-1.5 rounded border border-calibrex-teal/40 text-calibrex-teal text-[10px] font-bold uppercase tracking-wide hover:bg-calibrex-teal/10 disabled:opacity-50">
              {status.refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {status.refreshing ? 'Refreshing feeds' : 'Refresh now'}
            </button>
          )}
        </div>
        {status && (
          <p className="text-[11px] text-calibrex-muted mb-4 -mt-2">
            Alerts are critical and high-severity reports from the last 12 hours{status.updatedAt ? `, feeds pulled ${new Date(status.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}. Each one links to its source.
            {hiddenCount > 0 && <> {hiddenCount} lower-priority alert{hiddenCount === 1 ? ' is' : 's are'} hidden by your Settings.</>}
          </p>
        )}
        {status?.error && <p className="text-[11px] text-calibrex-critical font-bold mb-4">{status.error}</p>}

        {alerts.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-calibrex-muted border border-dashed border-calibrex-surface-light rounded">
                <p className="text-sm">{status?.refreshing ? 'Refreshing feeds…' : 'No active alerts. Monitoring systems are online.'}</p>
            </div>
        ) : (
            <div className="space-y-3">
            {alerts.map((alert) => (
                <div key={alert.id} className={`bg-calibrex-surface-light p-3 sm:p-4 rounded border-l-4 ${getBorderColor(alert.severity)} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 animate-in fade-in slide-in-from-right-2 duration-300`}>
                <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm mb-1 ${getTextColor(alert.severity)}`}>
                        {getEmoji(alert.severity)} {alert.message}
                    </p>
                    <p className="text-calibrex-muted text-xs">
                      Reported: {alert.timestamp}
                      {alert.source && <> · {alert.url ? <a href={alert.url} target="_blank" rel="noopener noreferrer" className="text-calibrex-teal hover:underline inline-flex items-center gap-1">{alert.source} <ExternalLink size={10} /></a> : alert.source}</>}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => onInvestigate(alert.message)}
                        className="flex items-center gap-2 bg-calibrex-navy hover:bg-black/40 text-calibrex-text border border-calibrex-surface-light hover:border-calibrex-gold px-3 py-1.5 sm:px-4 sm:py-2 rounded text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap"
                    >
                        <Search size={12} />
                        Investigate
                    </button>
                    <button
                        onClick={() => onDismiss(alert.id)}
                        className="p-1.5 sm:p-2 hover:bg-calibrex-critical/20 hover:text-calibrex-critical text-calibrex-muted rounded transition-colors"
                        title="Dismiss Alert"
                    >
                        <X size={16} />
                    </button>
                </div>
                </div>
            ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;
