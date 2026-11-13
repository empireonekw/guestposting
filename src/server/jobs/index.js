import Listing from '../models/Listing';
import User from '../models/User';
import Notification from '../models/Notification';
import { ensureOwnerAdmin } from '../owner';
import { checkOwnership } from '../verification';
import {
  migrateLegacyOrders, expireUnaccepted, autoApprove, warnLate, escalateDisputes,
  monitorLinks, escalateLinkCases, startLegacyMonitoring,
} from './orderJobs';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Verified domains are checked again every 30 days. Three failed checks in a
// row (so a short outage doesn't count) remove the Verified badge.
const recheckVerifiedDomains = async () => {
  const due = await Listing.find({
    isVerified: true,
    isDeleted: { $ne: true },
    'verification.method': { $in: ['dns', 'meta'] },
    $or: [{ 'verification.lastCheckedAt': { $lt: new Date(Date.now() - 30 * DAY) } }, { 'verification.lastCheckedAt': null }],
  })
    .select('+verification.token')
    .limit(50);
  let lost = 0;
  for (const listing of due) {
    // eslint-disable-next-line no-await-in-loop
    const result = await checkOwnership(listing.verification.method, listing.domain, listing.verification.token);
    listing.set('verification.lastCheckedAt', new Date());
    if (result.ok) {
      listing.set('verification.failures', 0);
      listing.set('verification.lastError', undefined);
    } else {
      const failures = (listing.verification.failures || 0) + 1;
      listing.set('verification.failures', failures);
      listing.set('verification.lastError', result.error);
      if (failures >= 3) {
        listing.isVerified = false;
        lost += 1;
        // eslint-disable-next-line no-await-in-loop
        await Notification.create({
          recipient: listing.seller,
          type: 'listing_update',
          message: `${listing.domain} lost its Verified badge: ${result.error}`,
          link: '/my-listings',
        });
      } else {
        // Try again tomorrow instead of in 30 days.
        listing.set('verification.lastCheckedAt', new Date(Date.now() - 29 * DAY));
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await listing.save();
  }
  return `${due.length} checked, ${lost} lost verification`;
};

// Every scheduled job: a unique name, how often it runs, and what it does.
// run() returns a short summary that is logged and saved in JobRun.
// Later modules add jobs here (metric refresh, link monitoring, auto-approve).
const jobs = [
  {
    // Creates the owner admin on a fresh database and puts its admin role
    // back if anyone changed it directly in the database.
    name: 'ensure-owner-admin',
    everyMs: 10 * 60 * 1000,
    run: () => ensureOwnerAdmin(User.collection),
  },
  {
    name: 'expire-featured-listings',
    everyMs: HOUR,
    // Featured lasts 30 days (set by the admin "Feature" button).
    run: async () => {
      const res = await Listing.updateMany(
        { isFeatured: true, featuredUntil: { $lte: new Date() } },
        { $set: { isFeatured: false }, $unset: { featuredUntil: 1 } }
      );
      return `${res.modifiedCount} listing(s) unfeatured`;
    },
  },
  {
    name: 'recheck-verified-domains',
    everyMs: DAY,
    run: recheckVerifiedDomains,
  },
  // --- Module 4: orders ---
  { name: 'migrate-legacy-orders', everyMs: DAY, run: migrateLegacyOrders },
  { name: 'expire-unaccepted-orders', everyMs: 10 * 60 * 1000, run: expireUnaccepted },
  { name: 'auto-approve-orders', everyMs: 30 * 60 * 1000, run: autoApprove },
  { name: 'warn-late-orders', everyMs: HOUR, run: warnLate },
  { name: 'escalate-disputes', everyMs: HOUR, run: escalateDisputes },
  // --- Module 5: links ---
  { name: 'start-legacy-link-monitoring', everyMs: DAY, run: startLegacyMonitoring },
  { name: 'monitor-links', everyMs: HOUR, run: monitorLinks },
  { name: 'escalate-link-cases', everyMs: HOUR, run: escalateLinkCases },
  {
    name: 'clear-expired-reset-codes',
    everyMs: HOUR,
    run: async () => {
      const res = await User.updateMany(
        { resetPasswordExpire: { $lt: new Date() } },
        { $unset: { resetPasswordOtp: 1, resetPasswordExpire: 1 }, $set: { resetPasswordAttempts: 0 } }
      );
      return `${res.modifiedCount} expired reset code(s) cleared`;
    },
  },
];

export default jobs;
