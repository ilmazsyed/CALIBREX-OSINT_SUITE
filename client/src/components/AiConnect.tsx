import React, { useEffect, useState } from 'react';
import { Sparkles, Check, Loader2, ExternalLink, KeyRound, LogIn, ChevronLeft, Unplug, PlayCircle } from 'lucide-react';
import { ai, useAiStatus, AiFamily, AiProvider, AiModel, shortModel } from '../lib/features';

const FAMILIES: { id: AiFamily; name: string; maker: string; direct: AiProvider; keyUrl: string; keySteps: string[] }[] = [
  {
    id: 'Claude', name: 'Claude', maker: 'Anthropic', direct: 'anthropic', keyUrl: 'https://platform.claude.com/settings/keys',
    keySteps: ['Open the Claude Console and sign in (or create an account).', 'Add a payment method under Billing if you have not already.', 'Go to API Keys and click "Create Key". Name it "Calibrex".', 'Copy the key (it starts with sk-ant-) and paste it below.'],
  },
  {
    id: 'ChatGPT', name: 'ChatGPT', maker: 'OpenAI', direct: 'openai', keyUrl: 'https://platform.openai.com/api-keys',
    keySteps: ['Open the OpenAI platform and sign in with your ChatGPT account.', 'Add credit under Settings → Billing (API use is billed separately from ChatGPT Plus).', 'Click "Create new secret key". Name it "Calibrex".', 'Copy the key (it starts with sk-) and paste it below.'],
  },
  {
    id: 'Gemini', name: 'Gemini', maker: 'Google', direct: 'gemini', keyUrl: 'https://aistudio.google.com/apikey',
    keySteps: ['Open Google AI Studio and sign in with your Google account.', 'Click "Create API key" and choose or create a project.', 'Copy the key (it starts with AIza) and paste it below.'],
  },
];

