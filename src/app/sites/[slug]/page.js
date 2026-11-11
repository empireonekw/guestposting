import { notFound } from 'next/navigation';
import SitesPage from '@/components/site/SitesPage';
import SiteDetail from '@/components/site/SiteDetail';
import { SITE_LIST_BY_SLUG } from '@/data/siteLists';
import connectDB from '@/server/db';
import Listing from '@/server/models/Listing';
import Review from '@/server/models/Review';
import { getTaxonomy } from '@/server/taxonomy';
import { PUBLIC_FIELDS, toPlain, hiddenSellerIds } from '@/server/listingSearch';

export const dynamic = 'force-dynamic';

// /sites/<list> shows a ready-made list (google-news, casino …);
// /sites/<domain> shows one website. Domains always contain a dot.
const isDomain = (slug) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(slug);

// Every live offer for a domain: verified sellers first, then cheapest.
const loadSite = async (domain) => {
  await connectDB();
  const suspended = await hiddenSellerIds();
  const rows = await Listing.find({
    domain: domain.toLowerCase(),
    status: 'approved',
    isDeleted: { $ne: true },
    ...(suspended.length ? { seller: { $nin: suspended } } : {}),
  })
    .select(PUBLIC_FIELDS)
    .populate('seller', 'name')
    .sort({ isVerified: -1, price: 1 })
    .lean();
  if (!rows.length) return null;
  const [main, ...others] = toPlain(rows);
  const stats = await Review.aggregate([
    { $match: { seller: rows[0].seller._id } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return { main, others, rating: { avg: stats[0]?.avg || 0, count: stats[0]?.count || 0 } };
};

export async function generateMetadata({ params }) {
  const { slug } = await params;
  if (isDomain(slug)) {
    const site = await loadSite(slug).catch(() => null);
    if (!site) return {};
    const l = site.main;
    return {
      title: `${l.domain}: guest post and link insertion`,
      description: `Buy a guest post on ${l.domain}. DR ${l.dr || '–'}, DA ${l.da || '–'}, ${l.traffic?.toLocaleString() || 0} monthly organic visitors.`,
      alternates: { canonical: `/sites/${l.domain}` },
    };
  }
  const list = SITE_LIST_BY_SLUG[slug];
  if (!list) return {};
  return { title: list.title, description: list.description, alternates: { canonical: `/sites/${slug}` } };
}

export default async function Page({ params, searchParams }) {
  const { slug } = await params;

  if (isDomain(slug)) {
    const [site, taxonomy] = await Promise.all([loadSite(slug), getTaxonomy()]);
    if (!site) notFound();
    return <SiteDetail listing={site.main} others={site.others} rating={site.rating} taxonomy={taxonomy} />;
  }

  const list = SITE_LIST_BY_SLUG[slug];
  if (!list) notFound();
  return (
    <SitesPage
      searchParams={searchParams}
      fixed={list.params}
      basePath={`/sites/${slug}`}
      title={list.title}
      intro={list.description}
      crumbs={[{ label: list.menuTitle }]}
    />
  );
}
