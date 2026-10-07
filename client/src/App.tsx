import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ViewState, ReportHistoryItem, Alert, Threat, IntelligenceNode } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Footer from './components/Footer';
import Dashboard from './components/Dashboard';
import Research from './components/Research';
import Reports from './components/Reports';
import Tools from './components/Tools';
import Alerts from './components/Alerts';
import Settings from './components/Settings';
import ThreatWireView from './components/ThreatWireView';
import AuthGate from './components/AuthGate';
import LaunchPage from './components/LaunchPage';
import Modal from './components/Modal';
import Toast from './components/Toast';
import UserManagement from './components/UserManagement';
import Watchlists from './components/Watchlists';
import Trends from './components/Trends';
import NotificationBell from './components/NotificationBell';
import BottomNav from './components/BottomNav';
import ArticleReader from './components/ArticleReader';
import VisualCollection from './components/VisualCollection';
import VisualIntel from './components/VisualIntel';
import GuidePopup from './components/GuidePopup';
import SubjectLookup from './components/SubjectLookup';
import Markets from './components/Markets';
import Signals from './components/Signals';
import Workbench from './components/Workbench';
import Chatter from './components/Chatter';
import BusinessWatch from './components/BusinessWatch';
import AddToCaseModal from './components/AddToCaseModal';
import AssistTour, { startTour, TOUR_DONE_KEY } from './components/AssistTour';
import { Loader2, Sparkles } from 'lucide-react';
import { auth, admin, User, ApiError, onAccessChange, loadRecord, saveRecord, localPref, setLocalPref, saveFile, plainText, copyText, applyDisplay } from './lib/api';
import { useLiveIntel, searchNews, timeAgo } from './lib/live';
import { ai, shortModel, useAiStatus, useNotifications } from './lib/features';

type AppPhase = 'SPLASH' | 'AUTHENTICATING' | 'MAIN_APP';
type AnyView = ViewState | 'dev-registry';

