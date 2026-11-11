'use client';

import { useMemo, useRef, useState } from 'react';
import { compact } from '@/lib/format';

// Monthly organic traffic, Ahrefs and Semrush on one axis (same unit).
// Colours were checked for colour-blind separation; each line is also named
// in the legend and labelled at its end, so colour is never the only cue.
const SERIES = [
  { key: 'ahrefs', label: 'Ahrefs', color: '#7058AD' },
  { key: 'semrush', label: 'Semrush', color: '#12927F' },
];

const W = 720;
const H = 260;
const PAD = { top: 16, right: 72, bottom: 32, left: 52 };

const niceMax = (v) => {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
};

const monthLabel = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });

const TrafficChart = ({ history = [] }) => {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef(null);

  const points = useMemo(() => [...history].sort((a, b) => new Date(a.month) - new Date(b.month)), [history]);
  const series = SERIES.filter((s) => points.filter((p) => Number.isFinite(p[s.key])).length >= 2);

  if (points.length < 2 || !series.length) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
        The traffic trend appears once our team has checked this site in two different months.
      </p>
    );
  }

  const max = niceMax(Math.max(...points.flatMap((p) => series.map((s) => p[s.key] || 0))));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  const path = (key) =>
    points
      .map((p, i) => (Number.isFinite(p[key]) ? `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}` : null))
      .filter(Boolean)
      .map((pt, i) => `${i ? 'L' : 'M'}${pt}`)
      .join(' ');

  const onMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    setHover(best);
  };

  const last = points.length - 1;
  const hp = hover !== null ? points[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex items-center gap-4 text-[13px] text-ink-soft" aria-label="Legend">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden="true" />
              {s.label} organic traffic
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setShowTable((v) => !v)} className="text-[13px] font-medium text-brand-700 hover:underline">
          {showTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-[12px] text-ink-soft">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Month</th>
                {series.map((s) => <th key={s.key} scope="col" className="px-3 py-2 text-right font-semibold">{s.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {points.map((p) => (
                <tr key={String(p.month)}>
                  <td className="px-3 py-2 text-ink-soft">{monthLabel(p.month)}</td>
                  {series.map((s) => <td key={s.key} className="px-3 py-2 text-right tabular-nums">{Number.isFinite(p[s.key]) ? p[s.key].toLocaleString() : '–'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full touch-none select-none"
            role="img"
            aria-label={`Monthly organic traffic from ${monthLabel(points[0].month)} to ${monthLabel(points[last].month)}`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" />
                <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-faint)">{compact(t)}</text>
              </g>
            ))}
            {points.map((p, i) => (
              (points.length <= 7 || i % 2 === last % 2) && (
                <text key={String(p.month)} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--color-ink-faint)">{monthLabel(p.month)}</text>
              )
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--color-slate-300)" strokeWidth="1" />}
            {series.map((s) => (
              <g key={s.key}>
                <path d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {Number.isFinite(points[last][s.key]) && (
                  <text x={x(last) + 8} y={y(points[last][s.key]) + 4} fontSize="11" fontWeight="600" fill="var(--color-ink-soft)">{s.label}</text>
                )}
                {hover !== null && Number.isFinite(hp[s.key]) && (
                  <circle cx={x(hover)} cy={y(hp[s.key])} r="4.5" fill={s.color} stroke="#fff" strokeWidth="2" />
                )}
              </g>
            ))}
          </svg>
          {hp && (
            <div
              className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border border-line bg-white px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]"
              style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > points.length / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}
            >
              <p className="mb-1 font-semibold text-ink">{monthLabel(hp.month)}</p>
              {series.map((s) => (
                <p key={s.key} className="flex items-center justify-between gap-4 text-ink-soft">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
                  <span className="font-semibold tabular-nums text-ink">{Number.isFinite(hp[s.key]) ? hp[s.key].toLocaleString() : '–'}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrafficChart;
