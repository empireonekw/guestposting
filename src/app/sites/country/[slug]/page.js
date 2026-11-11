import { notFound } from 'next/navigation';
import SitesPage from '@/components/site/SitesPage';
import Flag from '@/components/ui/Flag';
import { getTaxonomy } from '@/server/taxonomy';

export const dynamic = 'force-dynamic';

const findCountry = async (slug) => {
  const taxonomy = await getTaxonomy();
  return taxonomy.countries.find((c) => c.slug === slug) || null;
};

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const country = await findCountry(slug);
  if (!country) return {};
  return {
    title: `${country.name} guest posting sites`,
    description: `Guest posting sites with traffic from ${country.name}. Filter by niche, DR, DA, traffic and price.`,
    alternates: { canonical: `/sites/country/${slug}` },
  };
}

export default async function Page({ params, searchParams }) {
  const { slug } = await params;
  const country = await findCountry(slug);
  if (!country) notFound();
  return (
    <SitesPage
      searchParams={searchParams}
      fixed={{ country: country.code }}
      basePath={`/sites/country/${slug}`}
      title={(
        <span className="inline-flex items-center gap-3">
          <Flag code={country.code} name={country.name} className="!w-9 !h-7 sm:!w-10" />
          {country.name} guest posting sites
        </span>
      )}
      intro={`Publishers based in ${country.name} or getting a large share of their traffic from it.`}
      crumbs={[{ label: 'Countries', href: '/sites/country' }, { label: country.name }]}
    />
  );
}
