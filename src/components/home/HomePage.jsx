import Link from 'next/link';
import {
  ArrowRight, Search, FileText, Rocket, BadgeCheck, Newspaper, Link2, Bitcoin, Star, TrendingUp, Zap, Megaphone, MapPin,
} from 'lucide-react';
import HomeHero from './HomeHero';
import CountryBrowser from './CountryBrowser';
import Contact from '@/components/landing/Contact';
import Badge from '@/components/ui/Badge';
import { buttonClass } from '@/components/ui/Button';

const POPULAR_NICHES = [
  'technology-gadgets', 'business', 'finance', 'health', 'saas', 'travel-tourism', 'real-estate', 'crypto-blockchain',
  'digital-marketing', 'home-garden', 'education', 'lifestyle',
];

const LISTS = [
  { slug: 'premium', icon: Star, title: 'Premium sites', text: 'DR 70+ publishers' },
  { slug: 'organic-traffic', icon: TrendingUp, title: 'Real traffic', text: '5,000+ visitors a month' },
  { slug: 'google-news', icon: Newspaper, title: 'Google News', text: 'News-approved publishers' },
  { slug: 'link-insertion', icon: Link2, title: 'Link insertions', text: 'Links in existing posts' },
  { slug: 'crypto', icon: Bitcoin, title: 'Crypto', text: 'Crypto and Web3 friendly' },
  { slug: 'fast-turnaround', icon: Zap, title: 'Fast publishing', text: 'Live within a day' },
];

const STEPS = [
  { icon: Search, title: 'Find a site', text: 'Filter thousands of publishers by niche, country, DR, traffic and price.' },
  { icon: FileText, title: 'Send your brief', text: 'Share your article or a brief, the target URL and the anchor text.' },
  { icon: Rocket, title: 'Get published', text: 'The publisher posts your article and sends you the live link.' },
  { icon: BadgeCheck, title: 'Check the link', text: 'Confirm the link is live and dofollow before the order is completed.' },
];

const SectionHead = ({ eyebrow, title, text, action }) => (
  <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-2xl">
      {eyebrow && <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>}
      <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
      {text && <p className="mt-2 text-[15px] text-ink-soft">{text}</p>}
    </div>
    {action}
  </div>
);

const HomePage = ({ taxonomy, counts, stats }) => {
  const nicheTotal = (n) => (counts.niches[n.slug] || 0) + n.children.reduce((s, c) => s + (counts.niches[c.slug] || 0), 0);
  const niches = POPULAR_NICHES.map((s) => taxonomy.niches.find((n) => n.slug === s)).filter(Boolean);

  return (
    <>
      <HomeHero taxonomy={taxonomy} stats={stats} />

      {/* Ready-made lists */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHead
          eyebrow="Start here"
          title="Ready-made publisher lists"
          text="Jump straight to the sites that fit your campaign."
          action={<Link href="/sites" className={buttonClass({ variant: 'secondary' })}>All publishers <ArrowRight size={16} /></Link>}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {LISTS.map(({ slug, icon: Icon, title, text }) => (
            <Link key={slug} href={`/sites/${slug}`} className="group rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-brand-200">
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                <Icon size={18} />
              </span>
              <span className="block font-semibold text-ink">{title}</span>
              <span className="mt-0.5 block text-[13px] text-ink-soft">{text}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Browse by country */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHead
            eyebrow="By country"
            title="Reach readers where your customers are"
            text="Sites appear under a country when it is their home market or one of their top three traffic sources."
            action={<Link href="/sites/country" className={buttonClass({ variant: 'secondary' })}>All countries <ArrowRight size={16} /></Link>}
          />
          <CountryBrowser countries={taxonomy.countries} continents={taxonomy.continents} counts={counts.countries} />
        </div>
      </section>

      {/* Popular niches */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHead
          eyebrow="By niche"
          title="Popular niches"
          text={`${taxonomy.niches.length} niches and their sub-niches, from SaaS to plumbing.`}
          action={<Link href="/sites/niche" className={buttonClass({ variant: 'secondary' })}>All niches <ArrowRight size={16} /></Link>}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {niches.map((n) => (
            <Link key={n.slug} href={`/sites/niche/${n.slug}`} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3.5 transition hover:border-brand-200 hover:bg-brand-50/50">
              <span className="text-sm font-semibold text-ink">{n.name}</span>
              <span className="text-[12px] tabular-nums text-ink-faint">{nicheTotal(n).toLocaleString()}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHead eyebrow="How it works" title="From search to live link in four steps" />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-card)]">
                <span className="absolute right-5 top-5 text-4xl font-bold text-brand-100">{i + 1}</span>
                <span className="bg-brand-gradient mb-5 flex h-11 w-11 items-center justify-center rounded-xl text-white"><Icon size={20} /></span>
                <h3 className="font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHead eyebrow="Services" title="Everything for off-page SEO" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: FileText, title: 'Guest posts', text: 'A new article with your link on a relevant site.', href: '/sites' },
            { icon: Link2, title: 'Link insertions', text: 'Your link added to an existing, already-ranking article.', href: '/sites/link-insertion' },
            { icon: Megaphone, title: 'Press releases', text: 'Distribution to news sites.', soon: true },
            { icon: MapPin, title: 'Local citations', text: 'Business listings by country.', soon: true },
          ].map(({ icon: Icon, title, text, href, soon }) => {
            const body = (
              <>
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon size={18} /></span>
                <span className="flex items-center gap-2 font-semibold text-ink">{title} {soon && <Badge>Soon</Badge>}</span>
                <span className="mt-1 block text-sm text-ink-soft">{text}</span>
              </>
            );
            return soon ? (
              <div key={title} className="rounded-2xl border border-dashed border-line p-6">{body}</div>
            ) : (
              <Link key={title} href={href} className="rounded-2xl border border-line p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-brand-200">{body}</Link>
            );
          })}
        </div>
      </section>

      {/* Seller call to action */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="bg-aurora flex flex-col items-start gap-6 rounded-3xl px-6 py-10 sm:px-12 sm:py-14 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Own a website? Sell guest posts on it.</h2>
            <p className="mt-2 text-[15px] text-mist/80">List your sites for free, set your own prices and get orders from SEO teams and agencies.</p>
          </div>
          <Link href="/register" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-semibold text-brand-800 shadow-lg transition hover:bg-brand-50">
            Add your website <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <Contact />
    </>
  );
};

export default HomePage;
