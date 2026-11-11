import mongoose from 'mongoose';

// A chat thread.
//   direct:  two users (usually a buyer and a seller, about one website)
//   support: one user and the LetRank team (every admin can answer)
// Admins can read every conversation. Order chats keep their own Message
// model (one thread per order).
const readSchema = new mongoose.Schema(
  { user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: Date },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['direct', 'support'], required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    subject: { type: String, maxlength: 120 },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessage: {
      body: { type: String, maxlength: 200 },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      fromTeam: { type: Boolean, default: false },
    },
    // When each participant last opened the thread; `teamReadAt` is the same
    // for the LetRank team as a whole.
    reads: { type: [readSchema], default: [] },
    teamReadAt: Date,
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ kind: 1, status: 1, lastMessageAt: -1 });

export default mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
