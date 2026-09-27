
import React, { useState, useEffect } from 'react';
import { Save, Wifi, WifiOff } from 'lucide-react';
import { localPref, setLocalPref } from '../lib/claude';

interface SettingsProps {
    onSave: () => void;
    isOffline: boolean;
    onToggleOffline: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onSave, isOffline, onToggleOffline }) => {
  const [role, setRole] = useState('Intelligence Analyst');
  const [classification, setClassification] = useState('CONFIDENTIAL');
  const [alerts, setAlerts] = useState({
      critical: true,
      high: true,
      medium: false
  });

  useEffect(() => {
    const parsed = localPref<any>('settings', null);
    if (parsed) {
        setRole(parsed.role || 'Intelligence Analyst');
        setClassification(parsed.classification || 'CONFIDENTIAL');
        if (parsed.alerts) setAlerts(parsed.alerts);
    }
  }, []);

  const handleSave = () => {
      const settings = { role, classification, alerts };
      setLocalPref('settings', settings);
      onSave();
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="bg-calibrex-surface border border-calibrex-surface-light rounded-lg p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-calibrex-gold mb-4 sm:mb-6 flex items-center gap-2">
          ⚙ Platform Settings
        </h2>

        <div className="space-y-4 sm:space-y-6">
          <div className="p-3 sm:p-4 bg-black/20 rounded border border-white/5">
            <label className="block text-calibrex-text text-sm font-bold mb-2 sm:mb-3 flex items-center gap-2 uppercase tracking-widest opacity-70">
              System Connectivity Override
            </label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="text-xs text-calibrex-muted font-mono leading-relaxed flex-1">
                Manually toggle system state to "Offline" to suspend neural uplinks and use local cache only.
              </div>
              <button 
                onClick={onToggleOffline}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded text-[10px] font-black uppercase transition-all ${
                  isOffline 
                  ? 'bg-calibrex-critical/20 text-calibrex-critical border border-calibrex-critical/40' 
                  : 'bg-calibrex-teal/10 text-calibrex-teal border border-calibrex-teal/40'
                }`}
              >
                {isOffline ? <WifiOff size={14} /> : <Wifi size={14} />}
                {isOffline ? 'OFFLINE' : 'ONLINE'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-calibrex-text text-sm font-bold mb-2">User Role</label>
            <select 
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-calibrex-surface-light border border-calibrex-teal/30 rounded px-3 py-2 text-calibrex-text text-sm focus:outline-none focus:border-calibrex-teal"
            >
              <option>Intelligence Analyst</option>
              <option>Senior Analyst</option>
              <option>Journalist</option>
              <option>Researcher</option>
            </select>
          </div>

          <div>
            <label className="block text-calibrex-text text-sm font-bold mb-2">Alert Preferences</label>
            <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={alerts.critical}
                        onChange={(e) => setAlerts({...alerts, critical: e.target.checked})}
                        className="accent-calibrex-teal" 
                    />
                    <span className="text-sm text-calibrex-text">Critical Alerts</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={alerts.high}
                        onChange={(e) => setAlerts({...alerts, high: e.target.checked})}
                        className="accent-calibrex-teal" 
                    />
                    <span className="text-sm text-calibrex-text">High Priority</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={alerts.medium}
                        onChange={(e) => setAlerts({...alerts, medium: e.target.checked})}
                        className="accent-calibrex-teal" 
                    />
                    <span className="text-sm text-calibrex-text">Medium Priority</span>
                </label>
            </div>
          </div>

          <div>
            <label className="block text-calibrex-text text-sm font-bold mb-2">Data Classification</label>
            <select 
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full bg-calibrex-surface-light border border-calibrex-teal/30 rounded px-3 py-2 text-calibrex-text text-sm focus:outline-none focus:border-calibrex-teal"
            >
              <option>PUBLIC</option>
              <option>CONFIDENTIAL</option>
              <option>SECRET</option>
            </select>
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-calibrex-teal hover:bg-[#3aa5b5] text-calibrex-navy font-bold py-3 rounded uppercase tracking-wide transition-colors flex justify-center items-center gap-2 text-sm"
          >
            <Save size={16} />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;