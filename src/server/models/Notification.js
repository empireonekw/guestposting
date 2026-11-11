import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String, 
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    link: {
      type: String, 
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// The notification bell polls this query every few seconds.
notificationSchema.index({ recipient: 1, createdAt: -1 });

// In development a hot reload would otherwise keep the old model, which
// silently drops fields added since; rebuild it so new fields are saved.
if (process.env.NODE_ENV !== 'production' && mongoose.models.Notification) mongoose.deleteModel('Notification');
export default mongoose.models.Notification || mongoose.model('Notification', notificationSchema);