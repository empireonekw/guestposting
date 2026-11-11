'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, Cloud, Server, LayoutGrid, KeyRound, Globe, ShoppingCart, MessageSquare, ShieldCheck, UserCircle, Mail,
  Database, Send, Timer, CreditCard, ZoomIn, ZoomOut, Maximize, Expand, X, CheckCircle2, AlertTriangle, Pause, Play, Code2,
} from 'lucide-react';
import api from '@/lib/api';

// ---- Layout -------------------------------------------------------------

const W = 236;
const H = 64;
const COLS = { visitors: 30, edge: 340, server: 650, apis: 980, services: 1330 };
const CANVAS_W = 1600;
const CANVAS_H = 830;
const ROW = (i) => 70 + i * 92;
const MID_Y = ROW(3.5);

const ICONS = {
  visitors: Users, edge: Cloud, server: Server, pages: LayoutGrid, auth: KeyRound, listings: Globe, orders: ShoppingCart,
  messages: MessageSquare, admin: ShieldCheck, users: UserCircle, contact: Mail, mongodb: Database, email: Send, jobs: Timer, payments: CreditCard,
};

const POS = {
  visitors: { x: COLS.visitors, y: MID_Y },
  edge: { x: COLS.edge, y: MID_Y },
  server: { x: COLS.server, y: MID_Y },
  pages: { x: COLS.apis, y: ROW(0) },
  auth: { x: COLS.apis, y: ROW(1) },
  listings: { x: COLS.apis, y: ROW(2) },
  orders: { x: COLS.apis, y: ROW(3) },
  messages: { x: COLS.apis, y: ROW(4) },
  admin: { x: COLS.apis, y: ROW(5) },
  users: { x: COLS.apis, y: ROW(6) },
  contact: { x: COLS.apis, y: ROW(7) },
  email: { x: COLS.services, y: ROW(1) },
  mongodb: { x: COLS.services, y: MID_Y },
  jobs: { x: COLS.services, y: ROW(5.6) },
  payments: { x: COLS.services, y: ROW(7) },
};

const COLUMN_LABELS = [
  ['Visitors', COLS.visitors], ['Edge', COLS.edge], ['Gateway', COLS.server], ['Pages & APIs', COLS.apis], ['Services', COLS.services],
];

// Which box talks to which.
const LINKS = [
  ['visitors', 'edge'], ['edge', 'server'],
  ...['pages', 'auth', 'listings', 'orders', 'messages', 'admin', 'users', 'contact'].map((id) => ['server', id]),
  ['server', 'jobs', 'jobs'],
  ['pages', 'mongodb'], ['auth', 'mongodb'], ['listings', 'mongodb'], ['orders', 'mongodb'], ['messages', 'mongodb'],
  ['admin', 'mongodb'], ['users', 'mongodb'], ['jobs', 'mongodb', 'side'],
  ['auth', 'email'], ['orders', 'email'], ['messages', 'email'], ['admin', 'email'], ['contact', 'email'],
  ['orders', 'payments'],
];

const R = 10;
// Right-angled wire with rounded corners, through a vertical "bus" at busX.
const wire = (x1, y1, x2, y2, busX) => {
  if (Math.abs(y1 - y2) < 1) return `M${x1},${y1} H${x2}`;
  const dir = y2 > y1 ? 1 : -1;
  return `M${x1},${y1} H${busX - R} Q${busX},${y1} ${busX},${y1 + dir * R} V${y2 - dir * R} Q${busX},${y2} ${busX + R},${y2} H${x2}`;
};

const pathFor = ([from, to, kind]) => {
  const a = POS[from];
  const b = POS[to];
  if (kind === 'jobs') {
    // Server → scheduled jobs, under the API column.
    const x1 = a.x + W / 2;
    const y1 = a.y + H;
    const yb = CANVAS_H - 30;
    const xb = COLS.services - 34;
    return `M${x1},${y1} V${yb - R} Q${x1},${yb} ${x1 + R},${yb} H${xb - R} Q${xb},${yb} ${xb},${yb - R} V${b.y + H / 2 + R} Q${xb},${b.y + H / 2} ${xb + R},${b.y + H / 2} H${b.x}`;
  }
  if (kind === 'side') {
    // Jobs → MongoDB, both in the services column: along the right side.
    const x = a.x + W;
    const xr = x + 28;
    return `M${x},${a.y + H / 2} H${xr - R} Q${xr},${a.y + H / 2} ${xr},${a.y + H / 2 - R} V${b.y + H / 2 + R} Q${xr},${b.y + H / 2} ${xr - R},${b.y + H / 2} H${x}`;
  }
  const x1 = a.x + W;
  const x2 = b.x;
  const busX = from === 'server' ? (x1 + x2) / 2 : x1 + (x2 - x1) * 0.5;
  return wire(x1, a.y + H / 2, x2, b.y + H / 2, busX);
};

