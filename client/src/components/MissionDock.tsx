import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Compass, X, ChevronDown, Loader2, Check, ArrowRight, Sparkles, RotateCcw, ChevronLeft } from 'lucide-react';
import {
  MissionState, freshMission, loadMission, saveMission, suggestTopics, Suggestion,
  MISSION_OPEN, investigateTopic, ROLES, roleById, buildSteps, Step, loadDone, saveDone,
} from '../lib/mission';
import { getCases, saveCases, newCase } from '../lib/workbench';
import { navigateTo } from './AiAssist';

const MissionDock: React.FC<{ aiReady: boolean }> = ({ aiReady }) => {
  const [m, setM] = useState<MissionState | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [sugs, setSugs] = useState<Suggestion[] | null>(null);
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const mRef = useRef<MissionState | null>(null);
  mRef.current = m;

  const persist = (next: MissionState | null) => { setM(next); saveMission(next); };
  const steps: Step[] = useMemo(() => (m && m.roleId !== null ? buildSteps(roleById(m.roleId)) : []), [m?.roleId]);
  const role = m ? roleById(m.roleId) : null;
  const step = steps[m?.step ?? 0];

  useEffect(() => {
    loadMission().then(x => {
      // Only accept a well-formed record; discard anything from an older shape
      // so a stale persisted mission can never crash the dock.
      if (x && typeof x === 'object' && 'roleId' in x && typeof x.active === 'boolean') setM(x);
      else if (x) saveMission(null);
    }).catch(() => {});
    loadDone().then(setDone).catch(() => {});
  }, []);

  useEffect(() => {
    const open = () => { const cur = mRef.current; persist(cur ? { ...cur, active: true, minimized: false } : freshMission()); };
    window.addEventListener(MISSION_OPEN, open);
    return () => window.removeEventListener(MISSION_OPEN, open);
  }, []);

  // Track pins into the Case while on the collect step.
  useEffect(() => {
    if (!m?.active || !m.caseId || step?.kind !== 'collect') return;
    let alive = true;
    const sync = async () => {
      const cs = await getCases().catch(() => []);
      const c = cs.find(x => x.id === m.caseId);
      if (alive && c && c.items.length !== m.pinned) persist({ ...mRef.current!, pinned: c.items.length });
    };
    sync();
    const t = setInterval(sync, 4000);
    const h = () => sync();
    window.addEventListener('cx:add-to-case', h);
    return () => { alive = false; clearInterval(t); window.removeEventListener('cx:add-to-case', h); };
  }, [m?.active, m?.step, m?.caseId, m?.pinned, step?.kind]);

  // Filing a brief completes the final step; record the role for coverage.
  useEffect(() => {
    const onBrief = () => {
      const cur = mRef.current;
      if (cur?.active && steps[cur.step]?.kind === 'brief') {
        persist({ ...cur, briefDone: true, completedAt: Date.now() });
        if (cur.roleId && cur.roleId !== 'free' && !done.includes(cur.roleId)) { const nd = [...done, cur.roleId]; setDone(nd); saveDone(nd); }
      }
    };
    window.addEventListener('cx:briefs', onBrief);
    return () => window.removeEventListener('cx:briefs', onBrief);
  }, [steps, done]);

  // Topic suggestions when we reach the pick step.
  useEffect(() => { if (m?.active && step?.kind === 'pick' && sugs === null) suggestTopics().then(setSugs).catch(() => setSugs([])); }, [m?.active, step?.kind, sugs]);

  // ---- launcher pill (no active mission) ----
  if (!m || !m.active) {
    return (
      <button onClick={() => persist(m ? { ...m, active: true, minimized: false } : freshMission())}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6 right-4 z-[900] flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-calibrex-gold text-calibrex-navy shadow-lg shadow-black/40 text-[11px] font-black uppercase tracking-widest active:scale-95">
        <Compass size={15} /> Guided Mission
      </button>
    );
  }
  if (m.minimized) {
    return (
      <button onClick={() => persist({ ...m, minimized: false })}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6 right-4 z-[900] flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-calibrex-surface border border-calibrex-gold/40 text-calibrex-gold shadow-lg shadow-black/40 text-[11px] font-black uppercase tracking-widest active:scale-95">
        <Compass size={15} /> {role ? `${role.name.replace('The ', '')}` : 'Mission'} · {(m.step ?? 0) + 1}/{steps.length || '?'}
      </button>
    );
  }

  const start = async (q: string) => {
    const name = q.trim().slice(0, 80); if (!name) return;
    setBusy(true);
    try {
      const cs = await getCases().catch(() => []);
      const c = newCase(`Mission: ${name}`);
      await saveCases([c, ...cs]);
      persist({ ...m, topic: name, caseId: c.id, caseName: c.name, step: m.step + 1 });
    } finally { setBusy(false); }
  };
  const go = () => { if (step?.view) { if (step.investigate && m.topic) investigateTopic(m.topic); navigateTo(step.view); persist({ ...m, minimized: true }); } };
  const next = () => { persist({ ...m, step: Math.min(m.step + 1, steps.length - 1) }); if (steps[m.step + 1]?.kind === 'pick') setSugs(null); };
  const back = () => persist({ ...m, step: Math.max(0, m.step - 1) });
  const pickRole = (id: string) => { persist({ ...m, roleId: id, step: 0 }); setSugs(null); setTopic(''); };
  const atEnd = step?.kind === 'brief' && m.briefDone;

  const Header = (
    <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/10 bg-black/30">
      <Compass size={16} className="text-calibrex-gold shrink-0" />
      <span className="text-[11px] font-black text-white uppercase tracking-widest flex-1 truncate">{role ? role.name : 'Guided Mission'}</span>
      {m.roleId !== null && <span className="text-[9px] font-mono text-white/40">{(m.step ?? 0) + 1}/{steps.length}</span>}
      <button onClick={() => persist({ ...m, minimized: true })} className="p-1 text-white/40 hover:text-white"><ChevronDown size={15} /></button>
      <button onClick={() => persist({ ...m, active: false })} className="p-1 text-white/40 hover:text-white" title="Close (resume later)"><X size={15} /></button>
    </div>
  );

  // ---- role picker ----
  if (m.roleId === null) {
    return (
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6 right-4 left-4 sm:left-auto sm:w-[380px] z-[900] rounded-2xl border border-calibrex-gold/30 bg-calibrex-surface shadow-2xl shadow-black/60 overflow-hidden">
        {Header}
        <div className="px-3.5 pt-3 pb-1 flex items-center justify-between">
          <span className="text-[11px] text-white/60">Pick a role — we’ll coach that workflow end to end.</span>
          <span className="text-[9px] font-black text-calibrex-teal uppercase tracking-widest">{done.length}/{ROLES.length} explored</span>
        </div>
        <div className="p-3 space-y-1.5 max-h-[56vh] overflow-y-auto custom-scrollbar">
          {ROLES.map(r => (
            <button key={r.id} onClick={() => pickRole(r.id)} className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl border border-white/10 bg-black/30 hover:border-calibrex-gold/40">
              <span className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${r.accent}1f`, border: `1px solid ${r.accent}55` }}>
                {done.includes(r.id) ? <Check size={16} style={{ color: r.accent }} /> : <Compass size={15} style={{ color: r.accent }} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-mono uppercase tracking-widest" style={{ color: r.accent }}>{r.room}</span>
                <span className="block text-[13px] font-bold text-white leading-tight">{r.name}</span>
                <span className="block text-[10px] text-white/50 leading-snug mt-0.5">{r.blurb}</span>
              </span>
              <ArrowRight size={14} className="shrink-0 text-white/30" />
            </button>
          ))}
          <button onClick={() => pickRole('free')} className="w-full text-center py-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white">Or run a free investigation →</button>
        </div>
      </div>
    );
  }

  // ---- active step ----
  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6 right-4 left-4 sm:left-auto sm:w-[360px] z-[900] rounded-2xl border border-calibrex-gold/30 bg-calibrex-surface shadow-2xl shadow-black/60 overflow-hidden">
      {Header}
      <div className="flex gap-1 px-3.5 pt-3">
        {steps.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < m.step ? 'bg-calibrex-gold' : i === m.step ? 'bg-calibrex-gold/60' : 'bg-white/10'}`} />)}
      </div>
      <div className="p-3.5 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
        {atEnd ? (
          <div className="text-center py-3 space-y-2">
            <Check size={28} className="text-calibrex-low mx-auto" />
            <div className="text-sm font-black text-white uppercase tracking-widest">Mission complete</div>
            <p className="text-[11px] text-white/60">Case “{m.caseName}” · {m.pinned} source{m.pinned === 1 ? '' : 's'} · filed as a brief.</p>
            <p className="text-[10px] text-calibrex-teal font-black uppercase tracking-widest">{done.length}/{ROLES.length} roles explored</p>
            <div className="flex gap-2 justify-center pt-1">
              <button onClick={() => { persist({ ...freshMission() }); setSugs(null); setTopic(''); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-calibrex-gold text-calibrex-navy text-[10px] font-black uppercase tracking-widest"><RotateCcw size={13} /> Another role</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <button onClick={() => persist({ ...m, roleId: null, step: 0 })} className="shrink-0 mt-0.5 p-1 -ml-1 text-white/30 hover:text-white" title="Change role"><ChevronLeft size={15} /></button>
              <div className="flex-1">
                <div className="text-[9px] font-mono uppercase tracking-widest" style={{ color: role?.accent || '#e9c46a' }}>{step?.kind === 'orient' ? 'Orient' : step?.kind}</div>
                <div className="text-sm font-black text-white">{step?.title}</div>
                {m.topic && step?.kind !== 'pick' && <div className="text-[10px] font-mono text-calibrex-teal mt-0.5">Topic: {m.topic}</div>}
                <p className="text-[12px] text-white/70 leading-relaxed mt-1.5">{step?.what}</p>
              </div>
            </div>

            {step?.kind === 'pick' && (
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

            {step?.ai && (
              <div className={`flex items-center gap-2 text-[11px] rounded-lg border px-2.5 py-2 ${aiReady ? 'border-calibrex-teal/30 bg-calibrex-teal/5 text-calibrex-teal' : 'border-white/10 bg-black/20 text-white/40'}`}>
                <Sparkles size={13} className="shrink-0" />
                <span>{aiReady ? step.ai : 'Optional: connect AI in Settings to enable drafting here.'}</span>
              </div>
            )}

            {step?.kind !== 'pick' && (
              <div className="flex items-center gap-2 pt-1">
                {m.step > 0 && <button onClick={back} className="px-2.5 py-2 rounded-lg border border-white/10 text-white/50 text-[10px] font-black uppercase tracking-widest">Back</button>}
                {step?.view && <button onClick={go} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-calibrex-teal text-calibrex-navy text-[10px] font-black uppercase tracking-widest active:scale-95">{step.action} <ArrowRight size={13} /></button>}
                <button onClick={next} className="px-3 py-2 rounded-lg border border-calibrex-gold/40 text-calibrex-gold text-[10px] font-black uppercase tracking-widest">{m.step === steps.length - 1 ? 'Finish' : 'Next'}</button>
              </div>
            )}
            {step?.kind === 'collect' && <div className="text-[10px] text-white/45">{m.pinned} source{m.pinned === 1 ? '' : 's'} pinned to “{m.caseName}”.</div>}
          </>
        )}
      </div>
    </div>
  );
};

export default MissionDock;
