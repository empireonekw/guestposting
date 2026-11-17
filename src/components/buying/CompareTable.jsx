'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X, BadgeCheck, Check, Minus, Star, GitCompareArrows } from 'lucide-react';
import useCompare, { compareHref, setCompare, MAX_COMPARE } from '@/lib/compare';
import { compact, money } from '@/lib/format';
import Flag from '@/components/ui/Flag';
import Button from '@/components/ui/Button';
import BuyButton from '@/components/site/BuyButton';
import { CartButton, SaveButton } from './ListButtons';
import { LINK_TYPES, LINK_VALIDITY, RESTRICTED_TOPICS, labelOf } from '@/data/listingOptions';

// The side-by-side table on /compare (Module 6).

const yes = (v) => (v ? <Check size={16} className="mx-auto text-success" aria-label="Yes" /> : <Minus size={16} className="mx-auto text-ink-faint" aria-label="No" />);

// Each row: how to show it and, for numbers, which way is better.
const rows = (taxonomy) => {
  const countryName = (code) => taxonomy.countries.find((c) => c.code === code)?.name || code?.toUpperCase();
  const nicheName = new Map(taxonomy.niches.flatMap((n) => [[n.slug, n.name], ...n.children.map((c) => [c.slug, c.name])]));
  return [
    { group: 'Price' },
    { label: 'Guest post', value: (l) => l.price, show: (l) => money(l.price), better: 'low' },
    { label: 'Link insertion', value: (l) => l.linkInsertionPrice || null, show: (l) => (l.linkInsertionPrice ? money(l.linkInsertionPrice) : '–'), better: 'low' },
    { label: 'Turnaround', value: (l) => l.turnaroundDays ?? 3, show: (l) => `${l.turnaroundDays ?? 3} day${l.turnaroundDays === 1 ? '' : 's'}`, better: 'low' },
    { group: 'Authority' },
    { label: 'DR (Ahrefs)', value: (l) => l.dr, show: (l) => l.dr || '–', better: 'high' },
    { label: 'DA (Moz)', value: (l) => l.da, show: (l) => l.da || '–', better: 'high' },
    { label: 'AS (Semrush)', value: (l) => l.authorityScore, show: (l) => l.authorityScore || '–', better: 'high' },
    { label: 'Spam score', value: (l) => (Number.isFinite(l.spamScore) ? l.spamScore : null), show: (l) => (Number.isFinite(l.spamScore) ? `${l.spamScore}%` : '–'), better: 'low' },
    { group: 'Traffic' },
    { label: 'Traffic (Ahrefs)', value: (l) => l.traffic, show: (l) => compact(l.traffic), better: 'high' },
    { label: 'Traffic (Semrush)', value: (l) => l.semrushTraffic, show: (l) => compact(l.semrushTraffic), better: 'high' },
    { label: 'Keywords', value: (l) => l.keywords, show: (l) => compact(l.keywords), better: 'high' },
    {
      label: 'Top countries',
      show: (l) => (l.topCountries?.length ? (
        <span className="inline-flex flex-col items-center gap-0.5">
          {l.topCountries.map((c) => <span key={c.code} className="inline-flex items-center gap-1"><Flag code={c.code} name={countryName(c.code)} /> {Number(c.share).toFixed(0)}%</span>)}
        </span>
      ) : '–'),
    },
    { label: 'Main country', show: (l) => (l.country ? <span className="inline-flex items-center gap-1.5"><Flag code={l.country} name={countryName(l.country)} /> {countryName(l.country)}</span> : '–') },
    { label: 'Language', show: (l) => taxonomy.languages.find((x) => x.code === l.language)?.name || '–' },
    { label: 'Niches', show: (l) => (l.niches || []).map((s) => nicheName.get(s) || s).join(', ') || '–' },
    { group: 'The link' },
    { label: 'Link type', show: (l) => labelOf(LINK_TYPES, l.linkType) },
    { label: 'Link stays', show: (l) => labelOf(LINK_VALIDITY, l.linkValidity) },
    { label: 'Links per post', value: (l) => l.linksPerPost || 1, show: (l) => l.linksPerPost || 1, better: 'high' },
    { label: 'Google News', show: (l) => yes(l.googleNews) },
    { label: 'Marked sponsored', show: (l) => yes(l.markedSponsored) },
    { label: 'Other languages', show: (l) => yes(l.acceptsForeignLanguage) },
    ...RESTRICTED_TOPICS.map((t) => ({ label: `Accepts ${t.label.toLowerCase()}`, show: (l) => yes(l.allowed?.[t.key]) })),
    { group: 'Trust' },
    { label: 'Verified owner', show: (l) => yes(l.isVerified) },
    { label: 'Metrics checked by us', show: (l) => (l.metrics?.source === 'checked' ? new Date(l.metrics.updatedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Not yet') },
    {
      label: 'Publisher',
      show: (l) => (
        <span className="inline-flex flex-col items-center">
          <Link href={`/seller/${l.seller?._id}`} className="font-medium text-ink hover:text-brand-700">{l.seller?.name || 'Publisher'}</Link>
          <span className="inline-flex items-center gap-1 text-[12px] text-ink-faint">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            {l.rating?.count ? `${l.rating.avg.toFixed(1)} (${l.rating.count})` : 'No reviews'}
          </span>
        </span>
      ),
    },
  ];
};

// The index of the best value in a row, or -1 when there's no clear winner.
const bestIndex = (row, listings) => {
  if (!row.better || listings.length < 2) return [];
  const values = listings.map((l) => row.value(l)).map((v) => (v === null || v === undefined || v === 0 ? null : Number(v)));
  const real = values.filter((v) => v !== null);
  if (real.length < 2) return [];
  const target = row.better === 'high' ? Math.max(...real) : Math.min(...real);
  if (real.every((v) => v === target)) return [];
  return values.map((v, i) => (v === target ? i : -1)).filter((i) => i >= 0);
};

const CompareTable = ({ listings, missing, taxonomy }) => {
  const router = useRouter();
  const picked = useCompare();
  const shownIds = listings.map((l) => l._id).join(',');

  // An empty /compare opens what this browser picked, if anything.
  // Picked sites that have all gone are forgotten.
  useEffect(() => {
    if (listings.length || !picked.length) return;
    if (missing) setCompare([]);
    else router.replace(compareHref(picked));
  }, [listings.length, missing, picked, router]);

  // Keep the picked list in step with what this page shows.
  useEffect(() => {
    if (listings.length) setCompare(listings.map((l) => ({ id: l._id, domain: l.domain })));
  }, [shownIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const drop = (id) => {
    const rest = listings.filter((l) => l._id !== id);
    if (!rest.length) {
      setCompare([]);
      router.replace('/compare');
    } else {
      router.replace(compareHref(rest.map((l) => ({ id: l._id }))));
    }
  };

  if (!listings.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
        <GitCompareArrows size={32} className="mx-auto mb-3 text-ink-faint opacity-60" strokeWidth={1.5} />
        <p className="text-base font-semibold text-ink">{missing ? 'These sites are no longer available.' : 'Nothing to compare yet.'}</p>
        <p className="mt-1 text-sm text-ink-soft">Tick “Compare” next to up to {MAX_COMPARE} sites on the publisher list, then press “Compare now”.</p>
        <Button href="/sites" className="mt-4">Browse publishers</Button>
      </div>
    );
  }

  const table = rows(taxonomy);
  return (
    <>
      {missing > 0 && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{missing} of the sites you picked {missing === 1 ? 'is' : 'are'} no longer available.</p>}
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas align-top">
              <th scope="col" className="sticky left-0 z-10 w-44 bg-canvas px-4 py-4 text-left text-[12px] font-semibold text-ink-soft">
                {listings.length < MAX_COMPARE && <Link href="/sites" className="font-medium text-brand-700 hover:underline">+ Add a site</Link>}
              </th>
              {listings.map((l) => (
                <th key={l._id} scope="col" className="min-w-44 px-4 py-4 text-center font-normal">
                  <div className="flex items-start justify-center gap-1">
                    <Link href={`/sites/${l.domain}`} className="break-all text-[15px] font-semibold text-ink hover:text-brand-700">{l.domain}</Link>
                    {l.isVerified && <BadgeCheck size={15} className="mt-0.5 shrink-0 text-brand-600" aria-label="Verified" />}
                    <button type="button" onClick={() => drop(l._id)} aria-label={`Remove ${l.domain} from comparison`} className="ml-1 rounded p-0.5 text-ink-faint hover:bg-white hover:text-danger"><X size={14} /></button>
                  </div>
                  <p className="mt-1 text-lg font-bold tabular-nums text-ink">{money(l.price)}</p>
                  <div className="mt-2 flex items-center justify-center gap-1.5">
                    <SaveButton listing={l} />
                    <CartButton listing={l} />
                    <BuyButton listing={l} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.map((row) => {
              if (row.group) {
                return (
                  <tr key={`g-${row.group}`} className="bg-white">
                    <th colSpan={listings.length + 1} scope="colgroup" className="px-4 pb-1.5 pt-5 text-left text-[11px] font-semibold uppercase tracking-wider text-brand-700">{row.group}</th>
                  </tr>
                );
              }
              const best = bestIndex(row, listings);
              return (
                <tr key={row.label} className="border-t border-line-soft">
                  <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2.5 text-left text-[13px] font-medium text-ink-soft">{row.label}</th>
                  {listings.map((l, i) => (
                    <td key={l._id} className={`px-4 py-2.5 text-center tabular-nums ${best.includes(i) ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-ink'}`}>
                      {row.show(l)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default CompareTable;
