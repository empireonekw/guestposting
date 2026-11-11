// Ready-made lists at /sites/<slug>. Each one is the publisher list with some
// filters fixed, plus its own title and description for search engines.

export const SITE_LISTS = [
  {
    slug: 'premium',
    icon: 'star',
    title: 'Premium guest posting sites',
    menuTitle: 'Premium sites (DR 70+)',
    description: 'Top-tier publishers with Ahrefs DR 70 or higher and real organic traffic.',
    params: { minDR: '70' },
  },
  {
    slug: 'organic-traffic',
    icon: 'trending',
    title: 'Guest posting sites with organic traffic',
    menuTitle: 'Sites with 5K+ organic traffic',
    description: 'Publishers with at least 5,000 monthly organic visitors according to Ahrefs.',
    params: { minTraffic: '5000' },
  },
  {
    slug: 'organic-keywords',
    icon: 'search',
    title: 'Sites ranking for 100+ organic keywords',
    menuTitle: '100+ organic keywords',
    description: 'Publishers that rank for at least 100 organic keywords.',
    params: { minKeywords: '100' },
  },
  {
    slug: 'link-insertion',
    icon: 'link',
    title: 'Link insertion (niche edit) sites',
    menuTitle: 'Link insertions (niche edits)',
    description: 'Add your link to an existing, already-indexed article on these publishers.',
    params: { linkInsertion: 'yes' },
  },
  {
    slug: 'google-news',
    icon: 'newspaper',
    title: 'Google News approved sites',
    menuTitle: 'Google News sites',
    description: 'Publishers that are included in Google News.',
    params: { gnews: 'yes' },
  },
  {
    slug: 'casino',
    icon: 'dice',
    title: 'Sites that accept casino and gambling posts',
    menuTitle: 'Casino & gambling',
    description: 'Publishers that accept casino, betting and gambling content.',
    params: { casino: 'yes' },
  },
  {
    slug: 'cbd',
    icon: 'leaf',
    title: 'Sites that accept CBD and cannabis posts',
    menuTitle: 'CBD & cannabis',
    description: 'Publishers that accept CBD, THC, vaping and cannabis content.',
    params: { cbd: 'yes' },
  },
  {
    slug: 'crypto',
    icon: 'bitcoin',
    title: 'Sites that accept crypto guest posts',
    menuTitle: 'Crypto guest posts',
    description: 'Publishers that accept crypto, blockchain and Web3 content.',
    params: { crypto: 'yes' },
  },
  {
    slug: 'sitewide',
    icon: 'layout',
    title: 'Sites offering sidebar, footer and blogroll links',
    menuTitle: 'Sidebar / footer / blogroll',
    description: 'Publishers that sell site-wide links in the sidebar, footer or blogroll.',
    params: { sitewide: 'yes' },
  },
  {
    slug: 'fast-turnaround',
    icon: 'zap',
    title: 'Fast publishing (within 1 day)',
    menuTitle: 'Published within 1 day',
    description: 'Publishers that usually publish your article within one day.',
    params: { maxTat: '1' },
  },
];

export const SITE_LIST_BY_SLUG = Object.fromEntries(SITE_LISTS.map((l) => [l.slug, l]));
