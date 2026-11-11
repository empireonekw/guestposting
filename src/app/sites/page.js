import SitesPage from '@/components/site/SitesPage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Guest posting sites list: all publishers',
  description: 'Browse every publisher on LetRank. Filter by niche, country, language, DR, DA, traffic, price and link type.',
  alternates: { canonical: '/sites' },
};

export default function Page({ searchParams }) {
  return (
    <SitesPage
      searchParams={searchParams}
      basePath="/sites"
      title="All publishers"
      intro="Every website on LetRank, reviewed by our team. Filter by niche, country, authority, traffic and price, then order a guest post or link insertion."
    />
  );
}
