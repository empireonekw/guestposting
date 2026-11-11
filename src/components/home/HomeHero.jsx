import Link from 'next/link';
import { Search, ShieldCheck, BarChart3, Globe2 } from 'lucide-react';
import Flag from '@/components/ui/Flag';

const DR_OPTIONS = [
  ['', 'Any DR'],
  ['20', 'DR 20+'],
  ['30', 'DR 30+'],
  ['50', 'DR 50+'],
  ['70', 'DR 70+'],
];

const selectCls =
  'h-12 w-full appearance-none rounded-xl border border-white/10 bg-white/95 px-3.5 text-[15px] text-ink outline-none focus:ring-4 focus:ring-brand-400/40';

// The dark hero with the search that opens the publisher list. It is a plain
// GET form, so it works before any JavaScript loads.
const HomeHero = ({ taxonomy, stats }) => {
  const countries = [...taxonomy.countries].sort((a, b) => a.name.localeCompare(b.name));
  const quickCountries = ['us', 'gb', 'ca', 'au', 'in', 'ae'].map((c) => taxonomy.countries.find((x) => x.code === c)).filter(Boolean);

  return (
    <section className="bg-aurora relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[13px] font-medium text-mist">
            <ShieldCheck size={14} /> Every publisher reviewed by our team
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Guest posts on <span className="text-gradient">real sites</span> with real traffic
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-mist/80 sm:text-lg">
            Search publishers by niche, country and authority. Compare DR, DA, traffic and price side by side, then order in a few clicks.
          </p>
        </div>

        <form action="/sites" method="get" className="mx-auto mt-10 max-w-4xl rounded-2xl border border-white/10 bg-white/10 p-3 shadow-[var(--shadow-pop)] backdrop-blur-md">
          <div className="grid gap-3 md:grid-cols-[1.4fr_1.2fr_0.8fr_auto]">
            <label className="sr-only" htmlFor="hero-niche">Niche</label>
            <select id="hero-niche" name="niche" defaultValue="" className={selectCls}>
              <option value="">All niches</option>
              {taxonomy.niches.map((n) => <option key={n.slug} value={n.slug}>{n.name}</option>)}
            </select>
            <label className="sr-only" htmlFor="hero-country">Country</label>
            <select id="hero-country" name="country" defaultValue="" className={selectCls}>
              <option value="">All countries</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
            <label className="sr-only" htmlFor="hero-dr">Minimum DR</label>
            <select id="hero-dr" name="minDR" defaultValue="" className={selectCls}>
              {DR_OPTIONS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </select>
            <button type="submit" className="bg-brand-gradient inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold text-white shadow-lg shadow-brand-900/40 transition hover:brightness-110">
              <Search size={18} /> Find sites
            </button>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[13px] text-mist/70">
          <span>Popular:</span>
          {quickCountries.map((c) => (
            <Link key={c.code} href={`/sites/country/${c.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-mist hover:border-white/25 hover:bg-white/10">
              <Flag code={c.code} name={c.name} /> {c.name}
            </Link>
          ))}
        </div>

        <dl className="mx-auto mt-14 grid max-w-3xl grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/5 py-5 text-center">
          {[
            [Globe2, stats.sites.toLocaleString(), 'Live publishers'],
            [BarChart3, String(stats.countries), 'Countries'],
            [ShieldCheck, String(stats.niches), 'Niches'],
          ].map(([Icon, value, label]) => (
            <div key={label} className="px-2">
              <dt className="flex items-center justify-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-mist/60">
                <Icon size={13} /> {label}
              </dt>
              <dd className="mt-1 text-2xl font-bold text-white sm:text-3xl">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

export default HomeHero;
