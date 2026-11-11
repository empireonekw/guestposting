import HomePage from '@/components/home/HomePage';
import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import connectDB from '@/server/db';
import Listing from '@/server/models/Listing';
import { getTaxonomy } from '@/server/taxonomy';
import { countByNicheAndCountry } from '@/server/listingSearch';

export const dynamic = 'force-dynamic';

export const metadata = {
  alternates: { canonical: '/' },
};

// Live numbers for the hero and the browse sections. The page still renders
// (with zeros) if the database can't be reached.
const loadCounts = async () => {
  try {
    await connectDB();
    const [counts, sites] = await Promise.all([
      countByNicheAndCountry(),
      Listing.countDocuments({ status: 'approved', isDeleted: { $ne: true } }),
    ]);
    return { counts, sites };
  } catch (error) {
    console.error('Home page counts:', error.message);
    return { counts: { niches: {}, countries: {} }, sites: 0 };
  }
};

export default async function Page() {
  const [taxonomy, { counts, sites }] = await Promise.all([getTaxonomy(), loadCounts()]);
  const stats = { sites, countries: taxonomy.countries.length, niches: taxonomy.niches.length };
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader taxonomy={taxonomy} />
      <main className="flex-1">
        <HomePage taxonomy={taxonomy} counts={counts} stats={stats} />
      </main>
      <SiteFooter taxonomy={taxonomy} />
    </div>
  );
}
