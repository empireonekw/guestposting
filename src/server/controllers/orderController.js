import mongoose from 'mongoose';
import Order from '../models/Order';
import Review from '../models/Review';
import LinkCheck from '../models/LinkCheck';
import { suggestedRefund, caseOpen } from '../linkMonitor';
import User from '../models/User';
import { json, readBody, serverError, queryParams, getPaging, pageInfo, escapeRegex } from '../http';
import { str, objectId, oneOf, ValidationError } from '../validate';
import { rateLimit, MINUTE } from '../rateLimit';
import { saveOrderFile, findOrderFile, openDownload, KINDS } from '../files';
import {
  roleOf, availableActions, runAction, isLate, addDays, LATE_GRACE_DAYS, readBrief, addEvent,
} from '../orderFlow';
import Listing from '../models/Listing';
import { cleanArticle, wordCount } from '../articleHtml';
import { runCheck, startMonitoring, problemText } from '../linkMonitor';
import { url as urlField, num } from '../validate';
import { ORDER_STATUSES, OPEN_STATUSES, WAITING_ON } from '@/data/orderStatus';
import LEGAL from '@/data/legal';
import { placeOrders } from '../buying';

// POST /api/orders { listingId, couponCode?, clientName?, ...brief }: the
// one-form order. The brief (who writes, article, target URL, anchor text)
// comes with the order, so the publisher can publish straight away. The cart
// checkout places several orders through the same code, without a brief.
export const createOrder = async (request, params, user) => {
  try {
    const limited = rateLimit('order-create', user.id, { limit: 20, windowMs: 10 * MINUTE });
    if (limited) return limited;
    const body = await readBody(request);
    const listingId = objectId(body.listingId, 'listingId', 'Listing');
    const couponCode = str(body.couponCode, 'couponCode', 'Coupon code', { required: false, max: 40 });
    const clientName = str(body.clientName, 'clientName', 'Client name', { required: false, max: 120 });
    const brief = readBrief(body);
    const { orders } = await placeOrders(user, [listingId], { couponCode, brief, clientName });
    return json(orders[0], 201);
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
  // The coupon discount is the buyer's business (the seller earns the full price).
  discount: role === 'seller' ? undefined : order.discount || 0,
  status: order.status,
  createdAt: order.createdAt,
  dueAt: order.dueAt,
  acceptBy: order.acceptBy,
  reviewBy: order.reviewBy,
  late: isLate(order),
  yourTurn: order.kind !== 'self' && WAITING_ON[order.status] === role,
  kind: order.kind || 'marketplace',
  // The orderer's private client name: shown to them and to our team only.
  clientName: role === 'seller' && order.kind !== 'self' ? undefined : order.clientName,
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
    return await listOrders(request, { buyer: user.id, kind: { $ne: 'self' } }, 'buyer', 'seller');
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
  // The buyer's client is their business, not the publisher's.
  if (role === 'seller' && o.kind !== 'self') delete o.clientName;
  // Sellers earn the full price; a buyer's coupon is not their business.
  if (role === 'seller') {
    delete o.discount;
    delete o.coupon;
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

// POST /api/orders/own { listingId, clientName?, price?, targetUrl, anchorText,
// articleHtml?, liveLink }: a seller logs a post they published on one of
// their own websites for an outside client. It is recorded as a completed
// order (no buyer, no fee), the live link is checked now, and then it is
// monitored like any sold link.
export const logOwnPost = async (request, params, user) => {
  try {
    const limited = rateLimit('own-post', user.id, { limit: 30, windowMs: 10 * MINUTE });
    if (limited) return limited;
    const body = await readBody(request);
    const listingId = objectId(body.listingId, 'listingId', 'Website');
    const listing = await Listing.findOne({ _id: listingId, isDeleted: { $ne: true } });
    if (!listing || String(listing.seller) !== user.id) {
      throw new ValidationError('Choose one of your own websites', 'listingId');
    }
    const clientName = str(body.clientName, 'clientName', 'Client name', { required: false, max: 120 });
    const price = num(body.price, 'price', 'Price charged', { required: false, min: 0, max: 100000 });
    const targetUrl = urlField(body.targetUrl, 'targetUrl', 'Target URL');
    const anchorText = str(body.anchorText, 'anchorText', 'Anchor text', { max: 200 });
    const articleHtml = cleanArticle(body.articleHtml, { minWords: 1 });
    const liveLink = urlField(body.liveLink, 'liveLink', 'Live URL');
    const host = new URL(liveLink).hostname.replace(/^www\./, '').toLowerCase();
    const domain = (listing.domain || '').toLowerCase();
    if (domain && host !== domain && !host.endsWith(`.${domain}`)) {
      throw new ValidationError(`The live URL must be on ${domain}.`, 'liveLink');
    }

    const now = new Date();
    const order = new Order({
      kind: 'self',
      listing: listing._id,
      buyer: user.id,
      seller: user.id,
      site: { domain: listing.domain, url: listing.url },
      price: price ?? 0,
      sellerEarning: 0,
      turnaroundDays: listing.turnaroundDays ?? 3,
      linkType: listing.linkType || 'dofollow',
      linkValidity: listing.linkValidity || 'permanent',
      contentSource: 'seller',
      clientName,
      targetUrl,
      anchorText,
      ...(articleHtml ? { articleHtml, articleWords: wordCount(articleHtml) } : {}),
      liveLink,
      status: 'completed',
      briefAt: now,
      deliveredAt: now,
      completedAt: now,
      completedBy: 'self',
    });
    // Same check as a marketplace delivery: a missing, nofollow or gone link
    // is refused straight away.
    const check = await runCheck(order, { source: 'delivery', by: user.id });
    if (check.verdict === 'problem') {
      throw new ValidationError(`We checked ${liveLink} and found a problem: ${problemText(check.problems)}. Fix it and try again.`, 'liveLink');
    }
    order.set('link.status', check.verdict);
    startMonitoring(order, now);
    addEvent(order, { by: user.id, role: 'seller', type: 'own_post', note: clientName ? `For ${clientName}` : undefined });
    await order.save();
    return json({ _id: order._id, verdict: check.verdict, problems: check.problems }, 201);
  } catch (error) {
    return serverError(error);
  }
};
