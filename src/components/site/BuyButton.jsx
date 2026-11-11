'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import api from '@/lib/api';
import { compact, money } from '@/lib/format';
import useSession from '@/lib/useSession';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';

// "Buy" for one listing: sends signed-out visitors to sign in (and back),
// otherwise confirms and places the order.
const BuyButton = ({ listing, size = 'sm', className = '', label = 'Buy' }) => {
  const router = useRouter();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ loading: false, error: '' });

  const start = () => {
    if (!user) {
      const here = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?next=${encodeURIComponent(here)}`);
      return;
    }
    setState({ loading: false, error: '' });
    setOpen(true);
  };

  const placeOrder = async () => {
    setState({ loading: true, error: '' });
    try {
      await api.post('/orders', { listingId: listing._id });
      router.push('/orders');
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
            <span className="text-lg font-bold tabular-nums">{money(listing.price)}</span>
          </div>
          <p className="text-ink-soft">
            DR {listing.dr || '–'} · DA {listing.da || '–'} · {compact(listing.traffic)} monthly traffic · usually published in {listing.turnaroundDays ?? 3} day{listing.turnaroundDays === 1 ? '' : 's'}
          </p>
          <p className="rounded-lg bg-canvas px-3 py-2 text-[13px] text-ink-soft">
            After you place the order you send the publisher your article or brief, target URL and anchor text.
          </p>
          <p className="text-[12px] text-ink-faint">
            Your payment is held until the post is live and approved. By placing the order you agree to our{' '}
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
