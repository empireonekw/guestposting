// LetRank's own metrics. No outside service is called: our team checks each
// site's numbers and enters them in the admin panel. A check is dated, adds a
// point to the monthly traffic history (which draws the trend chart) and
// raises flags the admin report shows.
//
// Before the first check a listing shows the seller's own numbers, labelled
// as such. After it, a seller's edits only update what they "reported", and
// the public numbers change only when our team checks again.

// Public metric fields.
export const METRIC_KEYS = ['dr', 'da', 'authorityScore', 'traffic', 'semrushTraffic', 'keywords'];

// A check older than this shows as "out of date" in the admin report.
export const STALE_AFTER_DAYS = 30;

const SPAM_LIMIT = 30;
const DROP_LIMIT = 0.4; // flag a fall of 40% or more
const monthKey = (d) => new Date(d).toISOString().slice(0, 7);

export const isChecked = (listing) => listing.metrics?.source === 'checked';

// Problems worth an admin's attention. `past` is the traffic history before
// this check.
export const computeFlags = (listing, past = [], at = new Date()) => {
  const flags = [];
  const current = listing.traffic || 0;
  const earlier = past
    .filter((p) => monthKey(p.month) < monthKey(at) && Number.isFinite(p.ahrefs))
    .slice(-3)
    .map((p) => p.ahrefs);
  const peak = earlier.length ? Math.max(...earlier) : 0;
  if (peak >= 500 && current < peak * (1 - DROP_LIMIT)) {
    const pct = Math.round((1 - current / peak) * 100);
    flags.push({ type: 'traffic_drop', message: `Traffic fell ${pct}% (from ${peak.toLocaleString()} to ${current.toLocaleString()})`, at });
  }
  if (Number.isFinite(listing.spamScore) && listing.spamScore >= SPAM_LIMIT) {
    flags.push({ type: 'spam', message: `Spam score is ${listing.spamScore}%`, at });
  }
  const s = listing.sellerReported || {};
  const off = [];
  if (Number.isFinite(s.dr) && Math.abs(s.dr - (listing.dr || 0)) >= 10) off.push(`DR ${s.dr} vs ${listing.dr || 0}`);
  if (Number.isFinite(s.da) && Math.abs(s.da - (listing.da || 0)) >= 10) off.push(`DA ${s.da} vs ${listing.da || 0}`);
  if (Number.isFinite(s.traffic) && s.traffic - current >= 1000 && s.traffic > current * 1.5) {
    off.push(`traffic ${s.traffic.toLocaleString()} vs ${current.toLocaleString()}`);
  }
  if (off.length) flags.push({ type: 'mismatch', message: `Seller's numbers differ from our check: ${off.join(', ')}`, at });
  return flags;
};

// Merges monthly points (the newer value for a month wins) and keeps 2 years.
export const mergeHistory = (existing, incoming) => {
  const byMonth = new Map();
  [...existing, ...incoming].forEach((p) => {
    if (!p?.month) return;
    const key = monthKey(p.month);
    const prev = byMonth.get(key) || {};
    byMonth.set(key, {
      month: new Date(`${key}-01T00:00:00Z`),
      ahrefs: Number.isFinite(p.ahrefs) ? p.ahrefs : prev.ahrefs,
      semrush: Number.isFinite(p.semrush) ? p.semrush : prev.semrush,
    });
  });
  return [...byMonth.values()].sort((a, b) => a.month - b.month).slice(-24);
};

// Saves one check by our team. `values` holds any of METRIC_KEYS plus
// spamScore and topCountries; `checkedAt` may be in the past to fill in
// earlier months of history (then only the history changes, not the current
// numbers). The caller saves the listing.
export const applyCheckedMetrics = (listing, values, { userId, checkedAt = new Date() } = {}) => {
  const past = (listing.trafficHistory || []).map((p) => ({ month: p.month, ahrefs: p.ahrefs, semrush: p.semrush }));
  const lastCheck = listing.metrics?.updatedAt ? new Date(listing.metrics.updatedAt) : null;
  const isLatest = !lastCheck || monthKey(checkedAt) >= monthKey(lastCheck);

  // Keep what the seller typed before our numbers replace it.
  if (!isChecked(listing) && !listing.sellerReported?.at) {
    listing.sellerReported = {
      dr: listing.dr, da: listing.da, authorityScore: listing.authorityScore,
      traffic: listing.traffic, semrushTraffic: listing.semrushTraffic, keywords: listing.keywords,
      at: listing.updatedAt || new Date(),
    };
  }

  const traffic = Number.isFinite(values.traffic) ? values.traffic : listing.traffic;
  const semrushTraffic = Number.isFinite(values.semrushTraffic) ? values.semrushTraffic : listing.semrushTraffic;
  listing.trafficHistory = mergeHistory(past, [{ month: checkedAt, ahrefs: traffic, semrush: semrushTraffic }]);

  if (isLatest) {
    [...METRIC_KEYS, 'spamScore'].forEach((k) => {
      if (Number.isFinite(values[k])) listing[k] = values[k];
    });
    if (Array.isArray(values.topCountries)) listing.topCountries = values.topCountries;
    listing.set('metrics.source', 'checked');
    listing.set('metrics.updatedAt', checkedAt);
    if (userId) listing.set('metrics.checkedBy', userId);
    listing.flags = computeFlags(listing, past, checkedAt);
  }
  return { isLatest };
};
