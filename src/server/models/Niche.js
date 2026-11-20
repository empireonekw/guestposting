import mongoose from 'mongoose';
import defineModel from './defineModel';

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

export default defineModel('Niche', nicheSchema);
