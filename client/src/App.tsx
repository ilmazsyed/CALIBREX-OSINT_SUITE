import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ViewState, ReportHistoryItem, Alert, Threat, IntelligenceNode } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Footer from './components/Footer';
import Command from './components/Command';
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
import { LicenseLocked, LicenseBanner, isLocked, isEntitled } from './components/LicenseGate';
import PlansFeatures from './components/PlansFeatures';
import AssetExposure from './components/AssetExposure';
import AtlasCopilot from './components/AtlasCopilot';
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
import EarthWatch from './components/EarthWatch';
import GlobalSituation from './components/GlobalSituation';
import ConflictWatch from './components/ConflictWatch';
import Maritime from './components/Maritime';
import SanctionsScreen from './components/SanctionsScreen';
const GraphBoard = React.lazy(() => import('./components/GraphBoard'));
// The globe bundles the world outline; load it only when its view opens.
const LiveEarth3D = React.lazy(() => import('./components/LiveEarth3D'));
import SocialFootprint from './components/SocialFootprint';
import Workbench from './components/Workbench';
import Chatter from './components/Chatter';
import BusinessWatch from './components/BusinessWatch';
import GovernmentDashboard from './components/GovernmentDashboard';
import ElectionPolitics from './components/ElectionPolitics';
import BriefsView from './components/BriefsView';
import RapidBriefModal from './components/RapidBriefModal';
import AddToCaseModal from './components/AddToCaseModal';
import MissionDock from './components/MissionDock';
import ErrorBoundary from './components/ErrorBoundary';
import ScreenGuard from './components/ScreenGuard';
import AssistTour, { startTour, TOUR_DONE_KEY } from './components/AssistTour';
import { Loader2, Sparkles } from 'lucide-react';
import { auth, admin, User, ApiError, onAccessChange, loadRecord, saveRecord, localPref, setLocalPref, saveFile, plainText, copyText, applyDisplay } from './lib/api';
import { useLiveIntel, searchNews, timeAgo, openReader } from './lib/live';
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
  const [currentView, setCurrentView] = useState<AnyView>('command');
  const [previousView, setPreviousView] = useState<AnyView>('command');
  const [selectedThreat, setSelectedThreat] = useState<Threat | null>(null);
  const [pinnedNodes, setPinnedNodes] = useState<IntelligenceNode[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{ title: string, threatName?: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isGeneratingModal, setIsGeneratingModal] = useState(false);
  const [briefResult, setBriefResult] = useState<{ title: string; text: string; sources: { title: string; source: string; url: string; published?: number }[] } | null>(null);
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
    setCurrentView('command');
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

  // A profile edit elsewhere should refresh the identity shown in the sidebar.
  useEffect(() => {
    const h = () => auth.me().then(r => setUser(r.user)).catch(() => {});
    window.addEventListener('cx:user-updated', h);
    return () => window.removeEventListener('cx:user-updated', h);
  }, []);

  // Deep links from a tapped push notification: open the exact article
  // (?reader=…) or jump to a specific screen (?view=…). Works both for a fresh
  // launch (query string present on load) and when the app is already open (the
  // service worker posts the link in).
  const applyDeepLink = useCallback((search: string) => {
    try {
      const p = new URLSearchParams(search);
      const reader = p.get('reader');
      const view = p.get('view');
      if (reader) { openReader({ url: reader, title: p.get('t') || '', source: p.get('s') || '' }); return; }
      if (view) { setCurrentView(view as AnyView); setIsSidebarOpen(false); }
    } catch { /* ignore a malformed link */ }
  }, []);
  // Capture any launch deep link once, then strip it from the address bar.
  const launchSearch = useRef(typeof window !== 'undefined' ? window.location.search : '');
  useEffect(() => {
    if (window.location.search) { try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ } }
  }, []);
  useEffect(() => {
    if (appPhase === 'MAIN_APP' && launchSearch.current) { applyDeepLink(launchSearch.current); launchSearch.current = ''; }
  }, [appPhase, applyDeepLink]);
  // Deep links delivered while the app is already open.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'cx:notification' && e.data.url) {
        try { applyDeepLink(new URL(e.data.url, window.location.origin).search); } catch { /* ignore */ }
      }
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, [applyDeepLink]);

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

  const handleNavigate = useCallback((view: AnyView) => {
    if (view === ('mission' as AnyView)) {
      // Guided Mission is a sellable feature; if it's not in the plan, send the
      // user to Plans & Features to request it instead of a dead launcher.
      if (isEntitled(user, 'mission')) window.dispatchEvent(new Event('cx:mission-open'));
      else setCurrentView('plans');
      setIsSidebarOpen(false); return;
    }
    setCurrentView(view); setIsSidebarOpen(false);
  }, [user]);

  // Horizontal swipe between the main screens, in sidebar order. Swipe left
  // (finger right→left) advances to the next screen; swipe right goes back.
  const SWIPE_VIEWS: ViewState[] = ['command', 'dashboard', 'worldmap', 'markets', 'business', 'government', 'politics', 'signals', 'geoint', 'conflict', 'maritime', 'chatter', 'trends', 'visual-intel', 'watchlists', 'research', 'graph', 'subject-lookup', 'sanctions', 'socmint', 'tools', 'workbench', 'briefs', 'reports', 'alerts', 'settings'];
  const touchRef = useRef<{ x: number; y: number; t: number; ok: boolean } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) { touchRef.current = null; return; }
    const t = e.touches[0];
    // Ignore gestures that begin inside something that scrolls or pans
    // horizontally (maps, carousels, sliders, inputs), so they keep working.
    let ok = !(e.target as HTMLElement)?.closest?.('.leaflet-container,[data-no-swipe],input,textarea,select,[role="slider"]');
    for (let el = e.target as HTMLElement | null; ok && el && el !== document.body; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 4) { const ov = getComputedStyle(el).overflowX; if (ov === 'auto' || ov === 'scroll') { ok = false; break; } }
    }
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now(), ok };
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const s = touchRef.current; touchRef.current = null;
    if (!s || !s.ok || isSidebarOpen) return;
    const t = e.changedTouches[0]; if (!t) return;
    const dx = t.clientX - s.x, dy = t.clientY - s.y, dt = Date.now() - s.t;
    // Decisive, mostly-horizontal flick; ignore slow drags and vertical scroll.
    if (dt > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    const i = SWIPE_VIEWS.indexOf(currentView as ViewState);
    if (i === -1) return; // on a detail screen (e.g. threat-wire) — leave to its own Back
    const next = dx < 0 ? i + 1 : i - 1;
    if (next < 0 || next >= SWIPE_VIEWS.length) return;
    setCurrentView(SWIPE_VIEWS[next]);
  }, [currentView, isSidebarOpen]);
  const investigate = useCallback((q: string) => { setResearchQuery(prev => ({ q, n: prev.n + 1 })); setCurrentView('research'); }, []);

  // The Guided Mission asks to load a topic into Research. (Declared after
  // `investigate` so the dependency isn't read in the temporal dead zone.)
  useEffect(() => {
    const h = (e: Event) => { const q = (e as CustomEvent).detail; if (typeof q === 'string' && q.trim()) investigate(q); };
    window.addEventListener('cx:investigate', h);
    return () => window.removeEventListener('cx:investigate', h);
  }, [investigate]);

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
        setModalOpen(false);
        setBriefResult({ title: `AI Brief: ${name}`, text: content, sources: reports });
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
      setModalOpen(false);
      setBriefResult({ title: `Rapid Brief: ${name}`, text: content, sources: reports });
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

    // Demo accounts see every screen in the nav, but locked ones show the
    // "Get License to Activate" panel instead of the real feature.
    if (user && currentView !== 'dev-registry' && isLocked(user, currentView)) {
      return <LicenseLocked view={currentView} />;
    }

    switch (currentView) {
      case 'command':
        return <Command alertCount={alerts.length} />;
      case 'dashboard':
        return <Dashboard onGenerateReport={openReportModal} onShare={shareThreat} onInvestigate={investigate} onViewThreat={handleViewThreatWire} threats={globalThreats} hazards={hazards} live={live} isOffline={isSystemOffline} />;
      case 'threat-wire':
        // The detail view needs a selected threat; if we land here without one
        // (e.g. a Guided Mission routed straight to the wire), show the
        // Security Dashboard — the live wire lives there — instead of a blank.
        return selectedThreat
          ? <ThreatWireView threat={selectedThreat} onBack={() => setCurrentView(previousView)} onGenerateReport={openReportModal} onInvestigate={investigate} isOffline={isSystemOffline} />
          : <Dashboard onGenerateReport={openReportModal} onShare={shareThreat} onInvestigate={investigate} onViewThreat={handleViewThreatWire} threats={globalThreats} hazards={hazards} live={live} isOffline={isSystemOffline} />;
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
      case 'geoint': return <EarthWatch onInvestigate={investigate} />;
      case 'worldmap': return <GlobalSituation onInvestigate={investigate} />;
      case 'liveearth': return <LiveEarth3D onInvestigate={investigate} />;
      case 'exposure': return <AssetExposure onNotify={showToast} />;
      case 'copilot': return <AtlasCopilot />;
      case 'conflict': return <ConflictWatch onInvestigate={investigate} />;
      case 'maritime': return <Maritime onInvestigate={investigate} />;
      case 'sanctions': return <SanctionsScreen onInvestigate={investigate} />;
      case 'graph': return <GraphBoard onInvestigate={investigate} />;
      case 'socmint': return <SocialFootprint onInvestigate={investigate} />;
      case 'workbench': return <Workbench onInvestigate={investigate} />;
      case 'chatter': return <Chatter onInvestigate={investigate} />;
      case 'business': return <BusinessWatch live={live} onInvestigate={investigate} isOffline={isSystemOffline} />;
      case 'government': return <GovernmentDashboard live={live} onInvestigate={investigate} isOffline={isSystemOffline} />;
      case 'politics': return <ElectionPolitics live={live} onInvestigate={investigate} isOffline={isSystemOffline} />;
      case 'briefs': return <BriefsView onNotify={showToast} />;
      case 'plans': return <PlansFeatures onNotify={showToast} />;
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
          <Sidebar currentView={currentView} onNavigate={handleNavigate} isOffline={isSystemOffline} onToggleOffline={toggleSystemStatus} currentUser={sidebarUser} onLogout={handleLogout} onClose={() => setIsSidebarOpen(false)} pendingCount={pendingCount} watchUnread={notifications.unread} live={live} />
        </div>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {appPhase === 'MAIN_APP' && <Header onToggleSidebar={() => setIsSidebarOpen(true)} threatLevel={threatLevel} alertCount={alerts.length} onOpenAlerts={() => handleNavigate('alerts')} bell={<NotificationBell items={notifications.items} unread={notifications.unread} onMarkRead={notifications.markRead} onOpenWatchlists={() => handleNavigate('watchlists')} />} />}
        {appPhase === 'MAIN_APP' && user && <LicenseBanner user={user} />}
        <main onTouchStart={appPhase === 'MAIN_APP' ? onTouchStart : undefined} onTouchEnd={appPhase === 'MAIN_APP' ? onTouchEnd : undefined} className="flex-1 overflow-y-auto bg-calibrex-dark relative custom-scrollbar p-0 flex flex-col">
          <div key={appPhase === 'MAIN_APP' ? currentView : appPhase} className={`flex-none w-full max-w-full overflow-x-clip ${appPhase === 'MAIN_APP' ? 'cx-rise' : ''}`}>
            <React.Suspense fallback={<div className="py-24 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>}>
              <ErrorBoundary
                isolate
                key={appPhase === 'MAIN_APP' ? currentView : appPhase}
                fallback={
                  <div className="py-24 px-6 flex flex-col items-center justify-center text-center gap-3">
                    <div className="text-[11px] font-black text-calibrex-gold uppercase tracking-[0.25em]">This screen hit a snag</div>
                    <div className="text-xs text-calibrex-muted max-w-sm leading-relaxed">Something in this view couldn&apos;t load. The rest of the app is fine — switch to another screen, or reload to try again.</div>
                    <button onClick={() => window.location.reload()} className="mt-1 bg-calibrex-teal hover:bg-[#3aa5b5] text-calibrex-navy font-black py-2.5 px-5 rounded uppercase tracking-[0.2em] text-[10px]">Reload</button>
                  </div>
                }
              >
                {renderContent()}
              </ErrorBoundary>
            </React.Suspense>
          </div>
          {appPhase === 'MAIN_APP' && <Footer />}
        </main>
        {appPhase === 'MAIN_APP' && <BottomNav currentView={currentView} onNavigate={handleNavigate} onMore={() => setIsSidebarOpen(true)} watchUnread={notifications.unread} />}
      </div>

      {appPhase === 'MAIN_APP' && <ArticleReader />}
      {appPhase === 'MAIN_APP' && <VisualCollection />}
      {appPhase === 'MAIN_APP' && <Modal isOpen={modalOpen} onClose={() => !isGeneratingModal && setModalOpen(false)} title={modalContent?.title || ''}>
        <div className="space-y-4">
          <div className="text-[10px] font-black text-calibrex-gold uppercase tracking-[0.2em]">Topic</div>
          <div className="text-sm font-black text-white uppercase">{modalContent?.threatName}</div>
          <p className="text-[11px] text-calibrex-muted leading-relaxed">Calibrex collects the latest reporting on this vector from the live wires and a fresh news search, shows you the sourced brief, and lets you file it to <b className="text-calibrex-teal">Briefs</b>.</p>
          {modalError && <div className="text-[11px] text-calibrex-critical font-bold">{modalError}</div>}
          <button onClick={() => handleModalGenerate(false)} disabled={isGeneratingModal} className="w-full bg-calibrex-teal hover:bg-[#3aa5b5] text-calibrex-navy font-black py-4 rounded mt-4 uppercase tracking-[0.2em] transition-all text-[11px] flex justify-center items-center gap-2 disabled:opacity-50">
            {isGeneratingModal ? <><Loader2 className="animate-spin" size={16} /> Compiling</> : 'Compile Rapid Brief'}
          </button>
          {aiState.ready && (
            <button id="brief-ai" onClick={() => handleModalGenerate(true)} disabled={isGeneratingModal} className="w-full border border-calibrex-gold/50 bg-calibrex-gold/10 hover:bg-calibrex-gold/20 text-calibrex-gold font-black py-3 rounded uppercase tracking-[0.15em] text-[11px] flex justify-center items-center gap-2 disabled:opacity-50">
              <Sparkles size={15} /> Write the brief with AI
            </button>
          )}
        </div>
      </Modal>}
      {appPhase === 'MAIN_APP' && <RapidBriefModal open={!!briefResult} onClose={() => setBriefResult(null)} domain="Security" accent="teal" title={briefResult?.title || ''} text={briefResult?.text || ''} sources={briefResult?.sources || []} />}
      {appPhase === 'MAIN_APP' && toastMessage && <Toast message={toastMessage} onClose={clearToast} />}
      <GuidePopup />
      {appPhase === 'MAIN_APP' && <AddToCaseModal onNotify={showToast} />}
      {appPhase === 'MAIN_APP' && <AssistTour />}
      {appPhase === 'MAIN_APP' && isEntitled(user, 'mission') && <ErrorBoundary isolate><MissionDock aiReady={aiState.ready} /></ErrorBoundary>}
      {appPhase === 'MAIN_APP' && user && <ErrorBoundary isolate><ScreenGuard currentView={currentView} /></ErrorBoundary>}
    </div>
  );
};

export default App;
