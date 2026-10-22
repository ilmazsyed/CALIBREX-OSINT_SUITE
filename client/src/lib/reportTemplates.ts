// The four Calibrex report formats, as structured schemas. A report is filled
// (by the analyst or by AI) into ReportData, then rendered by ReportDoc into
// the branded dark document that matches the Calibrex sample outputs and
// exports to PDF via the browser's print.

export type BlockType = 'section' | 'table' | 'confidence' | 'sources';
export interface MetaField { key: string; label: string; placeholder?: string }
export interface SectionDef { key: string; label: string; hint?: string }
export interface TableCol { key: string; label: string; kind?: 'text' | 'status'; options?: string[] }
export interface TableDef { key: string; title: string; note?: string; cols: TableCol[]; addLabel: string }
export interface Block { type: BlockType; key?: string }

export interface ReportTemplate {
  id: string;
  name: string;            // e.g. "Intelligence Brief"
  kicker: string;          // top band, e.g. "OSINT STUDIO · CALIBREX ATLAS"
  blurb: string;           // one-line description for the picker
  tag?: { label: string; placeholder: string };   // the "· MARITIME" style tag after the title
  meta: MetaField[];
  sections: SectionDef[];
  tables: TableDef[];
  confidence: boolean;
  sources: boolean;
  layout: Block[];         // exact top-to-bottom order of blocks in the document
}

// Shared status vocabularies (exactly as used in the sample outputs).
const ST_TIMELINE = ['OBSERVED', 'CORROBORATED', 'CONFIRMED', 'UNVERIFIED', 'CONTRADICTS'];
const ST_EVIDENCE = ['CONFIRMED', 'CORROBORATED', 'UNVERIFIED', 'NOT REPEATED'];
const ST_IMPACT = ['HIGH', 'MEDIUM', 'LOW', 'NONE'];
const ST_NEWSCHECK = ['CONFIRMED', 'CORROBORATED', 'UNVERIFIED · NOT USED', 'OLD PHOTO · NOT USED'];
const ST_LANG = ['PUBLISHED', 'IN EDIT', 'DRAFT'];
const ST_RUNDOWN = ['READY', 'APPROVAL', 'EDIT', 'DRAFT'];
export const CONFIDENCE_LEVELS = ['LOW', 'MODERATE', 'HIGH'] as const;

/** Colour tone for a status / confidence value in the rendered document. */
export function statusTone(v: string): 'good' | 'warn' | 'bad' | 'mute' {
  const s = (v || '').toUpperCase();
  if (/CONFIRM|CORROBOR|OBSERVED|PUBLISHED|READY|HIGH CONF|^HIGH$/.test(s) && !/NOT USED/.test(s)) {
    if (s === 'HIGH') return 'bad';            // HIGH impact is bad; HIGH confidence handled below
    return 'good';
  }
  if (/CONTRADICT|NOT USED|OLD PHOTO|NOT REPEATED/.test(s)) return 'bad';
  if (/UNVERIFIED|IN EDIT|DRAFT|APPROVAL|EDIT|MODERATE|MEDIUM/.test(s)) return 'warn';
  if (/LOW|NONE/.test(s)) return 'mute';
  return 'mute';
}
/** Confidence has its own tone (HIGH = good here, unlike HIGH impact). */
export function confidenceTone(v: string): 'good' | 'warn' | 'bad' {
  const s = (v || '').toUpperCase();
  if (s === 'HIGH') return 'good';
  if (s === 'LOW') return 'bad';
  return 'warn';
}

