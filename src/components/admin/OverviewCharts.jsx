'use client';

import { useRef, useState } from 'react';
import { money } from '@/lib/format';

// Order value per day: this period (brand purple, solid) against the previous
// period (muted grey, dashed) on one axis. Legend names both lines, the
// tooltip shows both values, and a table view is one click away.
const W = 760;
const H = 280;
const PAD = { top: 16, right: 16, bottom: 30, left: 56 };
const CURRENT = '#7058AD';
const PREVIOUS = '#9C97B3';

const niceMax = (v) => {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
};
const dayLabel = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const short = (v) => (v >= 1000 ? `$${+(v / 1000).toFixed(1)}K` : `$${Math.round(v)}`);

export const OrderValueChart = ({ series = [] }) => {
  const [hover, setHover] = useState(null);
  const [table, setTable] = useState(false);
  const svgRef = useRef(null);
  const n = series.length;
  const max = niceMax(Math.max(0, ...series.flatMap((p) => [p.value, p.previous])));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => PAD.top + innerH - (v / max) * innerH;
  const line = (key) => series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const every = Math.max(1, Math.ceil(n / 7));

  const onMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - PAD.left) / innerW) * (n - 1)))));
  };
  const hp = hover !== null ? series[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-4 text-[13px] text-ink-soft">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: CURRENT }} /> This period</span>
        <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: PREVIOUS }} /> Previous period</span>
        <button type="button" onClick={() => setTable((t) => !t)} className="font-medium text-brand-700 hover:underline">{table ? 'Chart' : 'Table'}</button>
      </div>
      {table ? (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-canvas text-[12px] text-ink-soft">
              <tr><th className="px-3 py-2 text-left font-semibold">Day</th><th className="px-3 py-2 text-right font-semibold">Orders</th><th className="px-3 py-2 text-right font-semibold">Value</th><th className="px-3 py-2 text-right font-semibold">Previous period</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {series.map((p) => (
                <tr key={p.day}><td className="px-3 py-1.5 text-ink-soft">{dayLabel(p.day)}</td><td className="px-3 py-1.5 text-right tabular-nums">{p.orders}</td><td className="px-3 py-1.5 text-right tabular-nums">{money(p.value)}</td><td className="px-3 py-1.5 text-right tabular-nums text-ink-soft">{money(p.previous)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none select-none" role="img" aria-label="Order value per day, this period against the previous one" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t * max)} y2={y(t * max)} stroke="var(--color-line)" />
                <text x={PAD.left - 10} y={y(t * max) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-faint)">{short(t * max)}</text>
              </g>
            ))}
            {series.map((p, i) => (i % every === (n - 1) % every) && (
              <text key={p.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink-faint)">{dayLabel(p.day)}</text>
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--color-slate-300)" />}
            <path d={line('previous')} fill="none" stroke={PREVIOUS} strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
            <path d={line('value')} fill="none" stroke={CURRENT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {hp && <circle cx={x(hover)} cy={y(hp.value)} r="4.5" fill={CURRENT} stroke="#fff" strokeWidth="2" />}
          </svg>
          {hp && (
            <div className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-line bg-white px-3 py-2 text-[12px] shadow-[var(--shadow-pop)]" style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > n / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}>
              <p className="mb-1 font-semibold text-ink">{dayLabel(hp.day)}</p>
              <p className="flex justify-between gap-4 text-ink-soft"><span>This period</span><span className="font-semibold tabular-nums text-ink">{money(hp.value)}</span></p>
              <p className="flex justify-between gap-4 text-ink-soft"><span>Orders</span><span className="font-semibold tabular-nums text-ink">{hp.orders}</span></p>
              <p className="flex justify-between gap-4 text-ink-soft"><span>Previous</span><span className="tabular-nums">{money(hp.previous)}</span></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Listings by status. These are real states (live / waiting / rejected), so
// they use the status colours, each with its name and count beside it.
export const StatusDonut = ({ parts = [], total, label }) => {
  const [hover, setHover] = useState(null);
  const R = 70;
  const C = 2 * Math.PI * R;
  const sum = parts.reduce((s, p) => s + p.value, 0);
  let offset = 0;
  return (
    <div>
      <div className="relative mx-auto h-[200px] w-[200px]">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" role="img" aria-label={parts.map((p) => `${p.label}: ${p.value}`).join(', ')}>
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--color-line-soft)" strokeWidth="22" />
          {sum > 0 && parts.map((p, i) => {
            const len = (p.value / sum) * C;
            // A 2px surface gap between segments.
            const seg = (
              <circle
                key={p.label}
                cx="100" cy="100" r={R} fill="none" stroke={p.color} strokeWidth={hover === i ? 26 : 22}
                strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-offset}
                onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
                className="transition-[stroke-width]"
              />
            );
            offset += len;
            return p.value ? seg : null;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-bold tabular-nums text-ink">{hover !== null ? parts[hover].value : total}</span>
          <span className="text-[13px] text-ink-soft">{hover !== null ? parts[hover].label : label}</span>
        </div>
      </div>
      <ul className="mt-5 space-y-2.5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between text-[14px]">
            <span className="flex items-center gap-2 text-ink"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.label}</span>
            <span className="tabular-nums"><span className="font-semibold text-ink">{p.value.toLocaleString()}</span> <span className="text-[12px] text-ink-faint">{sum ? Math.round((p.value / sum) * 100) : 0}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
};
