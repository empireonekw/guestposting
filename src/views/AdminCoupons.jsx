'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, Loader2, TicketPercent, Plus, Pencil, Power, Users, Shuffle,
} from 'lucide-react';
import api from '@/lib/api';
import { money } from '@/lib/format';
import Pagination from '@/components/Pagination';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import {
  Field, Input, Select, Checkbox,
} from '@/components/ui/Field';
import { STATUS_LABEL } from '@/data/orderStatus';

// Admin → Coupons (Module 6): discount codes, their limits, and who used them.

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'expired', label: 'Expired' },
  { key: 'used_up', label: 'Used up' },
  { key: 'off', label: 'Turned off' },
];
const STATE = {
  live: { label: 'Live', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'brand' },
  expired: { label: 'Expired', tone: 'neutral' },
  used_up: { label: 'Used up', tone: 'warning' },
  off: { label: 'Off', tone: 'neutral' },
};

const day = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const dateInput = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const randomCode = () => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `SAVE-${[...bytes].map((b) => abc[b % abc.length]).join('')}`;
};

const EMPTY = {
  code: '', description: '', type: 'percent', value: '', maxDiscount: '', minSubtotal: '',
  firstOrderOnly: false, perUserLimit: '1', maxUses: '', startsAt: '', expiresAt: '', active: true,
};

const toForm = (c) => ({
  code: c.code,
  description: c.description || '',
  type: c.type,
  value: String(c.value ?? ''),
  maxDiscount: c.maxDiscount ? String(c.maxDiscount) : '',
  minSubtotal: c.minSubtotal ? String(c.minSubtotal) : '',
  firstOrderOnly: !!c.firstOrderOnly,
  perUserLimit: String(c.perUserLimit || 1),
  maxUses: c.maxUses ? String(c.maxUses) : '',
  startsAt: dateInput(c.startsAt),
  expiresAt: dateInput(c.expiresAt),
  active: c.active !== false,
});

