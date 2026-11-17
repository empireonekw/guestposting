import mongoose from 'mongoose';

// Field names kept from before Module 1 so existing screens and orders keep
// working: `price` is the guest post price, `da` is Moz DA and `traffic` is
// Ahrefs organic traffic. `category` is the old single niche; new listings
// fill it with their first niche's name.

const topCountrySchema = new mongoose.Schema(
  {
    code: { type: String, lowercase: true, maxlength: 2 },
    share: { type: Number, min: 0, max: 100 },
  },
  { _id: false },
);

const trafficPointSchema = new mongoose.Schema(
  {
    month: { type: Date },
    ahrefs: { type: Number, min: 0 },
    semrush: { type: Number, min: 0 },
  },
  { _id: false },
);

const listingSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    url: { type: String, required: true },
    // Bare host name ("example.com"): used for search, sorting and the
    // /sites/<domain> page.
    domain: { type: String, lowercase: true, trim: true },
    category: { type: String },
    niches: { type: [String], default: [] },
    description: { type: String, maxlength: 1000 },

    // Metrics
    price: { type: Number, required: true },
    da: { type: Number, default: 0 },
    dr: { type: Number, default: 0 },
    authorityScore: { type: Number, default: 0 },
    traffic: { type: Number, default: 0 },
    semrushTraffic: { type: Number, default: 0 },
    keywords: { type: Number, default: 0 },
    trafficHistory: { type: [trafficPointSchema], default: [] },

    // Location
    language: { type: String, lowercase: true, maxlength: 5 },
    country: { type: String, lowercase: true, maxlength: 2 },
    topCountries: { type: [topCountrySchema], default: [] },

    // Link details
    linkType: { type: String, enum: ['dofollow', 'nofollow'], default: 'dofollow' },
    linkValidity: { type: String, enum: ['permanent', '24m', '12m', '6m'], default: 'permanent' },
    linksPerPost: { type: Number, default: 1, min: 1 },
    googleNews: { type: Boolean, default: false },
    markedSponsored: { type: Boolean, default: false },
    acceptsSitewide: { type: Boolean, default: false },
    acceptsForeignLanguage: { type: Boolean, default: false },
    allowed: {
      casino: { type: Boolean, default: false },
      cbd: { type: Boolean, default: false },
      crypto: { type: Boolean, default: false },
      pharmacy: { type: Boolean, default: false },
      sports: { type: Boolean, default: false },
    },

    // Prices and timing
    linkInsertionPrice: { type: Number, min: 0 },
    turnaroundDays: { type: Number, min: 0, default: 3 },
    sampleUrls: { type: [String], default: [] },
    contentRules: { type: String, maxlength: 2000 },

    // --- Module 2: real metrics ---
    // What the seller typed, kept for the admin comparison report. Once our
    // team has checked the site, a seller's numbers only land here, never in
    // the public fields above.
    sellerReported: {
      dr: Number,
      da: Number,
      authorityScore: Number,
      traffic: Number,
      semrushTraffic: Number,
      keywords: Number,
      at: Date,
    },
    // Where the public numbers came from: the seller, or a dated check by
    // our team in the admin panel.
    metrics: {
      source: { type: String, enum: ['seller', 'checked'], default: 'seller' },
      updatedAt: Date,
      checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    spamScore: { type: Number, min: 0, max: 100 },
    // Problems the last metrics check found, for the admin report.
    flags: {
      type: [
        new mongoose.Schema(
          { type: { type: String }, message: String, at: Date },
          { _id: false },
        ),
      ],
      default: [],
    },

    // --- Module 2: domain ownership ---
    verification: {
      token: { type: String, select: false },
      method: { type: String, enum: ['dns', 'meta'] },
      verifiedAt: Date,
      lastCheckedAt: Date,
      lastError: { type: String, maxlength: 300 },
      failures: { type: Number, default: 0 },
    },

    status: {
      type: String,
      // changes_requested: an admin asked the seller to fix something; the
      // seller's next edit sends it back to "pending".
      enum: ["pending", "approved", "rejected", "changes_requested"],
      default: "pending",
    },
    // true once the seller proved they own the domain (DNS record or meta tag).
    isVerified: { type: Boolean, default: false },
    // When it last went live; saved-search alerts (Module 6) look for
    // listings that went live since the last alert. Older listings have none.
    approvedAt: { type: Date },
    isFeatured: { type: Boolean, default: false },
    featuredUntil: { type: Date },
    lastVerifiedAt: { type: Date },
    // Soft delete: past orders keep pointing at the listing, so it is hidden
    // everywhere instead of being removed.
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    // Shown to the seller when an admin rejects the listing.
    rejectionReason: { type: String, maxlength: 500 },
    // Shown to the seller when an admin asks for changes.
    reviewNote: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

listingSchema.pre('save', function fillDerived() {
  if (this.isModified('url') || !this.domain) {
    try {
      this.domain = new URL(/^https?:\/\//i.test(this.url) ? this.url : `https://${this.url}`).hostname
        .replace(/^www\./, '')
        .toLowerCase();
    } catch {
      // url is validated before saving; leave domain empty if it is odd.
    }
  }
});

// Marketplace query: approved, not deleted, featured first then newest.
listingSchema.index({ status: 1, isDeleted: 1, isFeatured: -1, createdAt: -1 });
listingSchema.index({ status: 1, isDeleted: 1, price: 1 });
listingSchema.index({ status: 1, isDeleted: 1, category: 1 });
// Module 1 filters and sorts.
listingSchema.index({ status: 1, isDeleted: 1, niches: 1 });
listingSchema.index({ status: 1, isDeleted: 1, country: 1 });
listingSchema.index({ status: 1, isDeleted: 1, 'topCountries.code': 1 });
listingSchema.index({ status: 1, isDeleted: 1, language: 1 });
listingSchema.index({ status: 1, isDeleted: 1, traffic: -1 });
listingSchema.index({ status: 1, isDeleted: 1, dr: -1 });
listingSchema.index({ status: 1, isDeleted: 1, approvedAt: -1 });
listingSchema.index({ domain: 1 });
// A seller's own listings, and duplicate checks.
listingSchema.index({ seller: 1, isDeleted: 1, createdAt: -1 });
listingSchema.index({ url: 1 });
// The admin report sorts by the date of the last metrics check.
listingSchema.index({ isDeleted: 1, 'metrics.updatedAt': 1 });
listingSchema.index({ 'flags.type': 1 });
// The featured-expiry job.
listingSchema.index({ isFeatured: 1, featuredUntil: 1 });

// In development a hot reload would otherwise keep the old model, which
// silently drops fields added since; rebuild it so new fields are saved.
if (process.env.NODE_ENV !== 'production' && mongoose.models.Listing) mongoose.deleteModel('Listing');
export default mongoose.models.Listing || mongoose.model('Listing', listingSchema);
