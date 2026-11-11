import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import connectDB from '@/server/db';
import { getTaxonomy } from '@/server/taxonomy';
import { countByNicheAndCountry } from '@/server/listingSearch';
import Flag from '@/components/ui/Flag';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Guest posting sites by country',
  description: 'Find publishers with traffic from the USA, UK, Canada, Australia, India, the UAE and more, grouped by continent.',
  alternates: { canonical: '/sites/country' },
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-[13px] text-ink-faint">
        <Link href="/" className="hover:text-ink">Home</Link>
        <ChevronRight size={12} />
        <Link href="/sites" className="hover:text-ink">Publishers</Link>
        <ChevronRight size={12} />
        <span className="text-ink-soft">Countries</span>
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Guest posting sites by country</h1>
      <p className="mt-2 max-w-3xl text-[15px] text-ink-soft">
        A site appears under a country when it is based there or that country is one of its top three traffic sources.
      </p>

      <div className="mt-8 space-y-10">
        {taxonomy.continents.map((continent) => {
          const list = taxonomy.countries.filter((c) => c.continent === continent.id);
          if (!list.length) return null;
          return (
            <section key={continent.id} aria-labelledby={`c-${continent.id}`}>
              <h2 id={`c-${continent.id}`} className="mb-3 text-lg font-semibold text-ink">{continent.name}</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {list.map((c) => (
                  <Link key={c.code} href={`/sites/country/${c.slug}`} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 hover:border-brand-300 hover:bg-brand-50/40">
                    <Flag code={c.code} name={c.name} className="!h-[18px] !w-6" />
                    <span className="flex-1 text-sm font-medium text-ink">{c.name}</span>
                    <span className="text-[12px] tabular-nums text-ink-faint">{(counts.countries[c.code] || 0).toLocaleString()}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
