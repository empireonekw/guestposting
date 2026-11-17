import SavedItem, { LISTS } from '../models/SavedItem';
import Listing from '../models/Listing';
import { json, readBody, serverError, getPaging, pageInfo } from '../http';
import { objectId, str, ValidationError } from '../validate';
import { rateLimit, MINUTE } from '../rateLimit';
import { PUBLIC_FIELDS, toPlain, hiddenSellerIds } from '../listingSearch';
import { placeOrders, checkListings, checkCoupon, couponSummary, cents, MAX_CHECKOUT } from '../buying';

// Module 6: saved sites (the wishlist), the cart, cart checkout and the
// coupon preview. Saved sites and the cart are the same rows (SavedItem)
// with a different `list`.

const MAX_ITEMS = { saved: 500, cart: MAX_CHECKOUT };
const listOf = (value) => {
  if (!LISTS.includes(value)) throw new ValidationError('Unknown list', 'list');
  return value;
};

// One or many listing ids from { listingId } or { listingIds: [] }.
const idsFrom = (body) => {
  const raw = Array.isArray(body.listingIds) ? body.listingIds : [body.listingId];
  if (!raw.length || raw.length > 100) throw new ValidationError('Choose between 1 and 100 websites', 'listingIds');
  return [...new Set(raw.map((id) => objectId(id, 'listingId', 'Website')))];
};

// GET /api/lists: the ids in the user's saved list and cart, so every heart
// and cart button on the page can show its state from one request.
export const getListIds = async (request, params, user) => {
  try {
    const rows = await SavedItem.find({ user: user.id }).select('listing list').lean();
    const out = { saved: [], cart: [] };
    rows.forEach((r) => out[r.list].push(String(r.listing)));
    return json(out);
  } catch (error) {
    return serverError(error);
  }
};

// The listings behind some saved rows, marked available or not.
const withListings = async (rows) => {
  const hidden = new Set((await hiddenSellerIds()).map(String));
  const listings = await Listing.find({ _id: { $in: rows.map((r) => r.listing) } })
    .select(`${PUBLIC_FIELDS} status isDeleted`)
    .populate('seller', 'name')
    .lean();
  const byId = new Map(listings.map((l) => [String(l._id), l]));
  return rows.map((r) => {
    const l = byId.get(String(r.listing));
    const available = !!l && l.status === 'approved' && !l.isDeleted && !hidden.has(String(l.seller?._id));
    let listing = null;
    if (l) {
      const { status, isDeleted, ...rest } = l;
      listing = available ? rest : { _id: rest._id, domain: rest.domain, url: rest.url, price: rest.price };
    }
    return { _id: r._id, addedAt: r.createdAt, available, listing: listing && toPlain(listing), listingId: String(r.listing) };
  });
};

// GET /api/saved?page= and GET /api/cart
export const getList = (list) => async (request, params, user) => {
  try {
    const paging = getPaging(request, { defaultLimit: list === 'cart' ? MAX_CHECKOUT : 25, maxLimit: 100 });
    const query = { user: user.id, list };
    const [rows, total] = await Promise.all([
      SavedItem.find(query).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit).lean(),
      SavedItem.countDocuments(query),
    ]);
    const items = await withListings(rows);
    const subtotal = cents(items.filter((i) => i.available).reduce((sum, i) => sum + (i.listing.price || 0), 0));
    return json({ items, ...pageInfo(total, paging), ...(list === 'cart' ? { subtotal } : {}) });
  } catch (error) {
    return serverError(error);
  }
};

