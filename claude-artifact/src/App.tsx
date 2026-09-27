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
  watchRevocations, watchVisits, logVisit, joinPresence, watchProviderContact,
  askClaude, aiMessage, saveFile, plainText, copyText,
} from './lib/claude';
import { useLiveIntel, assessThreats, Assessment, WIRE_KEYS, webSearch, timeAgo } from './lib/live';
import { AssessmentStatus } from './components/LiveStatusBar';

type AppPhase = 'SPLASH' | 'AUTHENTICATING' | 'MAIN_APP';
type AnyView = ViewState | 'dev-registry';

const App: React.FC = () => {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [savedProfile, setSavedProfile] = useState<{ name: string; org: string } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [revocations, setRevocations] = useState<Record<string, Revocation>>({});
  const [providerContact, setProviderContactState] = useState('');
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
    let unsubContact = () => {};
    (async () => {
      const op = await whoAmI();
      setOperator(op);
      const profile = await loadRecord<{ name: string; org: string } | null>(op.id, 'profile', null);
      setSavedProfile(profile);
      setProfileLoaded(true);
      unsubRev = await watchRevocations(setRevocations);
      unsubContact = await watchProviderContact(setProviderContactState);
    })();
    return () => { unsubRev(); unsubContact(); };
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

  // ---------------------------------------------------------------- live OSINT
  const liveActive = appPhase === 'MAIN_APP' && !isSystemOffline;
  const live = useLiveIntel(liveActive);
  const [assessment, setAssessment] = useState<Assessment | null>(() => localPref<Assessment | null>('assessment', null));
  const [analyzing, setAnalyzing] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);
  const assessingRef = useRef(false);
  const aiBlockedRef = useRef(false);
  const allItems = useMemo(() => WIRE_KEYS.flatMap(k => live.feeds[k].items), [live.feeds]);
  const feedsSettled = WIRE_KEYS.filter(k => !live.feeds[k].loading).length >= 4;

  const runAssessment = useCallback(async (manual: boolean) => {
    if (assessingRef.current || isSystemOffline) return;
    if (allItems.length < 8) { if (manual) setAssessError('Not enough live reports yet. Wait for the wires to load, then try again.'); return; }
    assessingRef.current = true;
    setAnalyzing(true);
    setAssessError(null);
    try {
      const res = await assessThreats(allItems);
      setAssessment(res);
      setLocalPref('assessment', res);
    } catch (e: any) {
      const msg = aiMessage(e);
      setAssessError(`Threat assessment failed: ${msg}`);
      if (['not_granted', 'sampling_disabled', 'unavailable', 'not_declared', 'capability_disabled'].includes(e?.code)) aiBlockedRef.current = true;
    } finally {
      assessingRef.current = false;
      setAnalyzing(false);
    }
  }, [allItems, isSystemOffline]);

  // Re-assess automatically when fresh wires arrive and the last assessment is over 15 minutes old.
  useEffect(() => {
    if (!liveActive || !feedsSettled || aiBlockedRef.current) return;
    const age = assessment ? Date.now() - assessment.at : Infinity;
    if (age > 15 * 60 * 1000) runAssessment(false);
  }, [liveActive, feedsSettled, allItems.length]);

  const assessmentStatus: AssessmentStatus = {
    analyzing, assessedAt: assessment?.at || null, basis: assessment?.basis || 0, error: assessError,
    onReanalyze: () => { aiBlockedRef.current = false; runAssessment(true); },
  };

  const globalThreats: Threat[] = useMemo(() => (assessment?.threats || []).map(t => {
    const latest = Math.max(0, ...t.sources.map(s => s.published));
    return {
      id: t.id,
      title: t.title,
      severity: t.severity,
      category: t.category,
      location: t.location,
      coordinates: [t.lat, t.lng] as [number, number],
      description: t.summary,
      details: [
        { label: 'Location', value: t.location },
        { label: 'Actors', value: t.actors },
        { label: 'Reports', value: `${t.sources.length} source${t.sources.length === 1 ? '' : 's'}` },
        { label: 'Latest', value: latest ? timeAgo(latest) : '—' },
      ],
      sources: t.sources.map(s => ({ title: s.title, url: s.url, source: s.source, published: s.published })),
      assessedAt: assessment?.at,
    };
  }), [assessment]);

  const hazards: Threat[] = useMemo(() => live.quakes.quakes.filter(q => q.mag >= 5).slice(0, 25).map(q => ({
    id: 'usgs-' + q.id,
    title: `M${q.mag.toFixed(1)} earthquake`,
    severity: q.mag >= 7 || q.alert === 'red' ? 'CRITICAL' : q.mag >= 6 || q.alert === 'orange' ? 'HIGH' : 'MEDIUM',
    category: 'HAZARD',
    location: q.place,
    coordinates: [q.lat, q.lng] as [number, number],
    description: `${q.place}. ${q.tsunami ? 'Tsunami flag raised by USGS. ' : ''}${q.alert ? `PAGER alert: ${q.alert}.` : ''}`.trim(),
    details: [
      { label: 'Magnitude', value: q.mag.toFixed(1) },
      { label: 'Time', value: `${new Date(q.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (${timeAgo(q.time)})` },
      { label: 'Source', value: 'USGS real-time feed' },
    ],
    sources: q.url ? [{ title: `USGS event page: ${q.place}`, url: q.url, source: 'USGS', published: q.time }] : [],
  })), [live.quakes.quakes]);

  const [dismissed, setDismissed] = useState<string[]>(() => localPref<string[]>('dismissed_alerts', []));
  const [prefsVersion, setPrefsVersion] = useState(0);
  const alertPrefs = useMemo(() => localPref<any>('settings', null)?.alerts || { critical: true, high: true, medium: false }, [prefsVersion]);
  const allAlerts: Alert[] = useMemo(() => (assessment?.alerts || []).filter(a => !dismissed.includes(a.id)).map(a => ({
    id: a.id,
    message: a.message,
    severity: a.severity,
    timestamp: a.source ? new Date(a.source.published).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
    url: a.source?.url,
    source: a.source?.source,
  })), [assessment, dismissed]);
  const alerts = allAlerts.filter(a => a.severity === 'CRITICAL' ? alertPrefs.critical !== false : a.severity === 'HIGH' ? alertPrefs.high !== false : !!alertPrefs.medium);
  const threatLevel = Math.min(5, 1 + globalThreats.filter(t => t.severity === 'CRITICAL').length + (globalThreats.filter(t => t.severity === 'HIGH').length >= 3 ? 1 : 0));

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
    const text = `CALIBREX OSINT ALERT: ${title}${t?.location ? ` (${t.location})` : ''}${t ? ` [${t.severity}]` : ''}${t?.description ? `\n${t.description}` : ''}${t?.sources?.length ? `\nSources:\n${t.sources.slice(0, 3).map(x => `- ${x.source}: ${x.url}`).join('\n')}` : ''}`;
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
    setDismissed(prev => { const next = [...prev, id].slice(-300); setLocalPref('dismissed_alerts', next); return next; });
  }, []);

  const handleDownloadFile = useCallback(async (item: ReportHistoryItem) => {
    if (!item.content) return;
    const st = localPref<any>('settings', null);
    const ok = await saveFile(`${item.title.replace(/\s+/g, '_')}_CALIBREX.txt`, `CALIBREX OSINT STUDIO\nCLASSIFICATION: ${st?.classification || 'CONFIDENTIAL'}\nTITLE: ${item.title}\nDATE: ${item.date}\nPREPARED BY: ${st?.role || 'Intelligence Analyst'}\n\n${plainText(item.content)}`);
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
      setModalPreview('Sweeping live sources…');
      const hits = await webSearch(`Latest news and verified facts about: ${modalContent.threatName}`, [modalContent.threatName.slice(0, 70), `${modalContent.threatName.replace(/^[^:]{2,30}:\s*/, '').slice(0, 50)} latest`]);
      const evidence = hits.slice(0, 8);
      setModalPreview('Drafting brief…');
      const brief = await askClaude(
        `As an OSINT News Correspondent, write a concise intelligence brief (about 220 words) on: "${modalContent.threatName}". Today is ${new Date().toDateString()}.\n` +
        `Use ONLY the numbered SOURCES below, retrieved from the web just now. Cite them inline as [n]. If they do not cover something, say so rather than guessing.\n` +
        `Sections, each heading on its own line: SITUATION, KEY INDICATORS, ASSESSMENT. Plain text, no Markdown symbols.\n\nSOURCES:\n` +
        (evidence.map((h, i) => `[${i + 1}] ${h.title} (${h.url})${h.published ? ` ${h.published}` : ''}\n${h.excerpt}`).join('\n\n') || '(no results found)'),
        { onText: setModalPreview, fresh: true }
      );
      const content = `${brief}\n\nSOURCES\n${evidence.map((h, i) => `[${i + 1}] ${h.title} — ${h.url}`).join('\n')}`;
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
    if (appPhase === 'AUTHENTICATING') return <AuthGate operator={operator} revoked={revoked} providerContact={providerContact} savedProfile={savedProfile} onAuthenticated={handleAuthenticated} />;

    switch (currentView) {
      case 'dashboard':
        return <Dashboard onGenerateReport={openReportModal} onShare={shareThreat} onInvestigate={investigate} onViewThreat={handleViewThreatWire} threats={globalThreats} live={live} assessment={assessmentStatus} isOffline={isSystemOffline} />;
      case 'geopolitical':
        return <GeopoliticalDashboard onGenerateReport={openReportModal} onShare={shareThreat} onInvestigate={investigate} onViewThreat={handleViewThreatWire} threats={globalThreats} hazards={hazards} live={live} assessment={assessmentStatus} isOffline={isSystemOffline} />;
      case 'threat-wire':
        return selectedThreat ? <ThreatWireView threat={selectedThreat} onBack={() => setCurrentView(previousView)} onGenerateReport={openReportModal} onInvestigate={investigate} isOffline={isSystemOffline} /> : null;
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
      case 'alerts': return <Alerts alerts={alerts} onInvestigate={investigate} onDismiss={handleDismissAlert} hiddenCount={allAlerts.length - alerts.length} status={assessmentStatus} />;
      case 'settings': return <Settings isOffline={isSystemOffline} onToggleOffline={toggleSystemStatus} onSave={() => { setPrefsVersion(v => v + 1); showToast('Platform configuration updated'); }} />;
      case 'info': return <InfoPage />;
      case 'dev-registry':
        return currentUser?.isMaster
          ? <UserManagement visits={visits} peers={peers} revocations={revocations} providerContact={providerContact} onNotify={showToast} />
          : <div className="p-8 text-center text-white/50">Access Denied</div>;
      default:
        return <Dashboard onGenerateReport={openReportModal} onShare={shareThreat} onInvestigate={investigate} onViewThreat={handleViewThreatWire} threats={globalThreats} live={live} assessment={assessmentStatus} isOffline={isSystemOffline} />;
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
        {appPhase === 'MAIN_APP' && <Header onToggleSidebar={() => setIsSidebarOpen(true)} threatLevel={threatLevel} alertCount={alerts.length} onOpenAlerts={() => handleNavigate('alerts')} />}
        <main className="flex-1 overflow-y-auto bg-calibrex-dark relative custom-scrollbar p-0 flex flex-col">
          <div className="flex-none w-full max-w-full overflow-x-clip">
            {renderContent()}
          </div>
          {appPhase === 'MAIN_APP' && <Footer />}
        </main>
      </div>

      {appPhase === 'MAIN_APP' && <Modal isOpen={modalOpen} onClose={() => !isGeneratingModal && setModalOpen(false)} title={modalContent?.title || ''}>
        <div className="space-y-4">
          <div className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em]">Target Vector</div>
          <div className="text-sm font-black text-white uppercase">{modalContent?.threatName}</div>
          <p className="text-[11px] text-calibrex-muted leading-relaxed">Calibrex sweeps live web sources on this vector, then Claude drafts a cited brief and commits it to your Report History.</p>
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
