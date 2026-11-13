import Order from '../models/Order';
import User from '../models/User';
import { json, serverError, queryParams, getPaging, pageInfo, escapeRegex } from '../http';
import { str, oneOf } from '../validate';
import { OPEN_CASE } from '@/data/orderStatus';

// Admin → Link monitor (Module 5): every guaranteed link, problems, lost-link
// cases and guarantees ending soon.

const DAY = 24 * 60 * 60 * 1000;
const VIEWS = ['monitored', 'problems', 'cases', 'awaiting', 'ending', 'ended', 'settled'];

const viewQuery = (view, now = new Date()) => {
  const monitored = { status: 'completed', 'link.guaranteeUntil': { $exists: true } };
  switch (view) {
    case 'problems': return { ...monitored, 'link.status': { $in: ['problem', 'unverified', 'lost'] } };
    case 'cases': return { 'link.case.status': { $in: OPEN_CASE } };
    case 'awaiting': return { 'link.case.status': 'awaiting_decision' };
    case 'ending': return { ...monitored, 'link.status': { $ne: 'ended' }, 'link.guaranteeUntil': { $gte: now, $lte: new Date(now.getTime() + 30 * DAY) } };
    case 'ended': return { ...monitored, 'link.status': 'ended' };
    case 'settled': return { 'link.case.status': { $in: ['fixed', 'replaced', 'refunded', 'closed'] } };
    default: return { ...monitored, 'link.status': { $ne: 'ended' } };
  }
};

// GET /api/admin/links?view=&search=&page=
export const getAdminLinks = async (request) => {
  try {
    const q = queryParams(request);
    const paging = getPaging(request, { defaultLimit: 25, maxLimit: 100 });
    const view = oneOf(q.view, 'view', 'View', VIEWS, { required: false }) || 'monitored';
    const search = str(q.search, 'search', 'Search', { required: false, max: 100 });

    const base = {};
    if (search) {
      const re = { $regex: escapeRegex(search), $options: 'i' };
      const people = await User.find({ $or: [{ name: re }, { email: re }] }).limit(200).distinct('_id');
      base.$or = [{ 'site.domain': re }, { liveLink: re }, { buyer: { $in: people } }, { seller: { $in: people } }];
    }
    const query = { ...base, ...viewQuery(view) };
    const count = (v) => Order.countDocuments({ ...base, ...viewQuery(v) });

    const [rows, total, monitored, problems, cases, awaiting, ending, worst] = await Promise.all([
      Order.find(query)
        .select('site liveLink price buyer seller link linkType linkValidity deliveredAt completedAt')
        .populate('buyer', 'name')
        .populate('seller', 'name')
        .sort(view === 'ending' ? { 'link.guaranteeUntil': 1 } : view === 'cases' || view === 'awaiting' ? { 'link.case.openedAt': 1 } : { 'link.lastCheckedAt': -1 })
        .skip(paging.skip)
        .limit(paging.limit)
        .lean(),
      Order.countDocuments(query),
      count('monitored'), count('problems'), count('cases'), count('awaiting'), count('ending'),
      // Sellers who lose links most often.
      Order.aggregate([
        { $match: { 'link.lostCount': { $gt: 0 } } },
        { $group: { _id: '$seller', lost: { $sum: '$link.lostCount' }, orders: { $sum: 1 } } },
        { $sort: { lost: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $project: { lost: 1, orders: 1, name: { $first: '$u.name' } } },
      ]),
    ]);
    return json({ links: rows, counts: { monitored, problems, cases, awaiting, ending }, worstSellers: worst, ...pageInfo(total, paging) });
  } catch (error) {
    return serverError(error);
  }
};
