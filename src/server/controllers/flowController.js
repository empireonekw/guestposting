import Listing from '../models/Listing';
import Order from '../models/Order';
import User from '../models/User';
import Conversation from '../models/Conversation';
import ChatMessage from '../models/ChatMessage';
import { json, serverError, queryParams } from '../http';
import { oneOf } from '../validate';
import { STALE_AFTER_DAYS } from '../metrics';

// The admin "Live flow" page: each business pipeline as steps (nodes) and
// moves between them (edges). For every step: how many items sit there and
// how many have a problem; for every edge: how many moved along it in the
// last 24 hours (the page animates those as moving dots).

const HOUR = 3600000;
const DAY = 24 * HOUR;
const live = { isDeleted: { $ne: true } };

// When a step's items count as having a problem.
const RULES = {
  noBriefDays: 3,
  writingDays: 7,
  reviewDays: 2,
  sellerReviewDays: 2,
  supportHours: 24,
};

const ago = (ms) => new Date(Date.now() - ms);

// Match filters for every step, shared by the counts and the item lists.
const steps = () => {
  const staleBefore = ago(STALE_AFTER_DAYS * DAY);
  return {
    // Selling flow
    'selling.sites': { model: Listing, match: { ...live, status: 'approved' } },
    'selling.placed': { model: Order, match: { status: 'awaiting_content' }, problem: { createdAt: { $lt: ago(RULES.noBriefDays * DAY) } }, problemText: `No brief after ${RULES.noBriefDays} days` },
    'selling.writing': { model: Order, match: { status: 'in_progress' }, problem: { updatedAt: { $lt: ago(RULES.writingDays * DAY) } }, problemText: `In progress over ${RULES.writingDays} days` },
    'selling.published': { model: Order, match: { status: 'published' } },
    'selling.cancelled': { model: Order, match: { status: 'cancelled' } },
    // Listing flow
    'listing.sellers': { model: User, match: { role: 'seller' } },
    'listing.sellerReview': { model: User, match: { role: 'seller', sellerStatus: 'pending' }, problem: { createdAt: { $lt: ago(RULES.sellerReviewDays * DAY) } }, problemText: `Waiting over ${RULES.sellerReviewDays} days` },
    'listing.submitted': { model: Listing, match: { ...live, status: 'pending' }, problem: { createdAt: { $lt: ago(RULES.reviewDays * DAY) } }, problemText: `Waiting for review over ${RULES.reviewDays} days` },
    'listing.live': { model: Listing, match: { ...live, status: 'approved' }, problem: { 'flags.0': { $exists: true } }, problemText: 'Flagged by a metrics check' },
    'listing.rejected': { model: Listing, match: { ...live, status: 'rejected' } },
    'listing.metrics': {
      model: Listing,
      match: { ...live, status: 'approved' },
      problem: { $or: [{ 'metrics.source': { $ne: 'checked' } }, { 'metrics.updatedAt': { $lt: staleBefore } }] },
      problemText: 'Metrics not checked, or older than 30 days',
    },
    // Support flow
    'support.questions': { model: Conversation, match: { kind: 'support' } },
    'support.waiting': { model: Conversation, match: { kind: 'support', status: 'open', 'lastMessage.fromTeam': false, 'lastMessage.sender': { $ne: null } }, problem: { lastMessageAt: { $lt: ago(RULES.supportHours * HOUR) } }, problemText: `No reply for ${RULES.supportHours} hours` },
    'support.answered': { model: Conversation, match: { kind: 'support', status: 'open', 'lastMessage.fromTeam': true } },
    'support.solved': { model: Conversation, match: { kind: 'support', status: 'closed' } },
    'support.chats': { model: Conversation, match: { kind: 'direct' } },
  };
};

// Moves in the last 24 hours, per edge.
const edgeActivity = async () => {
  const since = ago(DAY);
  const recent = { $gte: since };
  const n = (Model, match) => Model.countDocuments(match);
  const [
    newOrders, toWriting, toPublished, toCancelled,
    newSellers, newListings, toLive, toRejected, checked,
    newQuestions, teamReplies, solved, directMsgs,
  ] = await Promise.all([
    n(Order, { createdAt: recent }),
    n(Order, { status: 'in_progress', updatedAt: recent }),
    n(Order, { status: 'published', updatedAt: recent }),
    n(Order, { status: 'cancelled', updatedAt: recent }),
    n(User, { role: 'seller', createdAt: recent }),
    n(Listing, { ...live, createdAt: recent }),
    n(Listing, { ...live, status: 'approved', updatedAt: recent }),
    n(Listing, { ...live, status: 'rejected', updatedAt: recent }),
    n(Listing, { ...live, 'metrics.updatedAt': recent }),
    n(Conversation, { kind: 'support', createdAt: recent }),
    n(ChatMessage, { fromTeam: true, createdAt: recent }),
    n(Conversation, { kind: 'support', status: 'closed', updatedAt: recent }),
    n(ChatMessage, { fromTeam: false, createdAt: recent }),
  ]);
  return {
    'selling.sites>selling.placed': newOrders,
    'selling.placed>selling.writing': toWriting,
    'selling.writing>selling.published': toPublished,
    'selling.placed>selling.cancelled': toCancelled,
    'listing.sellers>listing.sellerReview': newSellers,
    'listing.sellerReview>listing.submitted': newListings,
    'listing.submitted>listing.live': toLive,
    'listing.submitted>listing.rejected': toRejected,
    'listing.live>listing.metrics': checked,
    'support.questions>support.waiting': newQuestions,
    'support.waiting>support.answered': teamReplies,
    'support.answered>support.solved': solved,
    'support.chats>support.chats': directMsgs,
  };
};

