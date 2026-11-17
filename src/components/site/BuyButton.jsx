'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LEGAL from '@/data/legal';
import { ShoppingCart } from 'lucide-react';
import api from '@/lib/api';
import { compact, money } from '@/lib/format';
import useSession from '@/lib/useSession';
import { refreshLists } from '@/lib/buyerLists';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import CouponField from '@/components/buying/CouponField';

// "Buy" for one listing: sends signed-out visitors to sign in (and back),
// otherwise confirms and places the order (with an optional coupon).
const BuyButton = ({ listing, size = 'sm', className = '', label = 'Buy' }) => {
  const router = useRouter();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [coupon, setCoupon] = useState(null);
  const [state, setState] = useState({ loading: false, error: '' });

  const start = () => {
    if (!user) {
      const here = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?next=${encodeURIComponent(here)}`);
      return;
    }
    setState({ loading: false, error: '' });
    setCoupon(null);
    setOpen(true);
  };

  const placeOrder = async () => {
    setState({ loading: true, error: '' });
    try {
      const { data } = await api.post('/orders', { listingId: listing._id, ...(coupon ? { couponCode: coupon.code } : {}) });
      refreshLists();
      router.push(`/orders/${data._id}`);
    } catch (err) {
      setState({ loading: false, error: err.response?.data?.message || 'Could not place the order. Please try again.' });
    }
  };

  return (
    <>
      <Button size={size} className={className} onClick={start}><ShoppingCart size={14} /> {label}</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Order a guest post"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={placeOrder} loading={state.loading}>Place order</Button>
          </>
        )}
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-ink">{listing.domain || listing.url}</span>
            <span className="text-right">
              {coupon && <span className="block text-[13px] tabular-nums text-ink-faint line-through">{money(listing.price)}</span>}
              <span className="text-lg font-bold tabular-nums">{money(coupon ? coupon.total : listing.price)}</span>
            </span>
          </div>
          <p className="text-ink-soft">
            DR {listing.dr || '–'} · DA {listing.da || '–'} · {compact(listing.traffic)} monthly traffic · usually published in {listing.turnaroundDays ?? 3} day{listing.turnaroundDays === 1 ? '' : 's'}
          </p>
          <CouponField listingIds={[listing._id]} applied={coupon} onApply={setCoupon} />
          <p className="rounded-lg bg-canvas px-3 py-2 text-[13px] text-ink-soft">
            After you place the order you send the publisher your article or brief, target URL and anchor text.
          </p>
          <p className="text-[12px] text-ink-faint">
            The publisher has {LEGAL.sellerAcceptHours} hours to accept. Then you send your brief. By placing the order you agree to our{' '}
            <Link href="/terms" target="_blank" className="font-medium text-brand-700 hover:underline">Terms</Link> and{' '}
            <Link href="/refund-policy" target="_blank" className="font-medium text-brand-700 hover:underline">Refund Policy</Link>.
          </p>
          {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">{state.error}</p>}
        </div>
      </Dialog>
    </>
  );
};

export default BuyButton;
