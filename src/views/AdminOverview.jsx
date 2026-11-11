'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, Calendar, Info, Clock, AlertTriangle, ClipboardCheck, CalendarClock, ChevronRight, ShoppingBag,
} from 'lucide-react';
import api from '@/lib/api';
import { money } from '@/lib/format';
import { OrderValueChart, StatusDonut } from '@/components/admin/OverviewCharts';

const PERIODS = [7, 30, 90];

// "+12%", "−5%", "New" (nothing before) or "No change".
const Delta = ({ current, previous, dark = false }) => {
  let text;
  let tone;
  if (!previous && !current) { text = 'No data'; tone = 'muted'; }
  else if (!previous) { text = 'New'; tone = 'up'; }
  else {
    const pct = Math.round(((current - previous) / previous) * 100);
    text = pct === 0 ? 'No change' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
    tone = pct > 0 ? 'up' : pct < 0 ? 'down' : 'muted';
  }
  const cls = dark
    ? 'bg-white/15 text-white'
    : tone === 'up' ? 'bg-emerald-50 text-emerald-700' : tone === 'down' ? 'bg-red-50 text-red-700' : 'bg-line-soft text-ink-soft';
  return <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${cls}`}>{text}</span>;
};

const BigCard = ({ label, value, previous, format = (v) => v.toLocaleString(), days, variant = 'white', href, delta }) => {
  const styles = {
    brand: 'bg-brand-gradient text-white border-transparent',
    dark: 'bg-aurora text-white border-transparent',
    white: 'bg-white text-ink border-line',
  }[variant];
  const sub = variant === 'white' ? 'text-ink-soft' : 'text-white/75';
  const body = (
    <div className={`relative h-full overflow-hidden rounded-3xl border p-6 shadow-[var(--shadow-card)] ${styles}`}>
      {variant !== 'white' && <span className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" aria-hidden="true" />}
      <div className="relative flex items-start justify-between gap-3">
        <p className="flex items-center gap-1 text-[15px] font-semibold">{label}{href && <ArrowUpRight size={15} />}</p>
        {delta !== false && <Delta current={value} previous={previous} dark={variant !== 'white'} />}
      </div>
      <p className="relative mt-4 text-4xl font-bold tracking-tight tabular-nums">{format(value)}</p>
      <p className={`relative mt-2 text-[13px] ${sub}`}>{previous === undefined ? `in the last ${days} days` : `vs ${format(previous)} in the previous ${days} days`}</p>
    </div>
  );
  return href ? <Link href={href} className="block transition hover:-translate-y-0.5">{body}</Link> : body;
};

const AttentionRow = ({ icon: Icon, label, count, href, tone }) => (
  <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-canvas">
    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${count ? tone : 'bg-line-soft text-ink-faint'}`}><Icon size={17} /></span>
    <span className="flex-1 text-[14px] text-ink">{label}</span>
    <span className={`text-[15px] font-bold tabular-nums ${count ? 'text-ink' : 'text-ink-faint'}`}>{count}</span>
    <ChevronRight size={16} className="text-ink-faint" />
  </Link>
);

