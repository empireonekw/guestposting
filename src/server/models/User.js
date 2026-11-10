import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
        'Please add a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 6,
      select: false, 
    },
    role: {
      type: String,
      enum: ['buyer', 'seller', 'admin'],
      default: 'buyer',
    },
    stripeAccountId: {
      type: String, 
    },
    isStripeConnected: {
      type: Boolean,
      default: false,
    },
    isSuspended: { 
      type: Boolean, 
      default: false 
    },
    
    // --- PASSWORD RECOVERY FIELDS ---
    // HMAC of the 6-digit code, never the code itself, and never sent to clients.
    resetPasswordOtp: { 
      type: String,
      select: false
    },
    resetPasswordExpire: { 
      type: Date 
    },
    resetPasswordAttempts: {
      type: Number,
      default: 0
    },

    // --- FINANCIAL WALLET FIELDS ---
    balance: { 
      type: Number, 
      default: 0 
    }, 
    payoutDetails: { 
      type: String, 
      default: '' 
    }
  },
  {
    timestamps: true, 
  }
);

// Admin user list: newest first, filtered by role.
userSchema.index({ role: 1, createdAt: -1 });

export default mongoose.models.User || mongoose.model('User', userSchema);