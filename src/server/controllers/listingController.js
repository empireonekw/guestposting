import { Readable } from 'stream';
import { isIP } from 'node:net';
import csv from 'csv-parser';
import Listing from '../models/Listing';
import Order from '../models/Order';
import User, { sellerStatusOf } from '../models/User';
import logActivity from '../logger';
import { json, readBody, serverError, queryParams, getPaging, pageInfo, escapeRegex } from '../http';
import { str, url as urlField, num, oneOf, objectId, ValidationError } from '../validate';
import { reviewListings, REVIEW_STATUSES, NEEDS_NOTE, MAX_BULK } from '../listingReview';
import { getTaxonomy, nicheIndex } from '../taxonomy';
import { searchListings, buildListingQuery, parseSort, PUBLIC_FIELDS } from '../listingSearch';
import { LANGUAGE_NAMES } from '@/data/languages';
import { METRIC_KEYS, isChecked, applyCheckedMetrics } from '../metrics';
import {
  LINK_TYPES, LINK_VALIDITY, RESTRICTED_TOPICS, BLOCKED_TOPICS, BLOCKED_NICHES, BLOCKED_REASON,
  MAX_NICHES, MAX_LINKS_PER_POST, MAX_SAMPLE_URLS,
} from '@/data/listingOptions';
import { slugify } from '@/data/niches';

// Deleted listings are kept for order history but hidden everywhere else.
const notDeleted = { isDeleted: { $ne: true } };
const findLiveListing = (id) => Listing.findOne({ _id: id, ...notDeleted });

const MAX_PRICE = 100000;
const MAX_TRAFFIC = 10_000_000_000;

const BOOL_WORDS = { yes: true, true: true, 1: true, y: true, no: false, false: false, 0: false, n: false };

// true/false from a checkbox or a CSV "yes"/"no".
const flag = (value, field, label) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const word = BOOL_WORDS[String(value).trim().toLowerCase()];
  if (word === undefined) throw new ValidationError(`${label} must be yes or no`, field);
  return word;
};

const asList = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value).split(/[|;,]/).map((v) => v.trim()).filter(Boolean);
};

const intField = (value, field, label, max = MAX_TRAFFIC) =>
  num(value, field, label, { required: false, min: 0, max, integer: true });

// Niche slugs from slugs or names ("SaaS", "saas"), checked against the list.
const readNiches = (value, niches, { required }) => {
  const items = asList(value);
  if (!items || items.length === 0) {
    if (required) throw new ValidationError('Choose at least one niche', 'niches');
    return undefined;
  }
  const byName = new Map([...niches.values()].map((n) => [n.name.toLowerCase(), n.slug]));
  const slugs = [];
  items.forEach((item) => {
    const key = item.toLowerCase();
    if (BLOCKED_NICHES.includes(key) || BLOCKED_NICHES.includes(slugify(item))) {
      throw new ValidationError(`${item}: ${BLOCKED_REASON}`, 'niches');
    }
    const slug = niches.has(key) ? key : byName.get(key);
    if (!slug) throw new ValidationError(`Unknown niche: ${item}`, 'niches');
    if (!slugs.includes(slug)) slugs.push(slug);
  });
  if (slugs.length > MAX_NICHES) throw new ValidationError(`Choose at most ${MAX_NICHES} niches`, 'niches');
  return slugs;
};

// [{code, share}] from an array or "us:54, ca:7.2, gb:2.6".
export const readTopCountries = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const items = Array.isArray(value)
    ? value
    : String(value).split(/[|;,]/).map((part) => {
      const [code, share] = part.split(':');
      return { code, share };
    });
  const rows = items
    .filter((c) => c && String(c.code || '').trim())
    .map((c, i) => {
      const code = String(c.code).trim().toLowerCase();
      if (!/^[a-z]{2}$/.test(code)) throw new ValidationError(`Top country ${i + 1} must be a 2-letter country code`, 'topCountries');
      const share = num(c.share, 'topCountries', `Share of top country ${i + 1}`, { required: false, min: 0, max: 100 });
      return { code, share: share ?? 0 };
    });
  if (rows.length > 3) throw new ValidationError('Add at most 3 top countries', 'topCountries');
  if (rows.reduce((sum, c) => sum + c.share, 0) > 100.5) throw new ValidationError('Top country shares add up to more than 100%', 'topCountries');
  return rows;
};

