import React, { useEffect, useRef, useState } from 'react';
import { Compass, X, ChevronDown, ChevronUp, Loader2, Check, ArrowRight, Sparkles, RotateCcw } from 'lucide-react';
import { MissionState, freshMission, loadMission, saveMission, suggestTopics, Suggestion, MISSION_OPEN, investigateTopic } from '../lib/mission';
import { getCases, saveCases, newCase } from '../lib/workbench';
import { navigateTo } from './AiAssist';

interface Step {
  title: string;
  what: string;                       // what to do + why
  view?: string;                      // screen to jump to
  action?: string;                    // primary button label
  investigate?: boolean;              // also load the topic into Research
  ai?: string;                        // optional AI hint (shown only when AI is connected)
  flag?: keyof MissionState;          // manual completion flag this step sets
}

const STEPS: Step[] = [
  { title: 'Pick your mission', what: 'Choose a live topic the situation is flagging right now, or type your own. We’ll open a Case to hold everything you gather.' },
  { title: 'Frame the question', what: 'Write the one thing you’re trying to establish (e.g. “Is there a troop build-up, and who reports it?”). A sharp question keeps the investigation honest.', ai: 'Ask AI to suggest investigative angles', flag: 'readDone' },
  { title: 'Collect sources', what: 'Search the topic, open promising results, and pin the credible ones to your Case with “Add to case”. Aim for 3+ independent outlets.', view: 'research', action: 'Open Research', investigate: true },
  { title: 'Read & extract', what: 'Open a pinned source in the reader. Note the who/what/where/when and anything that needs checking. Every capture is hash-stamped for provenance.', view: 'workbench', action: 'Open your Case', ai: 'Use “Summarise article with AI” in the reader', flag: 'verifyDone' },
  { title: 'Corroborate a claim', what: 'Take the single most important claim and run Verify on it. Three or more independent outlets = corroborated; fewer = treat as unconfirmed.', view: 'research', action: 'Go to Verify', flag: 'reportDone' },
  { title: 'Compile the report', what: 'Open Reports with your Case. Write: Executive summary, Analysis, Implications, Indicators to watch. Keep claims tied to pinned sources.', view: 'reports', action: 'Open Reports', ai: 'Use the AI draft button in Reports' },
  { title: 'File the brief', what: 'Save the finished write-up as a Rapid Brief so it’s filed and shareable. That closes the loop — collection to product.', view: 'briefs', action: 'Open Briefs' },
];

