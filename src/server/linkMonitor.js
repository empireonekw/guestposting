import LinkCheck from './models/LinkCheck';
import { checkLink } from './linkCheck';
import { notify, addEvent, site } from './orderEvents';
import { ValidationError } from './validate';
import LEGAL from '@/data/legal';
import { VALIDITY_MONTHS, OPEN_CASE, LINK_PROBLEM_TEXT } from '@/data/orderStatus';

// Module 5: the link guarantee. After an order is completed its link is
// re-checked every month until the guarantee ends. A problem seen twice in a
// row (or reported by the buyer and confirmed by a check) opens a lost-link
// case: the seller gets LEGAL.linkFixDays to restore the link, then our team
// arranges a replacement or a refund, as the Refund Policy says.

const DAY = 24 * 60 * 60 * 1000;
export const CHECK_EVERY_DAYS = 30;
const RETRY_DAYS = 1;
const CONFIRM_FAILS = 2; // a problem must be seen on two checks a day apart
const UNREACHABLE_FAILS = 5; // the page couldn't be opened for 5 days running

const addDays = (date, days) => new Date(new Date(date).getTime() + days * DAY);
const addMonths = (date, months) => {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

export const problemText = (problems = []) => problems.map((p) => LINK_PROBLEM_TEXT[p] || p).join('; ');
export const caseOpen = (order) => OPEN_CASE.includes(order.link?.case?.status);

// When the guarantee ends: the listing's link validity, counted from
// publication ("permanent" = LEGAL.permanentGuaranteeMonths).
export const guaranteeEnd = (order) => {
  const start = order.deliveredAt || order.completedAt || order.updatedAt || new Date();
  const months = VALIDITY_MONTHS[order.linkValidity] ?? LEGAL.permanentGuaranteeMonths;
  return addMonths(start, months);
};
export const inGuarantee = (order, now = new Date()) => !!order.link?.guaranteeUntil && new Date(order.link.guaranteeUntil) > now;

// Checks the live link now, saves the result to the history and to the order
// (without saving the order). Returns the check result.
export const runCheck = async (order, { source, by } = {}) => {
  const result = await checkLink({
    liveLink: order.liveLink,
    targetUrl: order.targetUrl,
    anchorText: order.anchorText,
    domain: order.site?.domain,
    expectDofollow: (order.linkType || 'dofollow') === 'dofollow',
  });
  const summary = {
    at: result.at,
    verdict: result.verdict,
    problems: result.problems,
    httpStatus: result.httpStatus,
    linkFound: result.linkFound,
    rel: result.rel,
    anchor: result.anchor,
    noindex: result.noindex,
    error: result.error,
    source,
  };
  await LinkCheck.create({ order: order._id, by, liveLink: order.liveLink, ...summary });
  order.set('link.last', summary);
  order.set('link.lastCheckedAt', result.at);
  order.set('link.checkCount', (order.link?.checkCount || 0) + 1);
  return result;
};

// Called by completeOrder: the guarantee clock and the monthly checks start.
export const startMonitoring = (order, now = new Date()) => {
  if (!order.liveLink) return;
  order.set('link.guaranteeUntil', guaranteeEnd(order));
  order.set('link.nextCheckAt', addDays(now, CHECK_EVERY_DAYS));
  order.set('link.failStreak', 0);
  const last = order.link?.last?.verdict;
  order.set('link.status', last && last !== 'problem' ? last : 'ok');
};

const openCase = async (order, { openedBy, reason, by, role }) => {
  const now = new Date();
  order.set('link.case', { status: 'open', openedAt: now, openedBy, reason, fixBy: addDays(now, LEGAL.linkFixDays) });
  order.set('link.status', 'lost');
  order.set('link.lostCount', (order.link?.lostCount || 0) + 1);
  order.set('link.nextCheckAt', addDays(now, RETRY_DAYS));
  addEvent(order, { by, role, type: 'link_lost', note: reason });
  await order.save();
  await notify(order, ['seller'],
    `The link on ${site(order)} needs fixing: ${reason}. Please restore it within ${LEGAL.linkFixDays} days, then press “I’ve fixed it” on the order.`,
    { emailSubject: `Action needed: link problem on ${site(order)}` });
  await notify(order, ['buyer'],
    `We found a problem with your link on ${site(order)}: ${reason}. The publisher has ${LEGAL.linkFixDays} days to fix it; if they don’t, our team arranges a replacement or a refund.`);
};

const closeAsFixed = async (order, { by, role }) => {
  const now = new Date();
  order.set('link.case.status', 'fixed');
  order.set('link.case.resolvedAt', now);
  order.set('link.status', order.link?.last?.verdict === 'warning' ? 'warning' : 'ok');
  order.set('link.failStreak', 0);
  order.set('link.nextCheckAt', addDays(now, CHECK_EVERY_DAYS));
  addEvent(order, { by, role, type: 'link_fixed' });
  await order.save();
  await notify(order, ['buyer', 'seller'], `The link on ${site(order)} is live again. The lost-link case is closed.`);
};

// After the fix deadline the case goes to our team.
export const escalateCase = async (order) => {
  order.set('link.case.status', 'awaiting_decision');
  order.set('link.case.escalatedAt', new Date());
  addEvent(order, { role: 'system', type: 'link_escalated' });
  await order.save();
  await notify(order, ['admins'], `The publisher didn’t fix the lost link on ${site(order)} in time. It needs a replacement or refund decision.`);
  await notify(order, ['buyer'], `The publisher didn’t restore your link on ${site(order)} in time. Our team will arrange a replacement or a refund.`);
};

// What a check means for a completed order, and the next check date.
// `report`: the buyer said the link is gone, so a problem opens a case at once.
export const applyResult = async (order, result, { by, role = 'system', report = false } = {}) => {
  const now = new Date();
  const open = caseOpen(order);
  const streak = (order.link?.failStreak || 0) + (result.verdict === 'ok' || result.verdict === 'warning' ? 0 : 1);

  if (result.verdict === 'ok' || result.verdict === 'warning') {
    order.set('link.failStreak', 0);
    if (open) return closeAsFixed(order, { by, role });
    order.set('link.status', result.verdict);
    order.set('link.nextCheckAt', addDays(now, CHECK_EVERY_DAYS));
  } else {
    order.set('link.failStreak', streak);
    order.set('link.nextCheckAt', addDays(now, RETRY_DAYS));
    if (!open) {
      const confirmed = result.verdict === 'problem'
        ? report || streak >= CONFIRM_FAILS
        : report || streak >= UNREACHABLE_FAILS;
      if (confirmed && inGuarantee(order, now)) {
        const reason = result.verdict === 'problem'
          ? problemText(result.problems)
          : `The page couldn’t be opened${result.error ? ` (${result.error})` : ''}`;
        return openCase(order, { openedBy: report ? 'buyer' : 'system', reason, by, role });
      }
      order.set('link.status', result.verdict);
    }
  }
  // The guarantee is over: stop checking (unless a case is still open).
  if (!inGuarantee(order, now) && !caseOpen(order)) {
    order.set('link.status', 'ended');
    order.set('link.nextCheckAt', undefined);
  }
  await order.save();
  return undefined;
};

// Our team opens a case by hand (e.g. the buyer emailed us).
export const openCaseByAdmin = (order, { reason, by }) => openCase(order, { openedBy: 'admin', reason, by, role: 'admin' });

// The refund the Refund Policy gives: the full price in the first 3 months
// after publication, then the share of the guarantee period that was left.
export const suggestedRefund = (order) => {
  const already = order.refundAmount || 0;
  const price = Math.max(0, (order.price || 0) - already);
  const start = new Date(order.deliveredAt || order.completedAt || order.createdAt);
  const lostAt = new Date(order.link?.case?.openedAt || Date.now());
  const end = new Date(order.link?.guaranteeUntil || lostAt);
  if (lostAt - start <= 90 * DAY) return price;
  const share = Math.max(0, Math.min(1, (end - lostAt) / (end - start || 1)));
  return Math.round(price * share * 100) / 100;
};

export const RESOLUTIONS = ['replaced', 'refunded', 'closed'];

// Our team's decision on a case. `replaced`: a comparable post was arranged.
// `refunded`: part or all of the price goes back to the buyer. `closed`: no
// action needed (false alarm, or the buyer agreed); monitoring continues.
export const resolveCase = async (order, { outcome, amount, note, by }) => {
  if (!caseOpen(order)) throw new ValidationError('There is no open link case on this order.', 'outcome');
  const now = new Date();
  order.set('link.case.status', outcome);
  order.set('link.case.resolvedAt', now);
  order.set('link.case.resolvedBy', by);
  order.set('link.case.note', note);
  let text;
  if (outcome === 'refunded') {
    const max = Math.max(0, (order.price || 0) - (order.refundAmount || 0));
    if (!(amount > 0) || amount > max) throw new ValidationError(`The refund must be between $0.01 and $${max}.`, 'amount');
    const value = Math.round(amount * 100) / 100;
    order.set('link.case.refundAmount', value);
    order.refundAmount = (order.refundAmount || 0) + value;
    // Recorded now; Module 3 takes it back from the seller's payouts.
    order.sellerEarning = Math.max(0, (order.sellerEarning ?? order.price) - value);
    text = `a refund of $${value}`;
  }
  if (outcome === 'replaced') text = 'a replacement post';
  if (outcome === 'refunded' || outcome === 'replaced') {
    order.set('link.status', 'ended');
    order.set('link.nextCheckAt', undefined);
  } else {
    order.set('link.status', 'ok');
    order.set('link.failStreak', 0);
    order.set('link.nextCheckAt', addDays(now, CHECK_EVERY_DAYS));
  }
  addEvent(order, { by, role: 'admin', type: 'link_resolved', note: `${outcome}: ${note}` });
  await order.save();
  await notify(order, ['buyer', 'seller'], outcome === 'closed'
    ? `Our team closed the link case on ${site(order)}: ${note}`
    : `The lost link on ${site(order)} was settled with ${text}. ${note}`, { from: by });
};
