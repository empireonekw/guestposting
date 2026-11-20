// Order statuses, shared by the server, the order pages and the admin.
//
//   pending_acceptance -> awaiting_brief -> writing -> (content_review) -> published -> completed
//                                                    \__________ disputed __________/
//   ...or cancelled at the points the Refund Policy allows.
//
// content_review only happens when the seller writes the article. "published"
// means the post is live and the buyer is checking it.

export const ORDER_STATUSES = [
  'pending_acceptance', 'awaiting_brief', 'writing', 'content_review', 'published', 'completed', 'cancelled', 'disputed',
];

// Still being worked on (counts as "open" for deleting listings, reports...).
export const OPEN_STATUSES = ['pending_acceptance', 'awaiting_brief', 'writing', 'content_review', 'published', 'disputed'];

export const STATUS_LABEL = {
  pending_acceptance: 'Waiting for seller',
  awaiting_brief: 'Waiting for brief',
  writing: 'In progress',
  content_review: 'Draft to review',
  published: 'Live link to check',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'In dispute',
};

// Badge tone per status (see components/ui/Badge.jsx).
export const STATUS_TONE = {
  pending_acceptance: 'warning',
  awaiting_brief: 'warning',
  writing: 'brand',
  content_review: 'brand',
  published: 'brand',
  completed: 'success',
  cancelled: 'neutral',
  disputed: 'danger',
};

// Whose move it is in each status.
export const WAITING_ON = {
  pending_acceptance: 'seller',
  awaiting_brief: 'buyer',
  writing: 'seller',
  content_review: 'buyer',
  published: 'buyer',
  disputed: 'admin',
};

// The progress tracker. `draft` steps only show when the seller writes.
export const ORDER_STEPS = [
  { key: 'ordered', label: 'Ordered' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'brief', label: 'Article & brief sent' },
  { key: 'draft', label: 'Draft approved', sellerWritesOnly: true },
  { key: 'published', label: 'Published' },
  { key: 'completed', label: 'Completed' },
];

export const DISPUTE_OUTCOMES = [
  { value: 'release', label: 'Release payment to the seller', hint: 'The order is completed as delivered.' },
  { value: 'refund_full', label: 'Full refund to the buyer', hint: 'The order is cancelled.' },
  { value: 'refund_partial', label: 'Partial refund', hint: 'The order is completed; the buyer gets part of the price back.' },
  { value: 'redo', label: 'Seller redoes the work', hint: 'The order goes back to "In progress" with a new deadline.' },
];

// File types allowed for articles, drafts, chat and dispute evidence.
export const FILE_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  txt: 'text/plain',
  md: 'text/markdown',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};
export const MAX_FILE_BYTES = 8 * 1024 * 1024; // nginx and the Next.js proxy both stop at 10 MB
export const FILE_ACCEPT = Object.keys(FILE_TYPES).map((e) => `.${e}`).join(',');

// ---- Module 5: link monitoring ----

export const LINK_STATUS_LABEL = {
  ok: 'Link live',
  warning: 'Live, with a warning',
  problem: 'Problem found',
  unverified: 'Couldn’t check',
  lost: 'Link lost',
  ended: 'Guarantee ended',
};
export const LINK_STATUS_TONE = { ok: 'success', warning: 'warning', problem: 'danger', unverified: 'neutral', lost: 'danger', ended: 'neutral' };

export const LINK_CASE_LABEL = {
  open: 'Waiting for the publisher to fix it',
  awaiting_decision: 'Waiting for our team',
  fixed: 'Fixed',
  replaced: 'Replaced',
  refunded: 'Refunded',
  closed: 'Closed',
};
export const OPEN_CASE = ['open', 'awaiting_decision'];

export const LINK_PROBLEM_TEXT = {
  page_gone: 'The page no longer exists',
  redirected_away: 'The page now redirects to another website',
  link_missing: 'The link to the target URL is not on the page',
  nofollow: 'The link is nofollow, sponsored or ugc, but dofollow was promised',
  noindex: 'The page tells search engines not to index it',
  anchor_mismatch: 'The anchor text is different from the one ordered',
  unreachable: 'We could not open the page',
};

// How long each listing's link promise lasts, in months (permanent comes
// from LEGAL.permanentGuaranteeMonths).
export const VALIDITY_MONTHS = { '6m': 6, '12m': 12, '24m': 24 };
