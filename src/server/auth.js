import jwt from 'jsonwebtoken';
import User from './models/User';
import { json, route } from './http';

// Ports of the Express protect / seller / admin middleware. protect returns
// either the authenticated user or a ready-made error response; seller and
// admin return an error response or null. withAuth chains them like
// router.get(path, protect, admin, handler) did.

export const protect = async (request) => {
  const header = request.headers.get('authorization');
  if (header && header.startsWith('Bearer')) {
    try {
      const token = header.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) throw new Error('User not found');
      // A password reset ends every login made before it.
      if ((decoded.v ?? 0) !== (user.tokenVersion ?? 0)) {
        return { error: json({ message: 'Your session has ended. Please sign in again.', sessionEnded: true }, 401) };
      }
      if (user.isSuspended) {
        return { error: json({ message: 'Your account has been suspended.', suspended: true }, 403) };
      }
      return { user };
    } catch (error) {
      return { error: json({ message: 'Not authorized, token failed' }, 401) };
    }
  }
  return { error: json({ message: 'Not authorized, no token' }, 401) };
};

export const seller = (user) => {
  if (user?.role === 'seller' && user.sellerStatus === 'blocked') {
    return json({ message: 'Your seller account is blocked. Contact support to find out why.', sellerBlocked: true }, 403);
  }
  if (user && (user.role === 'seller' || user.role === 'admin')) return null;
  return json({ message: 'Access denied. Only sellers or admins can perform this action.' }, 403);
};

// Sellers (even blocked ones) and admins: for read-only seller pages, so a
// blocked seller can still see their sites and why they were blocked.
export const sellerAny = (user) => {
  if (user && (user.role === 'seller' || user.role === 'admin')) return null;
  return json({ message: 'Access denied. Only sellers or admins can view this.' }, 403);
};

export const admin = (user) => {
  if (user && user.role === 'admin') return null;
  return json({ message: 'Not authorized as an admin' }, 401);
};

export const withAuth = (handler, ...checks) =>
  route(async (request, params) => {
    const { user, error } = await protect(request);
    if (error) return error;
    for (const check of checks) {
      const denied = check(user);
      if (denied) return denied;
    }
    return handler(request, params, user);
  });

export const generateToken = (id, version = 0) => {
  return jwt.sign({ id, v: version }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};
