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
export const RESTRICTED_TOPICS = [
  { key: 'casino', label: 'Casino & gambling' },
  { key: 'cbd', label: 'CBD & cannabis' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'pharmacy', label: 'Pharmacy' },
  { key: 'sports', label: 'Sports betting & gaming' },
];

export const MAX_NICHES = 6;
export const MAX_LINKS_PER_POST = 5;
export const MAX_SAMPLE_URLS = 3;

export const labelOf = (options, value) => options.find((o) => o.value === value)?.label || value || '';
