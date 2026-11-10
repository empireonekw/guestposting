import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    url: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    da: { type: Number, required: true },
    traffic: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    // NEW FIELDS
    isVerified: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    featuredUntil: { type: Date },
    lastVerifiedAt: { type: Date },
    // Soft delete: past orders keep pointing at the listing, so it is hidden
    // everywhere instead of being removed.
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    // Shown to the seller when an admin rejects the listing.
    rejectionReason: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

// Marketplace query: approved, not deleted, featured first then newest.
listingSchema.index({ status: 1, isDeleted: 1, isFeatured: -1, createdAt: -1 });
listingSchema.index({ status: 1, isDeleted: 1, price: 1 });
listingSchema.index({ status: 1, isDeleted: 1, category: 1 });
// A seller's own listings, and duplicate checks.
listingSchema.index({ seller: 1, isDeleted: 1, createdAt: -1 });
listingSchema.index({ url: 1 });
// The featured-expiry job.
listingSchema.index({ isFeatured: 1, featuredUntil: 1 });

export default mongoose.models.Listing || mongoose.model('Listing', listingSchema);
