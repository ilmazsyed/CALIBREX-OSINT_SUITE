import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Shield, Plus, RefreshCw, Save, AlertTriangle } from 'lucide-react';

type DefenceRecord = {
  id: string; name: string; type: string; country: string | null; description: string;
  state: string; confidence: number; validFrom: number | null; validTo: number | null;
  evidence: { id: string; url: string; publisher: string; sourceType: string; publishedAt: number | null; capturedAt: number | null }[];
  missing: string[]; reviewRequired: boolean;
};
const TYPES = ['ORGANISATION','UNIT','PLATFORM','INSTALLATION','EXERCISE','PROCUREMENT','CAPABILITY','EVENT'];
const STATES = ['UNVERIFIED','CANDIDATE','REVIEWED','CONTRADICTED','ARCHIVED'];
const SOURCE_TYPES = ['OFFICIAL','RESEARCH','MEDIA','DATASET','SOCIAL','OTHER'];
const toDate = (value: number | null) => value ? new Date(value).toISOString().slice(0,10) : '—';

const DefenceRegistryPanel: React.FC = () => {
  const [records,setRecords] = useState<DefenceRecord[]>([]);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [showForm,setShowForm] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [name,setName] = useState('');
  const [type,setType] = useState('UNIT');
  const [country,setCountry] = useState('IND');
  const [description,setDescription] = useState('');
  const [state,setState] = useState('UNVERIFIED');
  const [confidence,setConfidence] = useState('0');
  const [validFrom,setValidFrom] = useState('');
  const [validTo,setValidTo] = useState('');
  const [url,setUrl] = useState('');
  const [publisher,setPublisher] = useState('');
  const [sourceType,setSourceType] = useState('OFFICIAL');
  const [publishedAt,setPublishedAt] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { const result = await api<{records:DefenceRecord[]}>('/defence-intelligence/registry'); setRecords(result.records || []); }
    catch (e:any) { setError(e.message || 'Could not load the defence reference registry.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const next: any = {
        id: 'def_' + Date.now().toString(36), name, type, country: country.trim().toUpperCase(),
        description, state, confidence: Number(confidence) || 0,
        validFrom: validFrom || null, validTo: validTo || null,
        observedAt: Date.now(),
        evidence: [{ id: 'src_' + Date.now().toString(36), url, publisher, sourceType,
          publishedAt: publishedAt || null, capturedAt: Date.now() }]
      };
      const result = await api<{records:DefenceRecord[]}>('/defence-intelligence/registry/records', { method:'POST', body:{record:next} });
      setRecords(result.records || []); setNotice('Public-source reference record saved to your private registry.');
      setName(''); setDescription(''); setUrl(''); setPublisher(''); setValidFrom(''); setValidTo(''); setPublishedAt('');
      setState('UNVERIFIED'); setConfidence('0'); setShowForm(false);
    } catch (e:any) { setError(e.message || 'Could not save the defence reference record.'); }
    finally { setSaving(false); }
  };

  return <section className="rounded-xl border border-calibrex-teal/25 bg-calibrex-teal/5 p-4 sm:p-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-black text-sm flex items-center gap-2"><Shield size={15} className="text-calibrex-teal"/> Strategic defence reference registry</h3>
        <p className="text-[10px] text-white/45 mt-1">Maintain source-backed public records for organisations, units, platforms, installations, exercises and procurement.</p></div>
      <div className="flex gap-2">
        <button onClick={load} disabled={loading} className="text-[10px] rounded border border-white/15 px-3 py-2"><RefreshCw size={12} className="inline mr-1"/>{loading?'Loading…':'Refresh'}</button>
        <button onClick={()=>setShowForm(v=>!v)} className="text-[10px] rounded border border-calibrex-teal/30 text-calibrex-teal px-3 py-2"><Plus size={12} className="inline mr-1"/>Add record</button>
      </div>
    </div>
    {error && <p className="text-xs text-amber-300">{error}</p>}
    {notice && <p className="text-xs text-calibrex-teal">{notice}</p>}
    {showForm && <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Record name / designation" className="rounded bg-black/40 border border-white/10 p-2 text-xs"/>
        <select value={type} onChange={e=>setType(e.target.value)} className="rounded bg-black/40 border border-white/10 p-2 text-xs">{TYPES.map(x=><option key={x}>{x}</option>)}</select>
        <input value={country} onChange={e=>setCountry(e.target.value)} maxLength={3} placeholder="ISO country code (IND)" className="rounded bg-black/40 border border-white/10 p-2 text-xs"/>
        <select value={state} onChange={e=>setState(e.target.value)} className="rounded bg-black/40 border border-white/10 p-2 text-xs">{STATES.map(x=><option key={x}>{x}</option>)}</select>
        <input value={confidence} onChange={e=>setConfidence(e.target.value)} type="number" min="0" max="100" placeholder="Analyst confidence (0–100)" className="rounded bg-black/40 border border-white/10 p-2 text-xs"/>
        <input value={validFrom} onChange={e=>setValidFrom(e.target.value)} type="date" aria-label="Valid from" className="rounded bg-black/40 border border-white/10 p-2 text-xs"/>
        <input value={validTo} onChange={e=>setValidTo(e.target.value)} type="date" aria-label="Valid to" className="rounded bg-black/40 border border-white/10 p-2 text-xs"/>
        <input value={publisher} onChange={e=>setPublisher(e.target.value)} placeholder="Publisher / source organisation" className="rounded bg-black/40 border border-white/10 p-2 text-xs"/>
        <select value={sourceType} onChange={e=>setSourceType(e.target.value)} className="rounded bg-black/40 border border-white/10 p-2 text-xs">{SOURCE_TYPES.map(x=><option key={x}>{x}</option>)}</select>
        <input value={publishedAt} onChange={e=>setPublishedAt(e.target.value)} type="date" aria-label="Source publication date" className="rounded bg-black/40 border border-white/10 p-2 text-xs"/>
      </div>
      <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="What does the public source establish? Include scope and caveats." rows={2} className="w-full rounded bg-black/40 border border-white/10 p-2 text-xs"/>
      <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Original public source URL (http/https)" className="w-full rounded bg-black/40 border border-white/10 p-2 text-xs"/>
      <div className="flex justify-end gap-2"><button onClick={()=>setShowForm(false)} className="text-[10px] border border-white/15 rounded px-3 py-2">Cancel</button><button onClick={add} disabled={saving||!name.trim()||!url.trim()} className="text-[10px] rounded bg-calibrex-teal text-calibrex-navy font-black px-3 py-2 disabled:opacity-40"><Save size={12} className="inline mr-1"/>{saving?'Saving…':'Save reference'}</button></div>
    </div>}
    {records.length===0 ? <p className="text-xs text-white/40">No records saved yet. Add public-source references and record their temporal validity and evidence.</p> :
      <div className="space-y-2 max-h-[420px] overflow-y-auto">{records.map(record=><article key={record.id} className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs text-white">{record.name}</strong><span className="text-[9px] text-calibrex-teal">{record.type} · {record.country || 'Country unverified'} · {record.state}</span></div>
        <p className="text-[10px] text-white/55">{record.description || 'No description supplied.'}</p>
        <div className="text-[9px] text-white/35">Validity: {toDate(record.validFrom)} → {toDate(record.validTo)} · Confidence: {record.confidence}% · Sources: {record.evidence?.length || 0}</div>
        {record.missing?.length>0&&<p className="text-[9px] text-amber-300">Missing: {record.missing.join('; ')}</p>}
        {record.evidence?.map(source=><a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" className="block text-[9px] text-calibrex-teal underline break-all">{source.publisher || 'Open source'} · {source.url}</a>)}
      </article>)}</div>}
    <div className="rounded-lg border border-amber-400/15 bg-amber-400/5 p-2 text-[9px] text-white/50"><AlertTriangle size={12} className="inline mr-1 text-amber-300"/>Public-source strategic reference only. This registry is not a validated current order of battle, live force disposition or readiness assessment. Missing records do not prove absence.</div>
  </section>;
};
export default DefenceRegistryPanel;
