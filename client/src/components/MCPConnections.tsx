import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, Copy, ExternalLink, Loader2, RefreshCw, ShieldCheck, Workflow } from 'lucide-react';
import { copyText } from '../lib/api';

const MCP_URL = 'https://app.calibrex.org/api/mcp';
const RESOURCE_URL = 'https://app.calibrex.org/.well-known/oauth-protected-resource';
const AUTH_URL = 'https://app.calibrex.org/.well-known/oauth-authorization-server';

type Health = 'checking' | 'online' | 'offline';

const MCPConnections: React.FC<{ onNotify?: (message: string) => void }> = ({ onNotify }) => {
  const [health, setHealth] = useState<Health>('checking');
  const [scopes, setScopes] = useState<string[]>([]);
  const [issuer, setIssuer] = useState('https://app.calibrex.org');
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  const checkGateway = useCallback(async () => {
    setHealth('checking');
    try {
      const [resourceRes, authRes] = await Promise.all([
        fetch(RESOURCE_URL, { cache: 'no-store', credentials: 'omit' }),
        fetch(AUTH_URL, { cache: 'no-store', credentials: 'omit' }),
      ]);
      if (!resourceRes.ok || !authRes.ok) throw new Error('MCP discovery endpoints are unavailable.');
      const [resource, auth] = await Promise.all([resourceRes.json(), authRes.json()]);
      if (resource.resource !== MCP_URL || !Array.isArray(resource.scopes_supported)) {
        throw new Error('MCP resource metadata did not match this server.');
      }
      setScopes(resource.scopes_supported);
      setIssuer(typeof auth.issuer === 'string' ? auth.issuer : 'https://app.calibrex.org');
      setCheckedAt(Date.now());
      setHealth('online');
    } catch {
      setHealth('offline');
      setCheckedAt(Date.now());
    }
  }, []);

  useEffect(() => { void checkGateway(); }, [checkGateway]);

  const copyEndpoint = async () => {
    const ok = await copyText(MCP_URL);
    onNotify?.(ok ? 'MCP server address copied.' : 'Could not copy the MCP address.');
  };

  return (
    <section id="external-ai-connections" className="bg-calibrex-surface border border-calibrex-teal/40 rounded-xl p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 shrink-0 rounded-lg bg-calibrex-teal/15 text-calibrex-teal flex items-center justify-center"><Workflow size={21} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg sm:text-xl font-black text-calibrex-teal">Connect external AI</h2>
            <span className="text-[10px] font-black tracking-wider uppercase px-2 py-1 rounded-full bg-calibrex-teal/15 text-calibrex-teal">MCP gateway</span>
          </div>
          <p className="text-sm text-calibrex-muted mt-1">Use ChatGPT, Claude or an MCP-compatible Gemini client as an intelligence copilot connected to your Calibrex workspace. No additional model-provider API key is required for this connection.</p>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white"><Activity size={16} className="text-calibrex-teal" /> Gateway status</div>
          <div className={`flex items-center gap-1.5 text-xs font-bold ${health === 'online' ? 'text-calibrex-low' : health === 'offline' ? 'text-calibrex-critical' : 'text-calibrex-muted'}`}>
            {health === 'checking' ? <Loader2 size={13} className="animate-spin" /> : <span className={`w-2 h-2 rounded-full ${health === 'online' ? 'bg-calibrex-low' : 'bg-calibrex-critical'}`} />}
            {health === 'online' ? 'Discovery online' : health === 'offline' ? 'Unavailable — retry' : 'Checking'}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <code className="min-w-0 flex-1 break-all rounded-md bg-black/30 border border-white/10 px-3 py-3 text-xs sm:text-sm text-calibrex-text">{MCP_URL}</code>
          <button onClick={copyEndpoint} className="shrink-0 flex items-center justify-center gap-2 rounded-md bg-calibrex-teal text-calibrex-navy font-black text-sm px-4 py-3"><Copy size={15} /> Copy address</button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-calibrex-muted">
          <span>OAuth issuer: {issuer}</span>
          {checkedAt && <span>Checked {new Date(checkedAt).toLocaleTimeString()}</span>}
          <button onClick={() => void checkGateway()} className="inline-flex items-center gap-1 text-calibrex-teal font-bold"><RefreshCw size={11} /> Check again</button>
        </div>
        {health === 'online' && (
          <div className="pt-2 border-t border-white/10">
            <div className="text-[11px] uppercase tracking-wider font-bold text-calibrex-muted mb-2">Available permission scopes</div>
            <div className="flex flex-wrap gap-2">{scopes.map(scope => <span key={scope} className="text-[11px] rounded-full border border-calibrex-teal/30 bg-calibrex-teal/10 text-calibrex-teal px-2.5 py-1">{scope}</span>)}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/10 p-3">
          <div className="font-black text-white text-sm">ChatGPT</div>
          <p className="text-xs text-calibrex-muted mt-1">Add a custom MCP connector in ChatGPT settings where developer connectors are available.</p>
        </div>
        <div className="rounded-lg border border-white/10 p-3">
          <div className="font-black text-white text-sm">Claude</div>
          <p className="text-xs text-calibrex-muted mt-1">Add a custom remote connector in Claude settings, if supported by your plan and client.</p>
        </div>
        <div className="rounded-lg border border-white/10 p-3">
          <div className="font-black text-white text-sm">Gemini</div>
          <p className="text-xs text-calibrex-muted mt-1">Connect through a Gemini client or host that supports remote MCP servers.</p>
        </div>
      </div>

      <div className="rounded-lg border border-calibrex-gold/25 bg-calibrex-gold/5 p-3 sm:p-4 flex items-start gap-2.5">
        <ShieldCheck size={17} className="text-calibrex-gold shrink-0 mt-0.5" />
        <div className="text-xs text-calibrex-muted leading-relaxed">
          <strong className="text-calibrex-gold">Your workspace stays in control.</strong> The AI client redirects you to Calibrex to sign in and approve access. Read and case permissions are scoped; case-writing access must be explicitly granted. You can revoke access through the Calibrex security controls. Client availability and setup steps vary by provider and plan.
        </div>
      </div>

      <details className="rounded-lg border border-white/10 bg-black/15 p-3">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-sm font-bold text-calibrex-text">
          <span>Connection setup help</span><ExternalLink size={14} className="text-calibrex-muted" />
        </summary>
        <div className="mt-3 space-y-3 text-xs text-calibrex-muted leading-relaxed">
          <p><strong className="text-white">1.</strong> Copy the MCP server address above.</p>
          <p><strong className="text-white">2.</strong> In your AI client's MCP or custom-connector settings, add it as a remote server. Choose OAuth when prompted.</p>
          <p><strong className="text-white">3.</strong> Sign in to Calibrex in the authorization window and review the requested permissions before approving.</p>
          <p><strong className="text-white">4.</strong> Return to your AI client and confirm that the Calibrex tools are listed. Start with read-only research; grant case-writing permissions only when you need them.</p>
          <p>Do not paste your Calibrex password, session cookie or any provider API key into the MCP server address field.</p>
        </div>
      </details>
    </section>
  );
};

export default MCPConnections;