const readSampleUrls = (value) => {
  const items = asList(value);
  if (!items) return undefined;
  if (items.length > MAX_SAMPLE_URLS) throw new ValidationError(`Add at most ${MAX_SAMPLE_URLS} sample posts`, 'sampleUrls');
  return items.map((u, i) => urlField(u, 'sampleUrls', `Sample post ${i + 1}`));
};

const enumField = (value, field, label, options) => {
  if (value === undefined || value === null || value === '') return undefined;
  const v = String(value).trim().toLowerCase();
  const match = options.find((o) => o.value === v || o.label.toLowerCase() === v);
  if (!match) throw new ValidationError(`${label} must be one of: ${options.map((o) => o.label).join(', ')}`, field);
  return match.value;
};

// The fields a seller sends for one listing, checked and cleaned. With
// `partial`, missing fields are left out (for edits).
const readListingFields = async (body, { partial = false } = {}) => {
  const required = !partial;
  const taxonomy = await getTaxonomy();
  const niches = nicheIndex(taxonomy);

  const nicheSlugs = readNiches(body.niches ?? body.category, niches, { required });
  const language = str(body.language, 'language', 'Language', { required: false, max: 5 })?.toLowerCase();
  if (language && !LANGUAGE_NAMES[language]) throw new ValidationError('Choose a language from the list', 'language');
  const country = str(body.country, 'country', 'Main country', { required: false, max: 2 })?.toLowerCase();
  if (country && !/^[a-z]{2}$/.test(country)) throw new ValidationError('Main country must be a 2-letter country code', 'country');

  const allowedIn = body.allowed && typeof body.allowed === 'object' ? body.allowed : body;
  const allowed = {};
  RESTRICTED_TOPICS.forEach(({ key, label }) => {
    const v = flag(allowedIn[key], key, label);
    if (v !== undefined) allowed[key] = v;
  });
  // Blocked topics are switched off on every save, clearing older ticks.
  BLOCKED_TOPICS.forEach((key) => { allowed[key] = false; });

  const address = partial ? undefined : urlField(body.url, 'url', 'Website URL');
  if (address && isIP(new URL(address).hostname.replace(/^\[|\]$/g, ''))) {
    throw new ValidationError('Use the website\'s domain name, not an IP address', 'url');
  }
  const fields = {
    url: address,
    domain: address ? hostOf(address) : undefined,
    niches: nicheSlugs,
    category: nicheSlugs ? niches.get(nicheSlugs[0]).name : undefined,
    description: str(body.description, 'description', 'Description', { required: false, max: 1000 }),

    price: num(body.price, 'price', 'Guest post price', { required, min: 1, max: MAX_PRICE }),
    linkInsertionPrice: num(body.linkInsertionPrice, 'linkInsertionPrice', 'Link insertion price', { required: false, min: 0, max: MAX_PRICE }),
    da: num(body.da, 'da', 'DA', { required: false, min: 0, max: 100, integer: true }),
    dr: num(body.dr, 'dr', 'DR', { required: false, min: 0, max: 100, integer: true }),
    authorityScore: num(body.authorityScore ?? body.as, 'authorityScore', 'Authority Score', { required: false, min: 0, max: 100, integer: true }),
    traffic: intField(body.traffic, 'traffic', 'Ahrefs traffic'),
    semrushTraffic: intField(body.semrushTraffic, 'semrushTraffic', 'Semrush traffic'),
    keywords: intField(body.keywords, 'keywords', 'Organic keywords'),

    language,
    country,
    topCountries: readTopCountries(body.topCountries),

    linkType: enumField(body.linkType, 'linkType', 'Link type', LINK_TYPES),
    linkValidity: enumField(body.linkValidity, 'linkValidity', 'Link validity', LINK_VALIDITY),
    linksPerPost: num(body.linksPerPost, 'linksPerPost', 'Links per post', { required: false, min: 1, max: MAX_LINKS_PER_POST, integer: true }),
    googleNews: flag(body.googleNews, 'googleNews', 'Google News'),
    markedSponsored: flag(body.markedSponsored, 'markedSponsored', 'Marked as sponsored'),
    acceptsSitewide: flag(body.acceptsSitewide, 'acceptsSitewide', 'Sidebar / footer links'),
    acceptsForeignLanguage: flag(body.acceptsForeignLanguage, 'acceptsForeignLanguage', 'Other languages'),

    turnaroundDays: num(body.turnaroundDays, 'turnaroundDays', 'Turnaround', { required: false, min: 0, max: 60, integer: true }),
    sampleUrls: readSampleUrls(body.sampleUrls),
    contentRules: str(body.contentRules, 'contentRules', 'Content rules', { required: false, max: 2000 }),
  };
  const cleaned = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  // In an edit, an emptied optional field clears the saved value.
  if (partial) {
    ['linkInsertionPrice', 'description', 'contentRules', 'country'].forEach((key) => {
      if (body[key] === '' || body[key] === null) cleaned[key] = null;
    });
  }
  // Partial edits only touch the topics that were sent.
  Object.entries(allowed).forEach(([key, v]) => { cleaned[`allowed.${key}`] = v; });
  return cleaned;
};

