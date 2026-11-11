import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, 
  targetId: { type: String }, 
  details: { type: String }, 
  ipAddress: { type: String }
}, { timestamps: true });

activityLogSchema.index({ createdAt: -1 });

// In development a hot reload would otherwise keep the old model, which
// silently drops fields added since; rebuild it so new fields are saved.
if (process.env.NODE_ENV !== 'production' && mongoose.models.ActivityLog) mongoose.deleteModel('ActivityLog');
export default mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);