// POST /api/saved | /api/cart { listingId } or { listingIds: [] }
export const addToList = (list) => async (request, params, user) => {
  try {
    listOf(list);
    const limited = rateLimit(`list-add-${list}`, user.id, { limit: 120, windowMs: 10 * MINUTE });
    if (limited) return limited;
    const ids = idsFrom(await readBody(request));

    // Only live websites someone could buy; the cart also skips your own.
    const { ok, skipped } = list === 'cart'
      ? await checkListings(ids, user)
      : { ok: await Listing.find({ _id: { $in: ids }, status: 'approved', isDeleted: { $ne: true } }).select('_id domain'), skipped: [] };
    if (list === 'saved') {
      const found = new Set(ok.map((l) => String(l._id)));
      ids.filter((id) => !found.has(id)).forEach((id) => skipped.push({ listingId: id, message: 'This website is no longer available.' }));
    }

    const already = await SavedItem.find({ user: user.id, list, listing: { $in: ok.map((l) => l._id) } }).distinct('listing');
    const alreadySet = new Set(already.map(String));
    const fresh = ok.filter((l) => !alreadySet.has(String(l._id)));
    const count = await SavedItem.countDocuments({ user: user.id, list });
    const room = Math.max(0, MAX_ITEMS[list] - count);
    if (fresh.length > room) {
      const what = list === 'cart' ? 'Your cart' : 'Your saved list';
      if (!room) return json({ message: `${what} is full (${MAX_ITEMS[list]} websites). Remove some first.` }, 400);
      fresh.slice(room).forEach((l) => skipped.push({ listingId: String(l._id), domain: l.domain, message: `${what} is full.` }));
    }
    const adding = fresh.slice(0, room);
    if (adding.length) {
      await SavedItem.bulkWrite(adding.map((l) => ({
        updateOne: {
          filter: { user: user.id, list, listing: l._id },
          update: { $setOnInsert: { user: user.id, list, listing: l._id } },
          upsert: true,
        },
      })));
    }
    return json({ added: adding.map((l) => String(l._id)), skipped, count: count + adding.length }, 201);
  } catch (error) {
    return serverError(error);
  }
};

// DELETE /api/saved/:listingId | /api/cart/:listingId
export const removeFromList = (list) => async (request, params, user) => {
  try {
    listOf(list);
    const listingId = objectId(params.listingId, 'listingId', 'Website');
    await SavedItem.deleteOne({ user: user.id, list, listing: listingId });
    return json({ removed: listingId });
  } catch (error) {
    return serverError(error);
  }
};

// DELETE /api/cart: empty the cart.
export const clearCart = async (request, params, user) => {
  try {
    const res = await SavedItem.deleteMany({ user: user.id, list: 'cart' });
    return json({ removed: res.deletedCount });
  } catch (error) {
    return serverError(error);
  }
};

// The listing ids a checkout or preview is about: the ones sent, which must
// be in the cart, or else the whole cart.
const cartIds = async (body, user) => {
  const inCart = (await SavedItem.find({ user: user.id, list: 'cart' }).distinct('listing')).map(String);
  if (!Array.isArray(body.listingIds)) return inCart;
  const wanted = idsFrom(body);
  const set = new Set(inCart);
  return wanted.filter((id) => set.has(id));
};

// POST /api/cart/checkout { couponCode?, listingIds? }
export const checkoutCart = async (request, params, user) => {
  try {
    const limited = rateLimit('cart-checkout', user.id, { limit: 10, windowMs: 10 * MINUTE });
    if (limited) return limited;
    const body = await readBody(request);
    const couponCode = str(body.couponCode, 'couponCode', 'Coupon code', { required: false, max: 40 });
    const ids = await cartIds(body, user);
    if (!ids.length) return json({ message: 'Your cart is empty.' }, 400);
    const result = await placeOrders(user, ids, { couponCode });
    return json({
      orders: result.orders.map((o) => ({ _id: o._id, site: o.site, price: o.price, discount: o.discount })),
      skipped: result.skipped,
      subtotal: result.subtotal,
      discount: result.discount,
      total: result.total,
      coupon: result.coupon,
    }, 201);
  } catch (error) {
    return serverError(error);
  }
};

// POST /api/coupons/preview { code, listingIds? }: what a code takes off
// these websites (default: the whole cart). Nothing is reserved.
export const previewCoupon = async (request, params, user) => {
  try {
    const limited = rateLimit('coupon-preview', user.id, { limit: 30, windowMs: 10 * MINUTE });
    if (limited) return limited;
    const body = await readBody(request);
    const ids = Array.isArray(body.listingIds) || body.listingId ? idsFrom(body) : await cartIds(body, user);
    if (!ids.length) return json({ message: 'Add a website to your cart first.' }, 400);
    const { ok } = await checkListings(ids, user);
    const subtotal = cents(ok.reduce((sum, l) => sum + (l.price || 0), 0));
    const { coupon, discount } = await checkCoupon(body.code, user, subtotal);
    return json({
      code: coupon.code,
      summary: couponSummary(coupon),
      description: coupon.description || '',
      subtotal,
      discount,
      total: cents(subtotal - discount),
    });
  } catch (error) {
    return serverError(error);
  }
};
