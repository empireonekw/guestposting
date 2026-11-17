import Coupon from '../models/Coupon';
import CouponRedemption from '../models/CouponRedemption';
import ActivityLog from '../models/ActivityLog';
import {
  json, readBody, serverError, queryParams, getPaging, pageInfo, escapeRegex,
} from '../http';
import {
  str, num, bool, oneOf, objectId, ValidationError,
} from '../validate';
import { couponSummary, normalizeCode } from '../buying';

// Admin → Coupons (Module 6): create and edit discount codes and see who
// used them. Coupons are never deleted once used; turn them off instead.

const CODE_RE = /^[A-Z0-9_-]{3,32}$/;

const dateField = (value, field, label) => {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new ValidationError(`${label} is not a valid date`, field);
  return d;
};

const statusOf = (c, now = new Date()) => {
  if (!c.active) return 'off';
  if (c.expiresAt && c.expiresAt <= now) return 'expired';
  if (c.maxUses && c.uses >= c.maxUses) return 'used_up';
  if (c.startsAt && c.startsAt > now) return 'scheduled';
  return 'live';
};

const view = (c) => ({
  ...(c.toObject ? c.toObject() : c),
  summary: couponSummary(c),
  state: statusOf(c),
});

// Reads the editable fields. `existing` is the coupon being edited.
const readFields = (body, existing) => {
  const out = {};
  const has = (k) => body[k] !== undefined;
  if (!existing || has('code')) {
    const code = normalizeCode(str(body.code, 'code', 'Code', { max: 32 }));
    if (!CODE_RE.test(code)) throw new ValidationError('Use 3–32 letters, numbers, dashes or underscores', 'code');
    out.code = code;
  }
  if (!existing || has('type')) out.type = oneOf(body.type, 'type', 'Discount type', ['percent', 'fixed']);
  const type = out.type || existing?.type;
  if (!existing || has('value')) {
    out.value = num(body.value, 'value', type === 'percent' ? 'Percent off' : 'Amount off', {
      min: 0.01, max: type === 'percent' ? 100 : 100000,
    });
  } else if (out.type === 'percent' && existing.value > 100) {
    throw new ValidationError('Percent off must be at most 100', 'value');
  }
  if (has('description')) out.description = str(body.description, 'description', 'Description', { required: false, max: 200 }) || '';
  if (has('maxDiscount')) out.maxDiscount = num(body.maxDiscount, 'maxDiscount', 'Maximum discount', { required: false, min: 0, max: 100000 }) ?? null;
  if (has('minSubtotal')) out.minSubtotal = num(body.minSubtotal, 'minSubtotal', 'Minimum order', { required: false, min: 0, max: 1000000 }) ?? 0;
  if (has('firstOrderOnly')) out.firstOrderOnly = bool(body.firstOrderOnly, 'firstOrderOnly', 'First order only');
  if (has('startsAt')) out.startsAt = dateField(body.startsAt, 'startsAt', 'Start date');
  if (has('expiresAt')) out.expiresAt = dateField(body.expiresAt, 'expiresAt', 'End date');
  if (has('maxUses')) out.maxUses = num(body.maxUses, 'maxUses', 'Total uses', { required: false, min: 1, max: 1000000, integer: true }) ?? null;
  if (has('perUserLimit')) out.perUserLimit = num(body.perUserLimit, 'perUserLimit', 'Uses per buyer', { required: false, min: 1, max: 1000, integer: true }) ?? 1;
  if (has('active')) out.active = bool(body.active, 'active', 'Active');

  const starts = out.startsAt !== undefined ? out.startsAt : existing?.startsAt;
  const ends = out.expiresAt !== undefined ? out.expiresAt : existing?.expiresAt;
  if (starts && ends && ends <= starts) throw new ValidationError('The end date must be after the start date', 'expiresAt');
  return out;
};

const log = (admin, action, coupon, details) =>
  ActivityLog.create({ user: admin.id, action, targetId: String(coupon._id), details }).catch(() => {});

