'use client';

import { usePathname } from 'next/navigation';
import { X, GitCompareArrows } from 'lucide-react';
import useCompare, { removeCompare, clearCompare, compareHref, MAX_COMPARE } from '@/lib/compare';
import Button from '@/components/ui/Button';

// The bar at the bottom of the publisher list while sites are picked for
// comparison (Module 6).
const CompareBar = () => {
  const list = useCompare();
  const pathname = usePathname();
  if (!list.length || pathname === '/compare') return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 shadow-[var(--shadow-pop)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <GitCompareArrows size={15} className="text-brand-600" /> Compare {list.length}/{MAX_COMPARE}
        </span>
        <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {list.map((x) => (
            <li key={x.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1 text-[12px] font-medium text-brand-800">
              <span className="max-w-40 truncate">{x.domain}</span>
              <button type="button" onClick={() => removeCompare(x.id)} aria-label={`Remove ${x.domain} from comparison`} className="rounded-full p-0.5 hover:bg-brand-100">
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" onClick={clearCompare}>Clear</Button>
        {list.length < 2 ? (
          <span className="text-[12px] text-ink-faint">Pick one more site</span>
        ) : (
          <Button size="sm" href={compareHref(list)}>Compare now</Button>
        )}
      </div>
    </div>
  );
};

export default CompareBar;
