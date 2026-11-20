import Order from './models/Order';
import User from './models/User';
import { notify, addEvent, site } from './orderEvents';
import { ValidationError, str, url as urlField, num, oneOf } from './validate';
import { ownFile } from './files';
import { cleanArticle, wordCount } from './articleHtml';
import { releaseCouponIfVoid } from './buying';
import { rateLimit, HOUR as RL_HOUR } from './rateLimit';
import {
  runCheck, applyResult, startMonitoring, caseOpen, inGuarantee, problemText, resolveCase, openCaseByAdmin, RESOLUTIONS,
} from './linkMonitor';
import LEGAL from '@/data/legal';
import { OPEN_STATUSES, DISPUTE_OUTCOMES } from '@/data/orderStatus';

// The Module 4 order workflow: who may do what in each status, and what
// happens when they do. The rules follow the Refund Policy and the Seller &
// Payout Terms; the numbers (72 hours, 7 days, 2 revisions...) come from
// data/legal.js so the pages and the code always agree.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
export const LATE_GRACE_DAYS = 3; // a buyer may cancel this long after the deadline

export const addDays = (date, days) => new Date(new Date(date).getTime() + days * DAY);
export const addBusinessDays = (date, days) => {
  const d = new Date(date);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left -= 1;
  }
  return d;
};

const idOf = (x) => String(x?._id || x || '');

// Refunds are only mentioned once an order has really been paid (Module 3
// sets paymentStatus). Until then no money has changed hands.
const refundNote = (order) => (order.paymentStatus === 'paid' ? ' You will get a full refund.' : '');

// buyer | seller | admin | null for this user on this order.
export const roleOf = (order, user) => {
  if (!user) return null;
  if (idOf(order.buyer) === user.id) return 'buyer';
  if (idOf(order.seller) === user.id) return 'seller';
  if (user.role === 'admin') return 'admin';
  return null;
};

export const isLate = (order, now = new Date()) =>
  order.status === 'writing' && !!order.dueAt && new Date(order.dueAt) < now;

const buyerMayCancelLate = (order, now) =>
  order.status === 'writing' && !!order.dueAt && addDays(order.dueAt, LATE_GRACE_DAYS) < now;

// One-form orders go straight to the publisher, so the buyer can still
// change their mind for CANCEL_WINDOW_HOURS, as long as nothing is published.
export const CANCEL_WINDOW_HOURS = 24;
const buyerMayCancelEarly = (order, now) =>
  order.status === 'writing' && !order.deliveredAt && !!order.briefAt
  && now - new Date(order.briefAt) < CANCEL_WINDOW_HOURS * HOUR;

// Only orders from before one-form ordering have a draft-approval step.
const needsDraft = (order) => (order.flowVersion || 2) < 3 && order.contentSource === 'seller' && !order.draftApprovedAt;

// The brief: who writes the article, the article itself (pasted into the
// editor, or a link), target URL, anchor text and instructions. Used by the
// order form (all at once) and by the brief step of cart orders.
export const readBrief = (body, { articleFile } = {}) => {
  const contentSource = oneOf(body.contentSource, 'contentSource', 'Who writes the article', ['buyer', 'seller']);
  const brief = {
    contentSource,
    targetUrl: urlField(body.targetUrl, 'targetUrl', 'Target URL'),
    anchorText: str(body.anchorText, 'anchorText', 'Anchor text', { max: 200 }),
    contentNotes: str(body.contentNotes, 'contentNotes', 'Instructions', { required: false, max: 5000 }),
  };
  if (contentSource === 'buyer') {
    brief.articleHtml = cleanArticle(body.articleHtml);
    brief.articleLink = urlField(body.articleLink, 'articleLink', 'Article link', { required: false });
    if (articleFile) brief.articleFile = articleFile;
    need(brief.articleHtml || brief.articleLink || brief.articleFile, 'Paste your article into the editor, or share a link to it.', 'articleHtml');
    if (brief.articleHtml) brief.articleWords = wordCount(brief.articleHtml);
  } else {
    need(brief.contentNotes && brief.contentNotes.length >= 20, 'Tell the publisher what to write about (at least 20 characters).', 'contentNotes');
  }
  return brief;
};

