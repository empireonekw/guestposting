'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Loader2, ShoppingBag, ChevronRight, Clock, PauseCircle } from 'lucide-react';
import api from '@/lib/api';
import Pagination from '@/components/Pagination';
import Badge from '@/components/ui/Badge';
import { STATUS_LABEL, STATUS_TONE } from '@/data/orderStatus';
import { money } from '@/lib/format';

// Admin → Orders: every order, with the ones that need our team on top
// (late, stuck with no activity for a week, disputed).

const TABS = [
  { key: 'open', label: 'Open' },
  { key: 'late', label: 'Late' },
  { key: 'stuck', label: 'Stuck' },
  { key: 'disputed', label: 'Disputed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

const short = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

const AdminOrders = () => {
  const [tab, setTab] = useState('open');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const seq = useRef(0);

  // ?status=disputed opens that tab.
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('status');
    if (TABS.some((t) => t.key === s)) setTab(s);
  }, []);

  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({ status: tab, page: String(page) });
      if (search.trim()) params.set('search', search.trim());
      api.get(`/admin/orders?${params}`)
        .then(({ data: d }) => { if (n === seq.current) { setData(d); setError(''); } })
        .catch((err) => { if (n === seq.current) setError(err.response?.data?.message || 'Could not load orders.'); })
        .finally(() => { if (n === seq.current) setLoading(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [tab, search, page]);

  useEffect(() => { setPage(1); }, [tab, search]);

  return (
    <div className="mx-auto max-w-7xl pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Orders</h1>
        <p className="mt-1 text-[14px] text-ink-soft">Every order on the marketplace. Open one to extend its deadline, cancel it, or decide a dispute.</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-6 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-1" role="tablist">
            {TABS.map((t) => {
              const count = data?.counts?.[t.key];
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium ${tab === t.key ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-line-soft hover:text-ink'}`}
                >
                  {t.label}
                  {count !== undefined && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${count && ['late', 'stuck', 'disputed'].includes(t.key) ? 'bg-red-50 text-red-700' : 'bg-line-soft text-ink-soft'}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
          <label className="relative lg:ml-auto lg:w-72">
            <span className="sr-only">Search orders</span>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Website, buyer, seller or order id…"
              className="h-9 w-full rounded-lg border border-line bg-white pl-8 pr-3 text-[13px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
            />
          </label>
        </div>

        {error ? (
          <p className="p-12 text-center text-[14px] text-danger">{error}</p>
        ) : !data ? (
          <div className="p-16 text-center"><Loader2 size={24} className="mx-auto animate-spin text-brand-500" /></div>
        ) : data.orders.length === 0 ? (
          <div className="p-16 text-center text-ink-faint">
            <ShoppingBag size={32} className="mx-auto mb-3 opacity-50" strokeWidth={1.5} />
            <p className="text-[14px] font-medium">No orders here.</p>
          </div>
        ) : (
          <ul className={`divide-y divide-line ${loading ? 'opacity-60' : ''}`}>
            {data.orders.map((o) => (
              <li key={o._id}>
                <Link href={`/orders/${o._id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-canvas sm:px-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[14px] font-semibold text-ink">{o.site?.domain || 'Website'}</span>
                      <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status] || o.status}</Badge>
                      {o.late && <Badge tone="warning"><Clock size={11} /> Late</Badge>}
                      {o.stuck && <Badge tone="danger"><PauseCircle size={11} /> No activity for 7+ days</Badge>}
                    </div>
                    <p className="mt-1 truncate text-[12px] text-ink-faint">
                      #{String(o._id).slice(-6).toUpperCase()} · {short(o.createdAt)} · buyer {o.buyer?.name || '–'} · publisher {o.seller?.name || '–'}
                      {o.dueAt && o.status === 'writing' ? ` · due ${short(o.dueAt)}` : ''}
                    </p>
                  </div>
                  <span className="text-right text-[14px] font-semibold tabular-nums text-ink">
                    {money(o.price)}
                    {o.discount > 0 && <span className="block text-[11px] font-normal text-emerald-700">coupon −{money(o.discount)}</span>}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-ink-faint" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {data && (
          <div className="border-t border-line px-6">
            <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} label="orders" />
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminOrders;