const ago = (d) => {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const STATUS_TEXT = { awaiting_content: 'Awaiting brief', in_progress: 'In progress', published: 'Published', cancelled: 'Cancelled' };

const AdminOverview = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setError('');
    api.get(`/admin/overview?days=${days}`)
      .then(({ data: d }) => { if (live) setData(d); })
      .catch((err) => { if (live) setError(err.response?.data?.message || 'Could not load the overview.'); });
    return () => { live = false; };
  }, [days]);

  const c = data?.cards;
  const t = data?.totals;
  const a = data?.attention;

  return (
    <div className="pb-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Overview</h1>
          <p className="mt-2 text-[15px] text-ink-soft">Orders, sign-ups and listings on LetRank, compared with the previous {days} days.</p>
        </div>
        <label className="relative inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white pl-4 pr-3 text-[14px] font-medium text-ink shadow-[var(--shadow-card)]">
          <Calendar size={16} className="text-ink-faint" />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period" className="cursor-pointer appearance-none bg-transparent pr-5 outline-none">
            {PERIODS.map((p) => <option key={p} value={p}>Last {p} days</option>)}
          </select>
        </label>
      </div>

      <p className="mb-5 flex items-center gap-2 text-[13px] text-ink-faint">
        <Info size={14} /> Payments arrive in Module 3. Until then, order value is the price of orders placed, and completed value counts published orders.
      </p>

      {error && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-[168px] animate-pulse rounded-3xl bg-white" />)}
        </div>
      ) : (
        <>
          {/* Headline cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <BigCard variant="brand" label="Completed value" value={c.completedValue.current} previous={c.completedValue.previous} format={money} days={days} />
            <BigCard label="Orders" value={c.orders.current} previous={c.orders.previous} days={days} href="/orders" />
            <BigCard label="New sign-ups" value={c.signups.current} previous={c.signups.previous} days={days} href="/admin/users" />
            <BigCard variant="dark" label="Live sites" value={t.liveSites} days={days} delta={false} href="/admin/listings" format={(v) => v.toLocaleString()} />
          </div>

          {/* Strip */}
          <div className="mt-4 grid grid-cols-2 divide-line overflow-hidden rounded-3xl border border-line bg-white shadow-[var(--shadow-card)] sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
            {[
              ['New sellers', c.newSellers.current, c.newSellers],
              ['New listings', c.newListings.current, c.newListings],
              ['Waiting for review', t.pendingSites, null],
              ['Verified owners', t.verified, null],
              ['Avg order value', money(c.avgOrder.current), c.avgOrder],
              ['Metrics checked', t.liveSites ? `${Math.round(((t.liveSites - a.unchecked) / t.liveSites) * 100)}%` : '–', null],
            ].map(([label, value, cmp]) => (
              <div key={label} className="border-b border-line p-5 lg:border-b-0">
                <p className="text-[13px] text-ink-soft">{label}</p>
                <p className="mt-2 flex items-center gap-2 text-2xl font-bold tabular-nums text-ink">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                  {cmp && <Delta current={cmp.current} previous={cmp.previous} />}
                </p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_380px]">
            <section className="rounded-3xl border border-line bg-white p-6 shadow-[var(--shadow-card)]">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-ink">Order value over time</h2>
              </div>
              <p className="mb-2 text-[15px] text-ink-soft"><span className="font-bold text-ink">{money(c.orderValue.current)}</span> in total <Delta current={c.orderValue.current} previous={c.orderValue.previous} /></p>
              <OrderValueChart series={data.series} />
            </section>
            <section className="rounded-3xl border border-line bg-white p-6 shadow-[var(--shadow-card)]">
              <h2 className="text-lg font-semibold text-ink">Listings by status</h2>
              <p className="mb-5 text-[14px] text-ink-soft">Every website sellers and our team added</p>
              <StatusDonut
                total={(t.liveSites + t.pendingSites + t.rejectedSites).toLocaleString()}
                label="Total sites"
                parts={[
                  { label: 'Live', value: t.liveSites, color: '#059669' },
                  { label: 'Waiting for review', value: t.pendingSites, color: '#d97706' },
                  { label: 'Rejected', value: t.rejectedSites, color: '#dc2626' },
                ]}
              />
            </section>
          </div>

          {/* Lists */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <section className="rounded-3xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
              <h2 className="px-3 pb-2 pt-2 text-lg font-semibold text-ink">Needs attention</h2>
              <AttentionRow icon={Clock} label="Sites waiting for review" count={a.pending} href="/admin/listings" tone="bg-amber-50 text-amber-700" />
              <AttentionRow icon={ClipboardCheck} label="Live sites with unchecked metrics" count={a.unchecked} href="/admin/metrics?view=seller" tone="bg-brand-50 text-brand-700" />
              <AttentionRow icon={AlertTriangle} label="Flagged sites" count={a.flagged} href="/admin/metrics" tone="bg-red-50 text-red-700" />
              <AttentionRow icon={CalendarClock} label="Metrics out of date" count={a.stale} href="/admin/metrics?view=stale" tone="bg-line-soft text-ink-soft" />
            </section>

            <section className="rounded-3xl border border-line bg-white p-6 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink">Recent orders</h2>
                <Link href="/orders" className="text-[13px] font-semibold text-brand-700 hover:underline">All orders</Link>
              </div>
              {data.recentOrders.length === 0 ? (
                <p className="flex flex-col items-center gap-2 py-10 text-center text-sm text-ink-faint"><ShoppingBag size={22} /> No orders yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.recentOrders.map((o) => (
                    <li key={o._id} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-ink">{o.site}</span>
                        <span className="block text-[12px] text-ink-faint">{o.buyer} · {STATUS_TEXT[o.status] || o.status} · {ago(o.createdAt)}</span>
                      </span>
                      <span className="text-[14px] font-semibold tabular-nums">{money(o.price)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-line bg-white p-6 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink">Waiting for review</h2>
                <Link href="/admin/listings" className="text-[13px] font-semibold text-brand-700 hover:underline">Review</Link>
              </div>
              {data.recentPending.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-faint">Nothing to review.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.recentPending.map((l) => (
                    <li key={l._id} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-ink">{l.site}</span>
                        <span className="block text-[12px] text-ink-faint">{l.seller || 'Seller'} · {ago(l.createdAt)}</span>
                      </span>
                      <span className="text-[14px] font-semibold tabular-nums">{money(l.price)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminOverview;
