import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import DomainChecker from '@/components/buying/DomainChecker';
import BRAND from '@/data/brand';

export const metadata = {
  title: 'Bulk domain checker: which sites sell guest posts',
  description: `Paste up to 500 domains and see which ones sell guest posts on ${BRAND.name}, with price, DR, DA and traffic.`,
  alternates: { canonical: '/tools/domain-checker' },
};

// Free tool (Module 6): paste domains, see which are on the marketplace.
export default function Page() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-[13px] text-ink-faint">
        <Link href="/" className="hover:text-ink">Home</Link>
        <ChevronRight size={12} />
        <span className="text-ink-soft">Bulk domain checker</span>
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Bulk domain checker</h1>
      <p className="mt-2 max-w-3xl text-[15px] text-ink-soft">
        Paste a list of websites, for example a competitor&rsquo;s backlinks or your wish list, and see which ones you can buy a guest post on here, from what price.
      </p>
      <div className="mt-6">
        <DomainChecker />
      </div>
    </div>
  );
}
