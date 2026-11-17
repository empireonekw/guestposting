import mongoose from 'mongoose';

// A website a buyer saved (list "saved", the wishlist) or put in the cart
// (list "cart"). One row per user, list and listing (Module 6).

export const LISTS = ['saved', 'cart'];

const savedItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    list: { type: String, enum: LISTS, required: true },
  },
  { timestamps: true },
);

savedItemSchema.index({ user: 1, list: 1, listing: 1 }, { unique: true });
savedItemSchema.index({ user: 1, list: 1, createdAt: -1 });

if (process.env.NODE_ENV !== 'production' && mongoose.models.SavedItem) mongoose.deleteModel('SavedItem');
export default mongoose.models.SavedItem || mongoose.model('SavedItem', savedItemSchema);