// Puts a brief on an order and starts the clock: the seller has the
// listing's turnaround (+2 days when they write the article) to publish.
export const applyBrief = (order, brief, now = new Date()) => {
  Object.entries(brief).forEach(([k, v]) => { order[k] = v; });
  order.status = 'writing';
  order.briefAt = now;
  order.dueAt = addDays(now, Math.max(1, order.turnaroundDays || 3) + (brief.contentSource === 'seller' ? 2 : 0));
};

export const briefReadyText = (order) => (order.contentSource === 'seller'
  ? `Write the article about the topic in the brief, publish it on ${site(order)} and paste the live link`
  : `The article is ready: publish it on ${site(order)} and paste the live link`);

// The actions this person can take right now. The order page shows exactly
// these, and runAction refuses anything else.
export const availableActions = (order, role, now = new Date()) => {
  // A post a seller logged on their own site: there is no buyer, so the only
  // thing to do is re-check the link.
  if (order.kind === 'self') {
    return role && order.liveLink && order.link?.status !== 'ended' ? ['check_link'] : [];
  }
  const s = order.status;
  const out = [];
  const disputable = ['writing', 'content_review', 'published'].includes(s);
  if (role === 'buyer') {
    if (s === 'pending_acceptance' || s === 'awaiting_brief') out.push('cancel');
    if (s === 'awaiting_brief') out.push('brief');
    if (s === 'writing') out.push('extend');
    if (buyerMayCancelLate(order, now) || buyerMayCancelEarly(order, now)) out.push('cancel');
    if (s === 'content_review') {
      out.push('approve_draft');
      if ((order.revisionCount || 0) < LEGAL.revisionRounds) out.push('request_revision');
    }
    if (s === 'published') out.push('approve', 'request_fix');
  }
  if (role === 'seller') {
    if (s === 'pending_acceptance') out.push('accept', 'decline');
    if (['awaiting_brief', 'writing', 'content_review'].includes(s)) out.push('cancel');
    if (s === 'writing' && needsDraft(order)) out.push('draft');
    if (s === 'writing' && !needsDraft(order)) out.push('deliver');
    if (s === 'published') out.push('deliver'); // update the live link
  }
  if (role === 'buyer' || role === 'seller') {
    if (disputable) out.push('dispute');
    if (s === 'disputed') out.push('dispute_reply');
  }
  // Module 5: link checks. Anyone on the order can re-check a delivered
  // link; after completion the buyer can report a lost link during the
  // guarantee, the seller can say it's fixed, and our team decides.
  if (order.liveLink && role) {
    const monitored = s === 'completed' && order.link?.guaranteeUntil;
    const open = caseOpen(order);
    if (s === 'published' || (monitored && (order.link?.status !== 'ended' || open))) out.push('check_link');
    if (monitored && !open && inGuarantee(order, now)) {
      if (role === 'buyer') out.push('report_link');
      if (role === 'admin') out.push('link_open_case');
    }
    if (monitored && open) {
      if (role === 'seller') out.push('link_fixed');
      if (role === 'admin') out.push('link_resolve');
    }
  }
  if (role === 'admin') {
    if (['pending_acceptance', 'awaiting_brief', 'writing', 'content_review'].includes(s)) out.push('admin_extend');
    if (OPEN_STATUSES.includes(s)) out.push('admin_cancel');
    if (s === 'published') out.push('admin_complete');
    if (s === 'disputed') out.push('resolve', 'dispute_reply');
  }
  return [...new Set(out)];
};

// Notifications and the history list live in orderEvents.js.
export { notify, addEvent, site } from './orderEvents';

// Marks an order completed and records the seller's earning. The balance is
// only credited for paid orders, so no unbacked money builds up before
// payments exist (Module 3 replaces this with real payouts).
export const completeOrder = async (order, { by, role, completedBy, note }) => {
  order.status = 'completed';
  order.completedAt = new Date();
  order.completedBy = completedBy;
  order.sellerEarning = Math.max(0, (order.price || 0) - (order.refundAmount || 0));
  order.reviewBy = undefined;
  startMonitoring(order); // Module 5: the link guarantee starts
  addEvent(order, { by, role, type: 'completed', note });
  await order.save(); // optimistic concurrency: a second, parallel completion fails here
  if (order.paymentStatus === 'paid' && order.sellerEarning > 0) await User.updateOne({ _id: idOf(order.seller) }, { $inc: { balance: order.sellerEarning } });
};

