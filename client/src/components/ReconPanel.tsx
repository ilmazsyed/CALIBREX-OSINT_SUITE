import React, { useEffect, useState } from 'react';
import { Network, Loader2, ShieldAlert, ExternalLink, Copy, Server, Globe, Clock, FileWarning, ChevronRight } from 'lucide-react';
import { runRecon, ReconResult } from '../lib/recon';
import { copyText } from '../lib/api';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 py-1.5 border-b border-white/5 last:border-0">
    <div className="w-40 shrink-0 text-xs font-bold text-calibrex-muted uppercase tracking-wide">{label}</div>
    <div className="text-sm text-calibrex-text min-w-0 break-words">{children}</div>
  </div>
);
const Chips: React.FC<{ items?: string[]; empty?: string }> = ({ items, empty = '—' }) =>
  items && items.length ? <div className="flex flex-wrap gap-1.5">{items.map((x, i) => <span key={i} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono">{x}</span>)}</div> : <span className="text-calibrex-muted">{empty}</span>;

/** Built-in infrastructure recon on a domain or IP (Phase 2A). */
const ReconPanel: React.FC<{ initial?: string }> = ({ initial = '' }) => {
  const [target, setTarget] = useState(initial);
  const [data, setData] = useState<ReconResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (initial) setTarget(initial); }, [initial]);

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = target.trim();
    if (!t || loading) return;
    setLoading(true); setError(null); setData(null);
    try { setData(await runRecon(t)); } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const reg = data?.registration;
  const ip = data?.ipInfo || data?.host;
  const isDomain = data?.target.kind === 'domain';

  return (
    <div>
      <div className="p-4 rounded-lg bg-calibrex-surface border border-white/10 mb-4">
        <div className="flex items-center gap-2 mb-1"><Network size={16} className="text-calibrex-teal" /><h3 className="font-bold text-white">Infrastructure Recon</h3></div>
        <p className="text-sm text-calibrex-muted mb-3">Enter a website domain or server IP tied to a threat — a propaganda site, phishing domain, or leak site. Calibrex gathers what public, keyless sources say about the infrastructure. This looks up systems, not people.</p>
        <form onSubmit={run} className="flex flex-col sm:flex-row gap-2">
          <input id="recon-target" value={target} onChange={e => setTarget(e.target.value)} placeholder="example.com or 8.8.8.8" spellCheck={false} className="flex-1 bg-black/30 border border-white/15 rounded px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-calibrex-teal" />
          <button type="submit" disabled={!target.trim() || loading} className="px-5 py-2.5 rounded bg-calibrex-teal text-calibrex-navy font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Network size={15} />} Run recon
          </button>
        </form>
        {error && <div role="alert" className="mt-3 text-sm text-calibrex-critical">{error}</div>}
      </div>

      {loading && <div className="py-10 flex justify-center text-calibrex-teal"><Loader2 className="animate-spin" /></div>}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-white font-mono">{data.target.value}</span>
            <span className="px-2 py-0.5 rounded-full bg-calibrex-teal/15 text-calibrex-teal text-xs font-black uppercase">{data.target.kind}</span>
            <button onClick={() => copyText(data.target.value)} className="text-calibrex-muted hover:text-white" title="Copy"><Copy size={14} /></button>
          </div>

          {data.reputation.length > 0 && (
            <div className="p-4 rounded-lg border border-calibrex-critical/40 bg-calibrex-critical/10">
              <div className="text-sm font-black text-calibrex-critical flex items-center gap-2 mb-2"><ShieldAlert size={16} /> Reputation flags</div>
              {data.reputation.map((f, i) => (
                <div key={i} className="text-sm text-calibrex-text mb-1">
                  <b>{f.source}:</b> {f.detail} {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-calibrex-teal hover:underline inline-flex items-center gap-0.5">view <ExternalLink size={11} /></a>}
                </div>
              ))}
            </div>
          )}
          {data.reputation.length === 0 && <p className="text-sm text-calibrex-low flex items-center gap-1.5"><FileWarning size={14} /> No listings in the checked reputation feeds. Absence is not proof of safety — check the external tools below.</p>}

          {isDomain && (
            <section className="p-4 rounded-lg bg-calibrex-surface border border-white/10">
              <h4 className="text-sm font-bold text-calibrex-gold flex items-center gap-2 mb-2"><Globe size={14} /> Registration</h4>
              {reg?.ok === false ? <p className="text-sm text-calibrex-muted">{reg.error}</p> : (
                <div>
                  <Row label="Registrar">{reg?.registrar || <span className="text-calibrex-muted">—</span>}</Row>
                  <Row label="Registered">{reg?.created ? new Date(reg.created).toLocaleDateString() : '—'}</Row>
                  <Row label="Expires">{reg?.expires ? new Date(reg.expires).toLocaleDateString() : '—'}</Row>
                  <Row label="Registrant org">{reg?.org || <span className="text-calibrex-muted">redacted / not published</span>}{reg?.country ? ` · ${reg.country}` : ''}</Row>
                  <Row label="Status">{<Chips items={reg?.statuses} />}</Row>
                  <Row label="Abuse contact">{reg?.abuse || <span className="text-calibrex-muted">—</span>}</Row>
                </div>
              )}
            </section>
          )}

          {isDomain && data.dns && (
            <section className="p-4 rounded-lg bg-calibrex-surface border border-white/10">
              <h4 className="text-sm font-bold text-calibrex-gold flex items-center gap-2 mb-2"><Server size={14} /> DNS</h4>
              <Row label="IPv4 (A)"><Chips items={data.dns.a} /></Row>
              <Row label="IPv6 (AAAA)"><Chips items={data.dns.aaaa} /></Row>
              <Row label="Mail (MX)"><Chips items={data.dns.mx} /></Row>
              <Row label="Name servers"><Chips items={data.dns.ns} /></Row>
              <Row label="TXT"><Chips items={data.dns.txt} /></Row>
            </section>
          )}

          {ip && (
            <section className="p-4 rounded-lg bg-calibrex-surface border border-white/10">
              <h4 className="text-sm font-bold text-calibrex-gold flex items-center gap-2 mb-2"><Server size={14} /> {isDomain ? 'Hosting (first A record)' : 'IP ownership'}</h4>
              {ip.ok === false ? <p className="text-sm text-calibrex-muted">{ip.error}</p> : (
                <div>
                  <Row label="Network">{ip.network || '—'}{ip.cidr ? ` (${ip.cidr})` : ''}</Row>
                  <Row label="Organisation">{ip.org || <span className="text-calibrex-muted">—</span>}</Row>
                  <Row label="Country">{ip.country || '—'}</Row>
                  <Row label="Abuse contact">{ip.abuse || <span className="text-calibrex-muted">—</span>}</Row>
                  {data.ptr && data.ptr.length > 0 && <Row label="Reverse DNS"><Chips items={data.ptr} /></Row>}
                </div>
              )}
            </section>
          )}

          {isDomain && data.subdomains && (
            <section className="p-4 rounded-lg bg-calibrex-surface border border-white/10">
              <h4 className="text-sm font-bold text-calibrex-gold flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-2"><ChevronRight size={14} /> Subdomains {data.subdomains.names.length ? `(${data.subdomains.names.length}${data.subdomains.truncated ? '+' : ''})` : ''}</span>
              </h4>
              {data.subdomains.error ? <p className="text-sm text-calibrex-muted">{data.subdomains.error}</p> :
                data.subdomains.names.length === 0 ? <p className="text-sm text-calibrex-muted">None found in Certificate Transparency logs.</p> : (
                  <>
                    <div className="max-h-56 overflow-y-auto custom-scrollbar flex flex-wrap gap-1.5">{data.subdomains.names.map(n => <a key={n} href={`https://${n}`} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono hover:border-calibrex-teal">{n}</a>)}</div>
                    <p className="text-xs text-calibrex-muted mt-2">Source: {data.subdomains.source}. These are names that ever had a certificate; some may no longer resolve.</p>
                  </>
                )}
            </section>
          )}

          <section className="p-4 rounded-lg bg-calibrex-surface border border-white/10">
            <h4 className="text-sm font-bold text-calibrex-gold flex items-center gap-2 mb-2"><Clock size={14} /> Archive & external tools</h4>
            {data.archive.available && <p className="text-sm text-calibrex-text mb-2">Wayback Machine has a snapshot from {data.archive.timestamp ? `${data.archive.timestamp.slice(0, 4)}-${data.archive.timestamp.slice(4, 6)}-${data.archive.timestamp.slice(6, 8)}` : 'an earlier date'}: <a href={data.archive.url} target="_blank" rel="noopener noreferrer" className="text-calibrex-teal hover:underline">open ↗</a></p>}
            <div className="flex flex-wrap gap-2">
              {data.links.map(l => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded border border-white/15 text-xs text-calibrex-text hover:border-calibrex-teal flex items-center gap-1.5">{l.label} <ExternalLink size={11} /></a>)}
            </div>
          </section>

          <p className="text-xs text-calibrex-muted">Gathered from public sources (Certificate Transparency, DNS, RDAP, abuse.ch, Wayback) at {new Date(data.checkedAt).toLocaleTimeString()}. Data can be incomplete or out of date; confirm with the external tools before acting.</p>
        </div>
      )}
    </div>
  );
};

export default ReconPanel;
