import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ViewState, ReportHistoryItem, Alert, Threat, IntelligenceNode, ReportVerification } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Footer from './components/Footer';
import Dashboard from './components/Dashboard';
import GeopoliticalDashboard from './components/GeopoliticalDashboard';
import Research from './components/Research';
import ReportGenerator from './components/ReportGenerator';
import DispatchStudio from './components/DispatchStudio';
import Tools from './components/Tools';
import History from './components/History';
import Alerts from './components/Alerts';
import Settings from './components/Settings';
import InfoPage from './components/Info';
import ThreatWireView from './components/ThreatWireView';
import AuthGate, { SessionUser } from './components/AuthGate';
import LaunchPage from './components/LaunchPage';
import Modal from './components/Modal';
import Toast from './components/Toast';
import UserManagement from './components/UserManagement';
import { Loader2 } from 'lucide-react';
import {
  Operator, Revocation, VisitRecord, LivePeer,
  whoAmI, loadRecord, saveRecord, localPref, setLocalPref,
  watchRevocations, watchVisits, logVisit, joinPresence,
  askClaude, aiMessage, saveFile, plainText, copyText,
} from './lib/claude';

type AppPhase = 'SPLASH' | 'AUTHENTICATING' | 'MAIN_APP';
type AnyView = ViewState | 'dev-registry';

