import Link from 'next/link';
import Flag from '@/components/ui/Flag';
import { SITE_LISTS } from '@/data/siteLists';
import BRAND from '@/data/brand';
import Logo from '@/components/ui/Logo';
import { POLICIES } from '@/data/legal';

const POPULAR_NICHES = ['technology-gadgets', 'business', 'finance', 'health', 'travel-tourism', 'saas', 'real-estate', 'crypto-blockchain'];
const POPULAR_COUNTRIES = ['us', 'gb', 'ca', 'au', 'in', 'ae', 'de'];

const Column = ({ title, children }) => (
  <div>
    <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wider text-white">{title}</h3>
    <ul className="space-y-2.5 text-sm text-mist/75">{children}</ul>
  </div>
);

const SiteFooter = ({ taxonomy }) => {
  const niches = POPULAR_NICHES.map((s) => taxonomy.niches.find((n) => n.slug === s)).filter(Boolean);
  const countries = POPULAR_COUNTRIES.map((c) => taxonomy.countries.find((x) => x.code === c)).filter(Boolean);

  return (
    <footer className="bg-night text-mist">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link href="/" className="inline-flex" aria-label={`${BRAND.name} home`}>
              <Logo tone="light" size="md" />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-mist/70">
              A marketplace for guest posts and link insertions on real publisher sites, with every listing reviewed before it goes live.
            </p>
          </div>

          <Column title="Publisher lists">
            <li><Link href="/sites" className="hover:text-white">All publishers</Link></li>
            {SITE_LISTS.slice(0, 5).map((l) => (
              <li key={l.slug}><Link href={`/sites/${l.slug}`} className="hover:text-white">{l.menuTitle}</Link></li>
            ))}
          </Column>

          <Column title="Popular niches">
            {niches.map((n) => (
              <li key={n.slug}><Link href={`/sites/niche/${n.slug}`} className="hover:text-white">{n.name}</Link></li>
            ))}
          </Column>

          <Column title="Top countries">
            {countries.map((c) => (
              <li key={c.code}>
                <Link href={`/sites/country/${c.slug}`} className="inline-flex items-center gap-2 hover:text-white">
                  <Flag code={c.code} name={c.name} /> {c.name}
                </Link>
              </li>
            ))}
          </Column>

          <Column title={BRAND.name}>
            <li><Link href="/register" className="hover:text-white">Sell guest posts</Link></li>
            <li><Link href="/login" className="hover:text-white">Sign in</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact us</Link></li>
            <li><a href={`mailto:${BRAND.supportEmail}`} className="break-all hover:text-white">{BRAND.supportEmail}</a></li>
            <li className="pt-2 text-[12px] font-semibold uppercase tracking-wider text-white">Legal</li>
            {POLICIES.filter((p) => p.href !== '/contact').map((p) => (
              <li key={p.href}><Link href={p.href} className="hover:text-white">{p.title}</Link></li>
            ))}
          </Column>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-[13px] text-mist/50 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {BRAND.name}. All rights reserved. · {BRAND.tagline}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/refund-policy" className="hover:text-white">Refunds</Link>
            <span>Payments by Stripe</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
