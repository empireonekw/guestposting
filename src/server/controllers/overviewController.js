import Listing from '../models/Listing';
import Order from '../models/Order';
import User from '../models/User';
import { json, serverError, queryParams } from '../http';
import { STALE_AFTER_DAYS } from '../metrics';

const DAY = 86400000;
const PERIODS = [7, 30, 90];
const live = { isDeleted: { $ne: true } };

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

// One number for this period and the one before it.
const compare = (current, previous) => ({ current, previous });

const countIn = (Model, match, from, to) => Model.countDocuments({ ...match, createdAt: { $gte: from, $lt: to } });

const sumOrders = async (match, from, to) => {
  const rows = await Order.aggregate([
    // Sellers' own-site posts aren't marketplace sales.
    { $match: { ...match, kind: { $ne: 'self' }, createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, total: { $sum: '$price' }, n: { $sum: 1 } } },
  ]);
  return { total: rows[0]?.total || 0, n: rows[0]?.n || 0 };
};

// Order value per day for [from, to), one entry per day (zeros included).
const dailyOrderValue = async (from, to) => {
  const rows = await Order.aggregate([
    { $match: { status: { $ne: 'cancelled' }, kind: { $ne: 'self' }, createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, value: { $sum: '$price' }, n: { $sum: 1 } } },
  ]);
  const byDay = new Map(rows.map((r) => [r._id, r]));
  const out = [];
  for (let t = from.getTime(); t < to.getTime(); t += DAY) {
    const key = dayKey(t);
    out.push({ day: key, value: byDay.get(key)?.value || 0, orders: byDay.get(key)?.n || 0 });
  }
  return out;
};

// GET /api/admin/overview?days=30: the admin dashboard numbers.
export const getOverview = async (request) => {
  try {
    const q = queryParams(request);
    const days = PERIODS.includes(Number(q.days)) ? Number(q.days) : 30;
    const now = new Date();
    // Whole days, so the chart's last point is today.
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + DAY);
    const start = new Date(end.getTime() - days * DAY);
    const prevStart = new Date(start.getTime() - days * DAY);
    const staleBefore = new Date(Date.now() - STALE_AFTER_DAYS * DAY);
    const notCancelled = { status: { $ne: 'cancelled' } };

    const [
      completedNow, completedPrev, ordersNow, ordersPrev,
      signupsNow, signupsPrev, sellersNow, sellersPrev, listingsNow, listingsPrev,
      statusRows, roleRows, pending, flagged, unchecked, stale, verified,
      seriesNow, seriesPrev, recentOrders, recentPending,
    ] = await Promise.all([
      sumOrders({ status: 'completed' }, start, end),
      sumOrders({ status: 'completed' }, prevStart, start),
      sumOrders(notCancelled, start, end),
      sumOrders(notCancelled, prevStart, start),
      countIn(User, {}, start, end),
      countIn(User, {}, prevStart, start),
      countIn(User, { role: 'seller' }, start, end),
      countIn(User, { role: 'seller' }, prevStart, start),
      countIn(Listing, live, start, end),
      countIn(Listing, live, prevStart, start),
      Listing.aggregate([{ $match: live }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
      Listing.countDocuments({ ...live, status: 'pending' }),
      Listing.countDocuments({ ...live, 'flags.0': { $exists: true } }),
      Listing.countDocuments({ ...live, status: 'approved', 'metrics.source': { $ne: 'checked' } }),
      Listing.countDocuments({ ...live, 'metrics.source': 'checked', 'metrics.updatedAt': { $lt: staleBefore } }),
      Listing.countDocuments({ ...live, isVerified: true }),
      dailyOrderValue(start, end),
      dailyOrderValue(prevStart, start),
      Order.find({ kind: { $ne: 'self' } }).sort({ createdAt: -1 }).limit(6).populate('buyer', 'name').populate('listing', 'domain url').lean(),
      Listing.find({ ...live, status: 'pending' }).sort({ createdAt: -1 }).limit(6).populate('seller', 'name').select('domain url price createdAt seller').lean(),
    ]);

    const byStatus = Object.fromEntries(statusRows.map((r) => [r._id, r.n]));
    const byRole = Object.fromEntries(roleRows.map((r) => [r._id, r.n]));

    return json({
      days,
      from: start,
      to: end,
      cards: {
        completedValue: compare(completedNow.total, completedPrev.total),
        orders: compare(ordersNow.n, ordersPrev.n),
        orderValue: compare(ordersNow.total, ordersPrev.total),
        signups: compare(signupsNow, signupsPrev),
        newSellers: compare(sellersNow, sellersPrev),
        newListings: compare(listingsNow, listingsPrev),
        avgOrder: compare(ordersNow.n ? ordersNow.total / ordersNow.n : 0, ordersPrev.n ? ordersPrev.total / ordersPrev.n : 0),
      },
      totals: {
        liveSites: byStatus.approved || 0,
        pendingSites: byStatus.pending || 0,
        rejectedSites: byStatus.rejected || 0,
        changesSites: byStatus.changes_requested || 0,
        buyers: byRole.buyer || 0,
        sellers: byRole.seller || 0,
        admins: byRole.admin || 0,
        verified,
      },
      attention: { pending, flagged, unchecked, stale },
      series: seriesNow.map((p, i) => ({ ...p, previous: seriesPrev[i]?.value || 0 })),
      recentOrders: recentOrders.map((o) => ({
        _id: o._id, price: o.price, status: o.status, createdAt: o.createdAt,
        buyer: o.buyer?.name, site: o.listing?.domain || o.listing?.url,
      })),
      recentPending: recentPending.map((l) => ({
        _id: l._id, site: l.domain || l.url, price: l.price, createdAt: l.createdAt, seller: l.seller?.name,
      })),
    });
  } catch (error) {
    return serverError(error);
  }
};
