import Link from 'next/link';
import { notFound } from 'next/navigation';
import SitesPage from '@/components/site/SitesPage';
import { getTaxonomy, nicheIndex } from '@/server/taxonomy';

export const dynamic = 'force-dynamic';

const findNiche = async (slug) => {
  const taxonomy = await getTaxonomy();
  return nicheIndex(taxonomy).get(slug) ? { niche: nicheIndex(taxonomy).get(slug), taxonomy } : null;
};

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const found = await findNiche(slug);
  if (!found) return {};
  const { name } = found.niche;
  return {
    title: `${name} guest posting sites`,
    description: `Buy guest posts and link insertions on ${name.toLowerCase()} websites. Compare DR, DA, traffic and price.`,
    alternates: { canonical: `/sites/niche/${slug}` },
  };
}

export default async function Page({ params, searchParams }) {
  const { slug } = await params;
  const found = await findNiche(slug);
  if (!found) notFound();
  const { niche, taxonomy } = found;
  const parent = niche.parent ? taxonomy.niches.find((n) => n.slug === niche.parent) : null;

  return (
    <SitesPage
      searchParams={searchParams}
      fixed={{ niche: slug }}
      basePath={`/sites/niche/${slug}`}
      title={`${niche.name} guest posting sites`}
      intro={`Websites that publish ${niche.name.toLowerCase()} content${niche.children.length ? ', including all its sub-niches' : ''}. Narrow them down by country, authority, traffic and price.`}
      crumbs={[
        { label: 'Niches', href: '/sites/niche' },
        ...(parent ? [{ label: parent.name, href: `/sites/niche/${parent.slug}` }] : []),
        { label: niche.name },
      ]}
    >
      {niche.children.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {niche.children.map((c) => (
            <Link key={c.slug} href={`/sites/niche/${c.slug}`} className="rounded-full border border-line px-3 py-1 text-[13px] font-medium text-ink-soft hover:border-brand-300 hover:text-brand-700">
              {c.name}
            </Link>
          ))}
        </div>
      )}
    </SitesPage>
  );
}
