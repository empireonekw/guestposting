import User from '../models/User';
import Notification from '../models/Notification';
import { sendEmailInBackground } from '../sendEmail';
import { escapeHtml } from '../escape';
import Order from '../models/Order';
import Listing from '../models/Listing';
import ActivityLog from '../models/ActivityLog';
import logActivity from '../logger';
import { json, readBody, serverError, queryParams, getPaging, pageInfo, escapeRegex } from '../http';
import { str, oneOf, bool, objectId } from '../validate';
import { isOwnerEmail } from '../owner';

export const getPlatformStats = async () => {
  try {
    const [totalUsers, totalListings, totalOrders, revenueRows, recentOrders] = await Promise.all([
      User.countDocuments(),
      Listing.countDocuments({ isDeleted: { $ne: true } }),
      Order.countDocuments(),
      Order.aggregate([{ $match: { status: 'published' } }, { $group: { _id: null, total: { $sum: '$price' } } }]),
      Order.find()
        .populate('buyer', 'name')
        .populate('listing', 'url')
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    return json({
      stats: {
        totalUsers,
        totalListings,
        totalOrders,
        totalRevenue: revenueRows[0]?.total || 0,
      },
      recentOrders,
    });
  } catch (error) {
    return serverError(error);
  }
};

// GET /api/admin/users?search=&role=&page=1
export const getAllUsers = async (request) => {
  try {
    const q = queryParams(request);
    const paging = getPaging(request, { defaultLimit: 25, maxLimit: 100 });
    const role = oneOf(q.role, 'role', 'Role', ['buyer', 'seller', 'admin'], { required: false });
    const search = str(q.search, 'search', 'Search', { required: false, max: 100 });
    const sellerStatus = oneOf(q.seller, 'seller', 'Seller status', ['pending', 'approved', 'blocked'], { required: false });

    const query = {};
    if (role) query.role = role;
    if (sellerStatus) {
      query.role = 'seller';
      // Older sellers have no status and count as approved.
      query.sellerStatus = sellerStatus === 'approved' ? { $in: ['approved', null] } : sellerStatus;
    }
    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: 'i' };
      query.$or = [{ name: pattern }, { email: pattern }];
    }

    const [users, total] = await Promise.all([
      User.find(query).select('-password -resetPasswordOtp').sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit),
      User.countDocuments(query),
    ]);
    // isOwner lets the admin page lock the owner's row.
    const rows = users.map((u) => ({ ...u.toObject(), isOwner: isOwnerEmail(u.email) }));
    return json({ users: rows, ...pageInfo(total, paging) });
  } catch (error) {
    return serverError(error);
  }
};

export const updateUserByAdmin = async (request, params, authUser) => {
  try {
    const userId = objectId(params.id, 'id', 'User');
    const body = await readBody(request);
    const role = oneOf(body.role, 'role', 'Role', ['buyer', 'seller', 'admin'], { required: false });
    const isSuspended = bool(body.isSuspended, 'isSuspended', 'Suspended');
    const sellerStatus = oneOf(body.sellerStatus, 'sellerStatus', 'Seller status', ['pending', 'approved', 'blocked'], { required: false });
    const reason = str(body.reason, 'reason', 'Reason', { required: false, max: 500 });

    if (userId === authUser.id) {
      if (isSuspended === true) return json({ message: "You can't suspend your own account." }, 400);
      if (role && role !== 'admin') return json({ message: "You can't remove your own admin role." }, 400);
    }

    const user = await User.findById(userId);
    if (!user) return json({ message: 'User not found' }, 404);

    // The site owner (src/server/owner.js) always stays an active admin.
    if (isOwnerEmail(user.email) && ((role && role !== 'admin') || isSuspended === true)) {
      return json({ message: "The site owner's admin account can't be changed or suspended." }, 403);
    }

    const changes = [];
    if (role && role !== user.role) {
      changes.push(`role ${user.role} -> ${role}`);
      user.role = role;
    }
    if (isSuspended !== undefined && isSuspended !== user.isSuspended) {
      changes.push(isSuspended ? 'suspended' : 'unsuspended');
      user.isSuspended = isSuspended;
    }
    // A user made a seller by role change starts approved (an admin chose it).
    if (role === 'seller' && !user.sellerStatus && !sellerStatus) user.sellerStatus = 'approved';
    let sellerMessage = null;
    if (sellerStatus && user.role === 'seller' && sellerStatus !== (user.sellerStatus || 'approved')) {
      changes.push(`seller ${user.sellerStatus || 'approved'} -> ${sellerStatus}`);
      user.sellerStatus = sellerStatus;
      user.sellerStatusReason = sellerStatus === 'blocked' ? reason : undefined;
      sellerMessage = sellerStatus === 'approved'
        ? 'Your seller account is approved. Your websites can now go live after review.'
        : sellerStatus === 'blocked'
          ? `Your seller account was blocked${reason ? `: ${reason}` : '.'} Your websites are hidden from buyers.`
          : null;
    } else if (sellerStatus && user.role !== 'seller') {
      return json({ message: 'Only seller accounts have a seller status.' }, 400);
    }

    const updatedUser = await user.save();
    if (changes.length) {
      await logActivity(authUser.id, 'USER_MODERATED', user._id, `${user.email}: ${changes.join(', ')}`);
    }
    if (sellerMessage) {
      await Notification.create({ recipient: user._id, sender: authUser.id, type: 'seller_status', message: sellerMessage, link: '/my-listings' });
      sendEmailInBackground({
        email: user.email,
        subject: 'Your LetRank seller account',
        html: `<p>Hi ${escapeHtml(user.name)},</p><p>${escapeHtml(sellerMessage)}</p>`,
      }, 'Seller status email');
    }
    const { password, resetPasswordOtp, ...safe } = updatedUser.toObject();
    return json(safe);
  } catch (error) {
    return serverError(error);
  }
};

export const toggleFeaturedListing = async (request, params, authUser) => {
  try {
    const listing = await Listing.findById(objectId(params.id, 'id', 'Listing'));
    if (!listing || listing.isDeleted) return json({ message: 'Listing not found' }, 404);

    listing.isFeatured = !listing.isFeatured;
    // Featured lasts 30 days; the scheduled job unfeatures it after that.
    listing.featuredUntil = listing.isFeatured ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined;

    await listing.save();
    await logActivity(authUser.id, 'LISTING_FEATURED', listing._id, `Set ${listing.url} featured: ${listing.isFeatured}`);
    return json(listing);
  } catch (error) {
    return serverError(error);
  }
};

export const verifyListingMetrics = async (request, params, authUser) => {
  try {
    const listing = await Listing.findById(objectId(params.id, 'id', 'Listing'));
    if (!listing || listing.isDeleted) return json({ message: 'Listing not found' }, 404);
    listing.isVerified = true;
    listing.lastVerifiedAt = Date.now();
    await listing.save();
    await logActivity(authUser.id, 'METRICS_VERIFIED', listing._id, `Verified ${listing.url}`);
    return json(listing);
  } catch (error) {
    return serverError(error);
  }
};

// GET /api/admin/logs?page=1
export const getLogs = async (request) => {
  try {
    const paging = getPaging(request, { defaultLimit: 50, maxLimit: 200 });
    const [logs, total] = await Promise.all([
      ActivityLog.find().populate('user', 'name').sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit),
      ActivityLog.countDocuments(),
    ]);
    return json({ logs, ...pageInfo(total, paging) });
  } catch (error) {
    return serverError(error);
  }
};
