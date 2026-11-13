import mongoose from 'mongoose';
import { ORDER_STATUSES } from '@/data/orderStatus';

// One order for one guest post. The workflow (Module 4) lives in
// server/orderFlow.js; statuses and labels in data/orderStatus.js.

const { ObjectId } = mongoose.Schema.Types;

// A file stored in GridFS (see server/files.js).
const fileSchema = new mongoose.Schema(
  { fileId: ObjectId, name: String, size: Number, type: String },
  { _id: false },
);

// The timeline shown on the order page.
const eventSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: ObjectId, ref: 'User' },
    // buyer | seller | admin | system
    role: String,
    type: String,
    note: { type: String, maxlength: 2000 },
  },
  { _id: false },
);

const evidenceSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: ObjectId, ref: 'User' },
    role: String,
    text: { type: String, maxlength: 5000 },
    file: fileSchema,
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    listing: { type: ObjectId, ref: 'Listing', required: true },
    buyer: { type: ObjectId, ref: 'User', required: true },
    seller: { type: ObjectId, ref: 'User', required: true },
    // The website at the time of ordering, for search and history.
    site: { domain: String, url: String },
    price: { type: Number, required: true },
    // Set by Module 3 (payments). Until then orders are placed unpaid.
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded', 'partially_refunded'], default: 'unpaid' },
    turnaroundDays: { type: Number, default: 3 },
    // The listing's link promise when ordered (Module 5 checks against it).
    linkType: { type: String, default: 'dofollow' },
    linkValidity: { type: String, default: 'permanent' },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending_acceptance' },
    // 2 = Module 4 workflow. Older orders are converted by a scheduled job.
    flowVersion: { type: Number, default: 2 },

    // Acceptance
    acceptBy: Date,
    acceptedAt: Date,

    // The brief
    contentSource: { type: String, enum: ['buyer', 'seller'] }, // who writes the article
    targetUrl: String,
    anchorText: String,
    articleLink: String, // a Google Doc or similar
    articleFile: fileSchema,
    contentNotes: String,
    briefAt: Date,
    dueAt: Date, // when the seller should have published
    lateNotifiedAt: Date,

    // Draft review (only when the seller writes)
    draft: {
      link: String,
      text: { type: String, maxlength: 20000 },
      file: fileSchema,
      submittedAt: Date,
    },
    revisionCount: { type: Number, default: 0 },
    draftApprovedAt: Date,

    // Delivery
    liveLink: String,
    deliveredAt: Date,
    reviewBy: Date, // auto-approved after this
    fixCount: { type: Number, default: 0 },

    // The end
    completedAt: Date,
    completedBy: { type: String, enum: ['buyer', 'auto', 'admin'] },
    sellerEarning: Number, // what the seller is credited on completion
    refundAmount: { type: Number, default: 0 },
    cancelledAt: Date,
    cancelledBy: String, // buyer | seller | admin | system
    cancelReason: { type: String, maxlength: 1000 },

    dispute: {
      openedBy: { type: ObjectId, ref: 'User' },
      openedByRole: String,
      reason: { type: String, maxlength: 2000 },
      openedAt: Date,
      respondBy: Date,
      escalatedAt: Date,
      previousStatus: String,
      evidence: { type: [evidenceSchema], default: undefined },
      resolution: {
        outcome: String,
        amount: Number,
        note: { type: String, maxlength: 2000 },
        by: { type: ObjectId, ref: 'User' },
        at: Date,
      },
    },

    // Module 5: link checks and the link guarantee (see server/linkMonitor.js).
    link: {
      // ok | warning | problem | unverified | lost | ended
      status: String,
      last: {
        at: Date,
        verdict: String,
        problems: [String],
        httpStatus: Number,
        linkFound: Boolean,
        rel: String,
        anchor: String,
        noindex: Boolean,
        error: String,
        source: String, // delivery | monitor | manual
      },
      lastCheckedAt: Date,
      nextCheckAt: Date,
      guaranteeUntil: Date,
      failStreak: { type: Number, default: 0 },
      checkCount: { type: Number, default: 0 },
      lostCount: { type: Number, default: 0 },
      // A lost-link case: the seller gets LEGAL.linkFixDays to restore it,
      // then our team arranges a replacement or a refund.
      case: {
        status: String, // open | awaiting_decision | fixed | replaced | refunded | closed
        openedAt: Date,
        openedBy: String, // system | buyer | admin
        reason: String,
        fixBy: Date,
        escalatedAt: Date,
        resolvedAt: Date,
        resolvedBy: { type: ObjectId, ref: 'User' },
        note: String,
        refundAmount: Number,
      },
    },

    events: { type: [eventSchema], default: [] },
    lastActivityAt: { type: Date, default: Date.now },
  },
  // A save fails if someone else changed the order since it was loaded, so
  // two clicks at once can't both complete (and credit) an order.
  { timestamps: true, optimisticConcurrency: true },
);

// Buyer's orders, seller's sales, and open-order checks on a listing.
orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, createdAt: -1 });
orderSchema.index({ listing: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
// Scheduled jobs: unanswered orders, auto-approval, late orders.
orderSchema.index({ status: 1, acceptBy: 1 });
orderSchema.index({ status: 1, reviewBy: 1 });
orderSchema.index({ status: 1, dueAt: 1 });
orderSchema.index({ flowVersion: 1 });
orderSchema.index({ 'site.domain': 1 });
// Link monitoring: the hourly job and the admin Links page.
orderSchema.index({ status: 1, 'link.nextCheckAt': 1 });
orderSchema.index({ 'link.status': 1, 'link.guaranteeUntil': 1 });
orderSchema.index({ 'link.case.status': 1 });

// In development a hot reload would otherwise keep the old model, which
// silently drops fields added since; rebuild it so new fields are saved.
if (process.env.NODE_ENV !== 'production' && mongoose.models.Order) mongoose.deleteModel('Order');
export default mongoose.models.Order || mongoose.model('Order', orderSchema);
