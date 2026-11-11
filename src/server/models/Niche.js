import mongoose from 'mongoose';

// A niche or sub-niche (sub-niches have a parent slug). Listings store slugs.
const nicheSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 80 },
    parent: { type: String, default: null },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

nicheSchema.index({ parent: 1, order: 1 });

// In development a hot reload would otherwise keep the old model, which
// silently drops fields added since; rebuild it so new fields are saved.
if (process.env.NODE_ENV !== 'production' && mongoose.models.Niche) mongoose.deleteModel('Niche');
export default mongoose.models.Niche || mongoose.model('Niche', nicheSchema);
