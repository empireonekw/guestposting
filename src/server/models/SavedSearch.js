import mongoose from 'mongoose';

// A publisher-list search a buyer saved (Module 6). `params` are the same
// URL parameters /sites uses, so opening it shows the same results. With
// alerts on, a scheduled job emails new matching sites.

export const ALERT_FREQUENCIES = ['off', 'daily', 'weekly'];

const savedSearchSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, maxlength: 80 },
    params: { type: Map, of: String, default: {} },
    alerts: { type: String, enum: ALERT_FREQUENCIES, default: 'weekly' },
    // New sites are those that went live after this.
    lastAlertAt: Date,
    lastAlertCount: Number,
    nextAlertAt: Date,
  },
  { timestamps: true },
);

savedSearchSchema.index({ user: 1, createdAt: -1 });
savedSearchSchema.index({ alerts: 1, nextAlertAt: 1 });

if (process.env.NODE_ENV !== 'production' && mongoose.models.SavedSearch) mongoose.deleteModel('SavedSearch');
export default mongoose.models.SavedSearch || mongoose.model('SavedSearch', savedSearchSchema);
