'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Heart, Loader2, Trash2, BadgeCheck, ShoppingCart } from 'lucide-react';
import api from '@/lib/api';
import { compact, money } from '@/lib/format';
import { setInList, addManyToCart } from '@/lib/buyerLists';
import Pagination from '@/components/Pagination';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { CartButton, CompareToggle } from '@/components/buying/ListButtons';
import CompareBar from '@/components/buying/CompareBar';

// Saved sites, the buyer's wishlist (Module 6).

const day = (d) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

const Saved = () => {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const seq = useRef(0);

  const load = () => {
    const n = ++seq.current;
    api.get(`/saved?page=${page}`)
      .then(({ data: d }) => { if (n === seq.current) { setData(d); setError(''); } })
      .catch(() => { if (n === seq.current) setError('Could not load your saved sites.'); });
  };
  useEffect(load, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (id) => {
    try {
      await setInList('saved', id, false);
      setData((d) => ({ ...d, items: d.items.filter((i) => i.listingId !== id), total: d.total - 1 }));
    } catch (e) {
      setNote(e.message);
    }
  };

  const addAll = async () => {
    const ids = (data?.items || []).filter((i) => i.available).map((i) => i.listingId);
    if (!ids.length) return;
    setAdding(true);
    try {
      const res = await addManyToCart(ids);
      const skipped = res.skipped?.length ? ` ${res.skipped.length} couldn’t be added: ${res.skipped[0].message}` : '';
      setNote(`${res.added.length} site${res.added.length === 1 ? '' : 's'} added to your cart.${skipped}`);
    } catch (err) {
      setNote(err.response?.data?.message || 'Could not add them to your cart.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl pb-24">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Saved sites</h1>
          <p className="mt-1 text-[14px] text-ink-soft">Sites you saved with the heart. Add them to your cart when you’re ready to order.</p>
        </div>
        <div className="flex gap-2">
          {data?.items?.some((i) => i.available) && (
            <Button variant="secondary" onClick={addAll} loading={adding}>{!adding && <ShoppingCart size={15} />} Add page to cart</Button>
          )}
          <Button href="/cart">Open cart</Button>
        </div>
      </div>

      {note && <p role="status" className="mb-4 rounded-xl border border-line bg-white px-4 py-3 text-[13px] text-ink">{note}</p>}

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
        {error ? (
          <p className="p-12 text-center text-[14px] text-danger">{error}</p>
        ) : !data ? (
          <div className="p-16 text-center"><Loader2 size={24} className="mx-auto animate-spin text-brand-500" /></div>
        ) : data.items.length === 0 ? (
          <div className="p-16 text-center">
            <Heart size={32} className="mx-auto mb-3 text-ink-faint opacity-60" strokeWidth={1.5} />
            <p className="text-[15px] font-semibold text-ink">No saved sites yet</p>
            <p className="mt-1 text-[13px] text-ink-soft">Tap the heart next to any publisher to keep it here.</p>
            <Button href="/sites" className="mt-4">Browse publishers</Button>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map(({ listingId, listing, available, addedAt }) => (
              <li key={listingId} className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6 ${available ? '' : 'bg-canvas/60'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {available ? (
                      <Link href={`/sites/${listing.domain}`} className="truncate text-[15px] font-semibold text-ink hover:text-brand-700">{listing.domain}</Link>
                    ) : (
                      <span className="truncate text-[15px] font-semibold text-ink-faint line-through">{listing?.domain || 'Removed website'}</span>
                    )}
                    {available && listing.isVerified && <BadgeCheck size={15} className="text-brand-600" aria-label="Verified" />}
                    {!available && <Badge>No longer available</Badge>}
                  </div>
                  <p className="mt-1 text-[12px] text-ink-faint">
                    {available && `DR ${listing.dr || '–'} · DA ${listing.da || '–'} · ${compact(listing.traffic)} traffic · `}saved {day(addedAt)}
                  </p>
                  {available && <CompareToggle listing={listing} className="mt-1.5" />}
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  {available && <span className="mr-1 text-[15px] font-semibold tabular-nums text-ink">{money(listing.price)}</span>}
                  {available && <CartButton listing={listing} withLabel />}
                  <button type="button" onClick={() => remove(listingId)} aria-label={`Remove ${listing?.domain || 'site'} from saved`} title="Remove" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:bg-red-50 hover:text-danger">
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data && (
          <div className="border-t border-line px-6">
            <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} label="sites" />
          </div>
        )}
      </section>
      <CompareBar />
    </div>
  );
};

export default Saved;