// ---- Helpers --------------------------------------------------------------

const STATUS = {
  ok: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Working', ring: 'border-line' },
  idle: { dot: 'bg-slate-300', text: 'text-ink-faint', label: 'No traffic', ring: 'border-line' },
  warn: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Needs a look', ring: 'border-amber-300' },
  error: { dot: 'bg-red-600', text: 'text-red-700', label: 'Errors', ring: 'border-red-300' },
  planned: { dot: 'bg-white border border-slate-300', text: 'text-ink-faint', label: 'Not built yet', ring: 'border-dashed border-slate-300' },
};

const ago = (t) => {
  if (!t) return 'never';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
};
const fmtMs = (v) => (v === null || v === undefined ? '–' : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`);

const useReducedMotion = () => {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setR(mq.matches);
    const on = () => setR(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
};

// Requests per minute for the last 15 minutes; server errors in red.
const MinuteBars = ({ series = [] }) => {
  const max = Math.max(1, ...series.map((b) => b.n));
  return (
    <div>
      <div className="flex h-20 items-end gap-[3px]" role="img" aria-label={`Requests per minute, last 15 minutes: ${series.map((b) => b.n).join(', ')}`}>
        {series.map((b, i) => (
          <div key={i} className="flex flex-1 flex-col justify-end" title={`${15 - i} min ago: ${b.n} requests${b.e ? `, ${b.e} errors` : ''}`}>
            {b.e > 0 && <div className="rounded-t-[3px] bg-red-500" style={{ height: `${(b.e / max) * 100}%`, minHeight: 2 }} />}
            <div className={`${b.e ? '' : 'rounded-t-[3px]'} bg-brand-400`} style={{ height: `${((b.n - b.e) / max) * 100}%`, minHeight: b.n - b.e > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink-faint"><span>15 min ago</span><span>now</span></div>
    </div>
  );
};

// ---- Page -----------------------------------------------------------------

const CodeFlow = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [, setTick] = useState(0);
  const wrapRef = useRef(null);
  const drag = useRef(null);
  const reduced = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get('/admin/system');
      setData(d);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the system status.');
    }
  }, []);

  useEffect(() => {
    load();
    if (paused) return undefined;
    const t = setInterval(() => { if (!document.hidden) load(); }, 5000);
    return () => clearInterval(t);
  }, [load, paused]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const nodes = useMemo(() => Object.fromEntries((data?.nodes || []).map((n) => [n.id, n])), [data]);

  // Fit the whole diagram in the box on first load.
  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const k = Math.min(1, (el.clientWidth - 24) / CANVAS_W, (el.clientHeight - 24) / CANVAS_H);
    setView({ k, x: (el.clientWidth - CANVAS_W * k) / 2, y: 12 });
  }, []);
  useEffect(() => { fit(); }, [fit]);

  const zoomAt = (factor, cx, cy) => {
    setView((v) => {
      const k = Math.min(2, Math.max(0.35, v.k * factor));
      const f = k / v.k;
      return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
    });
  };
  const zoomButton = (factor) => {
    const el = wrapRef.current;
    zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2);
  };

  // Ctrl/Cmd + scroll zooms; plain scroll keeps scrolling the page.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e) => {
    if (e.target.closest('[data-node]') || e.target.closest('[data-panel]')) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    setView((v) => ({ ...v, x: drag.current.vx + e.clientX - drag.current.x, y: drag.current.vy + e.clientY - drag.current.y }));
  };
  const onPointerUp = () => { drag.current = null; };

  const fullscreen = () => {
    const el = wrapRef.current?.parentElement;
    if (!document.fullscreenElement) el?.requestFullscreen?.().then(() => setTimeout(fit, 100));
    else document.exitFullscreen?.().then(() => setTimeout(fit, 100));
  };

  const linked = (id) => LINKS.filter(([a, b]) => a === id || b === id);
  const hoverSet = hover ? new Set([hover, ...linked(hover).flat()]) : null;

  const edgeState = ([from, to]) => {
    const a = nodes[from];
    const b = nodes[to];
    if (!a || !b) return 'idle';
    if (b.status === 'planned') return 'planned';
    if (a.status === 'error' || b.status === 'error') return 'error';
    const busy = from === 'visitors' || from === 'edge' || from === 'server' ? nodes.visitors?.stats?.perMin > 0 : (a.stats?.perMin > 0 || (a.id === 'jobs' && a.status !== 'idle'));
    return busy ? 'live' : 'idle';
  };

  const issueCount = (data?.nodes || []).filter((n) => n.status === 'error' || n.status === 'warn').length;
  const sel = selected ? nodes[selected] : null;

  return (
    <div className="pb-4">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight text-ink"><Code2 className="text-brand-600" /> Code flow</h1>
          <p className="mt-1 text-[15px] text-ink-soft">
            Every request, live: from visitors through Cloudflare and the server to each API and the services behind it. Last {data?.windowMinutes || 15} minutes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium shadow-[var(--shadow-card)] ${issueCount ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-line bg-white text-ink-soft'}`}>
            {issueCount ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} className="text-success" />}
            {issueCount ? `${issueCount} ${issueCount === 1 ? 'box needs' : 'boxes need'} a look` : 'All systems working'}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-[13px] text-ink-soft shadow-[var(--shadow-card)]">
            <span className={`h-2 w-2 rounded-full ${paused ? 'bg-ink-faint' : 'animate-pulse bg-success'}`} />
            {paused ? 'Paused' : 'Live'}{data && ` · ${ago(data.generatedAt)}`}
          </span>
          <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume' : 'Pause'} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink-soft shadow-[var(--shadow-card)] hover:text-ink">
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <div className="relative overflow-hidden rounded-3xl border border-line bg-white shadow-[var(--shadow-card)]">
        <div
          ref={wrapRef}
          className="relative h-[calc(100vh-230px)] min-h-[560px] cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
          style={{ backgroundImage: 'radial-gradient(var(--color-slate-300) 1px, transparent 1px)', backgroundSize: '22px 22px', backgroundPosition: `${view.x}px ${view.y}px` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="absolute left-0 top-0 origin-top-left" style={{ width: CANVAS_W, height: CANVAS_H, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
            {COLUMN_LABELS.map(([label, x]) => (
              <p key={label} className="absolute top-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-faint" style={{ left: x, width: W, textAlign: 'center' }}>{label}</p>
            ))}

            <svg width={CANVAS_W} height={CANVAS_H} className="absolute inset-0" aria-hidden="true">
              {LINKS.map((l) => {
                const [from, to] = l;
                const id = `w-${from}-${to}`;
                const state = edgeState(l);
                const dim = hoverSet && !(hoverSet.has(from) && hoverSet.has(to) && (from === hover || to === hover));
                const color = state === 'error' ? '#dc2626' : state === 'live' ? 'var(--color-brand-400)' : 'var(--color-slate-300)';
                const strong = hover && (from === hover || to === hover);
                return (
                  <g key={id} opacity={dim ? 0.15 : 1}>
                    <path id={id} d={pathFor(l)} fill="none" stroke={color} strokeWidth={strong ? 3 : 2} strokeDasharray={state === 'idle' || state === 'planned' ? '5 5' : undefined} />
                    {!reduced && !paused && (state === 'live' || state === 'error') && (
                      <circle r="4.5" fill={state === 'error' ? '#dc2626' : 'var(--color-brand-600)'} stroke="#fff" strokeWidth="1.5">
                        <animateMotion dur={state === 'error' ? '1.6s' : '2.6s'} repeatCount="indefinite">
                          <mpath href={`#${id}`} />
                        </animateMotion>
                      </circle>
                    )}
                  </g>
                );
              })}
              {/* Connection points */}
              {Object.entries(POS).map(([id, p]) => (
                <g key={`p-${id}`} opacity={hoverSet && !hoverSet.has(id) ? 0.2 : 1}>
                  {id !== 'visitors' && <circle cx={p.x} cy={p.y + H / 2} r="3.5" fill="var(--color-slate-400)" />}
                  {!['email', 'mongodb', 'payments'].includes(id) && <circle cx={p.x + W} cy={p.y + H / 2} r="3.5" fill="var(--color-slate-400)" />}
                </g>
              ))}
            </svg>

            {Object.entries(POS).map(([id, p]) => {
              const n = nodes[id];
              const Icon = ICONS[id];
              const st = STATUS[n?.status || 'idle'];
              const dim = hoverSet && !hoverSet.has(id);
              const label = n?.label || (id.length < 9 && !['visitors', 'edge', 'server', 'pages', 'mongodb', 'email', 'jobs', 'payments'].includes(id) ? `/api/${id}` : id);
              return (
                <button
                  key={id}
                  type="button"
                  data-node
                  onMouseEnter={() => setHover(id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(id)}
                  onBlur={() => setHover(null)}
                  onClick={() => setSelected(id)}
                  aria-label={`${label}: ${st.label}. ${n?.line || ''}`}
                  style={{ left: p.x, top: p.y, width: W, height: H, opacity: dim ? 0.35 : 1 }}
                  className={`absolute flex items-center gap-3 rounded-2xl border bg-white px-3 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 ${selected === id ? 'border-brand-500 ring-4 ring-brand-500/15' : st.ring}`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${n?.status === 'error' ? 'bg-red-50 text-red-600' : n?.status === 'warn' ? 'bg-amber-50 text-amber-700' : n?.status === 'idle' || n?.status === 'planned' || !n ? 'bg-line-soft text-ink-faint' : 'bg-brand-50 text-brand-600'}`}>
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-ink">{label}</span>
                    <span className={`block truncate text-[12.5px] ${n?.status === 'error' ? 'text-red-700' : 'text-ink-soft'}`}>{n?.line || 'Loading…'}</span>
                  </span>
                  <span className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full ${st.dot}`} aria-hidden="true" />
                </button>
              );
            })}
          </div>

          {/* Controls */}
          <div data-panel className="absolute bottom-4 left-4 flex items-center overflow-hidden rounded-xl border border-line bg-white text-ink-soft shadow-[var(--shadow-card)]">
            <button type="button" onClick={() => zoomButton(0.85)} aria-label="Zoom out" className="flex h-9 w-9 items-center justify-center hover:bg-canvas"><ZoomOut size={16} /></button>
            <button type="button" onClick={() => setView((v) => ({ ...v, k: 1 }))} className="h-9 border-x border-line px-2.5 text-[13px] font-medium tabular-nums hover:bg-canvas" aria-label="Reset zoom to 100%">{Math.round(view.k * 100)}%</button>
            <button type="button" onClick={() => zoomButton(1.15)} aria-label="Zoom in" className="flex h-9 w-9 items-center justify-center hover:bg-canvas"><ZoomIn size={16} /></button>
            <button type="button" onClick={fit} aria-label="Fit to screen" className="flex h-9 w-9 items-center justify-center border-l border-line hover:bg-canvas"><Maximize size={15} /></button>
            <button type="button" onClick={fullscreen} aria-label="Full screen" className="flex h-9 w-9 items-center justify-center border-l border-line hover:bg-canvas"><Expand size={15} /></button>
          </div>
          <p className="pointer-events-none absolute bottom-6 left-[230px] hidden text-[12px] text-ink-faint md:block">Hover a box to see its connections · Drag to move · Ctrl + scroll to zoom</p>

          {/* Details panel */}
          {sel && (
            <aside data-panel className="absolute inset-y-3 right-3 flex w-[360px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-pop)]">
              <div className="flex items-start justify-between gap-3 border-b border-line p-4">
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold text-ink">{sel.label}</p>
                  <p className="text-[12px] text-ink-faint">{sel.about}</p>
                </div>
                <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="rounded-md p-1 text-ink-faint hover:bg-canvas hover:text-ink"><X size={16} /></button>
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto p-4 text-[13px]">
                <p className={`inline-flex items-center gap-2 font-semibold ${STATUS[sel.status].text}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS[sel.status].dot}`} /> {STATUS[sel.status].label} · <span className="font-normal text-ink-soft">{sel.line}</span>
                </p>

                <section>
                  <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-faint">What&apos;s wrong</h3>
                  {sel.issues.length ? (
                    <ul className="space-y-2">
                      {sel.issues.map((t) => (
                        <li key={t} className={`flex gap-2 rounded-lg px-3 py-2 ${sel.status === 'error' ? 'bg-red-50 text-red-900' : 'bg-amber-50 text-amber-900'}`}>
                          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="flex items-center gap-2 text-ink-soft"><CheckCircle2 size={14} className="text-success" /> {sel.status === 'planned' ? 'This part is not built yet.' : sel.status === 'idle' ? 'Nothing wrong. No traffic in this window.' : 'Nothing wrong.'}</p>
                  )}
                </section>

                {sel.series && (
                  <section>
                    <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-faint">Requests per minute</h3>
                    <MinuteBars series={sel.series} />
                  </section>
                )}

                {sel.stats && Object.keys(sel.stats).length > 0 && sel.id !== 'jobs' && (
                  <section>
                    <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-faint">Numbers</h3>
                    <dl className="grid grid-cols-2 gap-2">
                      {Object.entries({
                        'Requests / min': sel.stats.perMin,
                        [`Requests (${data.windowMinutes} min)`]: sel.stats.total,
                        'Typical time (p50)': sel.stats.p50 !== undefined ? fmtMs(sel.stats.p50) : undefined,
                        'Slowest 5% (p95)': sel.stats.p95 !== undefined ? fmtMs(sel.stats.p95) : undefined,
                        'Server errors': sel.stats.serverErrors,
                        'Refused (4xx)': sel.stats.clientErrors,
                        'Last request': sel.stats.lastAt !== undefined ? ago(sel.stats.lastAt) : undefined,
                        People: sel.stats.visitors,
                        'Via Cloudflare': sel.stats.viaCloudflare !== undefined ? (sel.stats.viaCloudflare === null ? '–' : `${sel.stats.viaCloudflare}%`) : undefined,
                        'Via nginx': sel.stats.viaProxy !== undefined ? (sel.stats.viaProxy === null ? '–' : `${sel.stats.viaProxy}%`) : undefined,
                        Uptime: sel.stats.uptimeMin !== undefined ? `${sel.stats.uptimeMin} min` : undefined,
                        Memory: sel.stats.memoryMb !== undefined ? `${sel.stats.memoryMb} MB` : undefined,
                        Node: sel.stats.node,
                        Database: sel.stats.name,
                        Connection: sel.stats.state,
                        Ping: sel.stats.ping !== undefined ? fmtMs(sel.stats.ping) : undefined,
                        Configured: sel.stats.configured !== undefined ? (sel.stats.configured ? 'Yes' : 'No') : undefined,
                        Sent: sel.stats.sent,
                        Failed: sel.stats.failed,
                      }).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-canvas px-3 py-2">
                          <dt className="text-[11px] text-ink-faint">{k}</dt>
                          <dd className="font-semibold tabular-nums text-ink">{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}

                {sel.id === 'jobs' && (
                  <section>
                    <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-faint">Jobs</h3>
                    <ul className="space-y-2">
                      {sel.stats.jobs.map((j) => (
                        <li key={j.name} className="rounded-lg bg-canvas px-3 py-2">
                          <p className="flex items-center justify-between gap-2 font-semibold text-ink">
                            {j.name}
                            <span className={`h-2 w-2 rounded-full ${j.lastStatus === 'error' ? 'bg-red-600' : j.lastStatus === 'ok' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          </p>
                          <p className="text-[12px] text-ink-faint">Last run {j.lastRunAt ? new Date(j.lastRunAt).toLocaleString() : 'never'} · {j.runs || 0} runs</p>
                          <p className={`text-[12px] ${j.lastError && j.lastStatus === 'error' ? 'text-red-700' : 'text-ink-soft'}`}>{j.lastStatus === 'error' ? j.lastError : j.lastResult}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {sel.recentErrors?.length > 0 && (
                  <section>
                    <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-faint">Recent errors</h3>
                    <ul className="space-y-2">
                      {sel.recentErrors.map((e) => (
                        <li key={`${e.t}-${e.path}`} className="rounded-lg border border-red-100 bg-red-50/60 px-3 py-2">
                          <p className="flex justify-between gap-2 font-mono text-[12px] text-red-800"><span className="truncate">{e.s} {e.path}</span><span className="shrink-0 text-red-600">{ago(e.t)}</span></p>
                          <p className="mt-0.5 break-words text-[12px] text-red-900">{e.message}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
      <p className="mt-3 text-[13px] text-ink-faint">
        Click any box to see its traffic, errors and what&apos;s wrong. Numbers are kept in the server&apos;s memory for {data?.windowMinutes || 15} minutes and reset when the site restarts.
      </p>
    </div>
  );
};

export default CodeFlow;
