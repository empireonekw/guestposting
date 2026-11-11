import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Sent by an admin on behalf of our team.
    fromTeam: { type: Boolean, default: false },
    body: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true },
);

// Open threads poll for messages newer than the last one they have.
chatMessageSchema.index({ conversation: 1, createdAt: 1 });

// In development a hot reload would otherwise keep the old model, which
// silently drops fields added since; rebuild it so new fields are saved.
if (process.env.NODE_ENV !== 'production' && mongoose.models.ChatMessage) mongoose.deleteModel('ChatMessage');
export default mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);