export const cancelOrder = async (order, { by, role, reason, refund = true }) => {
  order.status = 'cancelled';
  order.cancelledAt = new Date();
  order.cancelledBy = role;
  order.cancelReason = reason;
  if (refund && order.paymentStatus === 'paid') order.refundAmount = order.price;
  order.reviewBy = undefined;
  addEvent(order, { by, role, type: 'cancelled', note: reason });
  await order.save();
  // Module 6: a checkout whose orders are all cancelled gives its coupon back.
  await releaseCouponIfVoid(order).catch((err) => console.error('Coupon release failed:', err.message));
};

const need = (cond, message, field) => {
  if (!cond) throw new ValidationError(message, field);
};

const daysField = (value, label, max = 30) => num(value, 'days', label, { min: 1, max, integer: true });

// Runs one action. `body` is the request body; `role` comes from roleOf.
// Returns a short message for the person who acted.
export const runAction = async (order, user, role, body) => {
  const action = String(body.action || '');
  const now = new Date();
  if (!availableActions(order, role, now).includes(action)) {
    throw new ValidationError('That step isn’t available for this order right now. Refresh the page to see the latest status.', 'action');
  }
  const who = { by: user.id, role };
  const files = (fileId, kinds) => ownFile(fileId, { orderId: order._id, userId: user.id, kinds });

  switch (action) {
    // ---- Seller answers ----
    case 'accept': {
      order.status = 'awaiting_brief';
      order.acceptedAt = now;
      addEvent(order, { ...who, type: 'accepted' });
      await order.save();
      await notify(order, ['buyer'], `${site(order)} accepted your order. Send your brief so they can start.`, { from: user.id });
      return 'Order accepted. The buyer has been asked for the brief.';
    }
    case 'decline': {
      const reason = str(body.reason, 'reason', 'Reason', { min: 5, max: 1000 });
      await cancelOrder(order, { ...who, reason: `Declined by the seller: ${reason}` });
      await notify(order, ['buyer'], `The seller of ${site(order)} declined your order: ${reason}.${refundNote(order)}`, { from: user.id });
      return 'Order declined.';
    }

    // ---- Brief ----
    case 'brief': {
      const brief = readBrief(body, { articleFile: await files(body.articleFileId, ['article']) });
      applyBrief(order, brief, now);
      addEvent(order, { ...who, type: 'brief' });
      await order.save();
      await notify(order, ['seller'], `${briefReadyText(order)} by ${order.dueAt.toDateString()}.`, { from: user.id, emailSubject: `Ready to publish: ${site(order)}` });
      return 'Brief sent. The publisher can start now.';
    }

    // ---- Draft (seller writes) ----
    case 'draft': {
      const draftLink = urlField(body.link, 'link', 'Draft link', { required: false });
      const text = str(body.text, 'text', 'Draft', { required: false, max: 20000 });
      const file = await files(body.fileId, ['draft']);
      need(draftLink || text || file, 'Add the draft: upload a file, paste a link or paste the text.', 'link');
      order.draft = { link: draftLink, text, file, submittedAt: now };
      order.status = 'content_review';
      addEvent(order, { ...who, type: 'draft', note: order.revisionCount ? `Revision ${order.revisionCount}` : undefined });
      await order.save();
      await notify(order, ['buyer'], `The draft for ${site(order)} is ready for your review.`, { from: user.id });
      return 'Draft sent to the buyer for review.';
    }
    case 'approve_draft': {
      order.draftApprovedAt = now;
      order.status = 'writing';
      addEvent(order, { ...who, type: 'draft_approved' });
      await order.save();
      await notify(order, ['seller'], `The buyer approved the draft for ${site(order)}. Publish it and send the live link.`, { from: user.id });
      return 'Draft approved. The publisher will publish it next.';
    }
    case 'request_revision': {
      const note = str(body.note, 'note', 'What to change', { min: 5, max: 2000 });
      order.revisionCount = (order.revisionCount || 0) + 1;
      order.status = 'writing';
      order.dueAt = addDays(now, 2);
      order.lateNotifiedAt = undefined;
      addEvent(order, { ...who, type: 'revision_requested', note });
      await order.save();
      await notify(order, ['seller'], `Changes requested on the draft for ${site(order)}: ${note}`, { from: user.id });
      return `Changes requested (${order.revisionCount} of ${LEGAL.revisionRounds}).`;
    }

    // ---- Delivery ----
    case 'deliver': {
      const liveLink = urlField(body.liveLink, 'liveLink', 'Live URL');
      const host = new URL(liveLink).hostname.replace(/^www\./, '').toLowerCase();
      const domain = (order.site?.domain || '').toLowerCase();
      need(!domain || host === domain || host.endsWith(`.${domain}`), `The live URL must be on ${domain}.`, 'liveLink');
      const again = order.status === 'published' || !!order.deliveredAt;
      order.liveLink = liveLink;
      // Module 5: open the page now. A missing link, a gone page or a
      // nofollow link (when dofollow was promised) is refused straight away;
      // if we can't open the page, the buyer checks it by hand.
      const check = await runCheck(order, { source: 'delivery', by: user.id });
      if (check.verdict === 'problem') {
        throw new ValidationError(`We checked ${liveLink} and found a problem: ${problemText(check.problems)}. Fix it and send the link again.`, 'liveLink');
      }
      order.set('link.status', check.verdict);
      order.status = 'published';
      order.deliveredAt = now;
      order.reviewBy = addDays(now, LEGAL.autoApproveDays);
      addEvent(order, { ...who, type: again ? 'redelivered' : 'published', note: liveLink });
      await order.save();
      const checkNote = check.verdict === 'ok'
        ? ' Our automatic check found your link, as ordered.'
        : check.verdict === 'warning'
          ? ` Our automatic check found your link, with a note: ${problemText(check.problems)}.`
          : ' We couldn\u2019t open the page automatically, so please check it yourself.';
      await notify(order, ['buyer'], `Your post on ${site(order)} is live: ${liveLink}.${checkNote} Approve it within ${LEGAL.autoApproveDays} days, or it is approved automatically.`, { from: user.id, emailSubject: `Your guest post is live: ${site(order)}` });
      if (check.verdict === 'ok') return 'Live link sent. We checked it: the link is there as ordered.';
      if (check.verdict === 'warning') return `Live link sent. Note from our check: ${problemText(check.problems)}.`;
      return 'Live link sent. We couldn\u2019t open the page automatically, so the buyer will check it by hand.';
    }
    case 'approve': {
      await completeOrder(order, { ...who, completedBy: 'buyer' });
      await notify(order, ['seller'], `The buyer approved your post on ${site(order)}. The order is complete.`, { from: user.id });
      return 'Order completed. Thank you! You can leave a review below.';
    }
    case 'request_fix': {
      const note = str(body.note, 'note', 'What is wrong', { min: 5, max: 2000 });
      order.fixCount = (order.fixCount || 0) + 1;
      order.status = 'writing';
      order.dueAt = addDays(now, LEGAL.linkFixDays);
      order.lateNotifiedAt = undefined;
      order.reviewBy = undefined;
      addEvent(order, { ...who, type: 'fix_requested', note });
      await order.save();
      await notify(order, ['seller'], `The buyer reported a problem with the post on ${site(order)}: ${note}. Please fix it within ${LEGAL.linkFixDays} days.`, { from: user.id });
      return `Fix requested. The publisher has ${LEGAL.linkFixDays} days.`;
    }
    case 'extend': {
      const days = daysField(body.days, 'Extra days', 14);
      order.dueAt = addDays(order.dueAt && new Date(order.dueAt) > now ? order.dueAt : now, days);
      order.lateNotifiedAt = undefined;
      addEvent(order, { ...who, type: 'extended', note: `${days} more day${days === 1 ? '' : 's'}` });
      await order.save();
      await notify(order, ['seller'], `The buyer gave you ${days} more day${days === 1 ? '' : 's'} for ${site(order)}.`, { from: user.id });
      return 'Deadline extended.';
    }

    // ---- Cancelling ----
    case 'cancel': {
      const reason = str(body.reason, 'reason', 'Reason', { required: role === 'seller', min: 5, max: 1000 });
      const late = role === 'buyer' && order.status === 'writing' && buyerMayCancelLate(order, now);
      await cancelOrder(order, { ...who, reason: reason || (late ? 'Cancelled by the buyer: not delivered in time' : 'Cancelled by the buyer') });
      await notify(order, [role === 'buyer' ? 'seller' : 'buyer'],
        role === 'buyer'
          ? `The buyer cancelled the order for ${site(order)}${reason ? `: ${reason}` : '.'}`
          : `The seller cancelled your order for ${site(order)}: ${reason}.${refundNote(order)}`,
        { from: user.id });
      return 'Order cancelled.';
    }

    // ---- Disputes ----
    case 'dispute': {
      const reason = str(body.reason, 'reason', 'What went wrong', { min: 10, max: 2000 });
      const file = await files(body.fileId, ['evidence']);
      order.dispute = {
        openedBy: user.id,
        openedByRole: role,
        reason,
        openedAt: now,
        respondBy: addBusinessDays(now, LEGAL.disputeAnswerDays),
        previousStatus: order.status,
        evidence: [{ at: now, by: user.id, role, text: reason, file }],
      };
      order.status = 'disputed';
      order.reviewBy = undefined;
      addEvent(order, { ...who, type: 'dispute_opened', note: reason });
      await order.save();
      const other = role === 'buyer' ? 'seller' : 'buyer';
      await notify(order, [other], `A dispute was opened on ${site(order)}: ${reason}. Please add your side within ${LEGAL.disputeAnswerDays} business days.`, { from: user.id, emailSubject: `Dispute opened: ${site(order)}` });
      await notify(order, ['admins'], `New dispute on ${site(order)} (opened by the ${role}).`, { from: user.id });
      return 'Dispute opened. Our team will review both sides.';
    }
    case 'dispute_reply': {
      const text = str(body.text, 'text', 'Your answer', { required: false, max: 5000 });
      const file = await files(body.fileId, ['evidence']);
      need(text || file, 'Write your answer or attach a file.', 'text');
      order.dispute.evidence = [...(order.dispute.evidence || []), { at: now, by: user.id, role, text, file }];
      order.markModified('dispute');
      addEvent(order, { ...who, type: 'dispute_reply' });
      await order.save();
      const to = role === 'admin' ? ['buyer', 'seller'] : [role === 'buyer' ? 'seller' : 'buyer', 'admins'];
      await notify(order, to, `New message in the dispute on ${site(order)}.`, { from: user.id });
      return 'Added to the dispute.';
    }

    // ---- Admin ----
    case 'admin_extend': {
      const days = daysField(body.days, 'Extra days');
      if (order.status === 'pending_acceptance') order.acceptBy = addDays(order.acceptBy || now, days);
      else order.dueAt = addDays(order.dueAt && new Date(order.dueAt) > now ? order.dueAt : now, days);
      order.lateNotifiedAt = undefined;
      addEvent(order, { ...who, type: 'extended', note: `${days} more day${days === 1 ? '' : 's'} (by our team)` });
      await order.save();
      await notify(order, ['buyer', 'seller'], `Our team extended the deadline for ${site(order)} by ${days} day${days === 1 ? '' : 's'}.`, { from: user.id });
      return 'Deadline extended.';
    }
    case 'admin_cancel': {
      const reason = str(body.reason, 'reason', 'Reason', { min: 5, max: 1000 });
      await cancelOrder(order, { ...who, reason });
      await notify(order, ['buyer', 'seller'], `Our team cancelled the order for ${site(order)}: ${reason}.${refundNote(order)}`, { from: user.id });
      return 'Order cancelled.';
    }
    case 'admin_complete': {
      const note = str(body.note, 'note', 'Note', { required: false, max: 1000 });
      await completeOrder(order, { ...who, completedBy: 'admin', note });
      await notify(order, ['buyer', 'seller'], `Our team marked the order for ${site(order)} as completed.`, { from: user.id });
      return 'Order completed.';
    }
    case 'resolve': {
      const outcome = oneOf(body.outcome, 'outcome', 'Decision', DISPUTE_OUTCOMES.map((o) => o.value));
      const note = str(body.note, 'note', 'Explanation', { min: 10, max: 2000 });
      const resolution = { outcome, note, by: user.id, at: now };
      const label = DISPUTE_OUTCOMES.find((o) => o.value === outcome).label;
      if (outcome === 'refund_partial') {
        const amount = num(body.amount, 'amount', 'Refund amount', { min: 1, max: Math.max(1, order.price - 1) });
        resolution.amount = Math.round(amount * 100) / 100;
        order.refundAmount = resolution.amount;
      }
      order.dispute.resolution = resolution;
      order.markModified('dispute');
      addEvent(order, { ...who, type: 'dispute_resolved', note: `${label}: ${note}` });
      if (outcome === 'release' || outcome === 'refund_partial') {
        await completeOrder(order, { ...who, completedBy: 'admin' });
      } else if (outcome === 'refund_full') {
        await cancelOrder(order, { ...who, reason: `Dispute decided: full refund. ${note}` });
      } else {
        const days = daysField(body.days ?? order.turnaroundDays ?? 3, 'Days to redo it');
        order.status = 'writing';
        order.dueAt = addDays(now, days);
        order.lateNotifiedAt = undefined;
        await order.save();
      }
      const amountText = resolution.amount ? ` ($${resolution.amount} back to the buyer)` : '';
      await notify(order, ['buyer', 'seller'], `The dispute on ${site(order)} was decided: ${label}${amountText}. ${note}`, { from: user.id, emailSubject: `Dispute decided: ${site(order)}` });
      return 'Dispute resolved.';
    }
    // ---- Module 5: link checks ----
    case 'check_link':
    case 'report_link':
    case 'link_fixed': {
      // Checking opens someone else's website, so it is limited per order.
      const limited = rateLimit('link-check', String(order._id), { limit: 10, windowMs: RL_HOUR });
      if (limited) throw new ValidationError('This link was checked several times in the last hour. Please try again later.', 'action');
      const check = await runCheck(order, { source: 'manual', by: user.id });
      const found = problemText(check.problems);
      if (order.status === 'published') {
        order.set('link.status', check.verdict);
        await order.save();
      } else {
        if (action === 'link_fixed' && !['ok', 'warning'].includes(check.verdict)) {
          await order.save();
          throw new ValidationError(check.verdict === 'problem'
            ? `We checked again and the link is still not right: ${found}.`
            : `We couldn\u2019t open the page to confirm (${check.error || 'no answer'}). Try again in a few minutes.`, 'action');
        }
        await applyResult(order, check, { by: user.id, role, report: action === 'report_link' });
      }
      if (action === 'report_link') {
        return ['ok', 'warning'].includes(check.verdict)
          ? 'We checked just now and your link is live as ordered. If you still see a problem, message support from this page.'
          : 'Thanks. We confirmed the problem and asked the publisher to fix it.';
      }
      if (action === 'link_fixed') return 'Confirmed: the link is live again. The case is closed.';
      if (check.verdict === 'ok') return 'Checked: the link is live as ordered.';
      if (check.verdict === 'warning') return `Checked: the link is there, with a note: ${found}.`;
      if (check.verdict === 'unverified') return `We couldn\u2019t open the page (${check.error || 'no answer'}). We\u2019ll try again later.`;
      return `Checked: ${found}.`;
    }
    case 'link_open_case': {
      const reason = str(body.reason, 'reason', 'What is wrong', { min: 5, max: 1000 });
      await openCaseByAdmin(order, { reason, by: user.id });
      return 'Case opened. The publisher has been asked to fix the link.';
    }
    case 'link_resolve': {
      const outcome = oneOf(body.outcome, 'outcome', 'Decision', RESOLUTIONS);
      const note = str(body.note, 'note', 'Explanation', { min: 5, max: 2000 });
      const amount = outcome === 'refunded' ? num(body.amount, 'amount', 'Refund amount', { min: 0.01, max: 1000000 }) : undefined;
      await resolveCase(order, { outcome, amount, note, by: user.id });
      return 'Link case settled.';
    }
    default:
      throw new ValidationError('Unknown action', 'action');
  }
};
