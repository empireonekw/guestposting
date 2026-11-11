import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import connectDB from '@/server/db';
import { getTaxonomy } from '@/server/taxonomy';
import { countByNicheAndCountry } from '@/server/listingSearch';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Guest posting sites by niche',
  description: 'Browse guest posting and link insertion sites in more than 60 niches and their sub-niches.',
  alternates: { canonical: '/sites/niche' },
};

const safeCounts = async () => {
  try {
    await connectDB();
    return await countByNicheAndCountry();
  } catch {
    return { niches: {}, countries: {} };
  }
};

export default async function Page() {
  const [taxonomy, counts] = await Promise.all([getTaxonomy(), safeCounts()]);
  const total = (n) => (counts.niches[n.slug] || 0) + n.children.reduce((s, c) => s + (counts.niches[c.slug] || 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-[13px] text-ink-faint">
        <Link href="/" className="hover:text-ink">Home</Link>
        <ChevronRight size={12} />
        <Link href="/sites" className="hover:text-ink">Publishers</Link>
        <ChevronRight size={12} />
        <span className="text-ink-soft">Niches</span>
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Guest posting sites by niche</h1>
      <p className="mt-2 max-w-3xl text-[15px] text-ink-soft">Pick a niche to see its publishers. A site can belong to several niches.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {taxonomy.niches.map((n) => (
          <div key={n.slug} className="rounded-xl border border-line p-4">
            <Link href={`/sites/niche/${n.slug}`} className="flex items-center justify-between gap-2 font-semibold text-ink hover:text-brand-700">
              {n.name}
              <span className="text-[12px] font-medium tabular-nums text-ink-faint">{total(n).toLocaleString()} sites</span>
            </Link>
            {n.children.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {n.children.map((c) => (
                  <Link key={c.slug} href={`/sites/niche/${c.slug}`} className="text-[13px] text-ink-soft hover:text-brand-700">
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
