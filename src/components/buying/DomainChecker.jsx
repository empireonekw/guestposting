'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScanSearch, Download, ShoppingCart, BadgeCheck, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { compact, money } from '@/lib/format';
import useSession from '@/lib/useSession';
import { addManyToCart } from '@/lib/buyerLists';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { CartButton, SaveButton } from './ListButtons';

const MAX = 500;
const VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'listed', label: 'Available' },
  { key: 'missing', label: 'Not listed' },
];

const csvCell = (v) => {
  const t = String(v ?? '');
  return /[",\n]/.test(t) || /^[=+\-@]/.test(t) ? `"${t.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"` : t;
};

// The bulk domain checker (Module 6).
const DomainChecker = () => {
  const router = useRouter();
  const { user } = useSession();
  const [text, setText] = useState('');
  const [data, setData] = useState(null);
  const [view, setView] = useState('all');
  const [state, setState] = useState({ loading: false, error: '' });
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);

  const lines = text.split(/[\s,;]+/).filter(Boolean).length;

  const check = async (e) => {
    e.preventDefault();
    setState({ loading: true, error: '' });
    setNote('');
    try {
      const { data: d } = await api.post('/tools/domain-check', { domains: text });
      setData(d);
      setView('all');
      setState({ loading: false, error: '' });
    } catch (err) {
      setState({ loading: false, error: err.response?.data?.message || 'The check failed. Please try again.' });
    }
  };

  const listed = (data?.results || []).filter((r) => r.listed);
  const shown = (data?.results || []).filter((r) => (view === 'listed' ? r.listed : view === 'missing' ? !r.listed : true));

  const addAll = async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent('/tools/domain-checker')}`);
      return;
    }
    setAdding(true);
    try {
      const res = await addManyToCart(listed.map((r) => r.listingId));
      const skipped = res.skipped?.length ? ` ${res.skipped.length} skipped: ${res.skipped[0].message}` : '';
      setNote(`${res.added.length} site${res.added.length === 1 ? '' : 's'} added to your cart.${skipped}`);
    } catch (err) {
      setNote(err.response?.data?.message || 'Could not add them to your cart.');
    } finally {
      setAdding(false);
    }
  };

  const download = () => {
    const head = ['Domain', 'Status', 'Price from (USD)', 'Offers', 'DR', 'DA', 'Traffic', 'Verified'];
    const body = data.results.map((r) => [
      r.domain || r.input,
      !r.valid ? 'Not a domain' : r.listed ? 'Available' : 'Not listed',
      r.listed ? r.price : '', r.offers || '', r.dr ?? '', r.da ?? '', r.traffic ?? '', r.listed ? (r.verified ? 'yes' : 'no') : '',
    ]);
    const csv = [head, ...body].map((row) => row.map(csvCell).join(',')).join('\n');
    const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = href;
    a.download = 'domain-check.csv';
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={check} className="rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
        <label htmlFor="domains" className="block text-[13px] font-medium text-ink">Domains or URLs, one per line</label>
        <textarea
          id="domains"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={'example.com\nhttps://www.another-site.org/blog/post\nthird-site.net'}
          className="mt-1.5 w-full rounded-[var(--radius-control)] border border-line px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className={`text-[12px] ${lines > MAX ? 'font-medium text-danger' : 'text-ink-faint'}`}>{lines} of {MAX} domains</p>
          <Button type="submit" loading={state.loading} disabled={!lines || lines > MAX}>
            {!state.loading && <ScanSearch size={16} />} Check domains
          </Button>
        </div>
        {state.error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">{state.error}</p>}
      </form>

      {data && (
        <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]" aria-live="polite">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap gap-1" role="tablist">
              {VIEWS.map((v) => {
                const n = v.key === 'all' ? data.counts.checked : v.key === 'listed' ? data.counts.listed : data.counts.checked - data.counts.listed;
                return (
                  <button key={v.key} type="button" role="tab" aria-selected={view === v.key} onClick={() => setView(v.key)} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium ${view === v.key ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-line-soft hover:text-ink'}`}>
                    {v.label} <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11px] tabular-nums text-ink-soft">{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={download}><Download size={14} /> CSV</Button>
              {listed.length > 0 && (
                <Button size="sm" onClick={addAll} loading={adding}>{!adding && <ShoppingCart size={14} />} Add {listed.length} to cart</Button>
              )}
            </div>
          </div>
          {note && <p role="status" className="border-b border-line bg-canvas px-5 py-2.5 text-[13px] text-ink">{note} <Link href="/cart" className="font-medium text-brand-700 hover:underline">Open cart</Link></p>}

          {shown.length === 0 ? (
            <p className="p-10 text-center text-[14px] text-ink-faint">Nothing here.</p>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((r) => (
                <li key={r.domain || r.input} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {!r.valid ? <AlertCircle size={16} className="shrink-0 text-amber-600" /> : r.listed ? <CheckCircle2 size={16} className="shrink-0 text-success" /> : <XCircle size={16} className="shrink-0 text-ink-faint" />}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.listed ? (
                          <Link href={`/sites/${r.domain}`} className="truncate text-[14px] font-semibold text-ink hover:text-brand-700">{r.domain}</Link>
                        ) : (
                          <span className={`truncate text-[14px] ${r.valid ? 'text-ink-soft' : 'text-ink-faint'}`}>{r.domain || r.input}</span>
                        )}
                        {r.verified && <BadgeCheck size={14} className="text-brand-600" aria-label="Verified" />}
                        {r.googleNews && <Badge tone="brand">Google News</Badge>}
                        {r.offers > 1 && <Badge>{r.offers} sellers</Badge>}
                      </div>
                      <p className="text-[12px] text-ink-faint">
                        {!r.valid ? 'Not a valid domain' : r.listed ? `DR ${r.dr || '–'} · DA ${r.da || '–'} · ${compact(r.traffic)} traffic` : 'Not on our marketplace yet'}
                      </p>
                    </div>
                  </div>
                  {r.listed && (
                    <div className="flex items-center gap-2 pl-6 sm:pl-0">
                      <span className="mr-1 text-[14px] font-semibold tabular-nums text-ink">{r.offers > 1 ? 'from ' : ''}{money(r.price)}</span>
                      <SaveButton listing={{ _id: r.listingId, domain: r.domain }} />
                      <CartButton listing={{ _id: r.listingId, domain: r.domain }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};

export default DomainChecker;
