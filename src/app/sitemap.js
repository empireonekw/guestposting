import { getTaxonomy } from '@/server/taxonomy';
import { SITE_LISTS } from '@/data/siteLists';

export const dynamic = 'force-dynamic';

const BASE = (process.env.FRONTEND_URL || 'https://guestposting.live').replace(/\/$/, '');

export default async function sitemap() {
  const taxonomy = await getTaxonomy();
  const page = (path, priority) => ({ url: `${BASE}${path}`, changeFrequency: 'daily', priority });
  return [
    page('/', 1),
    page('/sites', 0.9),
    page('/sites/niche', 0.7),
    page('/sites/country', 0.7),
    ...['/terms', '/privacy', '/refund-policy', '/seller-terms', '/contact'].map((p) => ({ url: `${BASE}${p}`, changeFrequency: 'monthly', priority: 0.3 })),
    ...SITE_LISTS.map((l) => page(`/sites/${l.slug}`, 0.8)),
    ...taxonomy.niches.flatMap((n) => [n, ...n.children]).map((n) => page(`/sites/niche/${n.slug}`, 0.6)),
    ...taxonomy.countries.map((c) => page(`/sites/country/${c.slug}`, 0.6)),
  ];
}
