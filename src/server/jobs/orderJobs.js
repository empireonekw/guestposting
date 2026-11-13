import Order from '../models/Order';
import Listing from '../models/Listing';
import { completeOrder, cancelOrder, notify, addEvent } from '../orderFlow';
import {
  runCheck, applyResult, escalateCase, caseOpen, inGuarantee, guaranteeEnd,
} from '../linkMonitor';
import LEGAL from '@/data/legal';

// Scheduled jobs for the order workflow (Module 4). Each handles at most
// BATCH orders per run; the rest are picked up on the next run. A save that
// clashes with someone acting on the same order fails and is retried later.

const BATCH = 100;
const site = (o) => o.site?.domain || 'your order';

const each = async (orders, fn) => {
  let done = 0;
  for (const order of orders) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await fn(order);
      done += 1;
    } catch (error) {
      console.error(`[jobs] order ${order._id}:`, error.message);
    }
  }
  return done;
};

// Orders placed before Module 4 get the new statuses: awaiting_content ->
// awaiting_brief, in_progress -> writing, published (paid out) -> completed.
export const migrateLegacyOrders = async () => {
  const col = Order.collection;
  const legacy = { flowVersion: { $exists: false } };
  const now = new Date();
  const a = await col.updateMany({ ...legacy, status: 'awaiting_content' }, { $set: { status: 'awaiting_brief' } });
  const b = await col.updateMany({ ...legacy, status: 'in_progress' }, { $set: { status: 'writing', contentSource: 'buyer' } });
  const c = await col.updateMany({ ...legacy, status: 'published' }, [
    { $set: { status: 'completed', completedBy: 'buyer', completedAt: '$updatedAt', sellerEarning: '$price' } },
  ]);
  // The website snapshot used for search and messages.
  const rows = await col.find({ ...legacy, 'site.domain': { $exists: false } }).project({ listing: 1 }).limit(1000).toArray();
  const listings = await Listing.find({ _id: { $in: rows.map((r) => r.listing) } }).select('domain url').lean();
  const byId = new Map(listings.map((l) => [String(l._id), l]));
  if (rows.length) {
    await col.bulkWrite(rows.map((r) => {
      const l = byId.get(String(r.listing));
      return { updateOne: { filter: { _id: r._id }, update: { $set: { site: { domain: l?.domain, url: l?.url } } } } };
    }));
  }
  const d = await col.updateMany(legacy, { $set: { flowVersion: 2, paymentStatus: 'unpaid', lastActivityAt: now } });
  return `${a.modifiedCount + b.modifiedCount + c.modifiedCount} status(es) converted, ${d.modifiedCount} order(s) moved to the new workflow`;
};

// Sellers have LEGAL.sellerAcceptHours to answer a new order.
export const expireUnaccepted = async () => {
  const due = await Order.find({ status: 'pending_acceptance', acceptBy: { $lt: new Date() } }).limit(BATCH);
  const n = await each(due, async (order) => {
    await cancelOrder(order, { role: 'system', reason: `The seller didn’t accept within ${LEGAL.sellerAcceptHours} hours` });
    await notify(order, ['buyer', 'seller'], `The order for ${site(order)} was cancelled because the seller didn’t accept it within ${LEGAL.sellerAcceptHours} hours.`);
  });
  return `${n} unanswered order(s) cancelled`;
};

// A delivered post the buyer doesn't approve or dispute is approved
// automatically after LEGAL.autoApproveDays.
export const autoApprove = async () => {
  const due = await Order.find({ status: 'published', reviewBy: { $lt: new Date() } }).limit(BATCH);
  const n = await each(due, async (order) => {
    await completeOrder(order, { role: 'system', completedBy: 'auto', note: `Approved automatically after ${LEGAL.autoApproveDays} days` });
    await notify(order, ['buyer', 'seller'], `The order for ${site(order)} was approved automatically after ${LEGAL.autoApproveDays} days and is now complete.`);
  });
  return `${n} order(s) approved automatically`;
};