// A CSV row (lower-case headers) in the shape readListingFields expects.
const csvRowToBody = (row) => ({
  url: row.url || row.website,
  niches: row.niches || row.niche || row.category || 'General',
  price: row.price || row.guest_post_price,
  linkInsertionPrice: row.link_insertion_price,
  da: row.da,
  dr: row.dr,
  authorityScore: row.as || row.authority_score,
  traffic: row.ahrefs_traffic || row.traffic,
  semrushTraffic: row.semrush_traffic,
  keywords: row.keywords || row.ahrefs_keywords,
  language: row.language,
  country: row.country,
  topCountries: row.top_countries,
  linkType: row.link_type,
  linkValidity: row.link_validity,
  linksPerPost: row.links_per_post,
  googleNews: row.google_news,
  markedSponsored: row.sponsored || row.marked_sponsored,
  acceptsSitewide: row.sitewide,
  acceptsForeignLanguage: row.foreign_language,
  crypto: row.crypto,
  pharmacy: row.pharmacy,
  turnaroundDays: row.turnaround_days,
  sampleUrls: row.sample_urls,
  contentRules: row.content_rules,
});

// Sellers' metric numbers are always kept in sellerReported for the admin
// comparison. Once our team has checked a site (`locked`), the public numbers
// come only from our checks, so a seller can't change them.
const protectMetrics = (fields, { locked, nested }) => {
  const reported = {};
  METRIC_KEYS.forEach((k) => {
    if (fields[k] !== undefined) reported[k] = fields[k];
  });
  if (Object.keys(reported).length) {
    reported.at = new Date();
    if (nested) fields.sellerReported = reported;
    else Object.entries(reported).forEach(([k, v]) => { fields[`sellerReported.${k}`] = v; });
  }
  if (locked) {
    METRIC_KEYS.forEach((k) => { delete fields[k]; });
    delete fields.topCountries;
  }
  return fields;
};

// The metric values in a set of listing fields, for applyCheckedMetrics.
const metricValues = (fields) => ({
  ...Object.fromEntries(METRIC_KEYS.filter((k) => fields[k] !== undefined).map((k) => [k, fields[k]])),
  ...(fields.topCountries ? { topCountries: fields.topCountries } : {}),
});

// A new listing document. Sites our own team adds go live straight away,
// with their numbers counted as checked today.
const buildListing = (fields, user) => {
  const isAdmin = user.role === 'admin';
  const { sellerReported, ...rest } = fields;
  const listing = new Listing({
    seller: user.id,
    ...(isAdmin ? rest : fields),
    status: isAdmin ? 'approved' : 'pending',
  });
  if (isAdmin) {
    // Our own numbers: there is no seller figure to compare with.
    listing.set('metrics.source', 'checked');
    applyCheckedMetrics(listing, metricValues(fields), { userId: user.id });
  }
  return listing;
};

// Dotted "allowed.casino" keys -> a nested object, for create/insertMany.
const nest = (fields) => {
  const out = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (key.startsWith('allowed.')) {
      out.allowed = out.allowed || {};
      out.allowed[key.slice(8)] = value;
    } else {
      out[key] = value;
    }
  });
  return out;
};

const hostOf = (address) => new URL(address).hostname.replace(/^www\./, '').toLowerCase();

// A seller can't list the same website twice.
const findOwnDuplicate = async (sellerId, address) => {
  const host = escapeRegex(hostOf(address));
  return Listing.findOne({
    seller: sellerId,
    ...notDeleted,
    // Older listings may be stored without the https:// prefix.
    url: { $regex: `^(https?://)?(www\\.)?${host}(/|$)`, $options: 'i' },
  });
};

