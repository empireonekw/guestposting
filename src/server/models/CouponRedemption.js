import mongoose from 'mongoose';

// One checkout that used a coupon. "released" once every order from that
// checkout was cancelled: the use is given back to the buyer and the coupon.

const { ObjectId } = mongoose.Schema.Types;

const couponRedemptionSchema = new mongoose.Schema(
  {
    coupon: { type: ObjectId, ref: 'Coupon', required: true },
    code: String,
    user: { type: ObjectId, ref: 'User', required: true },
    checkout: { type: String, required: true },
    orders: { type: [ObjectId], ref: 'Order', default: [] },
    subtotal: Number,
    discount: Number,
    status: { type: String, enum: ['active', 'released'], default: 'active' },
    releasedAt: Date,
  },
  { timestamps: true },
);

couponRedemptionSchema.index({ coupon: 1, createdAt: -1 });
couponRedemptionSchema.index({ coupon: 1, user: 1, status: 1 });
couponRedemptionSchema.index({ checkout: 1 }, { unique: true });

if (process.env.NODE_ENV !== 'production' && mongoose.models.CouponRedemption) mongoose.deleteModel('CouponRedemption');
export default mongoose.models.CouponRedemption || mongoose.model('CouponRedemption', couponRedemptionSchema);
