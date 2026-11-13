'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Loader2, Link2, ChevronRight, ExternalLink, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import Pagination from '@/components/Pagination';
import Badge from '@/components/ui/Badge';
import { LINK_STATUS_LABEL, LINK_STATUS_TONE, LINK_CASE_LABEL, LINK_PROBLEM_TEXT, OPEN_CASE } from '@/data/orderStatus';

// Admin → Link monitor (Module 5): every guaranteed link, problems, lost-link
// cases, and guarantees ending soon. Open a row to check it now or settle a case.

const TABS = [
  { key: 'monitored', label: 'Monitored' },
  { key: 'problems', label: 'Problems' },
  { key: 'cases', label: 'Open cases' },
  { key: 'awaiting', label: 'Needs decision' },
  { key: 'ending', label: 'Ending in 30 days' },
  { key: 'settled', label: 'Settled cases' },
  { key: 'ended', label: 'Ended' },
];
const ALERT = ['problems', 'cases', 'awaiting'];

const day = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');

const AdminLinks = () => {
  const [view, setView] = useState('monitored');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    if (TABS.some((t) => t.key === v)) setView(v);
  }, []);

  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({ view, page: String(page) });
      if (search.trim()) params.set('search', search.trim());
      api.get(`/admin/links?${params}`)
        .then(({ data: d }) => { if (n === seq.current) { setData(d); setError(''); } })
        .catch((err) => { if (n === seq.current) setError(err.response?.data?.message || 'Could not load links.'); })
        .finally(() => { if (n === seq.current) setLoading(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [view, search, page]);

  useEffect(() => { setPage(1); }, [view, search]);

  return (
    <div className="mx-auto max-w-7xl pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Link monitor</h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          Every sold link is checked when it is delivered and then every month until its guarantee ends. Problems seen twice open a case; the publisher gets 7 days to fix it before it comes to you.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-6">
            <div className="flex flex-wrap gap-1" role="tablist">
              {TABS.map((t) => {
                const count = data?.counts?.[t.key];
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={view === t.key}
                    onClick={() => setView(t.key)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium ${view === t.key ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-line-soft hover:text-ink'}`}
                  >
                    {t.label}
                    {count !== undefined && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${count && ALERT.includes(t.key) ? 'bg-red-50 text-red-700' : 'bg-line-soft text-ink-soft'}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <label className="relative sm:w-80">
              <span className="sr-only">Search links</span>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Website, live URL, buyer or seller…"
                className="h-9 w-full rounded-lg border border-line bg-white pl-8 pr-3 text-[13px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
              />
            </label>
          </div>

          {error ? (
            <p className="p-12 text-center text-[14px] text-danger">{error}</p>
          ) : !data ? (
            <div className="p-16 text-center"><Loader2 size={24} className="mx-auto animate-spin text-brand-500" /></div>
          ) : data.links.length === 0 ? (
            <div className="p-16 text-center text-ink-faint">
              <Link2 size={32} className="mx-auto mb-3 opacity-50" strokeWidth={1.5} />
              <p className="text-[14px] font-medium">No links here.</p>
            </div>
          ) : (
            <ul className={`divide-y divide-line ${loading ? 'opacity-60' : ''}`}>
              {data.links.map((o) => {
                const l = o.link || {};
                const open = OPEN_CASE.includes(l.case?.status);
                const problems = (l.last?.problems || []).map((p) => LINK_PROBLEM_TEXT[p] || p).join('; ');
                return (
                  <li key={o._id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-canvas sm:px-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[14px] font-semibold text-ink">{o.site?.domain || 'Website'}</span>
                        {l.status && <Badge tone={LINK_STATUS_TONE[l.status]}>{LINK_STATUS_LABEL[l.status]}</Badge>}
                        {l.case?.status && <Badge tone={open ? 'danger' : 'neutral'}>Case: {LINK_CASE_LABEL[l.case.status]}</Badge>}
                      </div>
                      <a href={o.liveLink} target="_blank" rel="noopener noreferrer nofollow" className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[12px] text-brand-700 hover:underline">
                        <span className="truncate">{o.liveLink}</span><ExternalLink size={11} className="shrink-0" />
                      </a>
                      <p className="mt-0.5 truncate text-[12px] text-ink-faint">
                        buyer {o.buyer?.name || '–'} · publisher {o.seller?.name || '–'} · checked {day(l.lastCheckedAt)} · guaranteed until {day(l.guaranteeUntil)}
                        {open && l.case.status === 'open' ? ` · fix by ${day(l.case.fixBy)}` : ''}
                      </p>
                      {problems && l.status !== 'ok' && <p className="mt-0.5 truncate text-[12px] text-red-700">{problems}</p>}
                    </div>
                    <Link href={`/orders/${o._id}`} className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">
                      Open <ChevronRight size={15} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {data && (
            <div className="border-t border-line px-6">
              <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} label="links" />
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink"><AlertTriangle size={15} className="text-amber-600" /> Most lost links</h2>
            {!data?.worstSellers?.length ? (
              <p className="mt-2 text-[13px] text-ink-faint">No seller has lost a link yet.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {data.worstSellers.map((s) => (
                  <li key={s._id} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="truncate text-ink">{s.name || 'Unknown'}</span>
                    <span className="shrink-0 text-ink-faint">{s.lost} lost · {s.orders} order{s.orders === 1 ? '' : 's'}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="rounded-2xl border border-line bg-white p-5 text-[13px] text-ink-soft shadow-[var(--shadow-card)]">
            <p className="font-semibold text-ink">How checks work</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>On delivery, a missing link, a gone page or a nofollow link (when dofollow was sold) is refused.</li>
              <li>Monthly checks open a case when a problem is seen two days running, or the page can&rsquo;t be opened for five.</li>
              <li>Pages that block bots show as &ldquo;Couldn&rsquo;t check&rdquo;; open the link to look yourself.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default AdminLinks;
