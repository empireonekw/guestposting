import mongoose from 'mongoose';
import defineModel from './defineModel';

const messageSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: { type: String, default: '' },
    // Files sent with the message (stored in GridFS, see server/files.js).
    attachments: {
      type: [new mongoose.Schema({ fileId: mongoose.Schema.Types.ObjectId, name: String, size: Number, type: String }, { _id: false })],
      default: [],
    },
    // Written by our support team rather than the buyer or seller.
    fromTeam: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Open order chats poll this query every few seconds.
messageSchema.index({ order: 1, createdAt: 1 });

export default defineModel('Message', messageSchema);