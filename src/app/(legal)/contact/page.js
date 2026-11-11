import Link from 'next/link';
import { Mail, MessageSquare, Building2, Clock } from 'lucide-react';
import Contact from '@/components/landing/Contact';
import LEGAL, { POLICIES } from '@/data/legal';
import BRAND from '@/data/brand';

export const metadata = {
  title: 'Contact',
  description: `How to reach the ${BRAND.name} team: email, support chat and business details.`,
  alternates: { canonical: '/contact' },
};

const Card = ({ icon: Icon, title, children }) => (
  <div className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={20} /></div>
    <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
    <div className="mt-1 text-[14px] leading-relaxed text-ink-soft">{children}</div>
  </div>
);

export default function Page() {
  return (
    <>
      <div className="bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-brand-700">Contact</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Talk to the {BRAND.name} team</h1>
          <p className="mt-3 max-w-2xl text-[15px] text-ink-soft">
            Questions about an order, a refund, selling on your sites or payouts? We read every message.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card icon={Mail} title="Email">
              <a href={`mailto:${LEGAL.email}`} className="font-medium text-brand-700 hover:underline">{LEGAL.email}</a>
            </Card>
            <Card icon={MessageSquare} title="Support chat">
              Signed in? Open <Link href="/messages" className="font-medium text-brand-700 hover:underline">Messages</Link> and start a chat with {BRAND.supportName}.
            </Card>
            <Card icon={Clock} title="Response time">
              We aim to reply within 12 hours, and always within 1 business day. Refund and dispute requests are handled as set out in our <Link href="/refund-policy" className="font-medium text-brand-700 hover:underline">Refund Policy</Link>.
            </Card>
            <Card icon={Building2} title="Business details">
              <span className="block font-medium text-ink">{LEGAL.entity}</span>
              {LEGAL.address.map((line) => <span key={line} className="block">{line}</span>)}
              {LEGAL.registrationNumber && <span className="block">Reg. no. {LEGAL.registrationNumber}</span>}
            </Card>
          </div>

          <nav aria-label="Policies" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
            {POLICIES.filter((p) => p.href !== '/contact').map((p) => (
              <Link key={p.href} href={p.href} className="font-medium text-ink-soft hover:text-brand-700">{p.title}</Link>
            ))}
          </nav>
        </div>
      </div>
      <Contact />
    </>
  );
}