// One warning to both sides when an order passes its deadline.
export const warnLate = async () => {
  const due = await Order.find({ status: 'writing', dueAt: { $lt: new Date() }, lateNotifiedAt: null }).limit(BATCH);
  const n = await each(due, async (order) => {
    order.lateNotifiedAt = new Date();
    addEvent(order, { role: 'system', type: 'late' });
    await order.save();
    await notify(order, ['seller'], `The order for ${site(order)} is past its deadline. Please publish it, or agree a new date with the buyer in the order chat.`);
    await notify(order, ['buyer'], `The order for ${site(order)} is late. You can give the publisher more time, or cancel it if it is still not delivered 3 days after the deadline.`);
  });
  return `${n} late order(s) flagged`;
};

// Disputes where the answer deadline has passed go to our team's attention.
export const escalateDisputes = async () => {
  const due = await Order.find({ status: 'disputed', 'dispute.respondBy': { $lt: new Date() }, 'dispute.escalatedAt': null }).limit(BATCH);
  const n = await each(due, async (order) => {
    order.set('dispute.escalatedAt', new Date());
    await order.save();
    await notify(order, ['admins'], `The answer deadline passed on the dispute for ${site(order)}. It is ready for a decision.`);
  });
  return `${n} dispute(s) ready for a decision`;
};

// ---- Module 5: link monitoring ----

const LINK_BATCH = 25; // pages opened per run (the job runs hourly)
const pause = (ms) => new Promise((r) => { setTimeout(r, ms); });

// Re-checks links that are due (monthly, or daily while something is wrong).
export const monitorLinks = async () => {
  const now = new Date();
  const due = await Order.find({
    status: 'completed',
    liveLink: { $exists: true },
    'link.nextCheckAt': { $lte: now },
    'link.status': { $ne: 'ended' },
  }).sort({ 'link.nextCheckAt': 1 }).limit(LINK_BATCH);
  const counts = { checked: 0, ended: 0, problems: 0 };
  await each(due, async (order) => {
    if (!inGuarantee(order, now) && !caseOpen(order)) {
      order.set('link.status', 'ended');
      order.set('link.nextCheckAt', undefined);
      await order.save();
      counts.ended += 1;
      return;
    }
    const result = await runCheck(order, { source: 'monitor' });
    await applyResult(order, result);
    counts.checked += 1;
    if (!['ok', 'warning'].includes(result.verdict)) counts.problems += 1;
    await pause(1000); // be gentle with publishers' servers
  });
  return `${counts.checked} link(s) checked, ${counts.problems} with problems, ${counts.ended} guarantee(s) ended`;
};

// Cases where the seller's fix deadline has passed go to our team.
export const escalateLinkCases = async () => {
  const due = await Order.find({ 'link.case.status': 'open', 'link.case.fixBy': { $lt: new Date() } }).limit(BATCH);
  const n = await each(due, (order) => escalateCase(order));
  return `${n} lost-link case(s) passed to our team`;
};

// Orders completed before Module 5 start being monitored. Their link
// promise comes from the listing; the first checks are spread over 3 days.
export const startLegacyMonitoring = async () => {
  const rows = await Order.find({
    status: 'completed',
    liveLink: { $exists: true, $ne: '' },
    targetUrl: { $exists: true, $ne: '' },
    'link.guaranteeUntil': { $exists: false },
  }).limit(500);
  const listings = await Listing.find({ _id: { $in: rows.map((o) => o.listing) } }).select('linkType linkValidity').lean();
  const byId = new Map(listings.map((l) => [String(l._id), l]));
  const now = Date.now();
  const n = await each(rows, async (order) => {
    const l = byId.get(String(order.listing));
    if (l) {
      order.linkType = l.linkType || 'dofollow';
      order.linkValidity = l.linkValidity || 'permanent';
    }
    order.set('link.guaranteeUntil', guaranteeEnd(order));
    if (inGuarantee(order)) {
      order.set('link.status', 'unverified');
      order.set('link.nextCheckAt', new Date(now + Math.random() * 3 * 24 * 3600 * 1000));
    } else {
      order.set('link.status', 'ended');
    }
    await order.save();
  });
  return `${n} older order(s) added to link monitoring`;
};
