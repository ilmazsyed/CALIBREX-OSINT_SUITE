import React from 'react';
import { ReportData, templateById, statusTone, confidenceTone, TableDef } from '../lib/reportTemplates';

/* The branded, print-ready document. Rendered on dark stock to match the
   Calibrex sample outputs (Michroma headings, DM Mono labels, gold/mint/saffron
   accents) and exported to PDF via the browser print (see .cx-report-doc print
   rules in app.css). Styling is inline so print fidelity does not depend on app
   classes. */

const C = {
  bg: '#10141f', panel: '#161b29', line: 'rgba(255,255,255,0.09)',
  text: '#eef2f8', dim: '#9fb0c3', faint: '#6c7d90',
  gold: '#e9bd78', saffron: '#f5a944', mint: '#6ce1c4', red: '#ff6b6b',
};
const tone = (t: string) => ({ good: C.mint, warn: C.gold, bad: C.red, mute: '#8aa0b4' } as const)[t as 'good'];

const Chip: React.FC<{ value: string; kind?: 'status' | 'confidence' }> = ({ value, kind }) => {
  if (!value) return <span style={{ color: C.faint }}>—</span>;
  const col = tone(kind === 'confidence' ? confidenceTone(value) : statusTone(value));
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 5, fontFamily: '"DM Mono", monospace', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: col, background: `${col}1f`, border: `1px solid ${col}55`, whiteSpace: 'nowrap' }}>{value}</span>;
};

const Para: React.FC<{ text: string }> = ({ text }) => (
  <>{(text || '').split(/\n+/).filter(Boolean).map((p, i) => (
    <p key={i} style={{ margin: '0 0 7px', fontSize: 12.5, lineHeight: 1.55, color: C.text }}>{p}</p>
  ))}</>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, margin: '18px 0 7px', display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.mint, boxShadow: `0 0 8px ${C.mint}` }} />{children}
  </div>
);

function Table({ def, rows }: { def: TableDef; rows: Record<string, string>[] }) {
  if (!rows?.length) return null;
  return (
    <div style={{ marginTop: 4 }}>
      <SectionTitle>{def.title}{def.note ? <span style={{ color: C.faint, letterSpacing: '0.1em' }}> · {def.note}</span> : null}</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>{def.cols.map(c => (
            <th key={c.key} style={{ textAlign: 'left', padding: '6px 10px', fontFamily: '"DM Mono", monospace', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.faint, borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap' }}>{c.label}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
              {def.cols.map(c => (
                <td key={c.key} style={{ padding: '7px 10px', color: C.text, verticalAlign: 'top', borderBottom: `1px solid ${C.line}` }}>
                  {c.kind === 'status' ? <Chip value={r[c.key]} /> : (r[c.key] || <span style={{ color: C.faint }}>—</span>)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ReportDoc: React.FC<{ data: ReportData }> = ({ data }) => {
  const t = templateById(data.templateId);
  const metaLine = t.meta.map(m => data.meta[m.key]).filter(Boolean).join('  ·  ');
  const generated = new Date().toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="cx-report-doc" style={{ background: C.bg, color: C.text, fontFamily: '"Manrope", system-ui, sans-serif', padding: '30px 34px', borderRadius: 14, border: `1px solid ${C.line}`, maxWidth: 820, margin: '0 auto' }}>
      {/* kicker band */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.line}`, paddingBottom: 12 }}>
        <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim }}>
          <span style={{ fontFamily: 'Michroma, sans-serif', color: C.text }}>CALI<span style={{ color: C.saffron }}>BREX</span></span>
          <span style={{ color: C.faint }}>  ·  {t.kicker}</span>
        </div>
        <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: tone(confidenceTone(data.confidence)) }}>{data.classification || 'CONFIDENTIAL'}</div>
      </div>

      {/* title */}
      <h1 style={{ fontFamily: 'Michroma, sans-serif', fontSize: 21, letterSpacing: '0.04em', color: C.text, margin: '16px 0 6px', lineHeight: 1.2 }}>
        {t.name}{data.tag ? <span style={{ color: C.gold }}> · {data.tag}</span> : null}
      </h1>
      {metaLine && <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 10.5, letterSpacing: '0.06em', color: C.dim, marginBottom: 2 }}>{metaLine}</div>}

      {/* blocks */}
      {t.layout.map((b, i) => {
        if (b.type === 'section') {
          const def = t.sections.find(s => s.key === b.key); const val = data.sections[b.key!];
          if (!def || !val?.trim()) return null;
          return <div key={i}><SectionTitle>{def.label}</SectionTitle><Para text={val} /></div>;
        }
        if (b.type === 'table') {
          const def = t.tables.find(tb => tb.key === b.key); if (!def) return null;
          return <Table key={i} def={def} rows={data.tables[b.key!] || []} />;
        }
        if (b.type === 'confidence') {
          return <div key={i} style={{ marginTop: 16 }}><SectionTitle>Confidence</SectionTitle><Chip value={data.confidence} kind="confidence" /></div>;
        }
        if (b.type === 'sources') {
          if (!data.sources?.length) return null;
          return (
            <div key={i}><SectionTitle>Sources</SectionTitle>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: C.dim, lineHeight: 1.6 }}>
                {data.sources.map((s, j) => (
                  <li key={j}>{s.name}{s.url ? <span style={{ color: C.faint }}> — {s.url}</span> : null}</li>
                ))}
              </ol>
            </div>
          );
        }
        return null;
      })}

      {/* footer */}
      <div style={{ marginTop: 22, paddingTop: 12, borderTop: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: '"DM Mono", monospace', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.faint }}>
        <span>{(data.preparedBy ? `Prepared by ${data.preparedBy} · ` : '')}Generated {generated}</span>
        <span style={{ color: C.gold }}>calibrex.org</span>
      </div>
    </div>
  );
};

export default ReportDoc;
