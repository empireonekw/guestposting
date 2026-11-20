import mongoose from 'mongoose';
import defineModel from './defineModel';

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
    // Sellers: 'pending' until an admin approves them, 'blocked' when an
    // admin stops them selling (they can still buy and chat). Sellers from
    // before this field existed count as approved.
    sellerStatus: {
      type: String,
      enum: ['pending', 'approved', 'blocked'],
    },
    sellerStatusReason: { type: String, maxlength: 500 },
    
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
    // Goes up when the password is reset; logins issued before that stop
    // working (the number is inside each login token).
    tokenVersion: { type: Number, default: 0 },

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
userSchema.index({ role: 1, sellerStatus: 1 });

// A seller's effective status (older sellers have none and are approved).
export const sellerStatusOf = (user) => (user?.role === 'seller' ? user.sellerStatus || 'approved' : null);

export default defineModel('User', userSchema);