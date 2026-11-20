import Link from 'next/link';
import {
  ChevronRight, BadgeCheck, ExternalLink, Star, Clock, Link2, CalendarClock, Newspaper, Tag, Languages, ShieldAlert, Check, X, Info,
} from 'lucide-react';
import Flag from '@/components/ui/Flag';
import Badge from '@/components/ui/Badge';
import BuyButton from './BuyButton';
import MessageSellerButton from './MessageSellerButton';
import { SaveButton, CartButton, CompareToggle } from '@/components/buying/ListButtons';
import CompareBar from '@/components/buying/CompareBar';
import TrafficChart from './TrafficChart';
import { compact, money } from '@/lib/format';
import { LINK_TYPES, LINK_VALIDITY, RESTRICTED_TOPICS, labelOf } from '@/data/listingOptions';
import BRAND from '@/data/brand';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null);

const Metric = ({ label, source, value, date, note }) => (
  <div className="rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{source}</p>
    <p className="text-[13px] font-medium text-ink-soft">{label}</p>
    <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{value}</p>
    {date && <p className="mt-1 text-[11px] text-ink-faint">Checked {date}</p>}
    {note && <p className="mt-1 text-[11px] text-ink-faint">{note}</p>}
  </div>
);

const Row = ({ icon: Icon, label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2.5">
    <dt className="flex items-center gap-2 text-sm text-ink-soft"><Icon size={15} className="text-ink-faint" /> {label}</dt>
    <dd className="text-right text-sm font-medium text-ink">{children}</dd>
  </div>
);

const SiteDetail = ({ listing, others = [], taxonomy, rating }) => {
  const nicheMap = new Map(taxonomy.niches.flatMap((n) => [[n.slug, n], ...n.children.map((c) => [c.slug, c])]));
  const countryName = (code) => taxonomy.countries.find((c) => c.code === code)?.name || code?.toUpperCase();
  const language = taxonomy.languages.find((l) => l.code === listing.language)?.name;
  const real = listing.metrics?.source === 'checked';
  const checkedOn = real ? fmtDate(listing.metrics.updatedAt) : null;
  const ahrefsDate = checkedOn;
  const mozDate = checkedOn;
  const semrushDate = checkedOn;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-[13px] text-ink-faint">
        <Link href="/" className="hover:text-ink">Home</Link>
        <ChevronRight size={12} />
        <Link href="/sites" className="hover:text-ink">Publishers</Link>
        <ChevronRight size={12} />
        <span className="text-ink-soft">{listing.domain}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          {/* Title */}
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="break-all text-2xl font-bold tracking-tight text-ink sm:text-3xl">{listing.domain}</h1>
              {listing.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-700" title={`Ownership verified ${fmtDate(listing.verification?.verifiedAt) || ''}`}>
                  <BadgeCheck size={14} /> Verified owner
                </span>
              )}
              <a href={listing.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-soft hover:text-brand-700">
                Visit site <ExternalLink size={13} />
              </a>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {listing.country && (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft"><Flag code={listing.country} name={countryName(listing.country)} /> {countryName(listing.country)}</span>
              )}
              {language && <span className="text-[13px] text-ink-soft">· {language}</span>}
              {(listing.niches || []).map((s) => (
                <Link key={s} href={`/sites/niche/${s}`}><Badge className="hover:bg-brand-50 hover:text-brand-700">{nicheMap.get(s)?.name || s}</Badge></Link>
              ))}
            </div>
            {listing.description && <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-ink-soft">{listing.description}</p>}
          </div>

          {/* Metrics */}
          <section aria-labelledby="metrics-h">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="metrics-h" className="text-lg font-semibold text-ink">Metrics</h2>
              {real ? (
                <p className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand-700"><BadgeCheck size={13} /> Checked by {BRAND.name} on {checkedOn}</p>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-[12px] text-amber-700"><Info size={13} /> Reported by the seller, not yet checked by our team</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Number.isFinite(listing.autoMetrics?.dr) ? (
                <Metric
                  source="Ahrefs · automatic"
                  label="Domain Rating"
                  value={Math.round(listing.autoMetrics.dr)}
                  note={<>Domain Rating by <a href="https://ahrefs.com/" target="_blank" rel="noopener noreferrer" className="underline">Ahrefs</a> · {fmtDate(listing.autoMetrics.drAt)}</>}
                />
              ) : (
                <Metric source="Ahrefs" label="Domain Rating" value={listing.dr || '–'} date={ahrefsDate} />
              )}
              {Number.isFinite(listing.autoMetrics?.gpScore) && (
                <Metric
                  source={`${BRAND.name} · automatic`}
                  label="GP Authority"
                  value={`${listing.autoMetrics.gpScore}`}
                  note={`#${listing.autoMetrics.gpRank.toLocaleString()} of ${(listing.autoMetrics.gpTotal / 1e6).toFixed(0)}M sites on the web (Common Crawl)`}
                />
              )}
              {listing.autoMetrics?.domainCreatedAt && (
                <Metric
                  source="Domain registry · automatic"
                  label="Domain age"
                  value={`${Math.max(0, Math.floor((Date.now() - new Date(listing.autoMetrics.domainCreatedAt).getTime()) / (365.25 * 86400000)))} yrs`}
                  note={`Registered ${fmtDate(listing.autoMetrics.domainCreatedAt)}`}
                />
              )}
              <Metric source="Moz" label="Domain Authority" value={listing.da || '–'} date={mozDate} />
              <Metric source="Semrush" label="Authority Score" value={listing.authorityScore || '–'} date={semrushDate} />
              <Metric source="Ahrefs" label="Organic traffic" value={compact(listing.traffic)} date={ahrefsDate} />
              <Metric source="Ahrefs" label="Organic keywords" value={compact(listing.keywords)} date={ahrefsDate} />
              <Metric source="Semrush" label="Organic traffic" value={compact(listing.semrushTraffic)} date={semrushDate} />
              {Number.isFinite(listing.spamScore) && <Metric source="Moz" label="Spam score" value={`${listing.spamScore}%`} date={mozDate} />}
            </div>
          </section>

          {/* Trend */}
          <section aria-labelledby="trend-h" className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
            <h2 id="trend-h" className="mb-4 text-lg font-semibold text-ink">Traffic trend</h2>
            <TrafficChart history={(listing.trafficHistory || []).map((p) => ({ month: p.month, ahrefs: p.ahrefs, semrush: p.semrush }))} />
          </section>

          {/* Countries */}
          {listing.topCountries?.length > 0 && (
            <section aria-labelledby="countries-h">
              <h2 id="countries-h" className="mb-3 text-lg font-semibold text-ink">Top traffic countries</h2>
              <ul className="space-y-2.5">
                {listing.topCountries.map((c) => (
                  <li key={c.code} className="grid grid-cols-[150px_1fr_52px] items-center gap-3 text-sm">
                    <span className="flex items-center gap-2 text-ink"><Flag code={c.code} name={countryName(c.code)} /> {countryName(c.code)}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-line-soft"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, c.share)}%` }} /></span>
                    <span className="text-right tabular-nums text-ink-soft">{Number(c.share).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Rules */}
          <section aria-labelledby="rules-h" className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 id="rules-h" className="mb-2 text-lg font-semibold text-ink">Topics accepted</h2>
              <ul className="space-y-1.5">
                {RESTRICTED_TOPICS.map((t) => (
                  <li key={t.key} className="flex items-center gap-2 text-sm">
                    {listing.allowed?.[t.key]
                      ? <><Check size={15} className="text-success" /><span className="text-ink">{t.label}</span></>
                      : <><X size={15} className="text-ink-faint" /><span className="text-ink-faint">{t.label}</span></>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-2 text-lg font-semibold text-ink">Content rules</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{listing.contentRules || 'No special rules. The publisher may edit the article to fit the site.'}</p>
              {listing.sampleUrls?.length > 0 && (
                <>
                  <h3 className="mb-1.5 mt-4 text-sm font-semibold text-ink">Sample posts</h3>
                  <ul className="space-y-1">
                    {listing.sampleUrls.map((u) => (
                      <li key={u}><a href={u} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-sm text-brand-700 hover:underline">{u}</a></li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>
        </div>

        {/* Order box */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-pop)]">
            <p className="text-[13px] font-medium text-ink-soft">Guest post</p>
            <p className="text-3xl font-bold tabular-nums text-ink">{money(listing.price)}</p>
            {listing.linkInsertionPrice > 0 && <p className="mt-0.5 text-[13px] text-ink-soft">Link insertion {money(listing.linkInsertionPrice)}</p>}
            <BuyButton listing={listing} size="lg" className="mt-4 w-full" label="Order guest post" />
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              <CartButton listing={listing} size="md" withLabel className="w-full" />
              <SaveButton listing={listing} withLabel />
            </div>
            <MessageSellerButton listing={listing} className="mt-2 w-full" />
            <div className="mt-3 flex justify-center"><CompareToggle listing={listing} /></div>
            <dl className="mt-4 divide-y divide-line border-t border-line">
              <Row icon={Link2} label="Link type">{labelOf(LINK_TYPES, listing.linkType)}{listing.linksPerPost > 1 ? ` · ${listing.linksPerPost} links` : ''}</Row>
              <Row icon={CalendarClock} label="Link stays">{labelOf(LINK_VALIDITY, listing.linkValidity)}</Row>
              <Row icon={Clock} label="Turnaround">{listing.turnaroundDays ?? 3} day{listing.turnaroundDays === 1 ? '' : 's'}</Row>
              <Row icon={Newspaper} label="Google News">{listing.googleNews ? 'Yes' : 'No'}</Row>
              <Row icon={Tag} label="Sponsored label">{listing.markedSponsored ? 'Yes' : 'No'}</Row>
              <Row icon={Languages} label="Other languages">{listing.acceptsForeignLanguage ? 'Accepted' : 'No'}</Row>
            </dl>
            <div className="mt-4 rounded-xl bg-canvas p-3.5">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-faint">Publisher</p>
              <Link href={`/seller/${listing.seller?._id}`} className="mt-1 block font-semibold text-ink hover:text-brand-700">{listing.seller?.name || 'Publisher'}</Link>
              <p className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-soft">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                {rating.count ? `${rating.avg.toFixed(1)} from ${rating.count} review${rating.count === 1 ? '' : 's'}` : 'No reviews yet'}
              </p>
            </div>
            {!listing.isVerified && (
              <p className="mt-3 flex items-start gap-1.5 text-[12px] text-ink-faint"><ShieldAlert size={13} className="mt-0.5 shrink-0" /> The seller has not verified ownership of this domain yet.</p>
            )}
          </div>

          {others.length > 0 && (
            <div className="mt-4 rounded-2xl border border-line p-4">
              <p className="mb-2 text-sm font-semibold text-ink">Other sellers of this site</p>
              <ul className="space-y-2">
                {others.map((o) => (
                  <li key={o._id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-ink-soft">{o.seller?.name || 'Publisher'} {o.isVerified && <BadgeCheck size={13} className="inline text-brand-600" />}</span>
                    <span className="flex items-center gap-2"><span className="font-semibold tabular-nums">{money(o.price)}</span><CartButton listing={o} /><BuyButton listing={o} /></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
      <CompareBar />
    </div>
  );
};

export default SiteDetail;
