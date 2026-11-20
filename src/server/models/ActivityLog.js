import mongoose from 'mongoose';
import defineModel from './defineModel';

const activityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, 
  targetId: { type: String }, 
  details: { type: String }, 
  ipAddress: { type: String }
}, { timestamps: true });

activityLogSchema.index({ createdAt: -1 });

export default defineModel('ActivityLog', activityLogSchema);