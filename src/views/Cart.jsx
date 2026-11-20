'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingCart, Loader2, Trash2, Heart, BadgeCheck, CheckCircle2, AlertTriangle, ChevronRight, ExternalLink,
} from 'lucide-react';
import api from '@/lib/api';
import { compact, money } from '@/lib/format';
import { refreshLists, setInList } from '@/lib/buyerLists';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import CouponField from '@/components/buying/CouponField';
import { CompareToggle } from '@/components/buying/ListButtons';
import CompareBar from '@/components/buying/CompareBar';

// The cart (Module 6): every site the buyer added, a coupon, and one button
// that places an order per site. Each order then runs on its own.

const Metric = ({ label, value }) => (
  <span className="text-[12px] text-ink-faint">{label} <span className="font-semibold tabular-nums text-ink-soft">{value || '–'}</span></span>
);

const Done = ({ result }) => (
  <div className="mx-auto max-w-3xl pb-20">
    <div className="rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
      <CheckCircle2 size={32} className="text-success" />
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
        {result.orders.length} order{result.orders.length === 1 ? '' : 's'} placed
      </h1>
      <p className="mt-1 text-[14px] text-ink-soft">
        After checkout, open each order and paste the article (or the topic), target URL and anchor text. The publisher then publishes it.
      </p>
      <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
        {result.orders.map((o) => (
          <li key={o._id}>
            <Link href={`/orders/${o._id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{o.site?.domain}</span>
              <span className="text-right text-[14px] tabular-nums">
                {o.discount > 0 && <span className="mr-2 text-[12px] text-ink-faint line-through">{money(o.price)}</span>}
                <span className="font-semibold text-ink">{money(o.price - (o.discount || 0))}</span>
              </span>
              <ChevronRight size={16} className="text-ink-faint" />
            </Link>
          </li>
        ))}
      </ul>
      {result.skipped?.length > 0 && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4 text-[13px] text-amber-900">
          <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> Not ordered</p>
          <ul className="mt-1 list-disc pl-5">
            {result.skipped.map((s) => <li key={s.listingId}>{s.domain || 'A website'}: {s.message}</li>)}
          </ul>
        </div>
      )}
      <dl className="mt-5 space-y-1 text-[14px]">
        <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="tabular-nums">{money(result.subtotal)}</dd></div>
        {result.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Coupon {result.coupon}</dt><dd className="tabular-nums">−{money(result.discount)}</dd></div>}
        <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(result.total)}</dd></div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button href="/orders">Go to my orders</Button>
        <Button href="/sites" variant="secondary">Find more sites</Button>
      </div>
    </div>
  </div>
);

const Cart = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // Set of listing ids, null = all
  const [coupon, setCoupon] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');

  const load = () => api.get('/cart')
    .then(({ data: d }) => { setData(d); setError(''); })
    .catch(() => setError('Could not load your cart.'));

  useEffect(() => { load(); }, []);

  const available = useMemo(() => (data?.items || []).filter((i) => i.available), [data]);
  const unavailable = useMemo(() => (data?.items || []).filter((i) => !i.available), [data]);
  const chosen = useMemo(
    () => available.filter((i) => !selected || selected.has(i.listingId)),
    [available, selected],
  );
  const chosenIds = chosen.map((i) => i.listingId);
  const subtotal = chosen.reduce((sum, i) => sum + (i.listing.price || 0), 0);
  const discount = coupon ? coupon.discount : 0;

  // A different selection changes what the coupon takes off; check it again.
  const toggle = (id) => {
    const next = new Set(selected || available.map((i) => i.listingId));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setCoupon(null);
  };
  const allOn = chosen.length === available.length;
  const toggleAll = () => {
    setSelected(allOn ? new Set() : null);
    setCoupon(null);
  };

  const remove = async (id, { save = false } = {}) => {
    setBusy(id);
    try {
      if (save) await setInList('saved', id, true);
      await setInList('cart', id, false);
      setData((d) => ({ ...d, items: d.items.filter((i) => i.listingId !== id), total: d.total - 1 }));
      setCoupon(null);
    } catch (e) {
      window.alert(e.message);
    } finally {
      setBusy('');
    }
  };

  const clearUnavailable = async () => {
    for (const i of unavailable) {
      // eslint-disable-next-line no-await-in-loop
      await setInList('cart', i.listingId, false).catch(() => {});
    }
    load();
  };

  const checkout = async () => {
    setPlacing(true);
    setCheckoutError('');
    try {
      const { data: d } = await api.post('/cart/checkout', {
        listingIds: chosenIds,
        ...(coupon ? { couponCode: coupon.code } : {}),
      });
      setResult(d);
      refreshLists();
      window.scrollTo({ top: 0 });
    } catch (err) {
      setCheckoutError(err.response?.data?.message || 'Could not place the orders. Please try again.');
      if (err.response?.data?.field === 'couponCode') setCoupon(null);
    } finally {
      setPlacing(false);
    }
  };

  if (result) return <Done result={result} />;

  return (
    <div className="mx-auto max-w-6xl pb-24">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Cart</h1>
          <p className="mt-1 text-[14px] text-ink-soft">Order several guest posts at once. Each site becomes its own order with its own publisher.</p>
        </div>
        <Button href="/sites" variant="secondary">Find more sites</Button>
      </div>

      {error ? (
        <p className="rounded-2xl border border-line bg-white p-12 text-center text-[14px] text-danger">{error}</p>
      ) : !data ? (
        <div className="rounded-2xl border border-line bg-white p-16 text-center"><Loader2 size={24} className="mx-auto animate-spin text-brand-500" /></div>
      ) : data.items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-16 text-center shadow-[var(--shadow-card)]">
          <ShoppingCart size={32} className="mx-auto mb-3 text-ink-faint opacity-60" strokeWidth={1.5} />
          <p className="text-[15px] font-semibold text-ink">Your cart is empty</p>
          <p className="mt-1 text-[13px] text-ink-soft">Add sites from the publisher list, your saved sites or the domain checker.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button href="/sites">Browse publishers</Button>
            <Button href="/saved" variant="secondary">Saved sites</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
            {available.length > 0 && (
              <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
                <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink">
                  <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={allOn} onChange={toggleAll} />
                  {chosen.length} of {available.length} selected
                </label>
              </div>
            )}
            <ul className="divide-y divide-line">
              {available.map(({ listingId, listing }) => {
                const on = !selected || selected.has(listingId);
                return (
                  <li key={listingId} className={`flex gap-3 px-4 py-4 sm:px-6 ${on ? '' : 'bg-canvas/60'}`}>
                    <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-brand-600" checked={on} onChange={() => toggle(listingId)} aria-label={`Include ${listing.domain}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link href={`/sites/${listing.domain}`} className="truncate text-[15px] font-semibold text-ink hover:text-brand-700">{listing.domain}</Link>
                        <a href={listing.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Open ${listing.domain}`} className="text-ink-faint hover:text-brand-700"><ExternalLink size={12} /></a>
                        {listing.isVerified && <BadgeCheck size={15} className="text-brand-600" aria-label="Verified" />}
                        {listing.googleNews && <Badge tone="brand">Google News</Badge>}
                        {listing.linkType === 'nofollow' && <Badge>Nofollow</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <Metric label="DR" value={listing.dr} />
                        <Metric label="DA" value={listing.da} />
                        <Metric label="Traffic" value={compact(listing.traffic)} />
                        <Metric label="Turnaround" value={`${listing.turnaroundDays ?? 3}d`} />
                        <span className="text-[12px] text-ink-faint">by {listing.seller?.name || 'Publisher'}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <button type="button" disabled={busy === listingId} onClick={() => remove(listingId, { save: true })} className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-soft hover:text-brand-700 disabled:opacity-50">
                          <Heart size={12} /> Save for later
                        </button>
                        <button type="button" disabled={busy === listingId} onClick={() => remove(listingId)} className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-soft hover:text-danger disabled:opacity-50">
                          <Trash2 size={12} /> Remove
                        </button>
                        <CompareToggle listing={listing} />
                      </div>
                    </div>
                    <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">{money(listing.price)}</span>
                  </li>
                );
              })}
            </ul>
            {unavailable.length > 0 && (
              <div className="border-t border-line bg-canvas px-4 py-3 sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-ink-soft">No longer available ({unavailable.length})</p>
                  <Button size="sm" variant="ghost" onClick={clearUnavailable}>Remove all</Button>
                </div>
                <ul className="mt-1 space-y-1">
                  {unavailable.map((i) => (
                    <li key={i.listingId} className="flex items-center justify-between gap-2 text-[13px] text-ink-faint">
                      <span className="truncate line-through">{i.listing?.domain || 'Removed website'}</span>
                      <button type="button" onClick={() => remove(i.listingId)} aria-label="Remove" className="rounded p-1 hover:bg-white hover:text-danger"><Trash2 size={13} /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
              <h2 className="text-[15px] font-semibold text-ink">Summary</h2>
              <dl className="mt-3 space-y-1.5 text-[14px]">
                <div className="flex justify-between"><dt className="text-ink-soft">{chosen.length} site{chosen.length === 1 ? '' : 's'}</dt><dd className="tabular-nums">{money(subtotal)}</dd></div>
                {discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Coupon</dt><dd className="tabular-nums">−{money(discount)}</dd></div>}
                <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-ink"><dt>Total</dt><dd className="tabular-nums">{money(Math.max(0, subtotal - discount))}</dd></div>
              </dl>
              <div className="mt-4">
                {chosen.length > 0 && <CouponField listingIds={chosenIds} applied={coupon} onApply={setCoupon} />}
              </div>
              <Button size="lg" className="mt-4 w-full" onClick={checkout} loading={placing} disabled={!chosen.length}>
                Place {chosen.length || ''} order{chosen.length === 1 ? '' : 's'}
              </Button>
              {checkoutError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">{checkoutError}</p>}
              <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
                Next you send each order its article and link details. To order one site with everything in one step, use its Buy button. By placing these orders you agree to our{' '}
                <Link href="/terms" target="_blank" className="font-medium text-brand-700 hover:underline">Terms</Link> and{' '}
                <Link href="/refund-policy" target="_blank" className="font-medium text-brand-700 hover:underline">Refund Policy</Link>.
              </p>
            </div>
          </aside>
        </div>
      )}
      <CompareBar />
    </div>
  );
};

export default Cart;
