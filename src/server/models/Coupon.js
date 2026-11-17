import mongoose from 'mongoose';

// A discount code (Module 6). Our team creates them in Admin → Coupons.
// One use = one checkout (a cart of one or more orders). The discount comes
// out of the platform's side: the seller still earns the full price.

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 32 },
    description: { type: String, maxlength: 200 },
    type: { type: String, enum: ['percent', 'fixed'], required: true },
    // Percent (1-100) or dollars off.
    value: { type: Number, required: true, min: 0 },
    // For percent coupons: the most it can take off one checkout.
    maxDiscount: { type: Number, min: 0 },
    // The cart must be at least this much.
    minSubtotal: { type: Number, min: 0, default: 0 },
    // Only for buyers who have never had an order (cancelled ones don't count).
    firstOrderOnly: { type: Boolean, default: false },
    startsAt: Date,
    expiresAt: Date,
    // Checkouts in total; empty means no limit.
    maxUses: { type: Number, min: 1 },
    // Checkouts per buyer.
    perUserLimit: { type: Number, min: 1, default: 1 },
    active: { type: Boolean, default: true },

    // Kept up to date as checkouts use it (and give it back when all their
    // orders are cancelled).
    uses: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    lastUsedAt: Date,

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ active: 1, createdAt: -1 });

if (process.env.NODE_ENV !== 'production' && mongoose.models.Coupon) mongoose.deleteModel('Coupon');
export default mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
