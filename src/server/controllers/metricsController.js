import Listing from '../models/Listing';
import logActivity from '../logger';
import { json, readBody, serverError, queryParams, getPaging, pageInfo } from '../http';
import { objectId, oneOf, num, str, ValidationError } from '../validate';
import { applyCheckedMetrics, STALE_AFTER_DAYS } from '../metrics';
import { readTopCountries } from './listingController';
import { siteDataStatus } from '../sitedata';

const live = { isDeleted: { $ne: true } };
const VIEWS = ['flagged', 'stale', 'seller', 'all', 'duplicates'];

// Domains listed more than once (by any sellers), most copies first.
const duplicateDomains = () =>
  Listing.aggregate([
    { $match: { ...live, domain: { $type: 'string', $ne: '' } } },
    {
      $group: {
        _id: '$domain',
        n: { $sum: 1 },
        sellers: { $addToSet: '$seller' },
        listings: { $push: { id: '$_id', seller: '$seller', status: '$status', price: '$price', isVerified: '$isVerified' } },
      },
    },
    { $match: { n: { $gt: 1 } } },
    { $sort: { n: -1, _id: 1 } },
    { $limit: 200 },
    { $lookup: { from: 'users', localField: 'sellers', foreignField: '_id', as: 'sellerDocs', pipeline: [{ $project: { name: 1, email: 1 } }] } },
  ]);

// GET /api/admin/metrics-report?view=flagged&page=1
export const getMetricsReport = async (request) => {
  try {
    const q = queryParams(request);
    const view = oneOf(q.view, 'view', 'View', VIEWS, { required: false }) || 'flagged';
    const paging = getPaging(request, { defaultLimit: 25, maxLimit: 100 });
    const staleBefore = new Date(Date.now() - STALE_AFTER_DAYS * 86400000);

    const filters = {
      flagged: { ...live, 'flags.0': { $exists: true } },
      stale: { ...live, 'metrics.source': 'checked', 'metrics.updatedAt': { $lt: staleBefore } },
      seller: { ...live, 'metrics.source': { $ne: 'checked' } },
      all: { ...live },
    };

    const [summaryRows, duplicates] = await Promise.all([
      Listing.aggregate([
        { $match: live },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            real: { $sum: { $cond: [{ $eq: ['$metrics.source', 'checked'] }, 1, 0] } },
            stale: { $sum: { $cond: [{ $and: [{ $eq: ['$metrics.source', 'checked'] }, { $lt: ['$metrics.updatedAt', staleBefore] }] }, 1, 0] } },
            flagged: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$flags', []] } }, 0] }, 1, 0] } },
            verified: { $sum: { $cond: ['$isVerified', 1, 0] } },
          },
        },
      ]),
      duplicateDomains(),
    ]);
    const summary = summaryRows[0] || { total: 0, approved: 0, real: 0, stale: 0, flagged: 0, verified: 0 };
    delete summary._id;
    summary.duplicates = duplicates.length;

    const result = { summary, staleAfterDays: STALE_AFTER_DAYS, view, siteData: siteDataStatus() };

    if (view === 'duplicates') {
      result.duplicates = duplicates.map((d) => ({
        domain: d._id,
        count: d.n,
        listings: d.listings.map((l) => {
          const s = d.sellerDocs.find((u) => String(u._id) === String(l.seller));
          return { ...l, sellerName: s?.name, sellerEmail: s?.email };
        }),
      }));
      return json(result);
    }

    const query = filters[view];
    const [rows, total] = await Promise.all([
      Listing.find(query)
        .select('url domain status seller dr da authorityScore traffic semrushTraffic keywords spamScore topCountries sellerReported metrics flags isVerified')
        .populate('seller', 'name email')
        .sort(view === 'flagged' ? { 'flags.at': -1 } : { 'metrics.updatedAt': 1, createdAt: -1 })
        .skip(paging.skip)
        .limit(paging.limit)
        .lean(),
      Listing.countDocuments(query),
    ]);
    return json({ ...result, rows, ...pageInfo(total, paging) });
  } catch (error) {
    return serverError(error);
  }
};

const MAX_TRAFFIC = 10_000_000_000;

// PUT /api/admin/listings/:id/metrics: our team's check of a site's numbers.
// Body: dr, da, authorityScore, traffic, semrushTraffic, keywords, spamScore,
// topCountries, and checkedAt (YYYY-MM-DD, default today; an earlier month
// only fills in the traffic history).
export const updateCheckedMetrics = async (request, params, user) => {
  try {
    const id = objectId(params.id, 'id', 'Listing');
    const body = await readBody(request);
    const score = (k, label) => num(body[k], k, label, { required: false, min: 0, max: 100, integer: true });
    const big = (k, label) => num(body[k], k, label, { required: false, min: 0, max: MAX_TRAFFIC, integer: true });
    const values = {
      dr: score('dr', 'DR'),
      da: score('da', 'DA'),
      authorityScore: score('authorityScore', 'AS'),
      spamScore: score('spamScore', 'Spam score'),
      traffic: big('traffic', 'Traffic'),
      semrushTraffic: big('semrushTraffic', 'Semrush traffic'),
      keywords: big('keywords', 'Keywords'),
      topCountries: readTopCountries(body.topCountries),
    };
    Object.keys(values).forEach((k) => values[k] === undefined && delete values[k]);
    if (!Object.keys(values).length) throw new ValidationError('Enter at least one number', 'dr');

    let checkedAt = new Date();
    const date = str(body.checkedAt, 'checkedAt', 'Check date', { required: false, max: 10 });
    if (date) {
      checkedAt = new Date(`${date}T12:00:00Z`);
      if (Number.isNaN(checkedAt.getTime())) throw new ValidationError('Use a date like 2026-11-30', 'checkedAt');
      if (checkedAt > new Date(Date.now() + 86400000)) throw new ValidationError('The check date cannot be in the future', 'checkedAt');
    }

    const listing = await Listing.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!listing) return json({ message: 'Listing not found' }, 404);
    // DR comes from Ahrefs once we have it.
    if (Number.isFinite(listing.autoMetrics?.dr)) delete values.dr;
    const { isLatest } = applyCheckedMetrics(listing, values, { userId: user.id, checkedAt });
    await listing.save();
    await logActivity(user.id, 'METRICS_CHECKED', listing._id, `${isLatest ? 'Checked' : 'Added history for'} ${listing.domain} (${checkedAt.toISOString().slice(0, 10)})`);
    return json({
      message: isLatest
        ? `Saved. ${listing.domain} now shows these numbers, checked ${checkedAt.toISOString().slice(0, 10)}.`
        : `Saved as history for ${checkedAt.toISOString().slice(0, 7)}. The current numbers were not changed.`,
      flags: listing.flags,
    });
  } catch (error) {
    return serverError(error);
  }
};
