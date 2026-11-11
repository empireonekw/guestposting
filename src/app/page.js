import LandingPage from '@/components/landing/LandingPage';
import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import { getTaxonomy } from '@/server/taxonomy';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const taxonomy = await getTaxonomy();
  return (
    <>
      <SiteHeader taxonomy={taxonomy} />
      <LandingPage />
      <SiteFooter taxonomy={taxonomy} />
    </>
  );
}