// GET /api/admin/coupons?search=&state=&page=
export const getCoupons = async (request) => {
  try {
    const q = queryParams(request);
    const paging = getPaging(request, { defaultLimit: 25, maxLimit: 100 });
    const search = str(q.search, 'search', 'Search', { required: false, max: 40 });
    const state = oneOf(q.state, 'state', 'Status', ['all', 'live', 'off', 'expired', 'used_up', 'scheduled'], { required: false }) || 'all';
    const now = new Date();
    const query = {};
    if (search) query.$or = [{ code: { $regex: escapeRegex(search), $options: 'i' } }, { description: { $regex: escapeRegex(search), $options: 'i' } }];
    const usedUp = { $expr: { $and: [{ $gt: ['$maxUses', 0] }, { $gte: ['$uses', '$maxUses'] }] } };
    const notExpired = { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] };
    if (state === 'off') query.active = false;
    if (state === 'expired') Object.assign(query, { active: true, expiresAt: { $lte: now } });
    if (state === 'scheduled') Object.assign(query, { active: true, startsAt: { $gt: now } });
    if (state === 'used_up') Object.assign(query, { active: true, ...usedUp });
    if (state === 'live') {
      query.active = true;
      query.$and = [notExpired, { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $nor: [usedUp] }];
    }

    const [rows, total, totals] = await Promise.all([
      Coupon.find(query).populate('createdBy', 'name').sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit),
      Coupon.countDocuments(query),
      Coupon.aggregate([{ $group: { _id: null, uses: { $sum: '$uses' }, discount: { $sum: '$totalDiscount' }, sales: { $sum: '$totalSales' }, count: { $sum: 1 } } }]),
    ]);
    const t = totals[0] || {};
    return json({
      coupons: rows.map(view),
      totals: { coupons: t.count || 0, uses: t.uses || 0, discount: t.discount || 0, sales: t.sales || 0 },
      ...pageInfo(total, paging),
    });
  } catch (error) {
    return serverError(error);
  }
};

// POST /api/admin/coupons
export const createCoupon = async (request, params, user) => {
  try {
    const body = await readBody(request);
    const fields = readFields(body, null);
    if (await Coupon.exists({ code: fields.code })) return json({ message: 'A coupon with this code already exists', field: 'code' }, 409);
    const coupon = await Coupon.create({ ...fields, createdBy: user.id });
    await log(user, 'COUPON_CREATED', coupon, `Created coupon ${coupon.code}: ${couponSummary(coupon)}`);
    return json(view(coupon), 201);
  } catch (error) {
    return serverError(error);
  }
};

// PUT /api/admin/coupons/:id
export const updateCoupon = async (request, params, user) => {
  try {
    const id = objectId(params.id, 'id', 'Coupon');
    const coupon = await Coupon.findById(id);
    if (!coupon) return json({ message: 'Coupon not found' }, 404);
    const body = await readBody(request);
    const fields = readFields(body, coupon);
    // The code is what buyers typed; once used it stays the same.
    if (fields.code && fields.code !== coupon.code) {
      if (coupon.uses > 0 || (await CouponRedemption.exists({ coupon: coupon._id }))) {
        return json({ message: 'This coupon has been used, so its code can’t change. Create a new coupon instead.', field: 'code' }, 400);
      }
      if (await Coupon.exists({ code: fields.code, _id: { $ne: coupon._id } })) {
        return json({ message: 'A coupon with this code already exists', field: 'code' }, 409);
      }
    }
    Object.entries(fields).forEach(([k, v]) => coupon.set(k, v === null ? undefined : v));
    await coupon.save();
    const what = Object.keys(fields).join(', ');
    await log(user, 'COUPON_UPDATED', coupon, `Updated coupon ${coupon.code} (${what})`);
    return json(view(coupon));
  } catch (error) {
    return serverError(error);
  }
};

// GET /api/admin/coupons/:id/redemptions?page=
export const getRedemptions = async (request, params) => {
  try {
    const id = objectId(params.id, 'id', 'Coupon');
    const paging = getPaging(request, { defaultLimit: 20, maxLimit: 100 });
    const query = { coupon: id };
    const [rows, total] = await Promise.all([
      CouponRedemption.find(query)
        .populate('user', 'name email')
        .populate('orders', 'site.domain status price discount')
        .sort({ createdAt: -1 })
        .skip(paging.skip)
        .limit(paging.limit)
        .lean(),
      CouponRedemption.countDocuments(query),
    ]);
    return json({ redemptions: rows, ...pageInfo(total, paging) });
  } catch (error) {
    return serverError(error);
  }
};
