import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import connectDB from '@/server/db';
import { getTaxonomy } from '@/server/taxonomy';
import { searchListings, pagingFrom } from '@/server/listingSearch';
import { ValidationError } from '@/server/validate';
import SitesExplorer from './SitesExplorer';

// URL search params as plain strings (the first value of repeated keys).
export const readParams = (searchParams) =>
  Object.fromEntries(
    Object.entries(searchParams || {})
      .map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
      .filter(([, v]) => typeof v === 'string' && v !== ''),
  );

// A server-rendered publisher list. `fixed` filters belong to the page itself
// (a niche, a country, a quick list) and are always applied.
const SitesPage = async ({ searchParams, fixed = {}, title, intro, basePath, crumbs = [], children }) => {
  const params = readParams(await searchParams);
  // A page's own filters can't be overridden from the address bar.
  Object.keys(fixed).forEach((k) => delete params[k]);

  const taxonomy = await getTaxonomy();
  const paging = pagingFrom(params);
  let data = { listings: [], total: 0, page: 1, pages: 1, limit: paging.limit };
  let error = null;
  try {
    await connectDB();
    data = await searchListings({ ...params, ...fixed }, paging);
  } catch (e) {
    if (e instanceof ValidationError) error = e.message;
    else {
      console.error(e);
      error = 'We could not load publishers right now. Please try again in a minute.';
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-[13px] text-ink-faint">
        <Link href="/" className="hover:text-ink">Home</Link>
        <ChevronRight size={12} />
        <Link href="/sites" className="hover:text-ink">Publishers</Link>
        {crumbs.map((c) => (
          <span key={c.href || c.label} className="inline-flex items-center gap-1">
            <ChevronRight size={12} />
            {c.href ? <Link href={c.href} className="hover:text-ink">{c.label}</Link> : <span className="text-ink-soft">{c.label}</span>}
          </span>
        ))}
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
      {intro && <p className="mt-2 max-w-3xl text-[15px] text-ink-soft">{intro}</p>}
      {children}
      <div className="mt-6">
        <SitesExplorer data={data} params={params} fixed={fixed} taxonomy={taxonomy} basePath={basePath} error={error} />
      </div>
    </div>
  );
};

export default SitesPage;
