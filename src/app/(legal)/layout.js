import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import { getTaxonomy } from '@/server/taxonomy';

// Terms, privacy, refunds, seller terms and contact: the public header and
// footer around plain pages. Rebuilt at most once an hour, so the menus pick
// up niche and country changes without a database read on every visit.
export const revalidate = 3600;

export default async function LegalLayout({ children }) {
  const taxonomy = await getTaxonomy();
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader taxonomy={taxonomy} />
      <main className="flex-1">{children}</main>
      <SiteFooter taxonomy={taxonomy} />
    </div>
  );
}
