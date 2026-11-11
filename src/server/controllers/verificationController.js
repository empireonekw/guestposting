import Listing from '../models/Listing';
import Notification from '../models/Notification';
import logActivity from '../logger';
import { json, readBody, serverError } from '../http';
import { oneOf } from '../validate';
import { newToken, instructions, checkOwnership } from '../verification';
import { rateLimit } from '../rateLimit';

const loadOwned = async (id, user) => {
  const listing = await Listing.findOne({ _id: id, isDeleted: { $ne: true } }).select('+verification.token');
  if (!listing) return { error: json({ message: 'Listing not found' }, 404) };
  if (listing.seller.toString() !== user.id && user.role !== 'admin') {
    return { error: json({ message: 'Not authorized for this listing' }, 403) };
  }
  if (!listing.domain) return { error: json({ message: 'This listing has no domain' }, 400) };
  return { listing };
};

const view = (listing) => ({
  domain: listing.domain,
  isVerified: listing.isVerified,
  method: listing.verification?.method,
  verifiedAt: listing.verification?.verifiedAt,
  lastCheckedAt: listing.verification?.lastCheckedAt,
  lastError: listing.verification?.lastError,
  instructions: instructions(listing.domain, listing.verification.token),
});

// GET /api/listings/:id/verification: the DNS record and meta tag to add.
export const getVerification = async (request, params, user) => {
  try {
    const { listing, error } = await loadOwned(params.id, user);
    if (error) return error;
    if (!listing.verification?.token) {
      listing.set('verification.token', newToken());
      await listing.save();
    }
    return json(view(listing));
  } catch (error) {
    return serverError(error);
  }
};

// POST /api/listings/:id/verification { method: 'dns' | 'meta' }: check now.
export const checkVerification = async (request, params, user) => {
  try {
    const limited = rateLimit('verify-domain', user.id, { limit: 20, windowMs: 10 * 60 * 1000 });
    if (limited) return limited;

    const { method } = await readBody(request);
    const chosen = oneOf(method, 'method', 'Method', ['dns', 'meta']);
    const { listing, error } = await loadOwned(params.id, user);
    if (error) return error;
    if (!listing.verification?.token) return json({ message: 'Open the verification steps first.' }, 400);

    const result = await checkOwnership(chosen, listing.domain, listing.verification.token);
    const now = new Date();
    listing.set('verification.lastCheckedAt', now);
    if (result.ok) {
      const firstTime = !listing.isVerified;
      listing.isVerified = true;
      listing.lastVerifiedAt = now;
      listing.set('verification.method', chosen);
      listing.set('verification.verifiedAt', now);
      listing.set('verification.lastError', undefined);
      listing.set('verification.failures', 0);
      await listing.save();
      if (firstTime) {
        await logActivity(user.id, 'DOMAIN_VERIFIED', listing._id, `Verified ${listing.domain} by ${chosen === 'dns' ? 'DNS record' : 'meta tag'}`);
        await Notification.create({
          recipient: listing.seller,
          sender: user.id,
          type: 'listing_update',
          message: `${listing.domain} is now verified.`,
          link: '/my-listings',
        });
      }
      return json({ ...view(listing), message: `${listing.domain} is verified.` });
    }
    listing.set('verification.lastError', result.error);
    await listing.save();
    return json({ ...view(listing), message: result.error }, 422);
  } catch (error) {
    return serverError(error);
  }
};
