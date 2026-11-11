import { notFound } from 'next/navigation';
import SitesPage from '@/components/site/SitesPage';
import { SITE_LIST_BY_SLUG } from '@/data/siteLists';

export const dynamic = 'force-dynamic';

// Quick lists such as /sites/google-news. (Later, /sites/<domain> will show a
// single site; domains contain a dot, list slugs never do.)
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const list = SITE_LIST_BY_SLUG[slug];
  if (!list) return {};
  return { title: list.title, description: list.description, alternates: { canonical: `/sites/${slug}` } };
}

export default async function Page({ params, searchParams }) {
  const { slug } = await params;
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
