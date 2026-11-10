import { Readable } from 'stream';
import csv from 'csv-parser';
import Listing from '../models/Listing';
import Order from '../models/Order';
import User from '../models/User';
import Notification from '../models/Notification';
import logActivity from '../logger';
import { sendEmailInBackground } from '../sendEmail';
import { escapeHtml } from '../escape';
import { json, readBody, serverError, queryParams, getPaging, pageInfo, escapeRegex } from '../http';
import { str, url as urlField, num, oneOf, ValidationError } from '../validate';

// Deleted listings are kept for order history but hidden everywhere else.
const notDeleted = { isDeleted: { $ne: true } };
const findLiveListing = (id) => Listing.findOne({ _id: id, ...notDeleted });

const MAX_PRICE = 100000;
const MAX_TRAFFIC = 10_000_000_000;

// The fields a seller sends for one listing, checked and cleaned. With
// `partial`, missing fields are left out (for edits).
const readListingFields = (body, { partial = false } = {}) => {
  const required = !partial;
  const fields = {
    url: partial ? undefined : urlField(body.url, 'url', 'Website URL'),
    category: str(body.category, 'category', 'Category', { required, max: 60 }),
    price: num(body.price, 'price', 'Price', { required, min: 1, max: MAX_PRICE }),
    da: num(body.da, 'da', 'DA', { required: false, min: 0, max: 100, integer: true }),
    traffic: num(body.traffic, 'traffic', 'Traffic', { required: false, min: 0, max: MAX_TRAFFIC, integer: true }),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
};

const hostOf = (address) => new URL(address).hostname.replace(/^www\./, '').toLowerCase();

// A seller can't list the same website twice.
const findOwnDuplicate = async (sellerId, address) => {
  const host = escapeRegex(hostOf(address));
  return Listing.findOne({
    seller: sellerId,
    ...notDeleted,
    // Older listings may be stored without the https:// prefix.
    url: { $regex: `^(https?://)?(www\\.)?${host}(/|$)`, $options: 'i' },
  });
};

export const createListing = async (request, params, user) => {
  try {
    const fields = readListingFields(await readBody(request));
    if (await findOwnDuplicate(user.id, fields.url)) {
      return json({ message: 'You have already listed this website.', field: 'url' }, 400);
    }
    const listing = await Listing.create({
      seller: user.id,
      da: 0,
      traffic: 0,
      ...fields,
      status: 'pending',
    });
    return json(listing, 201);
  } catch (error) {
    return serverError(error);
  }
};

const SORTS = {
  default: { isFeatured: -1, createdAt: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  da_desc: { da: -1, _id: 1 },
  traffic_desc: { traffic: -1, _id: 1 },
};

const range = (min, max, label, { integer = true } = {}) => {
  const lo = num(min, `min${label}`, `Minimum ${label}`, { required: false, min: 0, integer });
  const hi = num(max, `max${label}`, `Maximum ${label}`, { required: false, min: 0, integer });
  if (lo === undefined && hi === undefined) return undefined;
  const r = {};
  if (lo !== undefined) r.$gte = lo;
  if (hi !== undefined) r.$lte = hi;
  return r;
};

// GET /api/listings: the public marketplace, 25 per page by default.
export const getListings = async (request) => {
  try {
    const q = queryParams(request);
    const paging = getPaging(request, { defaultLimit: 25, maxLimit: 100 });

    const query = { status: 'approved', ...notDeleted };

    // Listings of suspended sellers are hidden from the marketplace.
    const suspendedSellers = await User.find({ isSuspended: true }).distinct('_id');
    if (suspendedSellers.length) query.seller = { $nin: suspendedSellers };

    const search = str(q.search, 'search', 'Search', { required: false, max: 100 });
    if (search) query.url = { $regex: escapeRegex(search), $options: 'i' };

    const category = str(q.category, 'category', 'Category', { required: false, max: 60 });
    if (category && category !== 'All') query.category = category;

    const da = range(q.minDA, q.maxDA, 'DA');
    if (da) query.da = da;
    const traffic = range(q.minTraffic, q.maxTraffic, 'Traffic');
    if (traffic) query.traffic = traffic;
    const price = range(q.minPrice, q.maxPrice, 'Price', { integer: false });
    if (price) query.price = price;

    const sort = SORTS[q.sort] || SORTS.default;

    const [listings, total] = await Promise.all([
      Listing.find(query).populate('seller', 'name').sort(sort).skip(paging.skip).limit(paging.limit),
      Listing.countDocuments(query),
    ]);

    return json({ listings, ...pageInfo(total, paging) });
  } catch (error) {
    return serverError(error);
  }
};

export const approveListing = async (request, params, user) => {
  try {
    const listing = await findLiveListing(params.id);
    if (!listing) return json({ message: 'Listing not found' }, 404);
    listing.status = 'approved';
    listing.rejectionReason = undefined;
    const updatedListing = await listing.save();
    await logActivity(user.id, 'LISTING_APPROVED', listing._id, `Approved site: ${listing.url}`);
    return json(updatedListing);
  } catch (error) {
    return serverError(error);
  }
};

const ADMIN_STATUSES = ['pending', 'approved', 'rejected'];

// GET /api/listings/admin?status=pending&search=&page=1
export const getAdminListings = async (request) => {
  try {
    const q = queryParams(request);
    const paging = getPaging(request, { defaultLimit: 25, maxLimit: 100 });
    const status = oneOf(q.status, 'status', 'Status', ADMIN_STATUSES, { required: false });
    const search = str(q.search, 'search', 'Search', { required: false, max: 100 });

    const base = { ...notDeleted };
    if (search) base.url = { $regex: escapeRegex(search), $options: 'i' };
    const query = status ? { ...base, status } : base;

    const [listings, total, countRows] = await Promise.all([
      Listing.find(query)
        .populate('seller', 'name email')
        .sort({ createdAt: -1 })
        .skip(paging.skip)
        .limit(paging.limit),
      Listing.countDocuments(query),
      Listing.aggregate([{ $match: base }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);

    const counts = { pending: 0, approved: 0, rejected: 0 };
    countRows.forEach((row) => { counts[row._id] = row.n; });

    return json({ listings, counts, ...pageInfo(total, paging) });
  } catch (error) {
    return serverError(error);
  }
};

// PUT /api/listings/:id/status  { status, reason }
// Rejecting needs a reason; the seller is notified in the app and by email.
export const updateListingStatus = async (request, params, user) => {
  try {
    const body = await readBody(request);
    const status = oneOf(body.status, 'status', 'Status', ADMIN_STATUSES);
    const reason = str(body.reason, 'reason', 'Reason', { required: status === 'rejected', min: 5, max: 500 });

    const listing = await findLiveListing(params.id);
    if (!listing) return json({ message: 'Listing not found' }, 404);

    listing.status = status;
    listing.rejectionReason = status === 'rejected' ? reason : undefined;
    const updatedListing = await listing.save();

    await logActivity(
      user.id,
      status === 'rejected' ? 'LISTING_REJECTED' : `LISTING_${status.toUpperCase()}`,
      listing._id,
      status === 'rejected' ? `Rejected ${listing.url}: ${reason}` : `Set ${listing.url} to ${status}`,
    );

    if (status === 'rejected') {
      await Notification.create({
        recipient: listing.seller,
        sender: user.id,
        type: 'listing_update',
        message: `Your listing ${listing.url} was not approved: ${reason}`,
        link: '/my-listings',
      });
      const seller = await User.findById(listing.seller).select('email name');
      if (seller?.email) {
        sendEmailInBackground({
          email: seller.email,
          subject: `Listing update: ${listing.url}`,
          html: `<p>Hi ${escapeHtml(seller.name)},</p>
            <p>Your listing <strong>${escapeHtml(listing.url)}</strong> was not approved.</p>
            <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
            <p>You can edit the listing and it will be reviewed again.</p>`,
        }, 'Rejection email');
      }
    }

    return json(updatedListing);
  } catch (error) {
    return serverError(error);
  }
};

const MAX_CSV_BYTES = 1024 * 1024; // 1 MB
const MAX_CSV_ROWS = 1000;

// POST /api/listings/bulk: a CSV with url, category, price, da, traffic.
// Good rows are saved; bad rows come back with their row number and reason.
export const bulkUploadListings = async (request, params, user) => {
  try {
    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ message: 'Please upload a CSV file.' }, 400);
    }
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return json({ message: 'Please upload a CSV file.' }, 400);
    }
    if (file.size > MAX_CSV_BYTES) {
      return json({ message: 'The CSV file is too large (max 1 MB).' }, 400);
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    const rows = [];
    await new Promise((resolve, reject) => {
      Readable.from(buffer)
        .pipe(csv({ mapHeaders: ({ header }) => header.trim().toLowerCase() }))
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (rows.length === 0) return json({ message: 'The CSV file has no rows.' }, 400);
    if (rows.length > MAX_CSV_ROWS) {
      return json({ message: `Please upload at most ${MAX_CSV_ROWS} rows at a time.` }, 400);
    }

    const valid = [];
    const errors = [];
    const seenHosts = new Set();
    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2; // row 1 is the header
      try {
        const fields = readListingFields({ ...rows[i], category: rows[i].category || 'General' });
        const host = hostOf(fields.url);
        if (seenHosts.has(host)) throw new ValidationError('This website appears twice in the file', 'url');
        if (await findOwnDuplicate(user.id, fields.url)) throw new ValidationError('You have already listed this website', 'url');
        seenHosts.add(host);
        valid.push({ seller: user.id, da: 0, traffic: 0, ...fields, status: 'pending' });
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error;
        errors.push({ row: rowNumber, url: rows[i].url || '', message: error.message });
      }
    }

    if (valid.length) await Listing.insertMany(valid);

    const message = errors.length
      ? `${valid.length} of ${rows.length} listings uploaded. ${errors.length} row${errors.length === 1 ? '' : 's'} had problems.`
      : `${valid.length} listings uploaded successfully!`;
    return json({ message, inserted: valid.length, errors: errors.slice(0, 100) }, valid.length ? 201 : 400);
  } catch (error) {
    return serverError(error);
  }
};

export const getMyListings = async (request, params, user) => {
  try {
    const listings = await Listing.find({ seller: user.id, ...notDeleted }).sort({ createdAt: -1 });

    // Quick stats for the seller
    const totalListings = listings.length;
    const approvedListings = listings.filter((l) => l.status === 'approved').length;
    const pendingListings = listings.filter((l) => l.status === 'pending').length;

    return json({
      listings,
      stats: { totalListings, approvedListings, pendingListings },
    });
  } catch (error) {
    return serverError(error);
  }
};

export const updateListing = async (request, params, user) => {
  try {
    const listing = await findLiveListing(params.id);
    if (!listing) return json({ message: 'Listing not found' }, 404);

    // Only the owner or an admin can edit
    if (listing.seller.toString() !== user.id && user.role !== 'admin') {
      return json({ message: 'Not authorized to edit this listing' }, 403);
    }

    const fields = readListingFields(await readBody(request), { partial: true });
    Object.assign(listing, fields);

    // A seller's edit goes back to "pending" so an admin re-checks the new
    // metrics and price.
    if (user.role !== 'admin') {
      listing.status = 'pending';
      listing.isVerified = false;
      listing.rejectionReason = undefined;
    }

    const updatedListing = await listing.save();
    await logActivity(user.id, 'LISTING_UPDATED', listing._id, `Updated metrics/price for ${listing.url}`);
    return json(updatedListing);
  } catch (error) {
    return serverError(error);
  }
};

export const getListingById = async (request, params) => {
  try {
    const listing = await findLiveListing(params.id).populate('seller', 'name email');
    if (!listing) return json({ message: 'Listing not found' }, 404);
    return json(listing);
  } catch (error) {
    return serverError(error);
  }
};

// DELETE /api/listings/:id: the owner (or an admin) removes a website.
export const deleteListing = async (request, params, user) => {
  try {
    const listing = await findLiveListing(params.id);
    if (!listing) return json({ message: 'Listing not found' }, 404);

    if (listing.seller.toString() !== user.id && user.role !== 'admin') {
      return json({ message: 'Not authorized to delete this listing' }, 403);
    }

    const openOrders = await Order.countDocuments({
      listing: listing._id,
      status: { $in: ['awaiting_content', 'in_progress'] },
    });
    if (openOrders > 0) {
      return json({ message: 'This website has open orders. Complete or reject them before deleting it.' }, 400);
    }

    listing.isDeleted = true;
    listing.deletedAt = new Date();
    listing.isFeatured = false;
    await listing.save();

    await logActivity(user.id, 'LISTING_DELETED', listing._id, `Deleted ${listing.url}`);
    return json({ message: 'Listing deleted' });
  } catch (error) {
    return serverError(error);
  }
};
