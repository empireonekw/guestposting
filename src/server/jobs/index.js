import Listing from '../models/Listing';
import User from '../models/User';
import { ensureOwnerAdmin } from '../owner';

const HOUR = 60 * 60 * 1000;

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