const App: React.FC = () => {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [savedProfile, setSavedProfile] = useState<{ name: string; org: string } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [revocations, setRevocations] = useState<Record<string, Revocation>>({});
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [peers, setPeers] = useState<LivePeer[]>([]);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [appPhase, setAppPhase] = useState<AppPhase>('SPLASH');
  const [splashDone, setSplashDone] = useState(false);
  const [currentView, setCurrentView] = useState<AnyView>('dashboard');
  const [previousView, setPreviousView] = useState<AnyView>('dashboard');
  const [selectedThreat, setSelectedThreat] = useState<Threat | null>(null);
  const [pinnedNodes, setPinnedNodes] = useState<IntelligenceNode[]>([]);
  const [compiledReport, setCompiledReport] = useState<{ title: string; category: string; content: string; verification?: ReportVerification; userId: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{ title: string, threatName?: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalPreview, setModalPreview] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isGeneratingModal, setIsGeneratingModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSystemOffline, setIsSystemOffline] = useState<boolean>(() => localPref('system_offline', false));
  const [historyItems, setHistoryItems] = useState<ReportHistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [researchQuery, setResearchQuery] = useState<{ q: string; n: number }>({ q: '', n: 0 });
  const presenceRef = useRef<{ setView: (v: string) => void; stop: () => void } | null>(null);
  const loggedPeers = useRef<Set<string>>(new Set());

  const revoked = !!(operator?.id && revocations[operator.id] && !operator.isOwner);

  // Identity, saved profile, revocation list.
  useEffect(() => {
    let unsubRev = () => {};
    (async () => {
      const op = await whoAmI();
      setOperator(op);
      const profile = await loadRecord<{ name: string; org: string } | null>(op.id, 'profile', null);
      setSavedProfile(profile);
      setProfileLoaded(true);
      unsubRev = await watchRevocations(setRevocations);
    })();
    return () => unsubRev();
  }, []);

  // Returning operators with an active session skip the portal (as the original did).
  useEffect(() => {
    if (appPhase !== 'SPLASH' || !splashDone || !operator || !profileLoaded) return;
    if (savedProfile && localPref('session', false) && !revoked) {
      startSession(savedProfile, false);
    } else {
      setAppPhase('AUTHENTICATING');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appPhase, splashDone, operator, profileLoaded, savedProfile, revoked]);

  // Revocation takes effect immediately, even mid-session.
  useEffect(() => {
    if (revoked && appPhase === 'MAIN_APP') {
      setCurrentUser(null);
      setLocalPref('session', false);
      setAppPhase('AUTHENTICATING');
    }
  }, [revoked, appPhase]);

  const buildUser = (op: Operator, profile: { name: string; org: string }): SessionUser => ({
    id: op.id || 'local-operator',
    name: profile.name || op.name || 'Operator',
    email: op.email,
    org: profile.org || 'Independent',
    avatarUrl: op.avatarUrl,
    isMaster: op.isOwner,
    canEdit: op.canEdit,
  });

  const startSession = useCallback((profile: { name: string; org: string }, announce: boolean) => {
    if (!operator) return;
    const user = buildUser(operator, profile);
    setCurrentUser(user);
    setLocalPref('session', true);
    if (operator.id) logVisit(operator.id, { org: profile.org, callsign: profile.name, lastView: 'dashboard' });
    if (announce) setToastMessage(`Session Initialized: ${user.name}`);
    setAppPhase('MAIN_APP');
  }, [operator]);

  const handleAuthenticated = useCallback((_u: SessionUser, profile: { name: string; org: string }, isNew: boolean) => {
    if (isNew || JSON.stringify(profile) !== JSON.stringify(savedProfile)) {
      setSavedProfile(profile);
      saveRecord(operator?.id || null, 'profile', profile);
    }
    startSession(profile, true);
  }, [operator, savedProfile, startSession]);

  const handleLogout = useCallback(() => {
    setLocalPref('session', false);
    setCurrentUser(null);
    setCurrentView('dashboard');
    setAppPhase('AUTHENTICATING');
  }, []);

  // Live presence: every operator announces the screen they are on.
  useEffect(() => {
    if (appPhase !== 'MAIN_APP') return;
    let alive = true;
    joinPresence(p => { if (alive) setPeers(p); }).then(h => {
      if (!alive) { h.stop(); return; }
      presenceRef.current = h;
      h.setView(currentView);
    });
    return () => { alive = false; presenceRef.current?.stop(); presenceRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appPhase]);

  useEffect(() => { presenceRef.current?.setView(currentView); }, [currentView]);

  // Owner console: watch the visit log and record everyone seen online
  // (view-only guests cannot write their own visit record).
  useEffect(() => {
    if (appPhase !== 'MAIN_APP' || !currentUser?.isMaster) return;
    let unsub = () => {};
    watchVisits(setVisits).then(u => { unsub = u; });
    return () => unsub();
  }, [appPhase, currentUser?.isMaster]);

  useEffect(() => {
    if (!currentUser?.isMaster) return;
    for (const p of peers) {
      if (!p.by || p.isMe || loggedPeers.current.has(p.peer)) continue;
      loggedPeers.current.add(p.peer);
      const row = visits.find(v => v.id === p.by);
      const stale = !row || Date.now() - new Date(row.lastSeen).getTime() > 10 * 60 * 1000;
      logVisit(p.by, { guest: p.guest, lastView: p.view }, stale);
    }
  }, [peers, visits, currentUser?.isMaster]);

  useEffect(() => { setLocalPref('system_offline', isSystemOffline); }, [isSystemOffline]);
  const toggleSystemStatus = useCallback(() => setIsSystemOffline(prev => !prev), []);

  const globalThreats: Threat[] = useMemo(() => [
    {
      id: 'usa-1',
      title: 'USA: Cyber-Sabotage Probing',
      severity: 'MEDIUM',
      category: 'CYBER',
      location: 'Eastern Interconnect',
      coordinates: [39.04, -77.49],
      details: [{ label: 'Source', value: 'NSA / CISA' }, { label: 'Target', value: 'Energy Grid' }],
      description: 'Coordinated penetration attempts detected targeting regional energy nodes.'
    },
    {
      id: 'rus-1',
      title: 'Russia: Arctic Naval Maneuvering',
      severity: 'HIGH',
      category: 'KINETIC',
      location: 'Barents Sea',
      coordinates: [72.5, 38.0],
      details: [{ label: 'Sector', value: 'Barents Sea' }, { label: 'Asset', value: 'Submarine Cluster' }],
      description: 'Unusual naval acoustic patterns suggest new deployment cycles.'
    },
    {
      id: 'chn-1',
      title: 'China: South China Sea Militarization',
      severity: 'CRITICAL',
      category: 'KINETIC',
      location: 'Spratly Islands',
      coordinates: [8.64, 111.92],
      details: [{ label: 'Site', value: 'Spratly Islands' }, { label: 'Intel', value: 'Satellite imagery' }],
      description: 'Active island fortification confirmed via satellite telemetry.'
    },
    {
      id: 'pak-1',
      title: 'Pakistan: Infiltration Surge',
      severity: 'CRITICAL',
      category: 'KINETIC',
      location: 'LOC-Keran',
      coordinates: [34.66, 74.28],
      details: [{ label: 'Sector', value: 'LOC-Keran' }, { label: 'Group', value: 'TRF / LeT' }],
      description: 'SATP logs confirm tactical movements near launch pads.'
    }
  ], []);

  const [alerts, setAlerts] = useState<Alert[]>([
    { id: '1', message: 'Infiltration attempt detected on LoC near Keran Sector', severity: 'CRITICAL', timestamp: 'Dec 17, 2025, 14:32 IST' },
    { id: '2', message: 'Large crypto transfer detected to known TRF wallet', severity: 'HIGH', timestamp: 'Dec 17, 2025, 09:15 IST' },
  ]);

  // Per-operator report archive (private to each operator).
  useEffect(() => {
    if (!currentUser) { setHistoryItems([]); setHistoryLoaded(false); return; }
    let alive = true;
    loadRecord<ReportHistoryItem[]>(operator?.id || null, 'history', []).then(items => {
      if (!alive) return;
      setHistoryItems(Array.isArray(items) ? items.filter(i => i.userId === currentUser.id) : []);
      setHistoryLoaded(true);
    });
    return () => { alive = false; };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!historyLoaded || !currentUser) return;
    const t = setTimeout(() => saveRecord(operator?.id || null, 'history', historyItems.slice(0, 60)), 600);
    return () => clearTimeout(t);
  }, [historyItems, historyLoaded]);

  const showToast = useCallback((msg: string) => setToastMessage(msg), []);
  const clearToast = useCallback(() => setToastMessage(null), []);
  const shareThreat = useCallback((title: string) => {
    const t = globalThreats.find(x => x.title === title);
    const text = `CALIBREX OSINT ALERT: ${title}${t?.location ? ` (${t.location})` : ''}${t ? ` [${t.severity}]` : ''}${t?.description ? `\n${t.description}` : ''}`;
    copyText(text).then(ok => setToastMessage(ok ? `Alert copied for sharing: ${title}` : `${title}: copy blocked by this viewer`));
  }, [globalThreats]);

  const handleNavigate = useCallback((view: AnyView) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  }, []);

  const investigate = useCallback((q: string) => {
    setResearchQuery(prev => ({ q, n: prev.n + 1 }));
    setCurrentView('research');
  }, []);

  const handleAddToHistory = useCallback((item: ReportHistoryItem) => {
    if (!currentUser?.id) {
      showToast("Authentication required to archive reports.");
      return;
    }
    const itemWithUserId: ReportHistoryItem = { ...item, userId: currentUser.id };
    setHistoryItems(prev => [itemWithUserId, ...prev.filter(p => p.id !== item.id)]);
    showToast(`Dispatch committed to archive: ${item.title}`);
  }, [currentUser, showToast]);

  const handleViewThreatWire = useCallback((threat: Threat) => {
    setPreviousView(currentView);
    setSelectedThreat(threat);
    setCurrentView('threat-wire');
    setIsSidebarOpen(false);
  }, [currentView]);

  const togglePinNode = useCallback((node: IntelligenceNode) => {
    setPinnedNodes(prev => {
      const exists = prev.some(n => n.content === node.content);
      if (exists) return prev.filter(n => n.content !== node.content);
      return [...prev, node];
    });
  }, []);

  const handleDismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleDownloadFile = useCallback(async (item: ReportHistoryItem) => {
    if (!item.content) return;
    const ok = await saveFile(`${item.title.replace(/\s+/g, '_')}_CALIBREX.txt`, `CALIBREX OSINT STUDIO\nTITLE: ${item.title}\nDATE: ${item.date}\n\n${plainText(item.content)}`);
    if (!ok) showToast('Download unavailable in this viewer. Use Copy instead.');
  }, [showToast]);

  const openReportModal = useCallback((threatName: string) => {
    setModalContent({ title: 'Rapid Intelligence Summary', threatName });
    setModalError(null);
    setModalPreview('');
    setModalOpen(true);
  }, []);

  const handleModalGenerate = async () => {
    if (!modalContent?.threatName || !currentUser?.id) return;
    if (isSystemOffline) { setModalError('Terminal is offline. Bring the system online in the sidebar to generate briefs.'); return; }
    setIsGeneratingModal(true);
    setModalError(null);
    try {
      const content = await askClaude(
        `As an OSINT News Correspondent, write a concise intelligence brief (about 200 words) regarding: "${modalContent.threatName}". ` +
        `Use short labelled sections: SITUATION, KEY INDICATORS, ASSESSMENT. Draw only on publicly known background; clearly flag anything uncertain. Plain text, no Markdown symbols.`,
        { onText: setModalPreview, fresh: true }
      );
      const newItem: ReportHistoryItem = {
        id: Date.now().toString(),
        title: `Rapid Brief: ${modalContent.threatName}`,
        date: new Date().toLocaleDateString(),
        format: 'TXT',
        content,
        userId: currentUser.id
      };
      handleAddToHistory(newItem);
      setModalOpen(false);
    } catch (e: any) {
      setModalError(aiMessage(e));
    } finally {
      setIsGeneratingModal(false);
    }
  };

  const reportGen = (
    <ReportGenerator
      pinnedNodes={pinnedNodes}
      onRemoveNode={(id) => setPinnedNodes(prev => prev.filter(n => n.id !== id))}
      onProceedToDispatch={(report) => {
        if (currentUser?.id) {
          setCompiledReport({ ...report, userId: currentUser.id });
          setCurrentView('dispatch-studio');
        } else {
          showToast("Authentication required to dispatch reports.");
        }
      }}
      onArchiveReport={handleAddToHistory}
      onGoResearch={() => setCurrentView('research')}
      isOffline={isSystemOffline}
      currentUser={currentUser}
    />
  );

  const renderContent = () => {
    if (appPhase === 'SPLASH') return <LaunchPage onFinish={() => setSplashDone(true)} />;
    if (appPhase === 'AUTHENTICATING') return <AuthGate operator={operator} revoked={revoked} savedProfile={savedProfile} onAuthenticated={handleAuthenticated} />;

    switch (currentView) {
      case 'dashboard':
        return <Dashboard onGenerateReport={openReportModal} onShare={shareThreat} onInvestigate={investigate} onViewThreat={handleViewThreatWire} threats={globalThreats} isOffline={isSystemOffline} />;
      case 'geopolitical':
        return <GeopoliticalDashboard onGenerateReport={openReportModal} onShare={shareThreat} onInvestigate={investigate} onViewThreat={handleViewThreatWire} threats={globalThreats} isOffline={isSystemOffline} />;
      case 'threat-wire':
        return selectedThreat ? <ThreatWireView threat={selectedThreat} onBack={() => setCurrentView(previousView)} onGenerateReport={openReportModal} onInvestigate={investigate} /> : null;
      case 'research':
        return <Research uid={operator?.id || null} initialQuery={researchQuery} pinnedNodes={pinnedNodes} onTogglePin={togglePinNode} onClearPins={() => setPinnedNodes([])} onProceedToReport={() => setCurrentView('report-gen')} isOffline={isSystemOffline} />;
      case 'report-gen':
        return reportGen;
      case 'dispatch-studio':
        return compiledReport ? (
          <DispatchStudio reportData={compiledReport} history={historyItems} onFinalize={handleAddToHistory} isOffline={isSystemOffline} onNotify={showToast} />
        ) : reportGen;
      case 'tools': return <Tools />;
      case 'history': return <History items={historyItems} onDownload={handleDownloadFile} onNotify={showToast} currentUser={currentUser} />;
      case 'alerts': return <Alerts alerts={alerts} onInvestigate={investigate} onDismiss={handleDismissAlert} />;
      case 'settings': return <Settings isOffline={isSystemOffline} onToggleOffline={toggleSystemStatus} onSave={() => showToast('Platform configuration updated')} />;
      case 'info': return <InfoPage />;
      case 'dev-registry':
        return currentUser?.isMaster
          ? <UserManagement visits={visits} peers={peers} revocations={revocations} onNotify={showToast} />
          : <div className="p-8 text-center text-white/50">Access Denied</div>;
      default:
        return <Dashboard onGenerateReport={openReportModal} onShare={shareThreat} onInvestigate={investigate} onViewThreat={handleViewThreatWire} threats={globalThreats} isOffline={isSystemOffline} />;
    }
  };

  const onlineCount = peers.filter(p => !p.isMe).length;

  return (
    <div className="flex h-full bg-calibrex-dark text-calibrex-text font-sans selection:bg-calibrex-teal/30 overflow-hidden relative">
      {appPhase === 'MAIN_APP' && isSidebarOpen && <div className="fixed inset-0 bg-black/80 z-[60] lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {appPhase === 'MAIN_APP' && (
        <div className={`fixed inset-y-0 left-0 z-[70] transition-transform duration-300 transform lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar currentView={currentView} onNavigate={handleNavigate} isOffline={isSystemOffline} onToggleOffline={toggleSystemStatus} currentUser={currentUser} onLogout={handleLogout} onClose={() => setIsSidebarOpen(false)} onlineCount={onlineCount} />
        </div>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {appPhase === 'MAIN_APP' && <Header onToggleSidebar={() => setIsSidebarOpen(true)} />}
        <main className="flex-1 overflow-y-auto bg-calibrex-dark relative custom-scrollbar p-0 flex flex-col">
          <div className="flex-1 shrink-0 w-full max-w-full overflow-x-hidden">
            {renderContent()}
          </div>
          {appPhase === 'MAIN_APP' && <Footer />}
        </main>
      </div>

      {appPhase === 'MAIN_APP' && <Modal isOpen={modalOpen} onClose={() => !isGeneratingModal && setModalOpen(false)} title={modalContent?.title || ''}>
        <div className="space-y-4">
          <div className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em]">Target Vector</div>
          <div className="text-sm font-black text-white uppercase">{modalContent?.threatName}</div>
          <p className="text-[11px] text-calibrex-muted leading-relaxed">Claude will draft a rapid brief on this vector and commit it to your Report History.</p>
          {isGeneratingModal && (
            <div className="bg-black/40 border border-white/10 rounded-lg p-3 max-h-48 overflow-y-auto custom-scrollbar text-[11px] text-white/80 whitespace-pre-wrap leading-relaxed">
              {modalPreview || 'Thinking…'}
            </div>
          )}
          {modalError && <div className="text-[11px] text-calibrex-critical font-bold">{modalError}</div>}
          <button onClick={handleModalGenerate} disabled={isGeneratingModal} className="w-full bg-calibrex-teal hover:bg-[#3aa5b5] text-calibrex-navy font-black py-4 rounded mt-4 uppercase tracking-[0.2em] transition-all text-[11px] flex justify-center items-center gap-2 disabled:opacity-50 shadow-[0_4px_20px_rgba(42,138,154,0.3)]">
            {isGeneratingModal ? <><Loader2 className="animate-spin" size={16} /> Synthesizing</> : 'INITIATE RAPID BRIEF'}
          </button>
        </div>
      </Modal>}
      {appPhase === 'MAIN_APP' && toastMessage && <Toast message={toastMessage} onClose={clearToast} />}
    </div>
  );
};

export default App;
