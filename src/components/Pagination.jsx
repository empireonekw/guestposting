'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

// Previous / page numbers / next for any paged list. `page` and `pages` come
// straight from the API's pageInfo().
const Pagination = ({ page, pages, total, limit, onChange, label = 'results' }) => {
  if (!total) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  // Show the first, last and up to two pages either side of the current one.
  const numbers = [];
  for (let p = 1; p <= pages; p += 1) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 2) numbers.push(p);
    else if (numbers[numbers.length - 1] !== '…') numbers.push('…');
  }

  const btn = 'min-w-10 h-10 px-3 rounded-lg text-[13px] font-semibold flex items-center justify-center transition-colors';

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4">
      <p className="text-[13px] text-slate-500">
        Showing <span className="font-semibold text-slate-900">{from}–{to}</span> of{' '}
        <span className="font-semibold text-slate-900">{total.toLocaleString()}</span> {label}
      </p>
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <ChevronLeft size={16} />
          </button>
          {numbers.map((n, i) =>
            n === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-slate-400">…</span>
            ) : (
              <button
                type="button"
                key={n}
                onClick={() => onChange(n)}
                aria-current={n === page ? 'page' : undefined}
                className={`${btn} ${n === page ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {n}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => onChange(page + 1)}
            disabled={page >= pages}
            aria-label="Next page"
            className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
};

export default Pagination;
