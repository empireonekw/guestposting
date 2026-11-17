'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Loader2, ChevronRight, Clock } from 'lucide-react';
import api from '@/lib/api';
import useSession from '@/lib/useSession';
import Pagination from '@/components/Pagination';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { STATUS_LABEL, STATUS_TONE } from '@/data/orderStatus';
import { money } from '@/lib/format';

// "My orders" for buyers and "My sales" for sellers.

const FILTERS = [
  { key: 'action', label: 'Your turn' },
  { key: 'open', label: 'Open' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

const short = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '');

// The one date that matters for this order right now.
const dueText = (o) => {
  if (o.status === 'pending_acceptance' && o.acceptBy) return `Accept by ${short(o.acceptBy)}`;
  if (o.status === 'writing' && o.dueAt) return `${o.late ? 'Was due' : 'Due'} ${short(o.dueAt)}`;
  if (o.status === 'published' && o.reviewBy) return `Auto-approves ${short(o.reviewBy)}`;
  return '';
};

const Orders = () => {
  const { user } = useSession();
  const role = user?.role === 'seller' ? 'seller' : 'buyer';
  const [filter, setFilter] = useState('open');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    if (!user) return;
    const n = ++seq.current;
    const endpoint = role === 'seller' ? '/orders/mysales' : '/orders/myorders';
    api.get(`${endpoint}?status=${filter}&page=${page}`)
      .then(({ data: d }) => { if (n === seq.current) { setData(d); setError(''); } })
      .catch(() => { if (n === seq.current) setError('Could not load your orders.'); });
  }, [user, role, filter, page]);

  useEffect(() => { setPage(1); }, [filter]);

  const other = role === 'seller' ? 'buyer' : 'seller';

  return (
    <div className="mx-auto max-w-6xl pb-20">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{role === 'seller' ? 'My sales' : 'My orders'}</h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            {role === 'seller' ? 'Orders for your websites: accept them, publish, and send the live link.' : 'Your guest post orders and where each one stands.'}
          </p>
        </div>
        {role === 'buyer' && <Button href="/sites" variant="secondary">Find more sites</Button>}
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap gap-1 border-b border-line px-4 py-3 sm:px-6" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium ${filter === f.key ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-line-soft hover:text-ink'}`}
            >
              {f.label}
              {f.key === 'action' && data?.actionCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">{data.actionCount}</span>}
            </button>
          ))}
        </div>

        {error ? (
          <p className="p-12 text-center text-[14px] text-danger">{error}</p>
        ) : !data ? (
          <div className="p-16 text-center"><Loader2 size={24} className="mx-auto animate-spin text-brand-500" /></div>
        ) : data.orders.length === 0 ? (
          <div className="p-16 text-center text-ink-faint">
            <ShoppingBag size={32} className="mx-auto mb-3 opacity-50" strokeWidth={1.5} />
            <p className="text-[14px] font-medium">{filter === 'action' ? 'Nothing needs you right now.' : 'No orders here.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.orders.map((o) => (
              <li key={o._id}>
                <Link href={`/orders/${o._id}`} className={`flex items-center gap-4 px-4 py-4 hover:bg-canvas sm:px-6 ${o.yourTurn ? 'bg-brand-50/40' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[14px] font-semibold text-ink">{o.site?.domain || o.listing?.domain || 'Website'}</span>
                      <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status] || o.status}</Badge>
                      {o.late && <Badge tone="warning"><Clock size={11} /> Late</Badge>}
                      {o.yourTurn && <Badge tone="brand">Your turn</Badge>}
                    </div>
                    <p className="mt-1 text-[12px] text-ink-faint">
                      #{String(o._id).slice(-6).toUpperCase()} · {short(o.createdAt)}
                      {o[other]?.name ? ` · ${other === 'seller' ? 'publisher' : 'buyer'} ${o[other].name}` : ''}
                      {dueText(o) ? ` · ${dueText(o)}` : ''}
                    </p>
                  </div>
                  <span className="text-right text-[15px] font-semibold tabular-nums text-ink">
                    {o.discount > 0 && <span className="block text-[11px] font-normal text-ink-faint line-through">{money(o.price)}</span>}
                    {money(o.price - (o.discount || 0))}
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

export default Orders;
