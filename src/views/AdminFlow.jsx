'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Workflow, Globe, ShoppingCart, PenLine, CheckCircle2, XCircle, UserPlus, UserCheck, Inbox, BadgeCheck, Ban,
  ClipboardCheck, LifeBuoy, Clock, MessageSquareReply, MessagesSquare, AlertTriangle, ExternalLink, Pause, Play, RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';

// Canvas layout of each flow. Coordinates are the node's top-left corner on
// a 1120 x 400 canvas.
const NODE_W = 200;
const NODE_H = 84;
const FLOWS = [
  {
    id: 'selling',
    name: 'Selling flow',
    about: 'Buyers order guest posts on live sites; sellers publish them.',
    nodes: [
      { id: 'selling.sites', label: 'Live sites', icon: Globe, x: 30, y: 158, about: 'Websites buyers can order right now.' },
      { id: 'selling.placed', label: 'Order placed', icon: ShoppingCart, x: 310, y: 158, about: 'Waiting for the buyer to send the brief.' },
      { id: 'selling.writing', label: 'In progress', icon: PenLine, x: 590, y: 158, about: 'The seller is writing and publishing the post.' },
      { id: 'selling.published', label: 'Published', icon: CheckCircle2, x: 880, y: 70, about: 'The post is live with the buyer’s link.' },
      { id: 'selling.cancelled', label: 'Cancelled', icon: XCircle, x: 880, y: 262, about: 'Orders the seller rejected or that were cancelled.' },
    ],
    edges: [
      ['selling.sites', 'selling.placed', 'Orders'],
      ['selling.placed', 'selling.writing', 'Brief sent'],
      ['selling.writing', 'selling.published', 'Published'],
      ['selling.placed', 'selling.cancelled', 'Cancelled'],
    ],
  },
  {
    id: 'listing',
    name: 'Listing flow',
    about: 'Sellers join, add websites, our team reviews them and checks their metrics.',
    nodes: [
      { id: 'listing.sellers', label: 'Sellers', icon: UserPlus, x: 20, y: 158, about: 'Every seller account.' },
      { id: 'listing.sellerReview', label: 'Seller approval', icon: UserCheck, x: 245, y: 158, about: 'New sellers waiting for an admin to approve them.' },
      { id: 'listing.submitted', label: 'Site review', icon: Inbox, x: 470, y: 158, about: 'Websites waiting for approval.' },
      { id: 'listing.live', label: 'Live', icon: BadgeCheck, x: 695, y: 70, about: 'Approved websites. Problems are sites a metrics check flagged.' },
      { id: 'listing.rejected', label: 'Rejected', icon: Ban, x: 695, y: 262, about: 'Websites that were not approved.' },
      { id: 'listing.metrics', label: 'Metrics check', icon: ClipboardCheck, x: 910, y: 70, about: 'Live sites and whether our team has checked their numbers in the last 30 days.' },
    ],
    edges: [
      ['listing.sellers', 'listing.sellerReview', 'Sign-ups'],
      ['listing.sellerReview', 'listing.submitted', 'Sites added'],
      ['listing.submitted', 'listing.live', 'Approved'],
      ['listing.submitted', 'listing.rejected', 'Rejected'],
      ['listing.live', 'listing.metrics', 'Checked'],
    ],
  },
  {
    id: 'support',
    name: 'Support & chat',
    about: 'Questions to the LetRank team, and buyers talking to sellers.',
    nodes: [
      { id: 'support.questions', label: 'Support questions', icon: LifeBuoy, x: 30, y: 110, about: 'Every support conversation.' },
      { id: 'support.waiting', label: 'Waiting for us', icon: Clock, x: 310, y: 110, about: 'The user wrote last; the team has not replied yet.' },
      { id: 'support.answered', label: 'Answered', icon: MessageSquareReply, x: 590, y: 110, about: 'The team replied; waiting for the user.' },
      { id: 'support.solved', label: 'Solved', icon: CheckCircle2, x: 880, y: 110, about: 'Closed support conversations.' },
      { id: 'support.chats', label: 'Buyer ↔ seller chats', icon: MessagesSquare, x: 310, y: 280, about: 'Direct conversations between users. Admins can read them.' },
    ],
    edges: [
      ['support.questions', 'support.waiting', 'New'],
      ['support.waiting', 'support.answered', 'Replies'],
      ['support.answered', 'support.solved', 'Solved'],
    ],
  },
];

const CANVAS_W = 1120;
const CANVAS_H = 400;

// A smooth line from the right edge of one node to the left edge of the next.
const edgePath = (a, b) => {
  const x1 = a.x + NODE_W;
  const y1 = a.y + NODE_H / 2;
  const x2 = b.x;
  const y2 = b.y + NODE_H / 2;
  const dx = Math.max(40, (x2 - x1) / 2);
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
};

const ago = (d) => {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(d).toLocaleDateString();
};

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
};

