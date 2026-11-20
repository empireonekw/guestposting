import Listing from '../models/Listing';
import { getDomainRatings, getDomainRating, ahrefsEnabled, ahrefsStatus, normalizeDomain, ATTRIBUTION } from './ahrefs';
import { lookupAuthority, authorityStatus } from './authority';
import { readSiteInfo } from './siteInfo';

// Free, automatic site data: DR (Ahrefs' free endpoint), GP Authority (our
// own score from Common Crawl), and what we can read from the site and the
// domain registry. Used by the seller form's URL auto-fill, new listings,
// and a refresh job. Also raises "this looks fake" flags for the admin.

export { normalizeDomain, ATTRIBUTION };

const REFRESH_DAYS = 7; // DR and GP Authority
const INFO_DAYS = 30; // home page and domain age
const DAY = 86400000;

// ---- Fake-number alarm ---------------------------------------------------

// Highest believable monthly organic traffic for a site's DR. Real sites can
// beat these, which is why this only raises a flag for a person to look at.
const TRAFFIC_CAP_BY_DR = [[10, 20000], [20, 100000], [30, 300000], [40, 1000000]];
const AUTO_FLAG_TYPES = ['suspicious'];

export const autoFlags = (listing, at = new Date()) => {
  const a = listing.autoMetrics || {};
  const s = listing.sellerReported || {};
  const claimed = (k) => (Number.isFinite(s[k]) ? s[k] : listing.metrics?.source !== 'checked' ? listing[k] : undefined);
  const out = [];
  const add = (message) => out.push({ type: 'suspicious', message, at });

  if (Number.isFinite(a.dr)) {
    const dr = claimed('dr');
    if (Number.isFinite(dr) && Math.abs(dr - a.dr) >= 10) add(`Seller said DR ${dr}; Ahrefs says DR ${Math.round(a.dr)}.`);
    const traffic = claimed('traffic');
    const cap = TRAFFIC_CAP_BY_DR.find(([limit]) => a.dr < limit)?.[1];
    if (cap && Number.isFinite(traffic) && traffic > cap) {
      add(`Claims ${traffic.toLocaleString()} monthly visitors, which is very high for a DR ${Math.round(a.dr)} site (usually under ${cap.toLocaleString()}).`);
    }
    const da = claimed('da');
    if (Number.isFinite(da) && da > a.dr + 30) add(`Claims DA ${da}, far above its Ahrefs DR of ${Math.round(a.dr)}.`);
  }
  if (a.gpAt && !Number.isFinite(a.gpScore)) {
    const dr = claimed('dr');
    const traffic = claimed('traffic');
    if ((Number.isFinite(dr) && dr >= 40) || (Number.isFinite(traffic) && traffic >= 100000)) {
      add('Not among the top 10 million sites on the web (Common Crawl), yet claims high authority or traffic.');
    }
  }
  if (a.infoAt && a.loads === false) add(`The site did not load when we checked${a.lastError ? `: ${a.lastError}` : ''}.`);
  if (a.domainCreatedAt) {
    const months = (at - new Date(a.domainCreatedAt)) / (30.4 * DAY);
    const dr = claimed('dr');
    const traffic = claimed('traffic');
    if (months < 6 && ((Number.isFinite(dr) && dr >= 40) || (Number.isFinite(traffic) && traffic >= 50000))) {
      add(`The domain was registered only ${Math.max(1, Math.round(months))} month(s) ago, but claims high authority or traffic.`);
    }
  }
  return out;
};

// Re-check the fake-number alarm after a seller changes their numbers.
export const refreshAutoFlags = (listing, at = new Date()) => {
  listing.flags = [...(listing.flags || []).filter((f) => !AUTO_FLAG_TYPES.includes(f.type)), ...autoFlags(listing, at)];
};

// Put fresh automatic data on a listing document (the caller saves it).
export const applySiteData = (listing, { dr, authority, info, error }, at = new Date()) => {
  if (dr !== undefined && dr !== null) {
    // First Ahrefs value: keep what the seller typed for the comparison.
    if (!Number.isFinite(listing.sellerReported?.dr) && Number.isFinite(listing.dr) && listing.metrics?.source !== 'checked') {
      listing.set('sellerReported.dr', listing.dr);
      if (!listing.sellerReported?.at) listing.set('sellerReported.at', at);
    }
    listing.set('autoMetrics.dr', dr);
    listing.set('autoMetrics.drAt', at);
    // Ahrefs' DR is the public DR from now on.
    listing.dr = Math.round(dr);
  }
  if (authority) {
    listing.set('autoMetrics.gpScore', authority.ranked ? authority.score : null);
    listing.set('autoMetrics.gpRank', authority.ranked ? authority.rank : null);
    listing.set('autoMetrics.gpTotal', authority.total ?? null);
    listing.set('autoMetrics.gpRelease', authority.release ?? null);
    listing.set('autoMetrics.gpAt', at);
  }
  if (info) {
    listing.set('autoMetrics.loads', info.loads);
    listing.set('autoMetrics.https', info.https);
    listing.set('autoMetrics.siteTitle', info.title || null);
    listing.set('autoMetrics.siteLanguage', info.language || null);
    listing.set('autoMetrics.domainCreatedAt', info.domainCreatedAt || null);
    listing.set('autoMetrics.infoAt', at);
    listing.set('autoMetrics.lastError', info.loads ? null : info.error || null);
  }
  if (error) listing.set('autoMetrics.lastError', String(error).slice(0, 300));
  listing.set('autoMetrics.checkedAt', at);
  listing.flags = [...(listing.flags || []).filter((f) => !AUTO_FLAG_TYPES.includes(f.type)), ...autoFlags(listing, at)];
};

