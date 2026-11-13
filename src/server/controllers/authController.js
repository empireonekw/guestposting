import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User, { sellerStatusOf } from '../models/User';
import Notification from '../models/Notification';
import sendEmail from '../sendEmail';
import { generateToken } from '../auth';
import { json, readBody, serverError } from '../http';
import { str, email as emailField, oneOf } from '../validate';
import { rateLimit, firstLimited, clientIp, MINUTE, HOUR } from '../rateLimit';
import BRAND from '@/data/brand';

// Emails are matched case-insensitively so "Ali@x.com" and "ali@x.com" are
// the same account, including accounts created before emails were lowercased.
const CASE_INSENSITIVE = { locale: 'en', strength: 2 };
const findByEmail = (address) => User.findOne({ email: address }).collation(CASE_INSENSITIVE);

// Keyed with the server secret, so a leaked hash can't be reversed by trying
// all one million codes.
const hashOtp = (otp) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(String(otp)).digest('hex');
const OTP_MAX_ATTEMPTS = 5;

const sessionPayload = (user) => ({
  _id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  sellerStatus: sellerStatusOf(user),
  token: generateToken(user._id, user.tokenVersion || 0),
});

export const registerUser = async (request) => {
  try {
    const body = await readBody(request);
    const name = str(body.name, 'name', 'Name', { min: 2, max: 60 });
    const address = emailField(body.email).toLowerCase();
    const password = str(body.password, 'password', 'Password', { min: 6, max: 128 });
    // Sign-up can only create buyers or sellers. Admins are made from the
    // admin User Management page, never from a public request.
    const role = oneOf(body.role, 'role', 'Role', ['buyer', 'seller'], { required: false }) || 'buyer';

    // Counted after validation, so typos in the form don't lock anyone out.
    const limited = rateLimit('register', clientIp(request), { limit: 10, windowMs: HOUR });
    if (limited) return limited;

    if (await findByEmail(address)) {
      return json({ message: 'An account with this email already exists' }, 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email: address, password: hashedPassword, role,
      // New sellers wait for an admin to approve them.
      ...(role === 'seller' ? { sellerStatus: 'pending' } : {}),
    });
    if (role === 'seller') {
      const admins = await User.find({ role: 'admin', isSuspended: { $ne: true } }).distinct('_id');
      if (admins.length) {
        await Notification.insertMany(admins.map((id) => ({
          recipient: id,
          sender: user._id,
          type: 'seller_signup',
          message: `New seller waiting for approval: ${name}`,
          link: '/admin/users?seller=pending',
        })));
      }
    }
    return json(sessionPayload(user), 201);
  } catch (error) {
    return serverError(error);
  }
};

export const loginUser = async (request) => {
  try {
    const body = await readBody(request);
    const address = emailField(body.email);
    const password = str(body.password, 'password', 'Password', { max: 128 });

    const ip = clientIp(request);
    const limited = firstLimited(
      rateLimit('login-ip', ip, { limit: 30, windowMs: 15 * MINUTE }),
      rateLimit('login-account', `${ip}:${address.toLowerCase()}`, { limit: 8, windowMs: 15 * MINUTE }),
    );
    if (limited) return limited;

    const user = await findByEmail(address).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return json({ message: 'Invalid email or password' }, 401);
    }
    if (user.isSuspended) {
      return json({ message: 'Your account has been suspended. Please contact support.' }, 403);
    }
    return json(sessionPayload(user));
  } catch (error) {
    return serverError(error);
  }
};

// Always answers the same way, so the form can't be used to find out which
// emails have accounts.
const OTP_SENT = 'If an account exists for this email, we sent a 6-digit code to it.';

export const forgotPassword = async (request) => {
  try {
    const body = await readBody(request);
    const address = emailField(body.email);

    const limited = firstLimited(
      rateLimit('forgot-ip', clientIp(request), { limit: 10, windowMs: HOUR }),
      rateLimit('forgot-account', address.toLowerCase(), { limit: 3, windowMs: 15 * MINUTE }),
    );
    if (limited) return limited;

    const user = await findByEmail(address);
    if (!user) return json({ message: OTP_SENT });

    const otp = crypto.randomInt(100000, 1000000).toString();
    user.resetPasswordOtp = hashOtp(otp);
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    user.resetPasswordAttempts = 0;
    await user.save();

    try {
      await sendEmail({
        email: user.email,
        subject: `${BRAND.name}: your password reset code`,
        text: `Your password reset code is: ${otp}\n\nThis code is valid for 10 minutes. If you did not request this, please ignore this email.`,
      });
    } catch (err) {
      console.error('Password reset email failed:', err.message);
      user.resetPasswordOtp = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      return json({ message: 'We could not send the email. Please try again later.' }, 500);
    }
    return json({ message: OTP_SENT });
  } catch (error) {
    return serverError(error);
  }
};

const INVALID_OTP = 'Invalid or expired code';

export const resetPassword = async (request) => {
  try {
    const body = await readBody(request);
    const address = emailField(body.email);
    const otp = str(body.otp, 'otp', 'Code', { max: 6 });
    const newPassword = str(body.newPassword, 'newPassword', 'New password', { min: 6, max: 128 });

    const limited = rateLimit('reset-ip', clientIp(request), { limit: 20, windowMs: 15 * MINUTE });
    if (limited) return limited;

    const user = await findByEmail(address).select('+resetPasswordOtp');
    if (!user || !user.resetPasswordOtp || !user.resetPasswordExpire || user.resetPasswordExpire.getTime() < Date.now()) {
      return json({ message: INVALID_OTP }, 400);
    }

    const given = Buffer.from(hashOtp(otp));
    const stored = Buffer.from(user.resetPasswordOtp);
    const matches = given.length === stored.length && crypto.timingSafeEqual(given, stored);
    if (!matches) {
      // A code only survives a few wrong guesses, so it can't be brute-forced.
      user.resetPasswordAttempts = (user.resetPasswordAttempts || 0) + 1;
      if (user.resetPasswordAttempts >= OTP_MAX_ATTEMPTS) {
        user.resetPasswordOtp = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        return json({ message: 'Too many wrong codes. Please request a new one.' }, 400);
      }
      await user.save();
      return json({ message: INVALID_OTP }, 400);
    }

    user.password = await bcrypt.hash(newPassword, 10);
    // Sign out every device, in case someone else had access.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpire = undefined;
    user.resetPasswordAttempts = 0;
    await user.save();

    return json({ message: 'Password has been updated successfully' });
  } catch (error) {
    return serverError(error);
  }
};