// GET /api/admin/flow: counts, problems and 24-hour activity for every step.
export const getFlow = async () => {
  try {
    const defs = steps();
    const entries = await Promise.all(Object.entries(defs).map(async ([id, d]) => {
      const [count, problems] = await Promise.all([
        d.model.countDocuments(d.match),
        d.problem ? d.model.countDocuments({ ...d.match, ...d.problem }) : 0,
      ]);
      return [id, { count, problems, problemText: problems ? d.problemText : null }];
    }));
    return json({ nodes: Object.fromEntries(entries), edges: await edgeActivity(), rules: RULES, updatedAt: new Date() });
  } catch (error) {
    return serverError(error);
  }
};

const fmt = (d) => new Date(d).toISOString();

// One row for the details panel.
const toItem = (id, doc) => {
  const [flow] = id.split('.');
  if (flow === 'selling' && id !== 'selling.sites') {
    return { _id: doc._id, title: doc.listing?.domain || doc.listing?.url || 'Order', sub: `${doc.buyer?.name || 'Buyer'} → ${doc.seller?.name || 'Seller'} · $${doc.price}`, at: fmt(doc.updatedAt), href: `/orders/${doc._id}` };
  }
  if (id === 'listing.sellers' || id === 'listing.sellerReview') {
    return { _id: doc._id, title: doc.name, sub: `${doc.email} · ${doc.sellerStatus || 'approved'}`, at: fmt(doc.createdAt), href: `/admin/users?search=${encodeURIComponent(doc.email)}` };
  }
  if (flow === 'support') {
    const who = doc.participants?.map((p) => p.name).join(' ↔ ') || 'User';
    return { _id: doc._id, title: doc.subject || (doc.listing?.domain ? `About ${doc.listing.domain}` : who), sub: `${who} · ${doc.lastMessage?.body?.slice(0, 60) || ''}`, at: fmt(doc.lastMessageAt), href: `/messages?c=${doc._id}` };
  }
  return {
    _id: doc._id,
    title: doc.domain || doc.url,
    sub: `${doc.seller?.name || 'Seller'} · $${doc.price}${doc.flags?.length ? ` · ${doc.flags.map((f) => f.message).join('; ')}` : ''}`,
    at: fmt(doc.updatedAt),
    href: id === 'listing.metrics' || id === 'listing.live' ? '/admin/metrics' : id === 'selling.sites' ? `/sites/${doc.domain}` : '/admin/listings',
  };
};

// GET /api/admin/flow/items?node=selling.placed: what sits in one step,
// problems first.
export const getFlowItems = async (request) => {
  try {
    const defs = steps();
    const node = oneOf(queryParams(request).node, 'node', 'Step', Object.keys(defs));
    const d = defs[node];
    const populate = (q) => {
      if (d.model === Order) return q.populate('buyer', 'name').populate('seller', 'name').populate('listing', 'domain url');
      if (d.model === Listing) return q.populate('seller', 'name');
      if (d.model === Conversation) return q.populate('participants', 'name').populate('listing', 'domain');
      return q.select('name email sellerStatus createdAt');
    };
    const sortKey = d.model === Conversation ? { lastMessageAt: 1 } : { createdAt: 1 };
    const [problemDocs, otherDocs] = await Promise.all([
      d.problem ? populate(d.model.find({ ...d.match, ...d.problem }).sort(sortKey).limit(50)).lean() : [],
      populate(d.model.find(d.problem ? { ...d.match, $nor: [d.problem] } : d.match).sort({ ...(d.model === Conversation ? { lastMessageAt: -1 } : { createdAt: -1 }) }).limit(50)).lean(),
    ]);
    const items = [
      ...problemDocs.map((doc) => ({ ...toItem(node, doc), problem: d.problemText })),
      ...otherDocs.map((doc) => toItem(node, doc)),
    ].slice(0, 60);
    return json({ node, items });
  } catch (error) {
    return serverError(error);
  }
};
