import ActivityLog from './models/ActivityLog';
import User, { sellerStatusOf } from './models/User';
import Notification from './models/Notification';
import { sendEmailInBackground } from './sendEmail';
import { escapeHtml } from './escape';
import BRAND from '@/data/brand';
import { BLOCKED_NICHES, BLOCKED_REASON } from '@/data/listingOptions';

// The admin listing queue: approve, reject, ask for changes or move back to
// pending, for one listing or many at once. Sellers hear about the result
// once per review, not once per website.

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'changes_requested'];
// Statuses the seller must be told why about.
export const NEEDS_NOTE = ['rejected', 'changes_requested'];
export const MAX_BULK = 100;

const LOG_ACTION = {
  pending: 'LISTING_PENDING',
  approved: 'LISTING_APPROVED',
  rejected: 'LISTING_REJECTED',
  changes_requested: 'LISTING_CHANGES_REQUESTED',
};

const siteName = (listing) => listing.domain || String(listing.url).replace(/^https?:\/\/(www\.)?/, '');

const logDetails = (listing, status, note) => {
  if (status === 'approved') return `Approved site: ${listing.url}`;
  if (status === 'rejected') return `Rejected ${listing.url}: ${note}`;
  if (status === 'changes_requested') return `Asked for changes on ${listing.url}: ${note}`;
  return `Set ${listing.url} to pending`;
};

// Why a listing can't go live, or null when it can.
const blockReason = (state) => {
  if (state === 'pending') return 'Approve this seller first (Users → Sellers waiting).';
  if (state === 'blocked') return 'This seller is blocked, so their websites cannot go live.';
  return null;
};

const listText = (names) => (names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`);

const notificationText = (status, names, note) => {
  const many = names.length > 1;
  if (status === 'approved') return many ? `${names.length} of your websites are now live: ${listText(names)}` : `${names[0]} is now live.`;
  if (status === 'rejected') return many ? `${names.length} of your websites were not approved: ${note}` : `Your listing ${names[0]} was not approved: ${note}`;
  return many ? `Changes requested on ${names.length} of your websites: ${note}` : `Changes requested for ${names[0]}: ${note}`;
};

const emailFor = (status, seller, names, note) => {
  const sites = names.map((n) => `<li><strong>${escapeHtml(n)}</strong></li>`).join('');
  const intro = status === 'rejected'
    ? `${names.length > 1 ? 'These websites were' : 'This website was'} not approved:`
    : `Our team asked for changes on ${names.length > 1 ? 'these websites' : 'this website'}:`;
  const next = status === 'rejected'
    ? 'You can edit the listing and it will be reviewed again.'
    : 'Edit the listing in My websites. Once you save it, it goes back into our review queue.';
  return {
    email: seller.email,
    subject: status === 'rejected'
      ? `Listing update: ${names.length > 1 ? `${names.length} websites` : names[0]}`
      : `Changes needed: ${names.length > 1 ? `${names.length} websites` : names[0]}`,
    html: `<p>Hi ${escapeHtml(seller.name)},</p>
      <p>${intro}</p><ul>${sites}</ul>
      <p><strong>${status === 'rejected' ? 'Reason' : 'What to change'}:</strong> ${escapeHtml(note)}</p>
      <p>${next}</p>
      <p>${escapeHtml(BRAND.name)}</p>`,
  };
};

// One notification (and, for rejections and change requests, one email) per
// seller. An admin reviewing their own sites isn't notified.
const tellSellers = async (listings, status, note, admin) => {
  if (status === 'pending' || !listings.length) return;
  const bySeller = new Map();
  listings.forEach((l) => {
    const id = String(l.seller);
    if (id === admin.id) return;
    if (!bySeller.has(id)) bySeller.set(id, []);
    bySeller.get(id).push(siteName(l));
  });
  if (!bySeller.size) return;

  await Notification.insertMany([...bySeller].map(([recipient, names]) => ({
    recipient,
    sender: admin.id,
    type: 'listing_update',
    message: notificationText(status, names, note).slice(0, 500),
    link: '/my-listings',
  })));

  if (!NEEDS_NOTE.includes(status)) return;
  const sellers = await User.find({ _id: { $in: [...bySeller.keys()] } }).select('email name');
  sellers.forEach((seller) => {
    if (!seller.email) return;
    sendEmailInBackground(emailFor(status, seller, bySeller.get(String(seller._id)), note), 'Listing review email');
  });
};

// Sets `status` on the given (loaded, not deleted) listings. Listings whose
// seller can't sell right now are skipped when approving. Returns the saved
// listings and the skipped ones with the reason.
export const reviewListings = async (listings, status, note, admin) => {
  const done = [];
  const skipped = [];

  let stateOf = () => null;
  if (status === 'approved') {
    const owners = await User.find({ _id: { $in: listings.map((l) => l.seller) } }).select('role sellerStatus');
    const states = new Map(owners.map((o) => [String(o._id), sellerStatusOf(o)]));
    stateOf = (listing) => states.get(String(listing.seller));
  }

  for (const listing of listings) {
    // Gambling, betting and CBD sites can't go live (payment provider rules).
    const topicBlocked = status === 'approved' && (listing.niches || []).some((n) => BLOCKED_NICHES.includes(n)) ? BLOCKED_REASON : null;
    const blocked = topicBlocked || (status === 'approved' ? blockReason(stateOf(listing)) : null);
    if (blocked) {
      skipped.push({ _id: listing._id, site: siteName(listing), message: blocked });
      continue; // eslint-disable-line no-continue
    }
    if (status === 'approved' && listing.status !== 'approved') listing.approvedAt = new Date();
    listing.status = status;
    listing.rejectionReason = status === 'rejected' ? note : undefined;
    listing.reviewNote = status === 'changes_requested' ? note : undefined;
    // eslint-disable-next-line no-await-in-loop
    await listing.save();
    done.push(listing);
  }

  if (done.length) {
    try {
      await ActivityLog.insertMany(done.map((l) => ({
        user: admin.id,
        action: LOG_ACTION[status],
        targetId: String(l._id),
        details: logDetails(l, status, note),
      })));
    } catch (error) {
      console.error('Logging failed:', error);
    }
    await tellSellers(done, status, note, admin);
  }

  return { done, skipped };
};
