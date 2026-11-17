import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import { getTaxonomy } from '@/server/taxonomy';

// The public site frame: header with mega menus, the page, and the footer.
// Used by /sites, /compare and /tools.
export default async function PublicShell({ children }) {
  const taxonomy = await getTaxonomy();
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader taxonomy={taxonomy} />
      <main className="flex-1">{children}</main>
      <SiteFooter taxonomy={taxonomy} />
    </div>
  );
}
