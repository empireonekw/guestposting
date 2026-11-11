import Listing from './models/Listing';
import User from './models/User';
import { escapeRegex } from './http';
import { num, str } from './validate';
import { getTaxonomy, nicheIndex } from './taxonomy';
import { LINK_TYPES, LINK_VALIDITY, RESTRICTED_TOPICS } from '@/data/listingOptions';

// Turns the publisher-list URL parameters into a MongoDB query. The same
// parameters drive /api/listings, the CSV export and the server-rendered
// /sites pages, so a shared or bookmarked URL always shows the same results.

export const PAGE_SIZES = [25, 50, 100];

// sort=<key>_<asc|desc>
const SORT_FIELDS = {
  price: 'price',
  da: 'da',
  dr: 'dr',
  as: 'authorityScore',
  traffic: 'traffic',
  keywords: 'keywords',
  semrush: 'semrushTraffic',
  tat: 'turnaroundDays',
};

export const parseSort = (value) => {
  if (!value || value === 'default') return { isFeatured: -1, createdAt: -1 };
  if (value === 'newest') return { createdAt: -1, _id: -1 };
  const [key, dir] = String(value).split('_');
  const field = SORT_FIELDS[key];
  if (!field) return { isFeatured: -1, createdAt: -1 };
  return { [field]: dir === 'asc' ? 1 : -1, _id: 1 };
};

// Numeric range filters: URL name -> listing field.
const RANGES = [
  ['DA', 'da', true],
  ['DR', 'dr', true],
  ['AS', 'authorityScore', true],
  ['Traffic', 'traffic', true],
  ['Keywords', 'keywords', true],
  ['Semrush', 'semrushTraffic', true],
  ['Price', 'price', false],
];

const range = (q, label, integer) => {
  const lo = num(q[`min${label}`], `min${label}`, `Minimum ${label}`, { required: false, min: 0, integer });
  const hi = num(q[`max${label}`], `max${label}`, `Maximum ${label}`, { required: false, min: 0, integer });
  if (lo === undefined && hi === undefined) return undefined;
  const r = {};
  if (lo !== undefined) r.$gte = lo;
  if (hi !== undefined) r.$lte = hi;
  return r;
};

const list = (value, max = 30) =>
  String(value || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, max);

const yes = (value) => value === 'yes' || value === '1' || value === 'true';
const no = (value) => value === 'no' || value === '0' || value === 'false';

export const buildListingQuery = async (q) => {
  const taxonomy = await getTaxonomy();
  const niches = nicheIndex(taxonomy);
  const query = { status: 'approved', isDeleted: { $ne: true } };
  const and = [];

  // Listings of suspended sellers are hidden from the marketplace.
  const suspendedSellers = await User.find({ isSuspended: true }).distinct('_id');
  if (suspendedSellers.length) query.seller = { $nin: suspendedSellers };

  // Free text: a domain, or a niche name.
  const search = str(q.q ?? q.search, 'q', 'Search', { required: false, max: 100 });
  if (search) {
    const re = { $regex: escapeRegex(search), $options: 'i' };
    const lower = search.toLowerCase();
    const nicheHits = [...niches.values()].filter((n) => n.name.toLowerCase().includes(lower)).map((n) => n.slug);
    const or = [{ domain: re }, { url: re }];
    if (nicheHits.length) or.push({ niches: { $in: nicheHits } });
    and.push({ $or: or });
  }

  // Niches: a top-level niche also matches its sub-niches.
  const nicheSlugs = list(q.niche).filter((s) => niches.has(s));
  if (nicheSlugs.length) {
    const expanded = new Set();
    nicheSlugs.forEach((s) => {
      expanded.add(s);
      niches.get(s).children.forEach((c) => expanded.add(c.slug));
    });
    query.niches = { $in: [...expanded] };
  }

  // The old single category, still used by older links.
  const category = str(q.category, 'category', 'Category', { required: false, max: 60 });
  if (category && category !== 'All') query.category = category;

  // Country: the main country or one of the top-3 traffic countries.
  const countries = list(q.country).filter((c) => /^[a-z]{2}$/.test(c));
  if (countries.length) {
    and.push({ $or: [{ country: { $in: countries } }, { 'topCountries.code': { $in: countries } }] });
  }

  const languages = list(q.lang).filter((c) => /^[a-z]{2,3}$/.test(c));
  if (languages.length) query.language = { $in: languages };

  RANGES.forEach(([label, field, integer]) => {
    const r = range(q, label, integer);
    if (r) query[field] = r;
  });

  const maxTat = num(q.maxTat, 'maxTat', 'Turnaround', { required: false, min: 0, max: 365, integer: true });
  if (maxTat !== undefined) query.turnaroundDays = { $lte: maxTat };

  const minLinks = num(q.links, 'links', 'Links per post', { required: false, min: 1, max: 10, integer: true });
  if (minLinks !== undefined) query.linksPerPost = { $gte: minLinks };

  if (LINK_TYPES.some((t) => t.value === q.linkType)) query.linkType = q.linkType;

  const validity = list(q.validity).filter((v) => LINK_VALIDITY.some((o) => o.value === v));
  if (validity.length) query.linkValidity = { $in: validity };

  if (yes(q.gnews)) query.googleNews = true;
  else if (no(q.gnews)) query.googleNews = { $ne: true };

  if (yes(q.sponsored)) query.markedSponsored = true;
  else if (no(q.sponsored)) query.markedSponsored = { $ne: true };

  if (yes(q.sitewide)) query.acceptsSitewide = true;
  if (yes(q.foreign)) query.acceptsForeignLanguage = true;
  if (yes(q.verified)) query.isVerified = true;
  if (yes(q.linkInsertion)) query.linkInsertionPrice = { $gt: 0 };

  RESTRICTED_TOPICS.forEach(({ key }) => {
    if (yes(q[key])) query[`allowed.${key}`] = true;
  });

  if (and.length) query.$and = and;
  return query;
};