const canEnter = (u: User | null) => !!u && (u.role === 'admin' || u.status === 'active');

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [checkedSession, setCheckedSession] = useState(false);
  const [providerContact, setProviderContact] = useState('');
  const [appPhase, setAppPhase] = useState<AppPhase>(() => (sessionStorage.getItem('cx_booted') ? 'AUTHENTICATING' : 'SPLASH'));
  const [splashDone, setSplashDone] = useState(false);
  const [currentView, setCurrentView] = useState<AnyView>('dashboard');
  const [previousView, setPreviousView] = useState<AnyView>('dashboard');
  const [selectedThreat, setSelectedThreat] = useState<Threat | null>(null);
  const [pinnedNodes, setPinnedNodes] = useState<IntelligenceNode[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{ title: string, threatName?: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isGeneratingModal, setIsGeneratingModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSystemOffline, setIsSystemOffline] = useState<boolean>(() => localPref('system_offline', false));
  const [historyItems, setHistoryItems] = useState<ReportHistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [researchQuery, setResearchQuery] = useState<{ q: string; n: number }>({ q: '', n: 0 });
  const [pendingCount, setPendingCount] = useState(0);

  const showToast = useCallback((msg: string) => setToastMessage(msg), []);
  const aiState = useAiStatus(false);
  const clearToast = useCallback(() => setToastMessage(null), []);

  // ---------------------------------------------------------------- session

  useEffect(() => {
    auth.me()
      .then(r => { setUser(r.user); setProviderContact(r.contact); })
      .catch(() => setUser(null))
      .finally(() => setCheckedSession(true));
  }, []);

  useEffect(() => {
    if (appPhase === 'SPLASH' && splashDone && checkedSession) setAppPhase(canEnter(user) ? 'MAIN_APP' : 'AUTHENTICATING');
    if (appPhase === 'AUTHENTICATING' && checkedSession && canEnter(user)) setAppPhase('MAIN_APP');
  }, [appPhase, splashDone, checkedSession, user]);

  // Suspension or sign-out takes effect immediately, even mid-session.
  useEffect(() => onAccessChange((e: ApiError) => {
    if (e.status === 401) { setUser(null); setAppPhase('AUTHENTICATING'); return; }
    if (e.contact !== undefined) setProviderContact(e.contact);
    auth.me().then(r => setUser(r.user)).catch(() => setUser(null));
    setAppPhase('AUTHENTICATING');
  }), []);

  // Re-check account status every minute.
  useEffect(() => {
    if (appPhase !== 'MAIN_APP') return;
    const t = setInterval(() => {
      auth.me().then(r => {
        setUser(r.user);
        if (r.contact) setProviderContact(r.contact);
        if (!canEnter(r.user)) setAppPhase('AUTHENTICATING');
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, [appPhase]);

  const handleAuthenticated = useCallback((u: User, contact: string) => {
    setUser(u);
    setProviderContact(contact);
    if (canEnter(u)) {
      setAppPhase('MAIN_APP');
      setToastMessage(`Session Initialized: ${u.name}`);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try { await auth.logout(); } catch { /* ignore */ }
    setUser(null);
    setCurrentView('dashboard');
    setPinnedNodes([]);
    setAppPhase('AUTHENTICATING');
  }, []);

  useEffect(() => {
    if (appPhase !== 'MAIN_APP') return;
    aiState.reload();
    // Settings follow the operator across devices.
    loadRecord<any>('settings', null).then(v => { if (v) { setLocalPref('settings', v); applyDisplay(v); setPrefsVersion(n => n + 1); } });
    // First-run: offer the guided tour once (skippable, re-runnable from the ? in the header).
    try { if (!localStorage.getItem(TOUR_DONE_KEY)) { const t = setTimeout(startTour, 900); return () => clearTimeout(t); } } catch { /* ignore */ }
  }, [appPhase, user?.id]);

  // Returning from the one-click AI sign-in (?ai=connected / ?ai=error&reason=...).
  useEffect(() => {
    if (appPhase !== 'MAIN_APP') return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get('ai');
    if (!result) return;
    window.history.replaceState(null, '', window.location.pathname);
    setCurrentView('settings');
    setToastMessage(result === 'connected' ? 'AI connected. Pick a model and run a test below.' : `AI connection failed: ${params.get('reason') || 'unknown error'}`);
    aiState.reload();
  }, [appPhase]);

  // Other components ask to switch screens via a window event.
  useEffect(() => {
    const go = (e: Event) => { const v = (e as CustomEvent).detail; if (typeof v === 'string') { setCurrentView(v as AnyView); setIsSidebarOpen(false); } };
    window.addEventListener('cx:navigate', go);
    return () => window.removeEventListener('cx:navigate', go);
  }, []);

  // Admin: count accounts awaiting activation.
  useEffect(() => {
    if (appPhase !== 'MAIN_APP' || user?.role !== 'admin') return;
    const load = () => admin.users().then(r => setPendingCount(r.users.filter(u => u.status === 'pending').length)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [appPhase, user?.role, currentView]);

  // ---------------------------------------------------------------- live OSINT

  useEffect(() => { setLocalPref('system_offline', isSystemOffline); }, [isSystemOffline]);
  const toggleSystemStatus = useCallback(() => setIsSystemOffline(prev => !prev), []);
  const live = useLiveIntel(appPhase === 'MAIN_APP' && !isSystemOffline);
  const notifications = useNotifications(appPhase === 'MAIN_APP');

  const globalThreats: Threat[] = useMemo(() => live.threats.map(t => ({
    id: t.id,
    title: t.title,
    severity: t.severity,
    category: t.category,
    location: t.location,
    coordinates: [t.lat, t.lng] as [number, number],
    description: t.summary,
    details: [
      { label: 'Location', value: t.location },
      { label: 'Reports', value: `${t.reports} from ${t.outlets} outlet${t.outlets === 1 ? '' : 's'}` },
      { label: 'Wires', value: t.wires.join(', ').replace(/_/g, ' ') },
      { label: 'Latest', value: timeAgo(t.latest) },
    ],
    sources: t.sources.map(s => ({ title: s.title, url: s.url, source: s.source, published: s.published, kind: s.kind })),
    assessedAt: live.updatedAt || undefined,
  })), [live.threats, live.updatedAt]);

  const hazards: Threat[] = useMemo(() => [
    ...live.quakes.quakes.filter(q => q.mag >= 5).slice(0, 25).map(q => ({
      id: 'usgs-' + q.id,
      title: `M${q.mag.toFixed(1)} earthquake`,
      severity: (q.mag >= 7 || q.alert === 'red' ? 'CRITICAL' : q.mag >= 6 || q.alert === 'orange' ? 'HIGH' : 'MEDIUM') as Threat['severity'],
      category: 'HAZARD' as const,
      location: q.place,
      coordinates: [q.lat, q.lng] as [number, number],
      description: `${q.place}. ${q.tsunami ? 'Tsunami flag raised by USGS. ' : ''}${q.alert ? `PAGER alert: ${q.alert}.` : ''}`.trim(),
      details: [
        { label: 'Magnitude', value: q.mag.toFixed(1) },
        { label: 'Time', value: `${new Date(q.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (${timeAgo(q.time)})` },
        { label: 'Source', value: 'USGS real-time feed' },
      ],
      sources: q.url ? [{ title: `USGS event page: ${q.place}`, url: q.url, source: 'USGS', published: q.time }] : [],
    })),
    ...live.disasters.filter(d => d.level === 'orange' || d.level === 'red').map(d => ({
      id: 'gdacs-' + d.id,
      title: d.title,
      severity: (d.level === 'red' ? 'CRITICAL' : 'HIGH') as Threat['severity'],
      category: 'HAZARD' as const,
      location: d.title,
      coordinates: [d.lat, d.lng] as [number, number],
      description: d.summary,
      details: [{ label: 'Alert level', value: d.level.toUpperCase() }, { label: 'Reported', value: timeAgo(d.published) }, { label: 'Source', value: 'GDACS' }],
      sources: [{ title: d.title, url: d.url, source: 'GDACS', published: d.published }],
    })),
  ], [live.quakes.quakes, live.disasters]);

  // Alerts: server-raised, minus dismissed, filtered by Settings preferences.
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [prefsVersion, setPrefsVersion] = useState(0);
  useEffect(() => { if (appPhase === 'MAIN_APP') loadRecord<string[]>('dismissed_alerts', []).then(v => setDismissed(Array.isArray(v) ? v : [])); }, [appPhase]);
  const alertPrefs = useMemo(() => localPref<any>('settings', null)?.alerts || { critical: true, high: true, medium: false }, [prefsVersion]);
  const allAlerts: Alert[] = useMemo(() => live.alerts.filter(a => !dismissed.includes(a.id)).map(a => ({
    id: a.id,
    message: a.place ? `${a.place}: ${a.message}` : a.message,
    severity: a.severity,
    timestamp: new Date(a.published).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    url: a.url,
    source: a.source,
  })), [live.alerts, dismissed]);
  const alerts = allAlerts.filter(a => a.severity === 'CRITICAL' ? alertPrefs.critical !== false : a.severity === 'HIGH' ? alertPrefs.high !== false : !!alertPrefs.medium);
  const threatLevel = Math.min(5, 1 + globalThreats.filter(t => t.severity === 'CRITICAL').length + (globalThreats.filter(t => t.severity === 'HIGH').length >= 3 ? 1 : 0));

  const handleDismissAlert = useCallback((id: string) => {
    setDismissed(prev => { const next = [...prev, id].slice(-300); saveRecord('dismissed_alerts', next); return next; });
  }, []);

  // ---------------------------------------------------------------- report archive

  useEffect(() => {
    if (appPhase !== 'MAIN_APP' || !user) { setHistoryItems([]); setHistoryLoaded(false); return; }
    let alive = true;
    loadRecord<ReportHistoryItem[]>('history', []).then(items => {
      if (!alive) return;
      setHistoryItems(Array.isArray(items) ? items : []);
      setHistoryLoaded(true);
    });
    return () => { alive = false; };
  }, [appPhase, user?.id]);

  const historyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!historyLoaded) return;
    if (historyTimer.current) clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(() => saveRecord('history', historyItems.slice(0, 100)), 600);
  }, [historyItems, historyLoaded]);

  const handleAddToHistory = useCallback((item: ReportHistoryItem) => {
    if (!user) return;
    setHistoryItems(prev => [{ ...item, userId: user.id }, ...prev.filter(p => p.id !== item.id)]);
    showToast(`Dispatch committed to archive: ${item.title}`);
  }, [user, showToast]);

  // ---------------------------------------------------------------- navigation & actions

  const handleNavigate = useCallback((view: AnyView) => { setCurrentView(view); setIsSidebarOpen(false); }, []);
  const investigate = useCallback((q: string) => { setResearchQuery(prev => ({ q, n: prev.n + 1 })); setCurrentView('research'); }, []);
  const handleViewThreatWire = useCallback((threat: Threat) => {
    setPreviousView(currentView);
    setSelectedThreat(threat);
    setCurrentView('threat-wire');
    setIsSidebarOpen(false);
  }, [currentView]);
  const togglePinNode = useCallback((node: IntelligenceNode) => {
    setPinnedNodes(prev => prev.some(n => n.id === node.id || n.content === node.content)
      ? prev.filter(n => n.id !== node.id && n.content !== node.content)
      : [...prev, node]);
  }, []);

  const shareThreat = useCallback((title: string) => {
    const t = globalThreats.find(x => x.title === title);
    const text = `CALIBREX OSINT ALERT: ${title}${t?.location ? ` (${t.location})` : ''}${t ? ` [${t.severity}]` : ''}${t?.description ? `\n${t.description}` : ''}${t?.sources?.length ? `\nSources:\n${t.sources.slice(0, 3).map(x => `- ${x.source}: ${x.url}`).join('\n')}` : ''}`;
    copyText(text).then(ok => setToastMessage(ok ? `Alert copied for sharing: ${title}` : `${title}: copy blocked by the browser`));
  }, [globalThreats]);

  const handleDownloadFile = useCallback(async (item: ReportHistoryItem) => {
    if (!item.content) return;
    const st = localPref<any>('settings', null);
    await saveFile(`${item.title.replace(/\s+/g, '_')}_CALIBREX.txt`, `CALIBREX OSINT STUDIO\nCLASSIFICATION: ${st?.classification || 'CONFIDENTIAL'}\nTITLE: ${item.title}\nDATE: ${item.date}\nPREPARED BY: ${st?.role || 'Intelligence Analyst'}\n\n${plainText(item.content)}`);
  }, []);

  const openReportModal = useCallback((threatName: string) => {
    setModalContent({ title: 'Rapid Intelligence Summary', threatName });
    setModalError(null);
    setModalOpen(true);
  }, []);

  /** Rapid brief: the latest reporting on the vector, compiled with sources. No AI. */
  const handleModalGenerate = async (useAi = false) => {
    if (!modalContent?.threatName || !user) return;
    if (isSystemOffline) { setModalError('Terminal is offline. Bring the system online in the sidebar to generate briefs.'); return; }
    setIsGeneratingModal(true);
    setModalError(null);
    try {
      const name = modalContent.threatName;
      const known = globalThreats.find(t => t.title === name);
      const topic = name.replace(/^[^:]{2,30}:\s*/, '');
      const words = topic.split(/\s+/).filter(w => w.length > 3).slice(0, 5).join(' ');
      const searched = name === 'Global Crisis Briefing' ? [] : await searchNews(known?.location ? `"${known.location}" ${words}` : words, '3d').catch(() => []);
      const reports = [
        ...(known?.sources || []).map(s => ({ title: s.title, source: s.source, url: s.url, published: s.published })),
        ...searched.map(s => ({ title: s.title, source: s.source, url: s.url, published: s.published || 0 })),
        ...(name === 'Global Crisis Briefing' ? globalThreats.slice(0, 8).map(t => ({ title: t.title, source: `${t.sources?.length || 0} reports`, url: t.sources?.[0]?.url || '', published: t.sources?.[0]?.published || 0 })) : []),
      ].filter((r, i, a) => a.findIndex(x => x.title === r.title) === i).slice(0, 15);
      if (reports.length === 0) throw new Error('No current reporting found for this vector.');
      const outlets = new Set(reports.map(r => r.source)).size;
      const when = (ms: number) => ms ? new Date(ms).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'undated';
      if (useAi) {
        const r = await ai.generate('brief', { title: name, sources: reports });
        const content = [
          `RAPID BRIEF: ${name.toUpperCase()}`,
          `AI-assisted (${shortModel(r.model)}) ${when(Date.now())} from ${reports.length} reports across ${outlets} outlets. Check before publishing.`,
          `\n${r.text}`,
          `\nSOURCES`,
          ...reports.map((x, i) => `[${i + 1}] ${x.source}: ${x.title} ${x.url}`),
        ].join('\n');
        handleAddToHistory({ id: Date.now().toString(), title: `AI Brief: ${name}`, date: new Date().toLocaleDateString(), format: 'TXT', content, userId: user.id });
        setModalOpen(false);
        return;
      }
      const content = [
        `RAPID BRIEF: ${name.toUpperCase()}`,
        `Compiled ${when(Date.now())} from ${reports.length} reports across ${outlets} outlets.`,
        known ? `\nSITUATION\n${known.description}` : '',
        `\nLATEST REPORTING`,
        ...reports.map((r, i) => `${i + 1}. ${r.title} (${r.source}, ${when(r.published)})`),
        `\nSOURCES`,
        ...reports.map((r, i) => `[${i + 1}] ${r.url}`),
      ].filter(Boolean).join('\n');
      handleAddToHistory({ id: Date.now().toString(), title: `Rapid Brief: ${name}`, date: new Date().toLocaleDateString(), format: 'TXT', content, userId: user.id });
      setModalOpen(false);
    } catch (e: any) {
      setModalError(e?.message || 'The brief could not be compiled. Try again.');
    } finally {
      setIsGeneratingModal(false);
    }
  };

  // ---------------------------------------------------------------- render

  const reportsScreen = (
    <Reports
      pinnedNodes={pinnedNodes}
      onRemoveNode={(id) => setPinnedNodes(prev => prev.filter(n => n.id !== id))}
      onArchiveReport={handleAddToHistory}
      onGoResearch={() => setCurrentView('research')}
      isOffline={isSystemOffline}
      currentUser={user}
      historyItems={historyItems}
      onDownload={handleDownloadFile}
      onNotify={showToast}
    />
  );

  const renderContent = () => {
    if (appPhase === 'SPLASH') return <LaunchPage onFinish={() => setSplashDone(true)} />;
    if (appPhase === 'AUTHENTICATING') {
      if (!checkedSession) return <div className="fixed inset-0 flex items-center justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>;
      return <AuthGate blockedUser={user && !canEnter(user) ? user : null} providerContact={providerContact} onAuthenticated={handleAuthenticated} onSignOut={handleLogout} />;
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard onGenerateReport={openReportModal} onShare={shareThreat} onInvestigate={investigate} onViewThreat={handleViewThreatWire} threats={globalThreats} hazards={hazards} live={live} isOffline={isSystemOffline} />;
      case 'threat-wire':
        return selectedThreat ? <ThreatWireView threat={selectedThreat} onBack={() => setCurrentView(previousView)} onGenerateReport={openReportModal} onInvestigate={investigate} isOffline={isSystemOffline} /> : null;
      case 'research':
        return <Research initialQuery={researchQuery} pinnedNodes={pinnedNodes} onTogglePin={togglePinNode} onClearPins={() => setPinnedNodes([])} onProceedToReport={() => setCurrentView('reports')} isOffline={isSystemOffline} />;
      case 'reports':
        return reportsScreen;
      case 'tools': return <Tools />;
      case 'alerts': return <Alerts alerts={alerts} onInvestigate={investigate} onDismiss={handleDismissAlert} hiddenCount={allAlerts.length - alerts.length} status={{ refreshing: live.refreshing, updatedAt: live.updatedAt, error: live.error, onRefresh: live.refresh }} />;
      case 'settings': return <Settings onNotify={showToast} isOffline={isSystemOffline} onToggleOffline={toggleSystemStatus} onSave={() => { setPrefsVersion(v => v + 1); showToast('Platform configuration updated'); }} />;
      case 'watchlists': return <Watchlists notifications={notifications} onInvestigate={investigate} onNotify={showToast} />;
      case 'trends': return <Trends onInvestigate={investigate} />;
      case 'visual-intel': return <VisualIntel threats={globalThreats} />;
      case 'subject-lookup': return <SubjectLookup onNotify={showToast} />;
      case 'markets': return <Markets onInvestigate={investigate} />;
      case 'signals': return <Signals onInvestigate={investigate} />;
      case 'workbench': return <Workbench onInvestigate={investigate} />;
      case 'chatter': return <Chatter onInvestigate={investigate} />;
      case 'business': return <BusinessWatch live={live} onInvestigate={investigate} isOffline={isSystemOffline} />;
      case 'dev-registry':
        return user?.role === 'admin'
          ? <UserManagement currentUserId={user.id} providerContact={providerContact} onContactSaved={setProviderContact} onNotify={showToast} />
          : <div className="p-8 text-center text-white/50">Access Denied</div>;
      default:
        return <Dashboard onGenerateReport={openReportModal} onShare={shareThreat} onInvestigate={investigate} onViewThreat={handleViewThreatWire} threats={globalThreats} hazards={hazards} live={live} isOffline={isSystemOffline} />;
    }
  };

  const sidebarUser = user ? { ...user, org: user.org || 'Independent' } : null;

  return (
    <div className={`flex h-full bg-calibrex-dark text-calibrex-text font-sans selection:bg-calibrex-teal/30 overflow-hidden relative ${appPhase === 'MAIN_APP' ? 'cx-has-bottom-nav' : ''}`}>
      {appPhase === 'MAIN_APP' && isSidebarOpen && <div className="fixed inset-0 bg-black/80 z-[60] lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {appPhase === 'MAIN_APP' && (
        <div className={`fixed inset-y-0 left-0 z-[70] transition-transform duration-300 transform lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar currentView={currentView} onNavigate={handleNavigate} isOffline={isSystemOffline} onToggleOffline={toggleSystemStatus} currentUser={sidebarUser} onLogout={handleLogout} onClose={() => setIsSidebarOpen(false)} pendingCount={pendingCount} watchUnread={notifications.unread} />
        </div>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {appPhase === 'MAIN_APP' && <Header onToggleSidebar={() => setIsSidebarOpen(true)} threatLevel={threatLevel} alertCount={alerts.length} onOpenAlerts={() => handleNavigate('alerts')} bell={<NotificationBell items={notifications.items} unread={notifications.unread} onMarkRead={notifications.markRead} onOpenWatchlists={() => handleNavigate('watchlists')} />} />}
        <main className="flex-1 overflow-y-auto bg-calibrex-dark relative custom-scrollbar p-0 flex flex-col">
          <div key={appPhase === 'MAIN_APP' ? currentView : appPhase} className={`flex-none w-full max-w-full overflow-x-clip ${appPhase === 'MAIN_APP' ? 'cx-rise' : ''}`}>
            {renderContent()}
          </div>
          {appPhase === 'MAIN_APP' && <Footer />}
        </main>
      </div>

      {appPhase === 'MAIN_APP' && <ArticleReader />}
      {appPhase === 'MAIN_APP' && <VisualCollection />}
      {appPhase === 'MAIN_APP' && <BottomNav currentView={currentView} onNavigate={handleNavigate} onMore={() => setIsSidebarOpen(true)} watchUnread={notifications.unread} />}
      {appPhase === 'MAIN_APP' && <Modal isOpen={modalOpen} onClose={() => !isGeneratingModal && setModalOpen(false)} title={modalContent?.title || ''}>
        <div className="space-y-4">
          <div className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em]">Target Vector</div>
          <div className="text-sm font-black text-white uppercase">{modalContent?.threatName}</div>
          <p className="text-[11px] text-calibrex-muted leading-relaxed">Calibrex collects the latest reporting on this vector from the live wires and a fresh news search, and commits a sourced brief to your Report History.</p>
          {modalError && <div className="text-[11px] text-calibrex-critical font-bold">{modalError}</div>}
          <button onClick={() => handleModalGenerate(false)} disabled={isGeneratingModal} className="w-full bg-calibrex-teal hover:bg-[#3aa5b5] text-calibrex-navy font-black py-4 rounded mt-4 uppercase tracking-[0.2em] transition-all text-[11px] flex justify-center items-center gap-2 disabled:opacity-50">
            {isGeneratingModal ? <><Loader2 className="animate-spin" size={16} /> Compiling</> : 'INITIATE RAPID BRIEF'}
          </button>
          {aiState.ready && (
            <button id="brief-ai" onClick={() => handleModalGenerate(true)} disabled={isGeneratingModal} className="w-full border border-calibrex-gold/50 bg-calibrex-gold/10 hover:bg-calibrex-gold/20 text-calibrex-gold font-black py-3 rounded uppercase tracking-[0.15em] text-[11px] flex justify-center items-center gap-2 disabled:opacity-50">
              <Sparkles size={15} /> Write the brief with AI
            </button>
          )}
        </div>
      </Modal>}
      {appPhase === 'MAIN_APP' && toastMessage && <Toast message={toastMessage} onClose={clearToast} />}
      <GuidePopup />
      {appPhase === 'MAIN_APP' && <AddToCaseModal onNotify={showToast} />}
      {appPhase === 'MAIN_APP' && <AssistTour />}
    </div>
  );
};

export default App;
