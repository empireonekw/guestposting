import mongoose from 'mongoose';
import Order from '../models/Order';
import Listing from '../models/Listing';
import Review from '../models/Review';
import LinkCheck from '../models/LinkCheck';
import { suggestedRefund, caseOpen } from '../linkMonitor';
import User, { sellerStatusOf } from '../models/User';
import { json, readBody, serverError, queryParams, getPaging, pageInfo, escapeRegex } from '../http';
import { str, objectId, oneOf, ValidationError } from '../validate';
import { rateLimit, MINUTE } from '../rateLimit';
import { saveOrderFile, findOrderFile, openDownload, KINDS } from '../files';
import {
  roleOf, availableActions, runAction, addEvent, notify, isLate, addDays, LATE_GRACE_DAYS,
} from '../orderFlow';
import { ORDER_STATUSES, OPEN_STATUSES, WAITING_ON } from '@/data/orderStatus';
import { BLOCKED_NICHES } from '@/data/listingOptions';
import LEGAL from '@/data/legal';

const HOUR = 60 * 60 * 1000;

// POST /api/orders { listingId }
export const createOrder = async (request, params, user) => {
  try {
    const limited = rateLimit('order-create', user.id, { limit: 20, windowMs: 10 * MINUTE });
    if (limited) return limited;
    const body = await readBody(request);
    const listingId = objectId(body.listingId, 'listingId', 'Listing');

    const listing = await Listing.findById(listingId);
    // Only approved, live listings can be bought.
    if (!listing || listing.isDeleted || listing.status !== 'approved') {
      return json({ message: 'Listing not found' }, 404);
    }
    if ((listing.niches || []).some((n) => BLOCKED_NICHES.includes(n))) {
      return json({ message: 'This website can’t be ordered.' }, 400);
    }
    if (listing.seller.toString() === user.id) {
      return json({ message: 'You cannot buy your own listing' }, 400);
    }
    const listingSeller = await User.findById(listing.seller).select('isSuspended role sellerStatus');
    if (!listingSeller || listingSeller.isSuspended || ['pending', 'blocked'].includes(sellerStatusOf(listingSeller))) {
      return json({ message: 'This listing is currently unavailable.' }, 400);
    }

    const now = new Date();
    const order = new Order({
      listing: listing._id,
      buyer: user.id,
      seller: listing.seller,
      site: { domain: listing.domain, url: listing.url },
      price: listing.price,
      turnaroundDays: listing.turnaroundDays ?? 3,
      linkType: listing.linkType || 'dofollow',
      linkValidity: listing.linkValidity || 'permanent',
      status: 'pending_acceptance',
      acceptBy: new Date(now.getTime() + LEGAL.sellerAcceptHours * HOUR),
    });
    addEvent(order, { by: user.id, role: 'buyer', type: 'ordered' });
    await order.save();
    await notify(order, ['seller'], `New order for ${listing.domain}. Accept or decline it within ${LEGAL.sellerAcceptHours} hours.`, {
      from: user.id, emailSubject: `New order: ${listing.domain}`,
    });
    return json(order, 201);
  } catch (error) {
    return serverError(error);
  }
};

// A list row: the order plus whose move it is and whether it is late.
const listView = (order, role) => ({
  _id: order._id,
  site: order.site,
  listing: order.listing,
  buyer: order.buyer,
  seller: order.seller,
  price: order.price,
  status: order.status,
  createdAt: order.createdAt,
  dueAt: order.dueAt,
  acceptBy: order.acceptBy,
  reviewBy: order.reviewBy,
  late: isLate(order),
  yourTurn: WAITING_ON[order.status] === role,
});

// Filters shared by "my orders", "my sales" and the admin list.
const FILTERS = ['all', 'open', 'action', 'late', 'stuck', 'disputed', 'completed', 'cancelled', ...ORDER_STATUSES];
const filterQuery = (filter, role) => {
  const now = new Date();
  switch (filter) {
    case 'open': return { status: { $in: OPEN_STATUSES } };
    case 'action': {
      const mine = Object.entries(WAITING_ON).filter(([, who]) => who === role).map(([s]) => s);
      return { status: { $in: mine } };
    }
    case 'late': return { status: 'writing', dueAt: { $lt: now } };
    // Open but nothing has happened for a week.
    case 'stuck': return { status: { $in: OPEN_STATUSES }, lastActivityAt: { $lt: addDays(now, -7) } };
    case 'all':
    case undefined: return {};
    default: return { status: filter };
  }
};

