
import React, { useState, useEffect } from 'react';
import { Save, Wifi, WifiOff, Sparkles, Type, BellRing, Smartphone, Bell, ShieldAlert, Briefcase, Building2, Activity, Vote } from 'lucide-react';
import { localPref, setLocalPref, saveRecord, loadRecord, applyDisplay } from '../lib/api';
import AiConnect from './AiConnect';
import AlertDelivery from './AlertDelivery';
import AppInstall from './AppInstall';

interface SettingsProps {
    onSave: () => void;
    onNotify?: (m: string) => void;
    isOffline: boolean;
    onToggleOffline: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onSave, onNotify, isOffline, onToggleOffline }) => {
  const [comfort, setComfort] = useState(true);
  const [size, setSize] = useState<'normal' | 'large'>('normal');
  const [role, setRole] = useState('Intelligence Analyst');
  const [classification, setClassification] = useState('CONFIDENTIAL');
  const [alerts, setAlerts] = useState({
      critical: true,
      high: true,
      medium: false
  });

  // Per-channel push preferences (stored server-side; enforced when the server
  // sends push). Default every channel on.
  const PUSH_CHANNELS = [
    { key: 'threats', label: 'Threat alerts', desc: 'Critical security & kinetic events', icon: <ShieldAlert size={15} className="text-calibrex-critical" /> },
    { key: 'business', label: 'Business alerts', desc: 'Failures, market shocks, big M&A', icon: <Briefcase size={15} className="text-calibrex-gold" /> },
    { key: 'government', label: 'Government alerts', desc: 'Emergencies, orders, sanctions, coups', icon: <Building2 size={15} className="text-calibrex-teal" /> },
    { key: 'politics', label: 'Politics alerts', desc: 'Election results, leadership changes, upheaval', icon: <Vote size={15} className="text-calibrex-gold" /> },
    { key: 'markets', label: 'Market signals', desc: 'Crashes, corrections, stress events', icon: <Activity size={15} className="text-calibrex-high" /> },
  ] as const;
  const [pushPrefs, setPushPrefs] = useState<Record<string, boolean>>({ threats: true, business: true, government: true, politics: true, markets: true });
  useEffect(() => { loadRecord<Record<string, boolean>>('push_prefs', {}).then(v => { if (v && typeof v === 'object') setPushPrefs(p => ({ ...p, ...v })); }); }, []);
  const togglePush = (key: string) => {
    setPushPrefs(prev => {
      const next = { ...prev, [key]: !(prev[key] !== false) };
      saveRecord('push_prefs', next);
      return next;
    });
  };

  useEffect(() => {
    const apply = (parsed: any) => {
        if (!parsed) return;
        setRole(parsed.role || 'Intelligence Analyst');
        setClassification(parsed.classification || 'CONFIDENTIAL');
        if (parsed.alerts) setAlerts(parsed.alerts);
        setComfort(parsed.display?.comfort !== false);
        setSize(parsed.display?.size === 'large' ? 'large' : 'normal');
    };
    apply(localPref<any>('settings', null));
    loadRecord<any>('settings', null).then(v => { if (v) { apply(v); setLocalPref('settings', v); } });
  }, []);

  const handleSave = () => {
      const settings = { role, classification, alerts, display: { comfort, size } };
      applyDisplay(settings);
      setLocalPref('settings', settings);
      saveRecord('settings', settings);
      onSave();
  };

  // Preview display changes live; leaving without saving restores the saved look.
  useEffect(() => { applyDisplay({ display: { comfort, size } }); }, [comfort, size]);
  useEffect(() => () => applyDisplay(), []);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <section className="bg-calibrex-surface border border-calibrex-teal/30 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-calibrex-teal mb-1 flex items-center gap-2"><Smartphone size={18} /> Install &amp; Notifications</h2>
        <p className="text-sm text-calibrex-muted mb-5">Install Calibrex as an app on your phone or desktop, and turn on push notifications for your alerts.</p>
        <AppInstall onNotify={onNotify} />

        <div className="mt-5 pt-5 border-t border-white/10">
          <h3 className="text-sm font-bold text-calibrex-text mb-1 flex items-center gap-2"><Bell size={15} /> Push notification channels</h3>
          <p className="text-xs text-calibrex-muted mb-3">Choose which alerts reach your devices. Turning one off stops those pushes; in-app alerts and watchlists are unaffected.</p>
          <div className="space-y-2">
            {PUSH_CHANNELS.map(c => {
              const on = pushPrefs[c.key] !== false;
              return (
                <div key={c.key} className="flex items-center justify-between gap-3 p-3 bg-black/20 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {c.icon}
                    <div className="min-w-0"><div className="text-sm font-bold text-calibrex-text">{c.label}</div><div className="text-[11px] text-calibrex-muted truncate">{c.desc}</div></div>
                  </div>
                  <button role="switch" aria-checked={on} aria-label={`${c.label} ${on ? 'on' : 'off'}`} onClick={() => togglePush(c.key)}
                    className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${on ? 'bg-calibrex-teal' : 'bg-white/15'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="ai-connection" className="bg-calibrex-surface border border-calibrex-gold/30 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-calibrex-gold mb-1 flex items-center gap-2"><Sparkles size={18} /> AI Connection <span className="text-xs font-bold text-calibrex-muted">(optional)</span></h2>
        <p className="text-sm text-calibrex-muted mb-5">Connect your own Claude, ChatGPT or Gemini account to draft reports, summarise searches and explain verification results. Calibrex works fully without it.</p>
        <AiConnect onNotify={onNotify} />
      </section>

      <section className="bg-calibrex-surface border border-calibrex-surface-light rounded-lg p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-calibrex-gold mb-1 flex items-center gap-2"><BellRing size={18} /> Alert Delivery <span className="text-xs font-bold text-calibrex-muted">(optional)</span></h2>
        <p className="text-sm text-calibrex-muted mb-5">Push high-severity alerts out to Telegram or a webhook, optionally limited to geofenced areas. In-app alerts are unaffected.</p>
        <AlertDelivery onNotify={onNotify} />
      </section>

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
            <label className="block text-calibrex-text text-sm font-bold mb-2 flex items-center gap-2"><Type size={15} /> Display</label>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input id="display-comfort" type="checkbox" checked={comfort} onChange={e => setComfort(e.target.checked)} className="accent-calibrex-teal" />
              <span className="text-sm text-calibrex-text">Comfortable text (bigger labels, stronger contrast)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input id="display-large" type="checkbox" checked={size === 'large'} onChange={e => setSize(e.target.checked ? 'large' : 'normal')} className="accent-calibrex-teal" />
              <span className="text-sm text-calibrex-text">Larger text throughout</span>
            </label>
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