import User from '../models/User';
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

    const query = {};
    if (role) query.role = role;
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

    const updatedUser = await user.save();
    if (changes.length) {
      await logActivity(authUser.id, 'USER_MODERATED', user._id, `${user.email}: ${changes.join(', ')}`);
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
