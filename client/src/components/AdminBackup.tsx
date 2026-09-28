import React, { useRef, useState } from 'react';
import { Database, Download, Upload, Loader2, ShieldAlert } from 'lucide-react';
import { adminExtra } from '../lib/features';
import { saveFile } from '../lib/api';

/** Admin-only one-click backup and restore of the whole dataset. */
const AdminBackup: React.FC<{ onNotify: (m: string) => void }> = ({ onNotify }) => {
  const [busy, setBusy] = useState<'download' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ name: string; data: unknown; users: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = async () => {
    setBusy('download'); setError(null);
    try {
      const data = await adminExtra.backup();
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const ok = await saveFile(`calibrex-backup-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json');
      onNotify(ok ? 'Backup downloaded' : 'The download was blocked by the browser');
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data: any = JSON.parse(String(reader.result));
        if (!Array.isArray(data.users) || typeof data.settings !== 'object') throw new Error('bad');
        setPending({ name: file.name, data, users: data.users.length });
      } catch { setError('That file is not a valid Calibrex backup.'); }
    };
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsText(file);
  };

  const confirmRestore = async () => {
    if (!pending) return;
    setBusy('restore'); setError(null);
    try {
      const r = await adminExtra.restore(pending.data);
      setPending(null);
      onNotify(`Restored ${r.users} account${r.users === 1 ? '' : 's'}. Reloading…`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  return (
    <section className="bg-calibrex-surface border border-white/10 rounded-lg p-4 sm:p-5 mt-6">
      <h3 className="text-base font-bold text-calibrex-gold flex items-center gap-2 mb-1"><Database size={16} /> Backup &amp; restore</h3>
      <p className="text-sm text-calibrex-muted mb-4">Download your whole workspace — accounts, reports, settings and the audit log — as one file, or restore it. Keep backups private: the file contains password hashes and encrypted AI keys.</p>

      <div className="flex flex-wrap gap-3">
        <button onClick={download} disabled={!!busy} className="px-4 py-2.5 rounded bg-calibrex-teal text-calibrex-navy text-sm font-black flex items-center gap-2 disabled:opacity-50">
          {busy === 'download' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download backup
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={!!busy} className="px-4 py-2.5 rounded border border-white/15 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
          <Upload size={15} /> Restore from file
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={pick} className="hidden" />
      </div>

      {pending && (
        <div className="mt-4 p-4 rounded-lg border border-calibrex-critical/40 bg-calibrex-critical/10">
          <div className="text-sm font-black text-calibrex-critical flex items-center gap-2 mb-1"><ShieldAlert size={16} /> Confirm restore</div>
          <p className="text-sm text-calibrex-text">Restoring <b>{pending.name}</b> ({pending.users} account{pending.users === 1 ? '' : 's'}) will <b>replace everything</b> currently in this workspace. This cannot be undone.</p>
          <div className="mt-3 flex gap-2">
            <button onClick={confirmRestore} disabled={busy === 'restore'} className="px-4 py-2 rounded bg-calibrex-critical text-white text-sm font-black flex items-center gap-2 disabled:opacity-60">{busy === 'restore' ? <Loader2 size={14} className="animate-spin" /> : null} Replace everything and restore</button>
            <button onClick={() => setPending(null)} disabled={busy === 'restore'} className="px-4 py-2 rounded border border-white/15 text-white text-sm font-bold">Cancel</button>
          </div>
        </div>
      )}
      {error && <div role="alert" className="mt-3 text-sm text-calibrex-critical">{error}</div>}
    </section>
  );
};

export default AdminBackup;
