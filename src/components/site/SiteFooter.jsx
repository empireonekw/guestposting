import Link from 'next/link';
import Flag from '@/components/ui/Flag';
import { SITE_LISTS } from '@/data/siteLists';

const POPULAR_NICHES = ['technology-gadgets', 'business', 'finance', 'health', 'travel-tourism', 'saas', 'real-estate', 'crypto-blockchain'];
const POPULAR_COUNTRIES = ['us', 'gb', 'ca', 'au', 'in', 'ae', 'de'];

const Column = ({ title, children }) => (
  <div>
    <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wider text-ink">{title}</h3>
    <ul className="space-y-2.5 text-sm text-ink-soft">{children}</ul>
  </div>
);

const SiteFooter = ({ taxonomy }) => {
  const niches = POPULAR_NICHES.map((s) => taxonomy.niches.find((n) => n.slug === s)).filter(Boolean);
  const countries = POPULAR_COUNTRIES.map((c) => taxonomy.countries.find((x) => x.code === c)).filter(Boolean);

  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">L</span>
              <span className="text-lg font-semibold tracking-tight text-ink">LetRank</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              A marketplace for guest posts and link insertions on real publisher sites, with every listing reviewed before it goes live.
            </p>
          </div>

          <Column title="Publisher lists">
            <li><Link href="/sites" className="hover:text-brand-700">All publishers</Link></li>
            {SITE_LISTS.slice(0, 5).map((l) => (
              <li key={l.slug}><Link href={`/sites/${l.slug}`} className="hover:text-brand-700">{l.menuTitle}</Link></li>
            ))}
          </Column>

          <Column title="Popular niches">
            {niches.map((n) => (
              <li key={n.slug}><Link href={`/sites/niche/${n.slug}`} className="hover:text-brand-700">{n.name}</Link></li>
            ))}
          </Column>

          <Column title="Top countries">
            {countries.map((c) => (
              <li key={c.code}>
                <Link href={`/sites/country/${c.slug}`} className="inline-flex items-center gap-2 hover:text-brand-700">
                  <Flag code={c.code} name={c.name} /> {c.name}
                </Link>
              </li>
            ))}
          </Column>

          <Column title="LetRank">
            <li><Link href="/register" className="hover:text-brand-700">Sell guest posts</Link></li>
            <li><Link href="/login" className="hover:text-brand-700">Sign in</Link></li>
            <li><Link href="/#contact" className="hover:text-brand-700">Contact us</Link></li>
          </Column>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-line pt-6 text-[13px] text-ink-faint sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} LetRank. All rights reserved.</p>
          <p>Metrics are provided by publishers and reviewed by our team.</p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