export const TEMPLATES: ReportTemplate[] = [
  {
    id: 'intel-brief',
    name: 'Intelligence Brief',
    kicker: 'OSINT STUDIO · CALIBREX ATLAS',
    blurb: 'Time-boxed situational brief with a timeline and assessment.',
    tag: { label: 'Desk / topic', placeholder: 'MARITIME' },
    meta: [
      { key: 'issued', label: 'Issued', placeholder: '06:30 UTC' },
      { key: 'coverage', label: 'Coverage window', placeholder: '01:47–06:00 UTC' },
      { key: 'distribution', label: 'Distribution', placeholder: 'Client team' },
    ],
    sections: [
      { key: 'bottomLine', label: 'Bottom line', hint: 'The one thing the reader must take away.' },
      { key: 'assessment', label: 'Assessment', hint: 'What it means — fact vs. inference, no forecast.' },
      { key: 'whatWouldChange', label: 'What would change our view', hint: 'The evidence that would flip the assessment.' },
      { key: 'indicators', label: 'Indicators to watch', hint: 'Concrete things to monitor next.' },
      { key: 'limits', label: 'Limits', hint: 'What this brief does not cover / confidence caveats.' },
    ],
    tables: [
      { key: 'timeline', title: 'Timeline · UTC', addLabel: 'Add event', cols: [
        { key: 'time', label: 'Time' }, { key: 'event', label: 'Event' },
        { key: 'source', label: 'Source' }, { key: 'status', label: 'Status', kind: 'status', options: ST_TIMELINE },
      ] },
    ],
    confidence: true, sources: true,
    layout: [
      { type: 'section', key: 'bottomLine' }, { type: 'table', key: 'timeline' },
      { type: 'section', key: 'assessment' }, { type: 'section', key: 'whatWouldChange' },
      { type: 'confidence' }, { type: 'section', key: 'indicators' }, { type: 'section', key: 'limits' },
      { type: 'sources' },
    ],
  },
  {
    id: 'risk-brief',
    name: 'Risk Brief',
    kicker: 'RISK & THREAT INTELLIGENCE',
    blurb: 'For leadership — exposure table, options and confidence.',
    tag: { label: 'Audience', placeholder: 'FOR LEADERSHIP' },
    meta: [
      { key: 'preparedFor', label: 'Prepared for', placeholder: 'COO and Head of Supply Chain' },
      { key: 'nextReview', label: 'Next review', placeholder: 'Friday 10:00 IST' },
    ],
    sections: [
      { key: 'bottomLine', label: 'Bottom line', hint: 'The decision-relevant takeaway in two sentences.' },
      { key: 'whatKnown', label: 'What is known', hint: 'Established facts, with sources.' },
      { key: 'whatNotKnown', label: 'What is not known', hint: 'The gaps that matter to the decision.' },
      { key: 'options', label: 'Options', hint: 'Courses of action, each with a trade-off.' },
    ],
    tables: [
      { key: 'exposure', title: 'Exposure', addLabel: 'Add exposure', cols: [
        { key: 'asset', label: 'Asset' }, { key: 'affected', label: 'What is affected' },
        { key: 'impact', label: 'Likely impact', kind: 'status', options: ST_IMPACT }, { key: 'when', label: 'When' },
      ] },
    ],
    confidence: true, sources: true,
    layout: [
      { type: 'section', key: 'bottomLine' }, { type: 'table', key: 'exposure' },
      { type: 'section', key: 'whatKnown' }, { type: 'section', key: 'whatNotKnown' },
      { type: 'section', key: 'options' }, { type: 'confidence' }, { type: 'sources' },
    ],
  },
  {
    id: 'supplier',
    name: 'Supplier Assessment',
    kicker: 'OSINT STUDIO',
    blurb: 'Due-diligence check: red flags, what checks out, evidence table.',
    tag: { label: 'Type', placeholder: 'DUE DILIGENCE' },
    meta: [
      { key: 'preparedFor', label: 'Prepared for', placeholder: 'Procurement committee' },
      { key: 'scope', label: 'Scope', placeholder: 'Public records, courts, media' },
      { key: 'status', label: 'Status', placeholder: 'Final draft' },
    ],
    sections: [
      { key: 'bottomLine', label: 'Bottom line', hint: 'Go / caution / no-go in one or two sentences.' },
      { key: 'redFlags', label: 'Red flags', hint: 'What a reviewer must not miss.' },
      { key: 'whatChecksOut', label: 'What checks out', hint: 'Claims that were independently confirmed.' },
      { key: 'scopeMethod', label: 'Scope and method', hint: 'What was searched and how.' },
      { key: 'gaps', label: 'Gaps', hint: 'What could not be verified.' },
      { key: 'recommendation', label: 'Recommendation', hint: 'The decision you advise, and conditions.' },
    ],
    tables: [
      { key: 'evidence', title: 'Evidence checked', addLabel: 'Add evidence', cols: [
        { key: 'source', label: 'Source' }, { key: 'claim', label: 'Claim' },
        { key: 'status', label: 'Status', kind: 'status', options: ST_EVIDENCE },
      ] },
    ],
    confidence: true, sources: true,
    layout: [
      { type: 'section', key: 'bottomLine' }, { type: 'section', key: 'redFlags' },
      { type: 'section', key: 'whatChecksOut' }, { type: 'section', key: 'scopeMethod' },
      { type: 'section', key: 'gaps' }, { type: 'table', key: 'evidence' },
      { type: 'confidence' }, { type: 'section', key: 'recommendation' }, { type: 'sources' },
    ],
  },
  {
    id: 'newsroom',
    name: 'Newsroom Story Sheet',
    kicker: 'CALIBREX NRCS',
    blurb: 'One story, end to end — hand-offs, source checks, language versions.',
    tag: { label: 'Strapline', placeholder: 'ONE STORY, END TO END' },
    meta: [
      { key: 'desk', label: 'Desk', placeholder: 'City desk' },
      { key: 'priority', label: 'Priority', placeholder: 'High' },
      { key: 'deadline', label: 'Deadline', placeholder: '18:30 IST' },
      { key: 'status', label: 'Status', placeholder: 'Ready' },
    ],
    sections: [
      { key: 'assignment', label: 'Assignment', hint: 'The story in a few sentences: what, who, why now.' },
    ],
    tables: [
      { key: 'handoffs', title: 'Hand-offs · every one recorded', addLabel: 'Add hand-off', cols: [
        { key: 'step', label: 'Step' }, { key: 'owner', label: 'Owner' }, { key: 'note', label: 'Note / time' },
      ] },
      { key: 'sourceChecks', title: 'Source checks', note: 'OSINT Studio starter, included with NRCS', addLabel: 'Add check', cols: [
        { key: 'source', label: 'Source' }, { key: 'claim', label: 'Claim' },
        { key: 'status', label: 'Status', kind: 'status', options: ST_NEWSCHECK },
      ] },
      { key: 'languages', title: 'Language versions · one story, one approval', addLabel: 'Add language', cols: [
        { key: 'language', label: 'Language' }, { key: 'status', label: 'Status', kind: 'status', options: ST_LANG },
      ] },
      { key: 'rundown', title: "Today's rundown", addLabel: 'Add item', cols: [
        { key: 'item', label: 'Item' }, { key: 'status', label: 'Status', kind: 'status', options: ST_RUNDOWN },
      ] },
    ],
    confidence: false, sources: false,
    layout: [
      { type: 'section', key: 'assignment' }, { type: 'table', key: 'handoffs' },
      { type: 'table', key: 'sourceChecks' }, { type: 'table', key: 'languages' }, { type: 'table', key: 'rundown' },
    ],
  },
];

