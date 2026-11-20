import crypto from 'node:crypto';
import Listing from './models/Listing';
import Order from './models/Order';
import Coupon from './models/Coupon';
import CouponRedemption from './models/CouponRedemption';
import SavedItem from './models/SavedItem';
import User, { sellerStatusOf } from './models/User';
import { ValidationError } from './validate';
import { addEvent, notify } from './orderEvents';
import { applyBrief, briefReadyText } from './orderFlow';
import { BLOCKED_NICHES } from '@/data/listingOptions';

// Placing orders (Module 6): one "Buy" or a whole cart at once, with an
// optional coupon. Every order path goes through placeOrders(), so the
// availability rules and coupon rules are the same everywhere.

export const MAX_CHECKOUT = 50;

export const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;
const moneyText = (n) => `$${cents(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const idOf = (x) => String(x?._id || x || '');

// ---------- availability ----------

// Why this listing can't be ordered by this user right now, or null.
const blockerFor = (listing, user, sellerOf) => {
  if (!listing || listing.isDeleted || listing.status !== 'approved') return 'This website is no longer available.';
  if ((listing.niches || []).some((n) => BLOCKED_NICHES.includes(n))) return 'This website can’t be ordered.';
  if (idOf(listing.seller) === user.id) return 'You can’t buy your own website.';
  const seller = sellerOf(idOf(listing.seller));
  if (!seller || seller.isSuspended || ['pending', 'blocked'].includes(sellerStatusOf(seller))) {
    return 'This website is currently unavailable.';
  }
  return null;
};

// Splits listing ids into orderable listings and skipped ones (with why).
export const checkListings = async (listingIds, user) => {
  const ids = [...new Set(listingIds.map(String))];
  const listings = await Listing.find({ _id: { $in: ids } });
  const byId = new Map(listings.map((l) => [idOf(l), l]));
  const sellers = await User.find({ _id: { $in: listings.map((l) => l.seller) } }).select('isSuspended role sellerStatus');
  const sellerMap = new Map(sellers.map((s) => [idOf(s), s]));
  const ok = [];
  const skipped = [];
  ids.forEach((id) => {
    const listing = byId.get(id);
    const why = blockerFor(listing, user, (sid) => sellerMap.get(sid));
    if (why) skipped.push({ listingId: id, domain: listing?.domain, message: why });
    else ok.push(listing);
  });
  return { ok, skipped };
};

// ---------- coupons ----------

const fail = (message) => {
  throw new ValidationError(message, 'couponCode');
};

export const normalizeCode = (code) => String(code || '').trim().toUpperCase();

export const couponDiscount = (coupon, subtotal) => {
  let d = coupon.type === 'percent' ? cents((subtotal * coupon.value) / 100) : cents(coupon.value);
  if (coupon.type === 'percent' && coupon.maxDiscount > 0) d = Math.min(d, coupon.maxDiscount);
  return cents(Math.min(d, subtotal));
};

// A short line describing the coupon, for buyers and the admin list.
export const couponSummary = (c) => {
  const off = c.type === 'percent' ? `${c.value}% off` : `${moneyText(c.value)} off`;
  const parts = [off];
  if (c.type === 'percent' && c.maxDiscount > 0) parts.push(`up to ${moneyText(c.maxDiscount)}`);
  if (c.minSubtotal > 0) parts.push(`on orders of ${moneyText(c.minSubtotal)}+`);
  if (c.firstOrderOnly) parts.push('first order only');
  return parts.join(', ');
};

// Checks a code for this buyer and cart total. Returns { coupon, discount }
// or throws a ValidationError a buyer can read.
export const checkCoupon = async (code, user, subtotal) => {
  const clean = normalizeCode(code);
  if (!clean) fail('Enter a coupon code');
  if (clean.length > 32) fail('That coupon code doesn’t exist');
  const coupon = await Coupon.findOne({ code: clean });
  const now = new Date();
  if (!coupon || !coupon.active) fail('That coupon code doesn’t exist or is no longer active');
  if (coupon.startsAt && coupon.startsAt > now) fail(`This coupon starts on ${coupon.startsAt.toDateString()}`);
  if (coupon.expiresAt && coupon.expiresAt <= now) fail('This coupon has expired');
  if (coupon.maxUses && coupon.uses >= coupon.maxUses) fail('This coupon has been used up');
  if (coupon.minSubtotal > 0 && subtotal < coupon.minSubtotal) {
    fail(`This coupon needs an order total of at least ${moneyText(coupon.minSubtotal)}`);
  }
  if (coupon.firstOrderOnly && (await Order.exists({ buyer: user.id, status: { $ne: 'cancelled' }, kind: { $ne: 'self' } }))) {
    fail('This coupon is only for your first order');
  }
  const used = await CouponRedemption.countDocuments({ coupon: coupon._id, user: user.id, status: 'active' });
  if (used >= (coupon.perUserLimit || 1)) {
    fail(coupon.perUserLimit > 1 ? `You have already used this coupon ${used} times` : 'You have already used this coupon');
  }
  const discount = couponDiscount(coupon, subtotal);
  if (!(discount > 0)) fail('This coupon doesn’t take anything off this order');
  return { coupon, discount };
};

// Spreads a checkout discount over its orders by price, to the cent, never
// more than an order's own price.
export const splitDiscount = (prices, discount) => {
  const subtotal = prices.reduce((a, b) => a + b, 0);
  if (!(discount > 0) || !(subtotal > 0)) return prices.map(() => 0);
  const parts = prices.map((p) => Math.floor(((discount * p) / subtotal) * 100) / 100);
  let left = cents(discount - parts.reduce((a, b) => a + b, 0));
  // Put the leftover cents on the dearest orders first.
  const order = prices.map((p, i) => i).sort((a, b) => prices[b] - prices[a]);
  for (const i of order) {
    if (left <= 0) break;
    const room = cents(prices[i] - parts[i]);
    const add = Math.min(room, left);
    parts[i] = cents(parts[i] + add);
    left = cents(left - add);
  }
  return parts;
};

// A checkout whose orders were all cancelled gives its coupon use back.
// Called after every cancellation (orderFlow.cancelOrder).
export const releaseCouponIfVoid = async (order) => {
  if (!order?.coupon?.id || !order.checkout) return;
  const stillOpen = await Order.exists({ checkout: order.checkout, status: { $ne: 'cancelled' } });
  if (stillOpen) return;
  const r = await CouponRedemption.findOneAndUpdate(
    { checkout: order.checkout, status: 'active' },
    { $set: { status: 'released', releasedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!r) return;
  await Coupon.updateOne(
    { _id: r.coupon },
    { $inc: { uses: -1, totalDiscount: -(r.discount || 0), totalSales: -cents((r.subtotal || 0) - (r.discount || 0)) } },
  );
};

// ---------- placing orders ----------

// Creates one order per orderable listing. Returns the orders, the skipped
// listings and the discount. Throws when nothing can be ordered or the
// coupon doesn't apply (then nothing is created).
//
// One-form ordering: with a `brief` (from the order form, already checked by
// orderFlow.readBrief) the order goes straight to the publisher to publish.
// Without one (a cart checkout) each order waits for its brief. There is no
// separate "seller accepts" step any more; the seller can still decline.
export const placeOrders = async (user, listingIds, { couponCode, brief, clientName } = {}) => {
  if (!listingIds.length) throw new ValidationError('Choose at least one website', 'listingIds');
  if (listingIds.length > MAX_CHECKOUT) {
    throw new ValidationError(`You can order at most ${MAX_CHECKOUT} websites at once`, 'listingIds');
  }
  const { ok, skipped } = await checkListings(listingIds, user);
  if (!ok.length) {
    throw new ValidationError(skipped.length === 1 ? skipped[0].message : 'None of these websites can be ordered right now.', 'listingIds');
  }

  const prices = ok.map((l) => cents(l.price));
  const subtotal = cents(prices.reduce((a, b) => a + b, 0));
  let coupon = null;
  let discount = 0;
  if (normalizeCode(couponCode)) {
    ({ coupon, discount } = await checkCoupon(couponCode, user, subtotal));
    // Reserve the use atomically, so a limited coupon can't be over-used by
    // two checkouts at the same moment.
    const reserved = await Coupon.findOneAndUpdate(
      {
        _id: coupon._id,
        active: true,
        ...(coupon.maxUses ? { uses: { $lt: coupon.maxUses } } : {}),
      },
      { $inc: { uses: 1, totalDiscount: discount, totalSales: cents(subtotal - discount) }, $set: { lastUsedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!reserved) fail('This coupon has just been used up');
  }

  const checkout = crypto.randomUUID();
  const shares = splitDiscount(prices, discount);
  const now = new Date();
  const orders = ok.map((listing, i) => {
    const order = new Order({
      listing: listing._id,
      buyer: user.id,
      seller: listing.seller,
      site: { domain: listing.domain, url: listing.url },
      price: prices[i],
      checkout,
      discount: shares[i],
      ...(coupon ? { coupon: { code: coupon.code, id: coupon._id } } : {}),
      turnaroundDays: listing.turnaroundDays ?? 3,
      linkType: listing.linkType || 'dofollow',
      linkValidity: listing.linkValidity || 'permanent',
      status: 'awaiting_brief',
      ...(clientName ? { clientName } : {}),
    });
    addEvent(order, { by: user.id, role: 'buyer', type: 'ordered', note: shares[i] > 0 ? `Coupon ${coupon.code}: ${moneyText(shares[i])} off` : undefined });
    if (brief) {
      applyBrief(order, brief, now);
      addEvent(order, { by: user.id, role: 'buyer', type: 'brief' });
    }
    return order;
  });

  try {
    await Order.insertMany(orders);
    if (coupon) {
      await CouponRedemption.create({
        coupon: coupon._id, code: coupon.code, user: user.id, checkout, orders: orders.map((o) => o._id), subtotal, discount,
      });
    }
  } catch (error) {
    // Nothing half-done: remove any orders that were saved and give the
    // coupon use back.
    await Order.deleteMany({ checkout }).catch(() => {});
    if (coupon) {
      await Coupon.updateOne({ _id: coupon._id }, { $inc: { uses: -1, totalDiscount: -discount, totalSales: -cents(subtotal - discount) } }).catch(() => {});
    }
    throw error;
  }

  // Ordered sites leave the cart.
  await SavedItem.deleteMany({ user: user.id, list: 'cart', listing: { $in: ok.map((l) => l._id) } });

  // Tell each seller, all at once (a cart can hold many orders).
  await Promise.all(orders.map((order) => notify(order, ['seller'], order.status === 'writing'
    ? `New order for ${order.site.domain}. ${briefReadyText(order)} by ${order.dueAt.toDateString()}. If you can\u2019t take it, decline it from the order page.`
    : `New order for ${order.site.domain}. The buyer will send the article and details shortly.`, {
    from: user.id, emailSubject: `New order: ${order.site.domain}`,
  }).catch((err) => console.error('Order notification failed:', err.message))));

  return { orders, skipped, checkout, subtotal, discount, total: cents(subtotal - discount), coupon: coupon?.code };
};