const AdminFlow = () => {
  const [flowId, setFlowId] = useState('selling');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState({ loading: false, list: [] });
  const [paused, setPaused] = useState(false);
  const [tab, setTab] = useState('items');
  const [, setTick] = useState(0);
  const reduced = useReducedMotion();

  const flow = FLOWS.find((f) => f.id === flowId);
  const nodeById = useMemo(() => Object.fromEntries(flow.nodes.map((n) => [n.id, n])), [flow]);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get('/admin/flow');
      setData(d);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the live flow.');
    }
  }, []);

  useEffect(() => {
    load();
    if (paused) return undefined;
    const t = setInterval(() => { if (!document.hidden) load(); }, 10000);
    return () => clearInterval(t);
  }, [load, paused]);

  // Keeps "updated Xs ago" current.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);

  // Pick the step with the most problems when a flow opens.
  useEffect(() => {
    if (!data) return;
    if (selected && flow.nodes.some((n) => n.id === selected)) return;
    const worst = [...flow.nodes].sort((a, b) => (data.nodes[b.id]?.problems || 0) - (data.nodes[a.id]?.problems || 0))[0];
    setSelected(worst.id);
  }, [data, flow, selected]);

  const loadItems = useCallback(async (node) => {
    setItems((s) => ({ ...s, loading: true }));
    try {
      const { data: d } = await api.get(`/admin/flow/items?node=${node}`);
      setItems({ loading: false, list: d.items });
    } catch {
      setItems({ loading: false, list: [] });
    }
  }, []);

  useEffect(() => { if (selected) loadItems(selected); }, [selected, loadItems, data?.updatedAt]);

  const flowProblems = (f) => f.nodes.reduce((s, n) => s + (data?.nodes[n.id]?.problems || 0), 0);
  const sel = selected ? nodeById[selected] : null;
  const selStats = selected ? data?.nodes[selected] : null;

  return (
    <div className="pb-4">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight text-ink"><Workflow className="text-brand-600" /> Live flow</h1>
          <p className="mt-1 text-[15px] text-ink-soft">Everything moving through LetRank right now. Moving dots are activity in the last 24 hours; red marks a problem.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-[13px] text-ink-soft shadow-[var(--shadow-card)]">
            <span className={`h-2 w-2 rounded-full ${paused ? 'bg-ink-faint' : 'animate-pulse bg-success'}`} />
            {paused ? 'Paused' : 'Live'}{data && ` · updated ${ago(data.updatedAt)}`}
          </span>
          <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume live updates' : 'Pause live updates'} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink-soft shadow-[var(--shadow-card)] hover:text-ink">
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button type="button" onClick={load} aria-label="Refresh now" className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink-soft shadow-[var(--shadow-card)] hover:text-ink">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-[var(--shadow-card)]">
        <div className="grid xl:grid-cols-[220px_1fr_250px]">
          {/* Flow navigator */}
          <nav aria-label="Flows" className="border-b border-line bg-canvas/70 p-3 xl:border-b-0 xl:border-r">
            <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Flows</p>
            <ul className="flex gap-1 overflow-x-auto xl:flex-col">
              {FLOWS.map((f) => {
                const p = flowProblems(f);
                return (
                  <li key={f.id} className="shrink-0">
                    <button type="button" onClick={() => { setFlowId(f.id); setSelected(null); }}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] ${flowId === f.id ? 'bg-white font-semibold text-ink shadow-[var(--shadow-card)]' : 'text-ink-soft hover:bg-white/70'}`}>
                      <Workflow size={16} className={flowId === f.id ? 'text-brand-600' : 'text-ink-faint'} />
                      <span className="flex-1 whitespace-nowrap">{f.name}</span>
                      {p > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-5 text-white">{p}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 hidden px-2 text-[12px] leading-relaxed text-ink-faint xl:block">{flow.about}</p>
          </nav>

          {/* Canvas */}
          <div className="min-w-0 overflow-x-auto" style={{ backgroundImage: 'linear-gradient(var(--color-line-soft) 1px, transparent 1px), linear-gradient(90deg, var(--color-line-soft) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
            <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
              <svg width={CANVAS_W} height={CANVAS_H} className="absolute inset-0" aria-hidden="true">
                {flow.edges.map(([from, to, label]) => {
                  const a = nodeById[from];
                  const b = nodeById[to];
                  const d = edgePath(a, b);
                  const moved = data?.edges[`${from}>${to}`] || 0;
                  const dots = Math.min(4, moved);
                  const pid = `e-${from}-${to}`.replace(/\W/g, '-');
                  const midX = (a.x + NODE_W + b.x) / 2;
                  const midY = (a.y + b.y) / 2 + NODE_H / 2 - 10;
                  return (
                    <g key={pid}>
                      <path id={pid} d={d} fill="none" stroke={moved ? 'var(--color-brand-300)' : 'var(--color-slate-300)'} strokeWidth="2" strokeDasharray={moved ? undefined : '5 5'} />
                      {!reduced && Array.from({ length: dots }, (_, i) => (
                        <circle key={i} r="5" fill="var(--color-brand-600)" stroke="#fff" strokeWidth="1.5">
                          <animateMotion dur="2.4s" repeatCount="indefinite" begin={`${(i * 2.4) / dots}s`}>
                            <mpath href={`#${pid}`} />
                          </animateMotion>
                        </circle>
                      ))}
                      <text x={midX} y={midY} textAnchor="middle" fontSize="11" fill="var(--color-ink-soft)" fontWeight="600">
                        {label}{data ? ` · ${moved} today` : ''}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {flow.nodes.map((n) => {
                const s = data?.nodes[n.id];
                const Icon = n.icon;
                const isSel = selected === n.id;
                const bad = s?.problems > 0;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => { setSelected(n.id); setTab('items'); }}
                    aria-pressed={isSel}
                    style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H }}
                    className={`absolute flex items-center gap-3 rounded-2xl border bg-white px-3.5 text-left shadow-[var(--shadow-card)] transition ${
                      isSel ? 'border-brand-500 ring-4 ring-brand-500/15' : bad ? 'border-red-300' : 'border-line hover:border-brand-300'
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bad ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'}`}><Icon size={19} /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink-soft">{n.label}</span>
                      <span className="block text-2xl font-bold tabular-nums leading-tight text-ink">{s ? s.count.toLocaleString() : '–'}</span>
                    </span>
                    {bad && (
                      <span className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                        <AlertTriangle size={11} /> {s.problems}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step library + legend */}
          <aside className="border-t border-line bg-canvas/70 p-3 xl:border-l xl:border-t-0">
            <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Steps</p>
            <ul className="space-y-0.5">
              {flow.nodes.map((n) => {
                const s = data?.nodes[n.id];
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => { setSelected(n.id); setTab('items'); }} className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] ${selected === n.id ? 'bg-white font-semibold text-ink shadow-[var(--shadow-card)]' : 'text-ink-soft hover:bg-white/70'}`}>
                      <span className="truncate">{n.label}</span>
                      <span className="flex items-center gap-1.5 tabular-nums">
                        {s?.problems > 0 && <span className="text-[11px] font-bold text-red-600">{s.problems}!</span>}
                        <span className="text-ink-faint">{s?.count ?? '–'}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 space-y-2 border-t border-line px-2 pt-4 text-[12px] text-ink-soft">
              <p className="font-semibold uppercase tracking-wider text-ink-faint">Legend</p>
              <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> Moved in the last 24 hours</p>
              <p className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-slate-300" /> No movement today</p>
              <p className="flex items-center gap-2"><span className="rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">3</span> Items with a problem</p>
            </div>
          </aside>
        </div>

        {/* Details panel */}
        <div className="border-t border-line">
          <div className="flex items-center gap-1 border-b border-line bg-canvas/70 px-3" role="tablist">
            {[['items', sel ? sel.label : 'Items'], ['about', 'About this step']].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium ${tab === id ? 'border-brand-600 text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}>
                {label}
              </button>
            ))}
            {selStats?.problems > 0 && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-700"><AlertTriangle size={13} /> {selStats.problems} with a problem: {selStats.problemText}</span>
            )}
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {tab === 'about' ? (
              <div className="space-y-2 p-5 text-[14px] text-ink-soft">
                <p>{sel?.about}</p>
                {data?.rules && (
                  <p className="text-[13px] text-ink-faint">
                    Problem rules: order without a brief after {data.rules.noBriefDays} days · order in progress over {data.rules.writingDays} days · website waiting for review over {data.rules.reviewDays} days · seller waiting over {data.rules.sellerReviewDays} days · support question without a reply for {data.rules.supportHours} hours · live site flagged, unchecked or checked over 30 days ago.
                  </p>
                )}
              </div>
            ) : items.loading && items.list.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-faint">Loading…</p>
            ) : items.list.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-faint">Nothing in this step right now.</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.list.map((it) => (
                  <li key={it._id} className={`flex items-center gap-3 px-5 py-3 ${it.problem ? 'bg-red-50/50' : ''}`}>
                    {it.problem ? <AlertTriangle size={16} className="shrink-0 text-red-600" /> : <span className="h-2 w-2 shrink-0 rounded-full bg-brand-300" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">{it.title}</span>
                      <span className="block truncate text-[12px] text-ink-faint">{it.problem ? <span className="font-semibold text-red-700">{it.problem} · </span> : null}{it.sub}</span>
                    </span>
                    <span className="hidden shrink-0 text-[12px] text-ink-faint sm:block">{ago(it.at)}</span>
                    <Link href={it.href} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:bg-canvas hover:text-ink">
                      Open <ExternalLink size={12} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminFlow;
