'use client';

import { useState } from 'react';
import { Tag, X } from 'lucide-react';
import api from '@/lib/api';
import { money } from '@/lib/format';
import Button from '@/components/ui/Button';

// "Have a coupon?" for the cart and the Buy dialog (Module 6). Checks the
// code against these websites and reports the discount to the parent;
// the server checks it again when the order is placed.
const CouponField = ({ listingIds, applied, onApply }) => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [state, setState] = useState({ loading: false, error: '' });

  const apply = async (e) => {
    e?.preventDefault();
    if (!code.trim()) return;
    setState({ loading: true, error: '' });
    try {
      const { data } = await api.post('/coupons/preview', { code: code.trim(), ...(listingIds ? { listingIds } : {}) });
      onApply(data);
      setState({ loading: false, error: '' });
    } catch (err) {
      setState({ loading: false, error: err.response?.data?.message || 'Could not check this code.' });
    }
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px]">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-semibold text-emerald-800"><Tag size={13} /> {applied.code} · −{money(applied.discount)}</span>
          <span className="block truncate text-[12px] text-emerald-700">{applied.description || applied.summary}</span>
        </span>
        <button type="button" onClick={() => { onApply(null); setCode(''); }} aria-label="Remove coupon" className="rounded p-1 text-emerald-700 hover:bg-emerald-100">
          <X size={14} />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:underline">
        <Tag size={13} /> Have a coupon code?
      </button>
    );
  }

  return (
    <form onSubmit={apply} className="space-y-1.5">
      <div className="flex gap-2">
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Coupon code"
          aria-label="Coupon code"
          maxLength={32}
          className="h-9 min-w-0 flex-1 rounded-lg border border-line px-2.5 text-sm uppercase tracking-wide outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
        />
        <Button size="sm" type="submit" variant="secondary" className="h-9" loading={state.loading}>Apply</Button>
      </div>
      {state.error && <p className="text-[12px] font-medium text-danger">{state.error}</p>}
    </form>
  );
};

export default CouponField;
