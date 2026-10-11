import React, { useEffect, useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { getGate, Gate } from '../lib/sensitive';

/** Wraps a gated (sensitive) tool: shows a locked notice until an admin has
 *  enabled sensitive tools, otherwise renders the tool. */
const GateLock: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gate, setGate] = useState<Gate | null>(null);
  useEffect(() => { getGate().then(setGate).catch(() => setGate({ enabled: false, acknowledgedBy: null, acknowledgedAt: null })); }, []);

  if (!gate) return <div className="py-16 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>;
  if (!gate.enabled) return (
    <div className="rounded-xl border border-calibrex-high/30 bg-calibrex-high/5 p-5 flex items-start gap-3 max-w-2xl">
      <Lock size={20} className="text-calibrex-high shrink-0 mt-0.5" />
      <div>
        <div className="text-sm font-bold text-calibrex-high">Sensitive tools are disabled</div>
        <p className="text-[12px] text-calibrex-muted mt-1">An administrator must enable sensitive tools (with an authorization acknowledgment) in <b>User Management → Sensitive tools</b> before this runs. Every query is logged.</p>
      </div>
    </div>
  );
  return <>{children}</>;
};

export default GateLock;