// Everything we know about one site, for the seller form's auto-fill.
export const lookupSite = async (rawUrl) => {
  const domain = normalizeDomain(rawUrl);
  if (!domain) return null;
  const authority = lookupAuthority(domain);
  const registrable = authority?.domain || domain;
  const [info, drResult] = await Promise.all([
    readSiteInfo(domain, { registrable }),
    ahrefsEnabled()
      ? getDomainRating(domain).then((value) => ({ value }), (error) => ({ error: error.message }))
      : Promise.resolve({ disabled: true }),
  ]);
  return {
    domain,
    dr: drResult.value ?? null,
    drError: drResult.error || null,
    drAvailable: ahrefsEnabled(),
    attribution: ATTRIBUTION,
    authority: authority ? { score: authority.score, rank: authority.rank ?? null, total: authority.total ?? null, ranked: authority.ranked } : null,
    info,
  };
};

// Refresh a set of listings: DR for all of them in batches of 1000 (5 s
// apart, see ahrefs.js), GP Authority from the local index, and the home
// page / domain age for those whose details are older than INFO_DAYS.
export const refreshSiteData = async (listings, { infoLimit = 100 } = {}) => {
  if (!listings.length) return { refreshed: 0 };
  const at = new Date();
  let drMap = new Map();
  let drError = null;
  if (ahrefsEnabled()) {
    try {
      drMap = await getDomainRatings(listings.map((l) => l.domain || l.url));
    } catch (error) {
      drError = error.message;
    }
  }
  const needInfo = listings
    .filter((l) => !l.autoMetrics?.infoAt || at - new Date(l.autoMetrics.infoAt) > INFO_DAYS * DAY)
    .slice(0, infoLimit);
  const infos = new Map();
  // Five home pages at a time.
  for (let i = 0; i < needInfo.length; i += 5) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(needInfo.slice(i, i + 5).map(async (l) => {
      const d = normalizeDomain(l.domain || l.url);
      const auth = lookupAuthority(d);
      infos.set(String(l._id), await readSiteInfo(d, { registrable: auth?.domain || d }).catch(() => null));
    }));
  }
  let refreshed = 0;
  for (const l of listings) {
    const d = normalizeDomain(l.domain || l.url);
    if (!d) continue; // eslint-disable-line no-continue
    applySiteData(l, { dr: drMap.get(d), authority: lookupAuthority(d), info: infos.get(String(l._id)), error: drError }, at);
    // eslint-disable-next-line no-await-in-loop
    await l.save();
    refreshed += 1;
  }
  return { refreshed, withDr: drMap.size, withInfo: infos.size, drError };
};

// The scheduled job: listings whose automatic data is oldest, up to 5000 per
// run (= at most 5 Ahrefs requests, sent 5 seconds apart).
export const refreshDueSiteData = async ({ batch = 5000 } = {}) => {
  const cutoff = new Date(Date.now() - REFRESH_DAYS * DAY);
  const due = await Listing.find({
    isDeleted: { $ne: true },
    status: { $in: ['approved', 'pending', 'changes_requested'] },
    $or: [{ 'autoMetrics.checkedAt': { $exists: false } }, { 'autoMetrics.checkedAt': null }, { 'autoMetrics.checkedAt': { $lt: cutoff } }],
  }).sort({ 'autoMetrics.checkedAt': 1 }).limit(batch);
  const r = await refreshSiteData(due);
  return `${r.refreshed} listing(s) refreshed · DR for ${r.withDr || 0} · site details for ${r.withInfo || 0}${r.drError ? ` · Ahrefs error: ${r.drError}` : ''}`;
};

// After a seller adds sites, fetch their data without making them wait.
export const refreshInBackground = (ids) => {
  const list = Array.isArray(ids) ? ids : [ids];
  Listing.find({ _id: { $in: list } })
    .then((docs) => refreshSiteData(docs, { infoLimit: 1000 }))
    .catch((error) => console.error('[sitedata] refresh failed:', error.message));
};

export const siteDataStatus = () => ({ ahrefs: ahrefsStatus(), authority: authorityStatus() });
