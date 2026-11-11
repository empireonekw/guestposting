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

export default mongoose.models.Country || mongoose.model('Country', countrySchema);