const listOrders = async (request, base, role, populateOther) => {
  const q = queryParams(request);
  const paging = getPaging(request, { defaultLimit: 25, maxLimit: 100 });
  const filter = oneOf(q.status, 'status', 'Filter', FILTERS, { required: false }) || 'all';
  const query = { ...base, ...filterQuery(filter, role) };

  const [orders, total, actionCount] = await Promise.all([
    Order.find(query)
      .select('-events -dispute.evidence')
      .populate('listing', 'url domain category')
      .populate(populateOther, 'name')
      .sort({ createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .lean(),
    Order.countDocuments(query),
    Order.countDocuments({ ...base, ...filterQuery('action', role) }),
  ]);
  return json({ orders: orders.map((o) => listView(o, role)), actionCount, ...pageInfo(total, paging) });
};

export const getMyOrders = async (request, params, user) => {
  try {
    return await listOrders(request, { buyer: user.id }, 'buyer', 'seller');
  } catch (error) {
    return serverError(error);
  }
};

export const getMySales = async (request, params, user) => {
  try {
    return await listOrders(request, { seller: user.id }, 'seller', 'buyer');
  } catch (error) {
    return serverError(error);
  }
};

// GET /api/admin/orders?status=&search=&page=
export const getAdminOrders = async (request) => {
  try {
    const q = queryParams(request);
    const paging = getPaging(request, { defaultLimit: 25, maxLimit: 100 });
    const filter = oneOf(q.status, 'status', 'Filter', FILTERS, { required: false }) || 'open';
    const search = str(q.search, 'search', 'Search', { required: false, max: 100 });

    const base = {};
    if (search) {
      const re = { $regex: escapeRegex(search), $options: 'i' };
      const people = await User.find({ $or: [{ name: re }, { email: re }] }).limit(200).distinct('_id');
      base.$or = [{ 'site.domain': re }, { buyer: { $in: people } }, { seller: { $in: people } }];
      if (mongoose.isValidObjectId(search)) base.$or.push({ _id: new mongoose.Types.ObjectId(search) });
    }
    const query = { ...base, ...filterQuery(filter, 'admin') };
    const countFor = (f) => Order.countDocuments({ ...base, ...filterQuery(f, 'admin') });

    const [orders, total, open, late, stuck, disputed] = await Promise.all([
      Order.find(query)
        .select('-events -dispute.evidence')
        .populate('buyer', 'name email')
        .populate('seller', 'name email')
        .sort({ createdAt: -1 })
        .skip(paging.skip)
        .limit(paging.limit)
        .lean(),
      Order.countDocuments(query),
      countFor('open'), countFor('late'), countFor('stuck'), countFor('disputed'),
    ]);
    return json({
      orders: orders.map((o) => ({ ...listView(o, 'admin'), stuck: OPEN_STATUSES.includes(o.status) && o.lastActivityAt < addDays(new Date(), -7) })),
      counts: { open, late, stuck, disputed },
      ...pageInfo(total, paging),
    });
  } catch (error) {
    return serverError(error);
  }
};

// The full order for the order page, with what the viewer may do now.
const detailView = (order, role) => {
  const o = order.toObject();
  // Sellers don't see buyer emails, and buyers don't see seller emails.
  if (role !== 'admin') {
    if (o.buyer) delete o.buyer.email;
    if (o.seller) delete o.seller.email;
  }
  return {
    ...o,
    viewerRole: role,
    actions: availableActions(order, role),
    late: isLate(order),
    cancelLateAt: order.dueAt ? addDays(order.dueAt, LATE_GRACE_DAYS) : null,
    rules: {
      revisionRounds: LEGAL.revisionRounds,
      autoApproveDays: LEGAL.autoApproveDays,
      linkFixDays: LEGAL.linkFixDays,
      disputeAnswerDays: LEGAL.disputeAnswerDays,
      lateGraceDays: LATE_GRACE_DAYS,
    },
  };
};

// Review state, the last link checks, and for our team the refund the
// Refund Policy suggests when a lost-link case is open.
const detailExtras = async (order, role) => {
  const [reviewed, linkChecks] = await Promise.all([
    Review.exists({ order: order._id }),
    order.liveLink ? LinkCheck.find({ order: order._id }).sort({ at: -1 }).limit(10).select('-order -by').lean() : [],
  ]);
  return {
    reviewed: !!reviewed,
    linkChecks,
    suggestedRefund: role === 'admin' && caseOpen(order) ? suggestedRefund(order) : undefined,
  };
};

const loadOrder = (id) => Order.findById(id)
  .populate('listing', 'url domain category price turnaroundDays contentRules linkType')
  .populate('buyer', 'name email')
  .populate('seller', 'name email')
  .populate('events.by', 'name')
  .populate('dispute.evidence.by', 'name');

export const getOrderById = async (request, params, user) => {
  try {
    const id = objectId(params.id, 'id', 'Order');
    const order = await loadOrder(id);
    if (!order) return json({ message: 'Order not found' }, 404);
    const role = roleOf(order, user);
    if (!role) return json({ message: 'Not authorized to view this order' }, 403);
    return json({ ...detailView(order, role), ...(await detailExtras(order, role)) });
  } catch (error) {
    return serverError(error);
  }
};

// POST /api/orders/:id/action { action, ...fields }
export const orderAction = async (request, params, user) => {
  try {
    const limited = rateLimit('order-action', user.id, { limit: 60, windowMs: 10 * MINUTE });
    if (limited) return limited;
    const id = objectId(params.id, 'id', 'Order');
    const body = await readBody(request);
    const order = await loadOrder(id);
    if (!order) return json({ message: 'Order not found' }, 404);
    const role = roleOf(order, user);
    if (!role) return json({ message: 'Not authorized' }, 403);
    const message = await runAction(order, user, role, body);
    const fresh = await loadOrder(id);
    return json({ message, order: { ...detailView(fresh, role), ...(await detailExtras(fresh, role)) } });
  } catch (error) {
    return serverError(error);
  }
};

// POST /api/orders/:id/files (multipart: file, kind): upload one file for
// this order. The returned fileId is then sent with an action or message.
export const uploadOrderFile = async (request, params, user) => {
  try {
    const limited = rateLimit('order-upload', user.id, { limit: 30, windowMs: 10 * MINUTE });
    if (limited) return limited;
    const id = objectId(params.id, 'id', 'Order');
    const order = await Order.findById(id).select('buyer seller');
    if (!order) return json({ message: 'Order not found' }, 404);
    if (!roleOf(order, user)) return json({ message: 'Not authorized' }, 403);

    let form;
    try {
      form = await request.formData();
    } catch {
      throw new ValidationError('Choose a file to upload', 'file');
    }
    const kind = oneOf(form.get('kind'), 'kind', 'File kind', KINDS);
    const saved = await saveOrderFile(form.get('file'), { orderId: id, userId: user.id, kind });
    return json(saved, 201);
  } catch (error) {
    return serverError(error);
  }
};

// GET /api/files/:id: download a file, for the order's buyer, seller or an
// admin. Always sent as a download, never shown inline.
export const downloadFile = async (request, params, user) => {
  try {
    const doc = await findOrderFile(params.id);
    if (!doc) return json({ message: 'File not found' }, 404);
    const order = await Order.findById(doc.metadata?.order).select('buyer seller');
    if (!order || !roleOf(order, user)) return json({ message: 'File not found' }, 404);

    const stream = openDownload(doc._id);
    const body = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
      cancel() { stream.destroy(); },
    });
    const ascii = doc.filename.replace(/[^\x20-\x7e]/g, '_');
    return new Response(body, {
      headers: {
        'Content-Type': doc.metadata?.type || 'application/octet-stream',
        'Content-Length': String(doc.length),
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return serverError(error);
  }
};