// Form values -> API body. Dates run from the start of the first day to the
// end of the last one, in the admin's time zone.
const toBody = (f) => ({
  code: f.code.trim(),
  description: f.description.trim(),
  type: f.type,
  value: f.value,
  maxDiscount: f.type === 'percent' ? f.maxDiscount : '',
  minSubtotal: f.minSubtotal,
  firstOrderOnly: f.firstOrderOnly,
  perUserLimit: f.perUserLimit,
  maxUses: f.maxUses,
  startsAt: f.startsAt ? new Date(`${f.startsAt}T00:00:00`).toISOString() : '',
  expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59`).toISOString() : '',
  active: f.active,
});

const CouponDialog = ({ coupon, onClose, onSaved }) => {
  const [form, setForm] = useState(coupon ? toForm(coupon) : EMPTY);
  const [state, setState] = useState({ loading: false, error: '', field: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const err = (k) => (state.field === k ? state.error : '');
  const locked = coupon && coupon.uses > 0;

  const save = async (e) => {
    e?.preventDefault();
    setState({ loading: true, error: '', field: '' });
    try {
      const body = toBody(form);
      const { data } = coupon ? await api.put(`/admin/coupons/${coupon._id}`, body) : await api.post('/admin/coupons', body);
      onSaved(data);
    } catch (error) {
      const d = error.response?.data;
      setState({ loading: false, error: d?.message || 'Could not save the coupon.', field: d?.field || '' });
    }
  };

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={coupon ? `Edit ${coupon.code}` : 'New coupon'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={state.loading}>{coupon ? 'Save changes' : 'Create coupon'}</Button>
        </>
      )}
    >
      <form onSubmit={save} className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
        <Field label="Code" htmlFor="c-code" required error={err('code')} hint={locked ? 'Already used, so the code can’t change.' : 'Letters, numbers, dashes. Buyers type this.'}>
          <div className="flex gap-2">
            <Input id="c-code" value={form.code} disabled={locked} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} maxLength={32} placeholder="WELCOME10" className="font-mono uppercase" error={err('code')} />
            {!locked && <Button variant="secondary" onClick={() => setForm((f) => ({ ...f, code: randomCode() }))} aria-label="Generate a code" title="Generate a code"><Shuffle size={15} /></Button>}
          </div>
        </Field>
        <Field label="Description" htmlFor="c-desc" hint="Shown to the buyer when the code is applied." error={err('description')}>
          <Input id="c-desc" value={form.description} onChange={set('description')} maxLength={200} placeholder="10% off your first order" />
        </Field>
        <Field label="Discount" htmlFor="c-type" required>
          <Select id="c-type" value={form.type} onChange={set('type')}>
            <option value="percent">Percent off</option>
            <option value="fixed">Fixed amount off (USD)</option>
          </Select>
        </Field>
        <Field label={form.type === 'percent' ? 'Percent off' : 'Amount off'} htmlFor="c-value" required error={err('value')}>
          <Input id="c-value" type="number" min="0" step="0.01" inputMode="decimal" value={form.value} onChange={set('value')} prefix={form.type === 'fixed' ? '$' : undefined} placeholder={form.type === 'percent' ? '10' : '25'} error={err('value')} />
        </Field>
        {form.type === 'percent' && (
          <Field label="Most it can take off" htmlFor="c-max" hint="Optional cap per checkout." error={err('maxDiscount')}>
            <Input id="c-max" type="number" min="0" step="0.01" value={form.maxDiscount} onChange={set('maxDiscount')} prefix="$" placeholder="No cap" error={err('maxDiscount')} />
          </Field>
        )}
        <Field label="Minimum order" htmlFor="c-min" hint="Cart total needed. Optional." error={err('minSubtotal')}>
          <Input id="c-min" type="number" min="0" step="0.01" value={form.minSubtotal} onChange={set('minSubtotal')} prefix="$" placeholder="0" error={err('minSubtotal')} />
        </Field>
        <Field label="Uses per buyer" htmlFor="c-per" error={err('perUserLimit')}>
          <Input id="c-per" type="number" min="1" step="1" value={form.perUserLimit} onChange={set('perUserLimit')} error={err('perUserLimit')} />
        </Field>
        <Field label="Total uses" htmlFor="c-uses" hint="Checkouts in total. Empty = no limit." error={err('maxUses')}>
          <Input id="c-uses" type="number" min="1" step="1" value={form.maxUses} onChange={set('maxUses')} placeholder="No limit" error={err('maxUses')} />
        </Field>
        <Field label="Starts" htmlFor="c-start" hint="Empty = straight away." error={err('startsAt')}>
          <Input id="c-start" type="date" value={form.startsAt} onChange={set('startsAt')} error={err('startsAt')} />
        </Field>
        <Field label="Ends (last day)" htmlFor="c-end" hint="Empty = never." error={err('expiresAt')}>
          <Input id="c-end" type="date" value={form.expiresAt} onChange={set('expiresAt')} error={err('expiresAt')} />
        </Field>
        <div className="space-y-3 sm:col-span-2">
          <Checkbox label="First order only" description="Only buyers with no earlier orders (cancelled ones don’t count)." checked={form.firstOrderOnly} onChange={set('firstOrderOnly')} />
          <Checkbox label="Active" description="Turn off to stop new checkouts using it. Past orders keep their discount." checked={form.active} onChange={set('active')} />
        </div>
        {state.error && !state.field && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800 sm:col-span-2">{state.error}</p>}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
};

const UsageDialog = ({ coupon, onClose }) => {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get(`/admin/coupons/${coupon._id}/redemptions?page=${page}`).then(({ data: d }) => setData(d)).catch(() => setData({ redemptions: [], total: 0, page: 1, pages: 1, limit: 20, error: true }));
  }, [coupon._id, page]);
  return (
    <Dialog open size="lg" onClose={onClose} title={`Who used ${coupon.code}`}>
      <div className="max-h-[65vh] overflow-y-auto">
        <p className="mb-3 text-[13px] text-ink-soft">
          {coupon.uses} active use{coupon.uses === 1 ? '' : 's'} · {money(coupon.totalDiscount)} discount given · {money(coupon.totalSales)} paid by buyers.
          A use is given back when every order from that checkout is cancelled.
        </p>
        {!data ? (
          <div className="p-10 text-center"><Loader2 size={22} className="mx-auto animate-spin text-brand-500" /></div>
        ) : data.error ? (
          <p className="p-6 text-center text-[13px] text-danger">Could not load the usage.</p>
        ) : data.redemptions.length === 0 ? (
          <p className="p-6 text-center text-[13px] text-ink-faint">Nobody has used this coupon yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {data.redemptions.map((r) => (
              <li key={r._id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-ink">{r.user?.name || 'Deleted user'} <span className="font-normal text-ink-faint">{r.user?.email}</span></span>
                  <span className="flex items-center gap-2 text-[13px] tabular-nums">
                    {r.status === 'released' && <Badge>Given back</Badge>}
                    <span className="text-emerald-700">−{money(r.discount)}</span>
                    <span className="text-ink-faint">of {money(r.subtotal)}</span>
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-ink-faint">{day(r.createdAt)} · {r.orders.length} order{r.orders.length === 1 ? '' : 's'}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {r.orders.map((o) => (
                    <li key={o._id}>
                      <Link href={`/orders/${o._id}`} className="inline-flex items-center gap-1 rounded-md bg-line-soft px-1.5 py-0.5 text-[11px] font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700">
                        {o.site?.domain} · {STATUS_LABEL[o.status] || o.status}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {data && !data.error && <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} label="uses" />}
      </div>
    </Dialog>
  );
};

const AdminCoupons = () => {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // coupon, or 'new'
  const [usage, setUsage] = useState(null);
  const [reload, setReload] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({ state: tab, page: String(page) });
      if (search.trim()) params.set('search', search.trim());
      api.get(`/admin/coupons?${params}`)
        .then(({ data: d }) => { if (n === seq.current) { setData(d); setError(''); } })
        .catch((err) => { if (n === seq.current) setError(err.response?.data?.message || 'Could not load coupons.'); })
        .finally(() => { if (n === seq.current) setLoading(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [tab, search, page, reload]);

  useEffect(() => { setPage(1); }, [tab, search]);

  const toggle = async (c) => {
    try {
      await api.put(`/admin/coupons/${c._id}`, { active: !c.active });
      setReload((r) => r + 1);
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not change the coupon.');
    }
  };

  const totals = data?.totals;

  return (
    <div className="mx-auto max-w-7xl pb-20">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Coupons</h1>
          <p className="mt-1 max-w-3xl text-[14px] text-ink-soft">
            Discount codes buyers enter in the cart. A discount comes off the buyer&rsquo;s total; the publisher still earns the full price, so the platform covers it.
          </p>
        </div>
        <Button onClick={() => setEditing('new')}><Plus size={16} /> New coupon</Button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Coupons', totals?.coupons ?? '–'],
          ['Checkouts with a coupon', totals?.uses ?? '–'],
          ['Discount given', totals ? money(totals.discount) : '–'],
          ['Paid by those buyers', totals ? money(totals.sales) : '–'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
            <p className="text-[12px] font-medium text-ink-faint">{label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-ink">{value}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1" role="tablist">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${tab === t.key ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-line-soft hover:text-ink'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <label className="relative lg:w-72">
            <span className="sr-only">Search coupons</span>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code or description…" className="h-9 w-full rounded-lg border border-line bg-white pl-8 pr-3 text-[13px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10" />
          </label>
        </div>

        {error ? (
          <p className="p-12 text-center text-[14px] text-danger">{error}</p>
        ) : !data ? (
          <div className="p-16 text-center"><Loader2 size={24} className="mx-auto animate-spin text-brand-500" /></div>
        ) : data.coupons.length === 0 ? (
          <div className="p-16 text-center text-ink-faint">
            <TicketPercent size={32} className="mx-auto mb-3 opacity-50" strokeWidth={1.5} />
            <p className="text-[14px] font-medium">No coupons here.</p>
            {tab === 'all' && !search && <Button className="mt-4" onClick={() => setEditing('new')}><Plus size={16} /> Create the first one</Button>}
          </div>
        ) : (
          <ul className={`divide-y divide-line ${loading ? 'opacity-60' : ''}`}>
            {data.coupons.map((c) => (
              <li key={c._id} className="flex flex-col gap-3 px-4 py-3.5 sm:px-6 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-ink px-2 py-0.5 font-mono text-[13px] font-semibold tracking-wide text-white">{c.code}</span>
                    <Badge tone={STATE[c.state]?.tone}>{STATE[c.state]?.label || c.state}</Badge>
                    <span className="text-[13px] font-medium text-ink">{c.summary}</span>
                  </div>
                  <p className="mt-1 truncate text-[12px] text-ink-faint">
                    {c.description ? `${c.description} · ` : ''}
                    {c.perUserLimit > 1 ? `${c.perUserLimit} uses per buyer` : 'once per buyer'}
                    {c.startsAt ? ` · from ${day(c.startsAt)}` : ''}
                    {c.expiresAt ? ` · until ${day(c.expiresAt)}` : ' · no end date'}
                    {c.createdBy?.name ? ` · by ${c.createdBy.name}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[13px] tabular-nums">
                  <span className="text-ink-soft"><span className="font-semibold text-ink">{c.uses}</span>{c.maxUses ? `/${c.maxUses}` : ''} used</span>
                  <span className="text-emerald-700">−{money(c.totalDiscount)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setUsage(c)}><Users size={14} /> Usage</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil size={14} /> Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle(c)} title={c.active ? 'Stop new checkouts using it' : 'Allow it again'}>
                    <Power size={14} /> {c.active ? 'Turn off' : 'Turn on'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data && (
          <div className="border-t border-line px-6">
            <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} label="coupons" />
          </div>
        )}
      </section>

      {editing && (
        <CouponDialog
          coupon={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setReload((r) => r + 1); }}
        />
      )}
      {usage && <UsageDialog coupon={usage} onClose={() => setUsage(null)} />}
    </div>
  );
};

export default AdminCoupons;