// The fields buyers may see. Seller emails and internal flags stay private.
export const PUBLIC_FIELDS = [
  'url', 'domain', 'category', 'niches', 'description',
  'price', 'linkInsertionPrice', 'da', 'dr', 'authorityScore', 'traffic', 'semrushTraffic', 'keywords',
  'trafficHistory', 'language', 'country', 'topCountries',
  'linkType', 'linkValidity', 'linksPerPost', 'googleNews', 'markedSponsored', 'acceptsSitewide',
  'acceptsForeignLanguage', 'allowed', 'turnaroundDays', 'sampleUrls', 'contentRules',
  'isVerified', 'isFeatured', 'seller', 'createdAt', 'updatedAt',
].join(' ');

// Plain JSON for the browser (ObjectIds and dates become strings).
export const toPlain = (value) => JSON.parse(JSON.stringify(value));

export const searchListings = async (q, { page = 1, limit = 25 } = {}) => {
  const query = await buildListingQuery(q);
  const sort = parseSort(q.sort);
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    Listing.find(query).select(PUBLIC_FIELDS).populate('seller', 'name').sort(sort).skip(skip).limit(limit).lean(),
    Listing.countDocuments(query),
  ]);
  return {
    listings: toPlain(rows),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
};

// How many live listings each niche and each country has, for the
// browse-by-niche and browse-by-country pages. A country counts a listing
// whose main country or top-3 traffic countries include it.
export const countByNicheAndCountry = async () => {
  const live = { status: 'approved', isDeleted: { $ne: true } };
  const [nicheRows, countryRows] = await Promise.all([
    Listing.aggregate([{ $match: live }, { $unwind: '$niches' }, { $group: { _id: '$niches', n: { $sum: 1 } } }]),
    Listing.aggregate([
      { $match: live },
      {
        $project: {
          codes: {
            $setUnion: [
              { $cond: [{ $ifNull: ['$country', false] }, ['$country'], []] },
              { $ifNull: ['$topCountries.code', []] },
            ],
          },
        },
      },
      { $unwind: '$codes' },
      { $group: { _id: '$codes', n: { $sum: 1 } } },
    ]),
  ]);
  return {
    niches: Object.fromEntries(nicheRows.map((r) => [r._id, r.n])),
    countries: Object.fromEntries(countryRows.map((r) => [r._id, r.n])),
  };
};

// page / limit from a plain params object (limit is one of PAGE_SIZES).
export const pagingFrom = (q) => {
  const page = Math.min(10000, Math.max(1, parseInt(q.page, 10) || 1));
  const asked = parseInt(q.limit, 10);
  const limit = PAGE_SIZES.includes(asked) ? asked : 25;
  return { page, limit };
};
