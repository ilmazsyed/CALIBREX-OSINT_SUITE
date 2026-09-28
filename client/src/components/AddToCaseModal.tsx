import React, { useEffect, useState } from 'react';
import { FolderPlus, Plus, X, Check } from 'lucide-react';
import { getCases, saveCases, newCase, Board, CaseItem } from '../lib/workbench';

/** Global case picker. Opens on the `cx:add-to-case` event dispatched by addToCase(). */
const AddToCaseModal: React.FC<{ onNotify?: (m: string) => void }> = ({ onNotify }) => {
  const [item, setItem] = useState<Omit<CaseItem, 'addedAt'> | null>(null);
  const [cases, setCases] = useState<Board[]>([]);
  const [name, setName] = useState('');
  const [addedTo, setAddedTo] = useState<string | null>(null);

  useEffect(() => {
    const open = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setItem(detail); setAddedTo(null); setName('');
      getCases().then(setCases);
    };
    window.addEventListener('cx:add-to-case', open);
    return () => window.removeEventListener('cx:add-to-case', open);
  }, []);

  if (!item) return null;
  const close = () => setItem(null);

  const addTo = async (board: Board) => {
    if (board.items.some(i => i.id === item.id)) { onNotify?.(`Already in "${board.name}".`); setAddedTo(board.id); return; }
    const next = cases.map(c => c.id === board.id ? { ...c, items: [{ ...item, addedAt: Date.now() }, ...c.items].slice(0, 500) } : c);
    setCases(next); setAddedTo(board.id);
    await saveCases(next);
    onNotify?.(`Added to "${board.name}".`);
  };

  const createAndAdd = async () => {
    if (!name.trim()) return;
    const c = { ...newCase(name), items: [{ ...item, addedAt: Date.now() }] };
    const next = [c, ...cases];
    setCases(next); setAddedTo(c.id); setName('');
    await saveCases(next);
    onNotify?.(`Added to "${c.name}".`);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 cx-fade" onClick={close}>
      <div className="cx-glass cx-pop rounded-2xl w-full max-w-md p-5 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><FolderPlus size={16} className="text-calibrex-teal" /> Add to case</h3>
          <button onClick={close} className="text-calibrex-muted hover:text-white"><X size={18} /></button>
        </div>
        <p className="text-xs text-calibrex-muted mb-4 truncate">{item.title}</p>

        <div className="flex gap-2 mb-4">
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createAndAdd()} placeholder="New case name…" className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-calibrex-teal" />
          <button onClick={createAndAdd} disabled={!name.trim()} className="px-3 py-2 bg-calibrex-teal/15 border border-calibrex-teal/40 text-calibrex-teal rounded-lg disabled:opacity-40"><Plus size={16} /></button>
        </div>

        <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1.5">
          {cases.length === 0 ? <p className="text-xs text-calibrex-muted text-center py-4">No cases yet — create one above.</p>
            : cases.map(c => (
              <button key={c.id} onClick={() => addTo(c)} className="w-full text-left px-3 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 flex items-center justify-between gap-2">
                <span className="min-w-0"><span className="text-sm text-white block truncate">{c.name}</span><span className="text-[10px] text-calibrex-muted">{c.items.length} item{c.items.length === 1 ? '' : 's'}</span></span>
                {addedTo === c.id && <Check size={16} className="text-calibrex-low shrink-0" />}
              </button>
            ))}
        </div>

        {addedTo && <button onClick={close} className="w-full mt-4 py-2.5 bg-calibrex-teal text-calibrex-navy text-[11px] font-black uppercase tracking-widest rounded-lg">Done</button>}
      </div>
    </div>
  );
};

export default AddToCaseModal;
