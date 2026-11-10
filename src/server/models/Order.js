import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['awaiting_content', 'in_progress', 'published', 'cancelled'],
      default: 'awaiting_content',
    },
    targetUrl: {
      type: String,
    },
    anchorText: {
      type: String,
    },
    liveLink: { type: String },
    articleLink: { type: String }, 
  contentNotes: { type: String }
  },
  {
    timestamps: true,
  }
);

// Buyer's orders, seller's sales, and open-order checks on a listing.
orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, createdAt: -1 });
orderSchema.index({ listing: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.Order || mongoose.model('Order', orderSchema);