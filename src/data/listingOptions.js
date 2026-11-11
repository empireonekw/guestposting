// Choices for the listing fields, shared by the seller form, the filters and
// the server's validation so they can never disagree.

export const LINK_TYPES = [
  { value: 'dofollow', label: 'Dofollow' },
  { value: 'nofollow', label: 'Nofollow' },
];

export const LINK_VALIDITY = [
  { value: 'permanent', label: 'Permanent' },
  { value: '24m', label: '2 years' },
  { value: '12m', label: '1 year' },
  { value: '6m', label: '6 months' },
];

// Restricted topics a publisher may accept. `key` is the field under
// listing.allowed and the URL filter name.
export const ALL_RESTRICTED_TOPICS = [
  { key: 'casino', label: 'Casino & gambling' },
  { key: 'cbd', label: 'CBD & cannabis' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'pharmacy', label: 'Pharmacy' },
  { key: 'sports', label: 'Sports betting & gaming' },
];

// Topics and niches our payment provider (Stripe) doesn't allow: gambling,
// betting and CBD. They are hidden from every form, filter, menu and list,
// and the server refuses them. The data stays in the database, so removing
// an entry here brings it back. Keep /terms in line with this list.
export const BLOCKED_TOPICS = ['casino', 'cbd', 'sports'];
export const BLOCKED_NICHES = ['casino-gambling', 'cbd-cannabis', 'betting-fantasy-sports'];
export const BLOCKED_REASON = 'Gambling, betting and CBD can\u2019t be sold here because our payment provider doesn\u2019t support them.';

// The topics sellers can choose and buyers can filter by.
export const RESTRICTED_TOPICS = ALL_RESTRICTED_TOPICS.filter((t) => !BLOCKED_TOPICS.includes(t.key));

export const MAX_NICHES = 6;
export const MAX_LINKS_PER_POST = 5;
export const MAX_SAMPLE_URLS = 3;

export const labelOf = (options, value) => options.find((o) => o.value === value)?.label || value || '';