export const templateById = (id: string) => TEMPLATES.find(t => t.id === id) || TEMPLATES[0];

export interface ReportData {
  templateId: string;
  tag: string;
  meta: Record<string, string>;
  sections: Record<string, string>;
  tables: Record<string, Record<string, string>[]>;
  confidence: string;
  sources: { name: string; url?: string }[];
  classification: string;
  preparedBy: string;
}

export function emptyReport(t: ReportTemplate): ReportData {
  return {
    templateId: t.id, tag: t.tag?.placeholder || '',
    meta: Object.fromEntries(t.meta.map(m => [m.key, ''])),
    sections: Object.fromEntries(t.sections.map(s => [s.key, ''])),
    tables: Object.fromEntries(t.tables.map(tb => [tb.key, []])),
    confidence: 'MODERATE', sources: [], classification: 'CONFIDENTIAL', preparedBy: '',
  };
}

/** A compact machine-readable schema the AI must fill (sent to the model). */
export function aiSchema(t: ReportTemplate): string {
  const obj: any = { sections: {}, tables: {} };
  for (const s of t.sections) obj.sections[s.key] = `string — ${s.label}: ${s.hint || ''}`;
  for (const tb of t.tables) {
    const colDesc: any = {};
    for (const c of tb.cols) colDesc[c.key] = c.kind === 'status' ? `one of [${(c.options || []).join(' | ')}]` : `string — ${c.label}`;
    obj.tables[tb.key] = [colDesc];
  }
  if (t.confidence) obj.confidence = 'one of [LOW | MODERATE | HIGH]';
  if (t.sources) obj.sources = [{ name: 'string', url: 'string (optional)' }];
  return JSON.stringify(obj);
}
