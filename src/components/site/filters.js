// The publisher-list filters: what each URL parameter means and how its
// chip reads. Shared by the filter bar and the active-filter chips.
import { compact } from '@/lib/format';
import { LINK_TYPES, LINK_VALIDITY, RESTRICTED_TOPICS, labelOf } from '@/data/listingOptions';

export const RANGE_FILTERS = [
  { key: 'DR', label: 'DR', hint: 'Ahrefs Domain Rating', presets: [20, 50, 70] },
  { key: 'DA', label: 'DA', hint: 'Moz Domain Authority', presets: [20, 50, 70] },
  { key: 'AS', label: 'AS', hint: 'Semrush Authority Score', presets: [20, 50, 70] },
  { key: 'Traffic', label: 'Ahrefs traffic', hint: 'Monthly organic visitors', presets: [1000, 5000, 10000, 50000] },
  { key: 'Keywords', label: 'Ahrefs keywords', hint: 'Organic keywords', presets: [100, 1000, 10000] },
  { key: 'Semrush', label: 'Semrush traffic', hint: 'Monthly organic visitors', presets: [1000, 5000, 10000, 50000] },
  { key: 'Price', label: 'Price', hint: 'Guest post price in USD', money: true, maxPresets: [50, 100, 250, 500] },
];

export const YES_NO = [
  { value: '', label: 'Any' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export const LINKS_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '2', label: '2 or more' },
  { value: '3', label: '3 or more' },
];

export const TAT_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: 'Within 1 day' },
  { value: '3', label: 'Within 3 days' },
  { value: '7', label: 'Within 7 days' },
];

export const SORTS = [
  { value: '', label: 'Featured first' },
  { value: 'newest', label: 'Newest' },
  { value: 'traffic_desc', label: 'Ahrefs traffic: high to low' },
  { value: 'dr_desc', label: 'DR: high to low' },
  { value: 'da_desc', label: 'DA: high to low' },
  { value: 'as_desc', label: 'AS: high to low' },
  { value: 'keywords_desc', label: 'Keywords: high to low' },
  { value: 'semrush_desc', label: 'Semrush traffic: high to low' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export const splitList = (value) => String(value || '').split(',').map((v) => v.trim()).filter(Boolean);

const fmt = (f, n) => (f.money ? `$${Number(n).toLocaleString('en-US')}` : compact(n));

export const rangeText = (f, lo, hi) => {
  if (lo && hi) return `${f.label} ${fmt(f, lo)}–${fmt(f, hi)}`;
  if (lo) return `${f.label} ${fmt(f, lo)}+`;
  return f.money ? `${f.label} under ${fmt(f, hi)}` : `${f.label} up to ${fmt(f, hi)}`;
};

// Chips for every active filter in `params`. Each chip lists the URL
// parameters it controls (`keys`) and, for list filters, the value to drop.
export const activeChips = (params, { niches, countries, languages }) => {
  const chips = [];
  const has = (k) => params[k] !== undefined && params[k] !== '';

  if (has('q')) chips.push({ id: 'q', label: `“${params.q}”`, keys: ['q'] });
  splitList(params.niche).forEach((slug) => {
    chips.push({ id: `niche:${slug}`, label: niches.get(slug)?.name || slug, list: 'niche', value: slug });
  });
  splitList(params.country).forEach((code) => {
    const c = countries.find((x) => x.code === code);
    chips.push({ id: `country:${code}`, label: c?.name || code.toUpperCase(), flag: code, list: 'country', value: code });
  });
  splitList(params.lang).forEach((code) => {
    chips.push({ id: `lang:${code}`, label: languages.find((l) => l.code === code)?.name || code, list: 'lang', value: code });
  });
  RANGE_FILTERS.forEach((f) => {
    const lo = params[`min${f.key}`];
    const hi = params[`max${f.key}`];
    if (lo || hi) chips.push({ id: f.key, label: rangeText(f, lo, hi), keys: [`min${f.key}`, `max${f.key}`] });
  });
  if (has('linkType')) chips.push({ id: 'linkType', label: labelOf(LINK_TYPES, params.linkType), keys: ['linkType'] });
  splitList(params.validity).forEach((v) => {
    chips.push({ id: `validity:${v}`, label: `Link stays: ${labelOf(LINK_VALIDITY, v)}`, list: 'validity', value: v });
  });
  if (has('links')) chips.push({ id: 'links', label: `${params.links}+ links per post`, keys: ['links'] });
  if (has('gnews')) chips.push({ id: 'gnews', label: params.gnews === 'no' ? 'Not in Google News' : 'Google News', keys: ['gnews'] });
  if (has('sponsored')) chips.push({ id: 'sponsored', label: params.sponsored === 'no' ? 'Not marked sponsored' : 'Marked sponsored', keys: ['sponsored'] });
  RESTRICTED_TOPICS.forEach((t) => {
    if (params[t.key] === 'yes') chips.push({ id: t.key, label: `Accepts ${t.label.toLowerCase()}`, keys: [t.key] });
  });
  if (params.sitewide === 'yes') chips.push({ id: 'sitewide', label: 'Sidebar / footer links', keys: ['sitewide'] });
  if (params.foreign === 'yes') chips.push({ id: 'foreign', label: 'Articles in other languages', keys: ['foreign'] });
  if (params.linkInsertion === 'yes') chips.push({ id: 'linkInsertion', label: 'Link insertions', keys: ['linkInsertion'] });
  if (has('maxTat')) chips.push({ id: 'maxTat', label: `Published within ${params.maxTat} day${params.maxTat === '1' ? '' : 's'}`, keys: ['maxTat'] });
  return chips;
};

// URL parameters that are filters (not paging or sorting).
export const FILTER_KEYS = [
  'q', 'niche', 'country', 'lang', 'linkType', 'validity', 'links', 'gnews', 'sponsored',
  'sitewide', 'foreign', 'linkInsertion', 'maxTat',
  ...RESTRICTED_TOPICS.map((t) => t.key),
  ...RANGE_FILTERS.flatMap((f) => [`min${f.key}`, `max${f.key}`]),
];
