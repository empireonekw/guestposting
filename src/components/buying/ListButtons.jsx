'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingCart, Check, GitCompareArrows } from 'lucide-react';
import useSession from '@/lib/useSession';
import useBuyerLists, { setInList } from '@/lib/buyerLists';
import useCompare, { toggleCompare, MAX_COMPARE } from '@/lib/compare';
import Button from '@/components/ui/Button';

// Save (heart), add-to-cart and compare buttons for one listing (Module 6).
// Signed-out visitors are sent to sign in and brought back.

const useSignInFirst = () => {
  const router = useRouter();
  const { user } = useSession();
  return (fn) => () => {
    if (!user) {
      const here = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?next=${encodeURIComponent(here)}`);
      return;
    }
    fn();
  };
};

// A brief note under a button when something goes wrong.
const useFlash = () => {
  const [note, setNote] = useState('');
  const flash = (text) => {
    setNote(text);
    setTimeout(() => setNote(''), 3500);
  };
  return [note, flash];
};

const Note = ({ text }) => (text ? (
  <span role="status" className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg bg-ink px-2.5 py-1.5 text-left text-[12px] font-normal leading-snug text-white shadow-[var(--shadow-pop)]">
    {text}
  </span>
) : null);

export const SaveButton = ({ listing, withLabel = false, className = '' }) => {
  const lists = useBuyerLists();
  const guard = useSignInFirst();
  const [note, flash] = useFlash();
  const saved = lists.saved.has(listing._id);
  const label = saved ? 'Saved' : 'Save';
  const click = guard(() => setInList('saved', listing._id, !saved).catch((e) => flash(e.message)));
  return (
    <span className="relative inline-flex">
      {withLabel ? (
        <Button variant="secondary" className={className} onClick={click} aria-pressed={saved}>
          <Heart size={16} className={saved ? 'fill-rose-500 text-rose-500' : ''} /> {label}
        </Button>
      ) : (
        <button
          type="button"
          onClick={click}
          aria-pressed={saved}
          aria-label={`${saved ? 'Remove' : 'Save'} ${listing.domain}${saved ? ' from saved sites' : ''}`}
          title={saved ? 'Saved — click to remove' : 'Save for later'}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white hover:border-rose-200 hover:bg-rose-50 ${className}`}
        >
          <Heart size={15} className={saved ? 'fill-rose-500 text-rose-500' : 'text-ink-faint'} />
        </button>
      )}
      <Note text={note} />
    </span>
  );
};

export const CartButton = ({ listing, size = 'sm', withLabel = false, className = '' }) => {
  const lists = useBuyerLists();
  const router = useRouter();
  const guard = useSignInFirst();
  const [busy, setBusy] = useState(false);
  const [note, flash] = useFlash();
  const inCart = lists.cart.has(listing._id);

  const add = guard(async () => {
    if (inCart) {
      router.push('/cart');
      return;
    }
    setBusy(true);
    try {
      await setInList('cart', listing._id, true);
    } catch (e) {
      flash(e.message);
    } finally {
      setBusy(false);
    }
  });

  return (
    <span className="relative inline-flex">
      {withLabel ? (
        <Button variant={inCart ? 'secondary' : 'dark'} size={size} className={className} onClick={add} loading={busy}>
          {!busy && (inCart ? <Check size={15} /> : <ShoppingCart size={15} />)}
          {inCart ? 'In cart — view' : 'Add to cart'}
        </Button>
      ) : (
        <button
          type="button"
          onClick={add}
          disabled={busy}
          aria-label={inCart ? `${listing.domain} is in your cart. Open cart` : `Add ${listing.domain} to cart`}
          title={inCart ? 'In your cart' : 'Add to cart'}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${inCart ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-faint hover:border-brand-200 hover:text-brand-700'} ${className}`}
        >
          {inCart ? <Check size={15} /> : <ShoppingCart size={15} />}
        </button>
      )}
      <Note text={note} />
    </span>
  );
};

export const CompareToggle = ({ listing, className = '', withLabel = true }) => {
  const list = useCompare();
  const [note, flash] = useFlash();
  const on = list.some((x) => x.id === listing._id);
  const change = () => {
    if (!toggleCompare({ id: listing._id, domain: listing.domain })) flash(`You can compare up to ${MAX_COMPARE} sites. Remove one first.`);
  };
  return (
    <span className="relative inline-flex">
      <label className={`inline-flex cursor-pointer select-none items-center gap-1.5 text-[12px] font-medium ${on ? 'text-brand-700' : 'text-ink-faint hover:text-ink-soft'} ${className}`} title="Compare side by side">
        <input type="checkbox" className="h-3.5 w-3.5 accent-brand-600" checked={on} onChange={change} aria-label={`Compare ${listing.domain}`} />
        {withLabel && <><GitCompareArrows size={12} aria-hidden="true" /> Compare</>}
      </label>
      <Note text={note} />
    </span>
  );
};
