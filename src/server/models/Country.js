import mongoose from 'mongoose';

const countrySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, lowercase: true, minlength: 2, maxlength: 2 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 80 },
    continent: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// In development a hot reload would otherwise keep the old model, which
// silently drops fields added since; rebuild it so new fields are saved.
if (process.env.NODE_ENV !== 'production' && mongoose.models.Country) mongoose.deleteModel('Country');
export default mongoose.models.Country || mongoose.model('Country', countrySchema);