const Step: React.FC<{ n: number; label: string; state: 'done' | 'current' | 'todo' }> = ({ n, label, state }) => (
  <div className="flex items-center gap-2 min-w-0">
    <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black border ${state === 'done' ? 'bg-calibrex-teal text-calibrex-navy border-calibrex-teal' : state === 'current' ? 'border-calibrex-teal text-calibrex-teal' : 'border-white/15 text-white/40'}`}>
      {state === 'done' ? <Check size={14} /> : n}
    </span>
    <span className={`text-xs font-bold truncate ${state === 'todo' ? 'text-white/40' : 'text-white'}`}>{label}</span>
  </div>
);

const AiConnect: React.FC<{ onNotify?: (m: string) => void }> = ({ onNotify }) => {
  const { status, reload } = useAiStatus();
  const [family, setFamily] = useState<AiFamily | null>(null);
  const [mode, setMode] = useState<'oneclick' | 'key'>('oneclick');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<AiModel[]>([]);
  const [testResult, setTestResult] = useState<string | null>(null);
  const conn = status?.connection || null;

  useEffect(() => {
    if (!conn) { setModels([]); return; }
    ai.models().then(r => setModels(r.models)).catch(e => setError(e.message));
  }, [conn?.provider, conn?.connectedAt]);

  if (!status) return <div className="text-sm text-calibrex-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Checking AI connection…</div>;
  if (!status.enabled) return <p className="text-sm text-calibrex-muted">AI features are switched off for this workspace. Everything else in Calibrex works without AI.</p>;

  const fam = FAMILIES.find(f => f.id === family);
  const step = conn ? 3 : family ? 2 : 1;

  const connectKey = async () => {
    if (!fam) return;
    setBusy('key'); setError(null);
    try {
      await ai.connectKey(fam.direct, key.trim());
      setKey('');
      await reload();
      onNotify?.(`${fam.name} connected`);
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };
  const changeModel = async (model: string) => {
    setBusy('model'); setError(null); setTestResult(null);
    try { await ai.setModel(model); await reload(); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };
  const runTest = async () => {
    setBusy('test'); setError(null); setTestResult(null);
    try { setTestResult((await ai.generate('test', {})).text); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };
  const disconnect = async () => {
    if (!window.confirm('Disconnect your AI account from Calibrex? The stored key is deleted from our server.')) return;
    setBusy('disconnect');
    try { await ai.disconnect(); await reload(); setFamily(null); setTestResult(null); onNotify?.('AI disconnected'); } finally { setBusy(null); }
  };

  // Group models by family so OpenRouter's long list stays readable.
  const grouped = models.reduce<Record<string, AiModel[]>>((acc, m) => { (acc[m.family] ||= []).push(m); return acc; }, {});

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <Step n={1} label="Choose AI" state={step > 1 ? 'done' : 'current'} />
        <Step n={2} label="Connect" state={step > 2 ? 'done' : step === 2 ? 'current' : 'todo'} />
        <Step n={3} label="Model & test" state={step === 3 ? (testResult ? 'done' : 'current') : 'todo'} />
      </div>

      {step === 1 && (
        <div>
          <p className="text-sm text-calibrex-muted mb-3">Pick the assistant you want Calibrex to use. You use your own account, so you control access and cost. You can switch at any time.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {FAMILIES.map(f => (
              <button key={f.id} onClick={() => { setFamily(f.id); setMode('oneclick'); setError(null); }} className="text-left p-4 rounded-lg border border-white/10 bg-black/20 hover:border-calibrex-teal hover:bg-calibrex-teal/5 transition-colors">
                <div className="text-base font-black text-white">{f.name}</div>
                <div className="text-xs text-calibrex-muted">by {f.maker}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && fam && (
        <div className="space-y-4">
          <button onClick={() => setFamily(null)} className="text-xs text-calibrex-muted hover:text-white flex items-center gap-1"><ChevronLeft size={14} /> Choose a different AI</button>
          <div className="flex gap-2">
            <button onClick={() => setMode('oneclick')} className={`flex-1 px-3 py-2 rounded text-xs font-bold border ${mode === 'oneclick' ? 'border-calibrex-teal text-calibrex-teal bg-calibrex-teal/10' : 'border-white/10 text-calibrex-muted'}`}>Sign in (recommended)</button>
            <button onClick={() => setMode('key')} className={`flex-1 px-3 py-2 rounded text-xs font-bold border ${mode === 'key' ? 'border-calibrex-teal text-calibrex-teal bg-calibrex-teal/10' : 'border-white/10 text-calibrex-muted'}`}>Use my {fam.maker} key</button>
          </div>

          {mode === 'oneclick' ? (
            <div className="p-4 rounded-lg bg-black/20 border border-white/10 space-y-3">
              <ol className="text-sm text-calibrex-text space-y-2 list-decimal pl-5">
                <li>Click <b>Connect {fam.name}</b>. You go to OpenRouter, a service that gives one login for Claude, ChatGPT and Gemini.</li>
                <li>Sign in or create a free account there, then click <b>Authorize</b>.</li>
                <li>You come straight back here, connected. Add credit on OpenRouter when you want to use it; you only pay for what you use.</li>
              </ol>
              <button id="ai-oneclick" onClick={() => { setBusy('oneclick'); ai.startOneClick(fam.id); }} disabled={!!busy} className="w-full bg-calibrex-teal hover:bg-[#3aa5b5] text-calibrex-navy font-black py-3 rounded text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {busy === 'oneclick' ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Connect {fam.name}
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-black/20 border border-white/10 space-y-3">
              <ol className="text-sm text-calibrex-text space-y-2 list-decimal pl-5">
                {fam.keySteps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
              <a href={fam.keyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-calibrex-teal font-bold hover:underline">Open {fam.maker} key page <ExternalLink size={13} /></a>
              <div className="flex flex-col sm:flex-row gap-2">
                <input id="ai-key" type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder="Paste your API key" className="flex-1 bg-calibrex-surface-light border border-calibrex-teal/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-calibrex-teal" />
                <button id="ai-key-connect" onClick={connectKey} disabled={!key.trim() || !!busy} className="px-4 py-2 bg-calibrex-teal text-calibrex-navy font-black rounded text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {busy === 'key' ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Connect
                </button>
              </div>
              <p className="text-xs text-calibrex-muted">Calibrex checks the key with {fam.maker}, then stores it encrypted. It is only used for requests you make.</p>
            </div>
          )}
        </div>
      )}

      {step === 3 && conn && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-calibrex-teal/5 border border-calibrex-teal/30 flex items-start gap-3">
            <Sparkles size={18} className="text-calibrex-teal shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-white">Connected via {conn.providerLabel}</div>
              <div className="text-xs text-calibrex-muted">Since {new Date(conn.connectedAt).toLocaleDateString()} · key ending {conn.hint}</div>
            </div>
            <button onClick={disconnect} disabled={!!busy} className="text-xs text-calibrex-critical font-bold flex items-center gap-1 hover:underline shrink-0"><Unplug size={13} /> Disconnect</button>
          </div>
          <div>
            <label htmlFor="ai-model" className="block text-sm font-bold text-calibrex-text mb-2">Model</label>
            <select id="ai-model" value={conn.model} onChange={e => changeModel(e.target.value)} disabled={!!busy || !models.length} className="w-full bg-calibrex-surface-light border border-calibrex-teal/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-calibrex-teal">
              {!models.some(m => m.id === conn.model) && <option value={conn.model}>{shortModel(conn.model)}</option>}
              {Object.entries(grouped).map(([g, list]) => (
                <optgroup key={g} label={g}>{list.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
              ))}
            </select>
          </div>
          <button id="ai-test" onClick={runTest} disabled={!!busy} className="w-full border border-calibrex-teal text-calibrex-teal hover:bg-calibrex-teal/10 font-black py-2.5 rounded text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {busy === 'test' ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />} Test connection
          </button>
          {testResult && <div className="p-3 rounded bg-black/30 border border-calibrex-low/30 text-sm text-calibrex-text"><span className="text-calibrex-low font-bold">Working. </span>{testResult}</div>}
          <p className="text-xs text-calibrex-muted">AI buttons now appear in Research, Report Generator, Threat Wire, Verify and Rapid Brief. AI answers are drafts built from the live sources shown; check them before you publish.</p>
        </div>
      )}

      {error && <div role="alert" className="text-sm text-calibrex-critical font-bold">{error}</div>}
    </div>
  );
};

export default AiConnect;