const MissionDock: React.FC<{ aiReady: boolean }> = ({ aiReady }) => {
  const [m, setM] = useState<MissionState | null>(null);
  const [sugs, setSugs] = useState<Suggestion[] | null>(null);
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const mRef = useRef<MissionState | null>(null);
  mRef.current = m;

  const persist = (next: MissionState | null) => { setM(next); saveMission(next); };

  useEffect(() => { loadMission().then(x => { if (x) setM(x); }); }, []);

  // Launcher (nav / Command / help) opens or resumes the mission.
  useEffect(() => {
    const open = () => { const cur = mRef.current; persist(cur ? { ...cur, active: true, minimized: false } : freshMission()); };
    window.addEventListener(MISSION_OPEN, open);
    return () => window.removeEventListener(MISSION_OPEN, open);
  }, []);

  // Track pins into the mission's Case while on the Collect step.
  useEffect(() => {
    if (!m?.active || m.step !== 2 || !m.caseId) return;
    let alive = true;
    const sync = async () => {
      const cases = await getCases().catch(() => []);
      const c = cases.find(x => x.id === m.caseId);
      if (alive && c && c.items.length !== m.pinned) persist({ ...mRef.current!, pinned: c.items.length });
    };
    sync();
    const t = setInterval(sync, 4000);
    const h = () => sync();
    window.addEventListener('cx:add-to-case', h);
    return () => { alive = false; clearInterval(t); window.removeEventListener('cx:add-to-case', h); };
  }, [m?.active, m?.step, m?.caseId, m?.pinned]);

  // Filing a brief completes the final step.
  useEffect(() => {
    const onBrief = () => { const cur = mRef.current; if (cur?.active && cur.step === 6) persist({ ...cur, briefDone: true, completedAt: Date.now() }); };
    window.addEventListener('cx:briefs', onBrief);
    return () => window.removeEventListener('cx:briefs', onBrief);
  }, []);

  // Load live topic suggestions when we enter step 0.
  useEffect(() => { if (m?.active && m.step === 0 && sugs === null) suggestTopics().then(setSugs).catch(() => setSugs([])); }, [m?.active, m?.step, sugs]);

  if (!m || !m.active) {
    return (
      <button onClick={() => persist(m ? { ...m, active: true, minimized: false } : freshMission())}
        className="fixed bottom-20 right-4 z-[900] flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-calibrex-gold text-calibrex-navy shadow-lg shadow-black/40 text-[11px] font-black uppercase tracking-widest active:scale-95">
        <Compass size={15} /> Guided Mission
      </button>
    );
  }

  const start = async (q: string) => {
    const name = q.trim().slice(0, 80);
    if (!name) return;
    setBusy(true);
    try {
      const cases = await getCases().catch(() => []);
      const c = newCase(`Mission: ${name}`);
      await saveCases([c, ...cases]);
      persist({ ...m, topic: name, caseId: c.id, caseName: c.name, step: 1 });
    } finally { setBusy(false); }
  };

  const step = STEPS[m.step];
  const atEnd = m.step === STEPS.length - 1 && m.briefDone;
  const go = () => { if (step.view) { if (step.investigate && m.topic) investigateTopic(m.topic); navigateTo(step.view); persist({ ...m, minimized: true }); } };
  const next = () => { const flags: Partial<MissionState> = step.flag ? { [step.flag]: true } as any : {}; persist({ ...m, ...flags, step: Math.min(m.step + 1, STEPS.length - 1) }); setSugs(null); };
  const back = () => persist({ ...m, step: Math.max(0, m.step - 1) });

  if (m.minimized) {
    return (
      <button onClick={() => persist({ ...m, minimized: false })}
        className="fixed bottom-20 right-4 z-[900] flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-calibrex-surface border border-calibrex-gold/40 text-calibrex-gold shadow-lg shadow-black/40 text-[11px] font-black uppercase tracking-widest active:scale-95">
        <Compass size={15} /> Mission · {m.step + 1}/{STEPS.length}
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-[360px] z-[900] rounded-2xl border border-calibrex-gold/30 bg-calibrex-surface shadow-2xl shadow-black/60 overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/10 bg-black/30">
        <Compass size={16} className="text-calibrex-gold shrink-0" />
        <span className="text-[11px] font-black text-white uppercase tracking-widest flex-1">Guided Mission</span>
        <span className="text-[9px] font-mono text-white/40">{m.step + 1}/{STEPS.length}</span>
        <button onClick={() => persist({ ...m, minimized: true })} className="p-1 text-white/40 hover:text-white"><ChevronDown size={15} /></button>
        <button onClick={() => persist({ ...m, active: false })} className="p-1 text-white/40 hover:text-white" title="Close (resume later)"><X size={15} /></button>
      </div>

      {/* progress dots */}
      <div className="flex gap-1 px-3.5 pt-3">
        {STEPS.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < m.step ? 'bg-calibrex-gold' : i === m.step ? 'bg-calibrex-gold/60' : 'bg-white/10'}`} />)}
      </div>

      <div className="p-3.5 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
        {atEnd ? (
          <div className="text-center py-3 space-y-2">
            <Check size={28} className="text-calibrex-low mx-auto" />
            <div className="text-sm font-black text-white uppercase tracking-widest">Mission complete</div>
            <p className="text-[11px] text-white/60">Case “{m.caseName}” · {m.pinned} source{m.pinned === 1 ? '' : 's'} pinned · report filed as a brief.</p>
            <button onClick={() => { persist(freshMission()); setSugs(null); setTopic(''); }} className="mt-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-calibrex-gold text-calibrex-navy text-[10px] font-black uppercase tracking-widest"><RotateCcw size={13} /> Start another</button>
          </div>
        ) : (
          <>
            <div>
              <div className="text-sm font-black text-white">{step.title}</div>
              {m.topic && m.step > 0 && <div className="text-[10px] font-mono text-calibrex-teal mt-0.5">Topic: {m.topic}</div>}
              <p className="text-[12px] text-white/70 leading-relaxed mt-1.5">{step.what}</p>
            </div>

            {/* Step 0: topic picker */}
            {m.step === 0 && (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') start(topic); }} placeholder="Type a topic or place…" className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-calibrex-gold placeholder:text-white/30" />
                  <button onClick={() => start(topic)} disabled={busy || !topic.trim()} className="px-3 rounded-lg bg-calibrex-gold text-calibrex-navy text-[10px] font-black uppercase tracking-widest disabled:opacity-40">{busy ? <Loader2 size={13} className="animate-spin" /> : 'Start'}</button>
                </div>
                <div className="text-[9px] font-black text-white/40 uppercase tracking-widest">Live from the situation</div>
                {sugs === null ? <div className="py-3 flex justify-center text-calibrex-teal"><Loader2 size={15} className="animate-spin" /></div>
                  : sugs.length === 0 ? <p className="text-[11px] text-white/40">No live suggestions right now — type your own above.</p>
                  : <div className="space-y-1.5">{sugs.map((s, i) => (
                      <button key={i} onClick={() => start(s.query)} disabled={busy} className="w-full text-left flex items-start gap-2 p-2 rounded-lg border border-white/10 bg-black/30 hover:border-calibrex-gold/40">
                        <span className="text-[8px] font-black uppercase tracking-widest text-calibrex-teal bg-calibrex-teal/10 border border-calibrex-teal/25 rounded px-1.5 py-0.5 shrink-0 mt-0.5">{s.tag}</span>
                        <span className="text-[12px] text-white/85 leading-snug">{s.label}</span>
                      </button>))}</div>}
              </div>
            )}

            {step.ai && (
              <div className={`flex items-center gap-2 text-[11px] rounded-lg border px-2.5 py-2 ${aiReady ? 'border-calibrex-teal/30 bg-calibrex-teal/5 text-calibrex-teal' : 'border-white/10 bg-black/20 text-white/40'}`}>
                <Sparkles size={13} className="shrink-0" />
                <span>{aiReady ? step.ai : 'Optional: connect AI in Settings to enable drafting here.'}</span>
              </div>
            )}

            {/* actions */}
            {m.step > 0 && (
              <div className="flex items-center gap-2 pt-1">
                {m.step > 1 && <button onClick={back} className="px-2.5 py-2 rounded-lg border border-white/10 text-white/50 text-[10px] font-black uppercase tracking-widest">Back</button>}
                {step.view && <button onClick={go} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-calibrex-teal text-calibrex-navy text-[10px] font-black uppercase tracking-widest active:scale-95">{step.action} <ArrowRight size={13} /></button>}
                <button onClick={next} className="px-3 py-2 rounded-lg border border-calibrex-gold/40 text-calibrex-gold text-[10px] font-black uppercase tracking-widest">{m.step === STEPS.length - 1 ? 'Finish' : 'Next'}</button>
              </div>
            )}
            {m.step === 2 && <div className="text-[10px] text-white/45">{m.pinned} source{m.pinned === 1 ? '' : 's'} pinned to “{m.caseName}”.</div>}
          </>
        )}
      </div>
    </div>
  );
};

export default MissionDock;
