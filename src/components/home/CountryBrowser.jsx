'use client';

import { useState } from 'react';
import Link from 'next/link';
import Flag from '@/components/ui/Flag';

// Browse by country, one continent at a time.
const CountryBrowser = ({ countries, continents, counts }) => {
  const shown = continents.filter((c) => countries.some((x) => x.continent === c.id));
  const [tab, setTab] = useState(shown[0]?.id);

  return (
    <div>
      <div role="tablist" aria-label="Continents" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {shown.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={tab === c.id}
            onClick={() => setTab(c.id)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === c.id ? 'bg-brand-600 text-white shadow-sm' : 'border border-line bg-white text-ink-soft hover:border-brand-200 hover:text-ink'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {countries.filter((c) => c.continent === tab).map((c) => (
          <Link
            key={c.code}
            href={`/sites/country/${c.slug}`}
            className="group flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-brand-200"
          >
            <Flag code={c.code} name={c.name} className="!h-6 !w-8" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink group-hover:text-brand-700">{c.name}</span>
              <span className="block text-[12px] text-ink-faint">{(counts[c.code] || 0).toLocaleString()} sites</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default CountryBrowser;