export const createListing = async (request, params, user) => {
  try {
    const fields = protectMetrics(nest(await readListingFields(await readBody(request))), { locked: false, nested: true });
    if (await findOwnDuplicate(user.id, fields.url)) {
      return json({ message: 'You have already listed this website.', field: 'url' }, 400);
    }
    const listing = await buildListing(fields, user).save();
    return json(listing, 201);
  } catch (error) {
    return serverError(error);
  }
};

// GET /api/listings: the public marketplace, 25 per page by default. Takes
// the same filters as the /sites pages (see listingSearch.js).
export const getListings = async (request) => {
  try {
    const q = queryParams(request);
    const { page, limit } = getPaging(request, { defaultLimit: 25, maxLimit: 100 });
    return json(await searchListings(q, { page, limit }));
  } catch (error) {
    return serverError(error);
  }
};

const EXPORT_LIMIT = 5000;
const csvCell = (value) => {
  const text = value === undefined || value === null ? '' : String(value);
  // Quote, and stop spreadsheets from running cells that start with = + - @.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// GET /api/listings/export: the current search as a CSV file (signed-in users).
export const exportListings = async (request) => {
  try {
    const q = queryParams(request);
    const query = await buildListingQuery(q);
    const rows = await Listing.find(query).select(PUBLIC_FIELDS).sort(parseSort(q.sort)).limit(EXPORT_LIMIT).lean();
    const header = ['Website', 'Niches', 'Language', 'Country', 'DR', 'DA', 'AS', 'Ahrefs traffic', 'Ahrefs keywords',
      'Semrush traffic', 'Top countries', 'Link type', 'Link validity', 'Links per post', 'Google News',
      'Marked sponsored', 'Turnaround days', 'Guest post price', 'Link insertion price'];
    const lines = rows.map((l) => [
      l.domain || l.url, (l.niches || []).join(' | '), l.language, l.country, l.dr, l.da, l.authorityScore,
      l.traffic, l.keywords, l.semrushTraffic,
      (l.topCountries || []).map((c) => `${c.code.toUpperCase()} ${c.share}%`).join(' | '),
      l.linkType, l.linkValidity, l.linksPerPost, l.googleNews ? 'yes' : 'no', l.markedSponsored ? 'yes' : 'no',
      l.turnaroundDays, l.price, l.linkInsertionPrice ?? '',
    ].map(csvCell).join(','));
    const body = [header.join(','), ...lines].join('\r\n');
    return new Response(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="publishers.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return serverError(error);
  }
};

// PUT /api/listings/:id/approve
export const approveListing = async (request, params, user) => {
  try {
    const listing = await findLiveListing(params.id);
    if (!listing) return json({ message: 'Listing not found' }, 404);
    const { done, skipped } = await reviewListings([listing], 'approved', undefined, user);
    if (skipped.length) return json({ message: skipped[0].message }, 400);
    return json(done[0]);
  } catch (error) {
    return serverError(error);
  }
};

// GET /api/listings/admin?status=pending&search=&page=1
export const getAdminListings = async (request) => {
  try {
    const q = queryParams(request);
    const paging = getPaging(request, { defaultLimit: 25, maxLimit: 100 });
    const status = oneOf(q.status, 'status', 'Status', REVIEW_STATUSES, { required: false });
    const search = str(q.search, 'search', 'Search', { required: false, max: 100 });

    const base = { ...notDeleted };
    if (search) base.url = { $regex: escapeRegex(search), $options: 'i' };
    const query = status ? { ...base, status } : base;

    const [listings, total, countRows] = await Promise.all([
      Listing.find(query)
        .populate('seller', 'name email sellerStatus role')
        .sort({ createdAt: -1 })
        .skip(paging.skip)
        .limit(paging.limit),
      Listing.countDocuments(query),
      Listing.aggregate([{ $match: base }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);

    const counts = Object.fromEntries(REVIEW_STATUSES.map((s) => [s, 0]));
    countRows.forEach((row) => { counts[row._id] = row.n; });

    return json({ listings, counts, ...pageInfo(total, paging) });
  } catch (error) {
    return serverError(error);
  }
};

const readReview = (body) => {
  const status = oneOf(body.status, 'status', 'Status', REVIEW_STATUSES);
  const label = status === 'changes_requested' ? 'What to change' : 'Reason';
  const note = str(body.reason, 'reason', label, { required: NEEDS_NOTE.includes(status), min: 5, max: 500 });
  return { status, note: NEEDS_NOTE.includes(status) ? note : undefined };
};

// PUT /api/listings/:id/status  { status, reason }
// Rejecting or asking for changes needs a reason; the seller is notified in
// the app and by email.
export const updateListingStatus = async (request, params, user) => {
  try {
    const { status, note } = readReview(await readBody(request));
    const listing = await findLiveListing(params.id);
    if (!listing) return json({ message: 'Listing not found' }, 404);
    const { done, skipped } = await reviewListings([listing], status, note, user);
    if (skipped.length) return json({ message: skipped[0].message }, 400);
    return json(done[0]);
  } catch (error) {
    return serverError(error);
  }
};

const BULK_TEXT = {
  pending: 'moved back to pending',
  approved: 'approved',
  rejected: 'rejected',
  changes_requested: 'sent back for changes',
};

// POST /api/listings/admin/bulk  { ids: [...], status, reason }
// The same review for up to 100 listings at once.
export const bulkReviewListings = async (request, params, user) => {
  try {
    const body = await readBody(request);
    const { status, note } = readReview(body);
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      throw new ValidationError('Select at least one listing', 'ids');
    }
    const ids = [...new Set(body.ids.map(String))];
    if (ids.length > MAX_BULK) throw new ValidationError(`Select at most ${MAX_BULK} listings at a time`, 'ids');
    ids.forEach((id) => objectId(id, 'ids', 'Listing'));

    const listings = await Listing.find({ _id: { $in: ids }, ...notDeleted });
    if (!listings.length) return json({ message: 'None of the selected listings were found.' }, 404);
    const { done, skipped } = await reviewListings(listings, status, note, user);

    const missing = ids.length - listings.length;
    const parts = [`${done.length} listing${done.length === 1 ? '' : 's'} ${BULK_TEXT[status]}.`];
    if (skipped.length) parts.push(`${skipped.length} skipped: ${[...new Set(skipped.map((x) => x.message))].join(' ')}`);
    if (missing) parts.push(`${missing} no longer exist${missing === 1 ? 's' : ''}.`);
    return json({ message: parts.join(' '), updated: done.length, skipped }, done.length ? 200 : 400);
  } catch (error) {
    return serverError(error);
  }
};

const MAX_CSV_BYTES = 1024 * 1024; // 1 MB
const MAX_CSV_ROWS = 1000;

// POST /api/listings/bulk: a CSV with url, category, price, da, traffic.
// Good rows are saved; bad rows come back with their row number and reason.
export const bulkUploadListings = async (request, params, user) => {
  try {
    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ message: 'Please upload a CSV file.' }, 400);
    }
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return json({ message: 'Please upload a CSV file.' }, 400);
    }
    if (file.size > MAX_CSV_BYTES) {
      return json({ message: 'The CSV file is too large (max 1 MB).' }, 400);
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    const rows = [];
    await new Promise((resolve, reject) => {
      Readable.from(buffer)
        .pipe(csv({ mapHeaders: ({ header }) => header.trim().toLowerCase() }))
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (rows.length === 0) return json({ message: 'The CSV file has no rows.' }, 400);
    if (rows.length > MAX_CSV_ROWS) {
      return json({ message: `Please upload at most ${MAX_CSV_ROWS} rows at a time.` }, 400);
    }

    const valid = [];
    const errors = [];
    const seenHosts = new Set();
    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2; // row 1 is the header
      try {
        const fields = protectMetrics(nest(await readListingFields(csvRowToBody(rows[i]))), { locked: false, nested: true });
        const host = hostOf(fields.url);
        if (seenHosts.has(host)) throw new ValidationError('This website appears twice in the file', 'url');
        if (await findOwnDuplicate(user.id, fields.url)) throw new ValidationError('You have already listed this website', 'url');
        seenHosts.add(host);
        valid.push(buildListing(fields, user));
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error;
        errors.push({ row: rowNumber, url: rows[i].url || '', message: error.message });
      }
    }

    if (valid.length) await Listing.insertMany(valid);

    const message = errors.length
      ? `${valid.length} of ${rows.length} listings uploaded. ${errors.length} row${errors.length === 1 ? '' : 's'} had problems.`
      : `${valid.length} listings uploaded successfully!`;
    return json({ message, inserted: valid.length, errors: errors.slice(0, 100) }, valid.length ? 201 : 400);
  } catch (error) {
    return serverError(error);
  }
};

export const getMyListings = async (request, params, user) => {
  try {
    const listings = await Listing.find({ seller: user.id, ...notDeleted }).sort({ createdAt: -1 });

    // Quick stats for the seller
    const totalListings = listings.length;
    const approvedListings = listings.filter((l) => l.status === 'approved').length;
    const pendingListings = listings.filter((l) => l.status === 'pending').length;
    const changesRequested = listings.filter((l) => l.status === 'changes_requested').length;

    const me = await User.findById(user.id).select('role sellerStatus sellerStatusReason');
    return json({
      listings,
      stats: { totalListings, approvedListings, pendingListings, changesRequested },
      sellerStatus: sellerStatusOf(me),
      sellerStatusReason: me?.sellerStatusReason,
    });
  } catch (error) {
    return serverError(error);
  }
};

export const updateListing = async (request, params, user) => {
  try {
    const listing = await findLiveListing(params.id);
    if (!listing) return json({ message: 'Listing not found' }, 404);

    // Only the owner or an admin can edit
    if (listing.seller.toString() !== user.id && user.role !== 'admin') {
      return json({ message: 'Not authorized to edit this listing' }, 403);
    }

    const fields = await readListingFields(await readBody(request), { partial: true });
    if (user.role === 'admin') {
      // An admin changing the numbers counts as a dated check by our team.
      const values = metricValues(fields);
      METRIC_KEYS.forEach((k) => { delete fields[k]; });
      delete fields.topCountries;
      listing.set(fields);
      const sameCountries = !values.topCountries
        || JSON.stringify(values.topCountries) === JSON.stringify((listing.topCountries || []).map((c) => ({ code: c.code, share: c.share })));
      const changed = METRIC_KEYS.some((k) => values[k] !== undefined && values[k] !== listing[k]) || !sameCountries;
      if (changed) applyCheckedMetrics(listing, values, { userId: user.id });
    } else {
      // Sellers only update their own reported numbers once we've checked.
      listing.set(protectMetrics(fields, { locked: isChecked(listing), nested: false }));
      // A seller's edit goes back to "pending" so an admin reviews it. The
      // ownership badge stays: the domain hasn't changed.
      listing.status = 'pending';
      listing.rejectionReason = undefined;
      listing.reviewNote = undefined;
    }

    const updatedListing = await listing.save();
    await logActivity(user.id, 'LISTING_UPDATED', listing._id, `Updated metrics/price for ${listing.url}`);
    return json(updatedListing);
  } catch (error) {
    return serverError(error);
  }
};

export const getListingById = async (request, params, user) => {
  try {
    const listing = await findLiveListing(params.id).populate('seller', 'name email').lean();
    if (!listing) return json({ message: 'Listing not found' }, 404);
    // Only the owner and admins see the seller's email.
    const isOwner = String(listing.seller?._id) === String(user?.id);
    if (!isOwner && user?.role !== 'admin' && listing.seller) delete listing.seller.email;
    return json(listing);
  } catch (error) {
    return serverError(error);
  }
};

// DELETE /api/listings/:id: the owner (or an admin) removes a website.
export const deleteListing = async (request, params, user) => {
  try {
    const listing = await findLiveListing(params.id);
    if (!listing) return json({ message: 'Listing not found' }, 404);

    if (listing.seller.toString() !== user.id && user.role !== 'admin') {
      return json({ message: 'Not authorized to delete this listing' }, 403);
    }

    const openOrders = await Order.countDocuments({
      listing: listing._id,
      status: { $in: ['awaiting_content', 'in_progress'] },
    });
    if (openOrders > 0) {
      return json({ message: 'This website has open orders. Complete or reject them before deleting it.' }, 400);
    }

    listing.isDeleted = true;
    listing.deletedAt = new Date();
    listing.isFeatured = false;
    await listing.save();

    await logActivity(user.id, 'LISTING_DELETED', listing._id, `Deleted ${listing.url}`);
    return json({ message: 'Listing deleted' });
  } catch (error) {
    return serverError(error);
  }
};
