import mongoose from 'mongoose';
import defineModel from './defineModel';

// One check of a published guest post (Module 5). The order keeps only the
// latest result; this is the history shown on the order and admin pages.
const linkCheckSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    at: { type: Date, default: Date.now },
    source: String, // delivery | monitor | manual
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    liveLink: String,
    verdict: String, // ok | warning | problem | unverified
    problems: [String],
    httpStatus: Number,
    linkFound: Boolean,
    rel: String,
    anchor: String,
    noindex: Boolean,
    error: String,
  },
  { versionKey: false },
);

linkCheckSchema.index({ order: 1, at: -1 });
// History older than two years is removed automatically.
linkCheckSchema.index({ at: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 3600 });

export default defineModel('LinkCheck', linkCheckSchema);
