import React, { useMemo, useState } from 'react';
import { SeriesPoint } from '../lib/markets';

const RANGES: { label: string; days: number }[] = [
  { label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 182 }, { label: '1Y', days: 365 }, { label: 'Max', days: 100000 },
];

/** Interactive SVG line chart — no external chart library (CSP-safe). Range toggle + hover readout. */
const LineChart: React.FC<{ series: SeriesPoint[]; dp?: number; label?: string }> = ({ series, dp = 2, label }) => {
  const [range, setRange] = useState(90);
  const [hover, setHover] = useState<number | null>(null);

  const data = useMemo(() => series.slice(-range), [series, range]);
  const W = 640, H = 240, PAD = 8;
  const geom = useMemo(() => {
    if (data.length < 2) return null;
    const vals = data.map(d => d.close);
    const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
    const x = (i: number) => PAD + (i / (data.length - 1)) * (W - 2 * PAD);
    const y = (v: number) => PAD + (1 - (v - min) / rng) * (H - 2 * PAD);
    const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.close).toFixed(1)}`).join(' ');
    return { min, max, x, y, pts, vals };
  }, [data]);

  if (!geom) return <div className="h-[240px] flex items-center justify-center text-sm text-calibrex-muted">Not enough history to chart.</div>;

  const up = data[data.length - 1].close >= data[0].close;
  const color = up ? '#3fb950' : '#ff5555';
  const hi = hover != null ? data[hover] : null;
  const changePct = ((data[data.length - 1].close - data[0].close) / (data[0].close || 1)) * 100;
  const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-calibrex-muted">
          {label && <span className="text-white font-bold mr-2">{label}</span>}
          <span className={up ? 'text-calibrex-low' : 'text-calibrex-critical'}>{changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}% over range</span>
        </div>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button key={r.label} onClick={() => setRange(r.days)} className={`px-2 py-0.5 rounded text-[10px] font-bold ${range === r.days ? 'bg-calibrex-teal/20 text-calibrex-teal' : 'text-calibrex-muted hover:text-white'}`}>{r.label}</button>
          ))}
        </div>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none"
          onMouseLeave={() => setHover(null)}
          onMouseMove={e => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const rel = (e.clientX - rect.left) / rect.width;
            setHover(Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1)))));
          }}>
          <polyline points={geom.pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          {hi && hover != null && <>
            <line x1={geom.x(hover)} y1={PAD} x2={geom.x(hover)} y2={H - PAD} stroke="#ffffff30" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={geom.x(hover)} cy={geom.y(hi.close)} r="3" fill={color} />
          </>}
        </svg>
        <div className="flex justify-between text-[10px] text-calibrex-muted mt-1 tabular-nums">
          <span>{data[0].date}</span>
          <span>{hi ? `${hi.date} · ${fmt(hi.close)}` : `high ${fmt(geom.max)} · low ${fmt(geom.min)}`}</span>
          <span>{data[data.length - 1].date}</span>
        </div>
      </div>
    </div>
  );
};

export default LineChart;
