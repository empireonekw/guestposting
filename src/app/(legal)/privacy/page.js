import LegalPage, { P, List, A, Mail } from '@/components/legal/LegalPage';
import LEGAL from '@/data/legal';
import BRAND from '@/data/brand';

export const metadata = {
  title: 'Privacy Policy',
  description: `What personal data ${BRAND.name} collects, why, who we share it with, and your rights.`,
  alternates: { canonical: '/privacy' },
};

const Table = ({ rows }) => (
  <div className="mb-4 overflow-x-auto rounded-xl border border-line">
    <table className="w-full min-w-[520px] text-left text-[14px]">
      <thead className="bg-canvas text-[12px] uppercase tracking-wider text-ink-faint">
        <tr><th className="px-4 py-2.5 font-semibold">Provider</th><th className="px-4 py-2.5 font-semibold">What they do</th><th className="px-4 py-2.5 font-semibold">Data</th></tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map(([who, what, data]) => (
          <tr key={who}><td className="px-4 py-2.5 font-medium text-ink">{who}</td><td className="px-4 py-2.5">{what}</td><td className="px-4 py-2.5">{data}</td></tr>
        ))}
      </tbody>
    </table>
  </div>
);

const sections = [
  {
    id: 'who',
    title: 'Who we are',
    body: (
      <P>
        {LEGAL.entity}{LEGAL.address.length ? `, ${LEGAL.address.join(', ')}` : ''} runs {BRAND.name} ({LEGAL.website}) and is responsible for your
        personal data (the &ldquo;controller&rdquo;). For any privacy question or request, email <Mail to={LEGAL.privacyEmail} />.
      </P>
    ),
  },
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <>
        <P><strong className="text-ink">What you give us</strong></P>
        <List
          items={[
            'Account details: your name, email address, password (stored only as a secure hash) and whether you buy or sell.',
            'Seller details: the websites you list, their prices and metrics, and the proof that you own a domain (a DNS record or meta tag we check).',
            'Orders: target URLs, anchor text, articles, briefs, live links and reviews.',
            'Messages you send in the site’s chat, and messages sent through our contact form.',
            'Payout details for sellers. Identity and bank details for payouts are given directly to Stripe, not to us.',
          ]}
        />
        <P><strong className="text-ink">What is collected automatically</strong></P>
        <List
          items={[
            'Your IP address, used briefly in memory to stop password guessing and spam (rate limits). We don’t store it with your account.',
            'Basic request logs (page or API address, time, response status and speed), kept for a short time to run and secure the site.',
            'A count of visitors over the last 15 minutes, made from a scrambled one-way code of your IP address and browser that is thrown away after 15 minutes.',
          ]}
        />
        <P><strong className="text-ink">Payments</strong></P>
        <P>
          Card payments are handled by Stripe. We receive the payment result and limited card details (such as the card brand, last four digits and country),
          never your full card number.
        </P>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How we use it, and why we may',
    body: (
      <List
        items={[
          <><strong>To provide the marketplace</strong> (accounts, listings, orders, payments, payouts, messages): needed to perform our contract with you.</>,
          <><strong>To keep the site safe</strong> (fraud checks, rate limits, reviewing listings and metrics, settling disputes, reading chats when needed): our legitimate interest in a safe marketplace.</>,
          <><strong>To send service emails</strong> (password codes, order updates, listing decisions, receipts): needed to perform our contract.</>,
          <><strong>To meet legal duties</strong> such as tax, accounting and answering lawful requests: legal obligation.</>,
          <><strong>To improve the site</strong> using totals and trends, not individual tracking: legitimate interest.</>,
        ]}
      />
    ),
  },
  {
    id: 'visible',
    title: 'What other users can see',
    body: (
      <List
        items={[
          'Buyers see a seller’s name, their listed websites, ratings and reviews. Seller email addresses are not shown to buyers.',
          'When you order, the seller sees your name and the order details (brief, target URL, anchor text, article).',
          'Reviews you leave are public, with your name.',
          'Our support team can read conversations between buyers and sellers to keep the marketplace safe and to settle disputes.',
        ]}
      />
    ),
  },
  {
    id: 'share',
    title: 'Who we share it with',
    body: (
      <>
        <P>We don&rsquo;t sell your personal data, and we don&rsquo;t use it for advertising. We use these service providers, who may only use it to provide their service to us:</P>
        <Table
          rows={[
            ['Stripe', 'Card payments, refunds, seller identity checks and payouts', 'Payment, identity and bank details; order amounts'],
            ['MongoDB Atlas', 'Database hosting', 'All account, listing, order and message data'],
            ['Cloudflare', 'Network security and delivery', 'IP address, request data'],
            ['Google (Gmail)', 'Sending our emails', 'Your email address and the email content'],
            ['Our hosting provider', 'Runs the website server', 'Request logs'],
          ]}
        />
        <P>
          We may also share data when the law requires it, to protect our users or our rights, or with a buyer of our business, who would have to keep
          this policy.
        </P>
      </>
    ),
  },
  {
    id: 'transfers',
    title: 'International transfers',
    body: (
      <P>
        Our providers may process data in the United States and other countries. Where data leaves the UK or the European Economic Area, we rely on safeguards
        such as the European Commission&rsquo;s Standard Contractual Clauses that these providers offer.
      </P>
    ),
  },
  {
    id: 'storage',
    title: 'Cookies and browser storage',
    body: (
      <>
        <P>We don&rsquo;t use advertising or analytics cookies. The site stores two things in your browser:</P>
        <List
          items={[
            <><code>userInfo</code>: keeps you signed in. It is removed when you sign out.</>,
            <><code>sidebarCollapsed</code>: remembers whether you folded the dashboard menu.</>,
          ]}
        />
        <P>Cloudflare may set strictly necessary security cookies, and Stripe sets its own cookies on its payment pages to prevent fraud.</P>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <List
        items={[
          'Account, listing and message data: while your account is open. When you close it, we delete or anonymise it within 30 days.',
          `Order, payment and payout records: ${LEGAL.dataRetentionYears} years, because tax and accounting law requires it.`,
          'Password reset codes: 10 minutes. Rate-limit and visitor counts: minutes, in memory only.',
          'Server logs: only as long as needed to run and secure the site, normally a few weeks.',
        ]}
      />
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <P>
        Passwords are stored as secure hashes, connections use HTTPS, reset codes are single-use and short-lived, and only our team can open the admin tools.
        No system is perfectly secure; if a breach affects you, we will tell you and the authorities as the law requires.
      </P>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <P>Depending on where you live (for example under the GDPR, the UK GDPR or California law) you can ask us to:</P>
        <List
          items={[
            'give you a copy of your data, or send it to another service;',
            'correct it, or delete it (we keep what the law makes us keep);',
            'stop or limit some uses, or object to them;',
            'tell you what we share and with whom.',
          ]}
        />
        <P>
          Email <Mail to={LEGAL.privacyEmail} /> from the address on your account. We answer within 30 days and don&rsquo;t charge for it. You can also complain to
          your local data protection authority.
        </P>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: <P>{BRAND.name} is for businesses and adults. It is not meant for anyone under 18, and we don&rsquo;t knowingly collect their data.</P>,
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <P>
        If we change this policy, we update the date at the top. For important changes we tell account holders by email or in the app. See also our
        {' '}<A href="/terms">Terms of Service</A>.
      </P>
    ),
  },
];

export default function Page() {
  return (
    <LegalPage
      path="/privacy"
      title="Privacy Policy"
      intro={`What personal data ${BRAND.name} collects, why we need it, who we share it with, and the choices you have.`}
      sections={sections}
    />
  );
}
