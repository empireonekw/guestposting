import BRAND from './brand';

// Business details used by the legal pages (/terms, /privacy, /refund-policy,
// /seller-terms, /contact). Payment providers check that these match the
// business you register with them, so fill in the empty ones before you
// apply. Empty fields are simply left out of the pages.
const LEGAL = {
  // Registered company or sole-trader name, e.g. "Guest Posting LLC".
  entity: BRAND.name,
  // Registered business address, one line per entry.
  address: [],
  // Country (and state, if relevant) whose laws govern the terms, e.g. "Delaware, United States".
  governingLaw: '',
  // Company registration / trade licence number, if you have one.
  registrationNumber: '',
  email: BRAND.supportEmail,
  privacyEmail: BRAND.supportEmail,
  website: (process.env.FRONTEND_URL || 'https://guestposting.live').replace(/\/$/, ''),
  // Shown on every policy. Change it whenever you change a policy.
  updated: '2026-11-11',

  // Order and payout rules quoted by the policies. Keep them in line with
  // the order workflow (Module 4) and payouts (Module 3).
  sellerAcceptHours: 72, // a seller has this long to accept or decline an order
  autoApproveDays: 7, // a delivered order is approved automatically after this many days
  revisionRounds: 2, // free changes a buyer can ask for on the draft
  refundRequestDays: 30, // how long after delivery a buyer can open a dispute for a removed link
  linkFixDays: 7, // how long a seller has to restore a removed link
  disputeAnswerDays: 3, // how long the other side has to answer a dispute
  payoutHoldDays: 7, // funds stay pending this long after an order completes
  // "Permanent" links are guaranteed for this many months; dated links for
  // their stated period.
  permanentGuaranteeMonths: 12,
  // The platform commission taken from each sale, in percent. Leave null
  // until you decide it; the pages then point sellers to their dashboard.
  commissionPercent: null,
  dataRetentionYears: 7, // order and payment records kept for tax and accounting
};

export const updatedText = () =>
  new Date(`${LEGAL.updated}T00:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const POLICIES = [
  { href: '/terms', title: 'Terms of Service' },
  { href: '/privacy', title: 'Privacy Policy' },
  { href: '/refund-policy', title: 'Refund & Cancellation Policy' },
  { href: '/seller-terms', title: 'Seller & Payout Terms' },
  { href: '/contact', title: 'Contact' },
];

export default LEGAL;
