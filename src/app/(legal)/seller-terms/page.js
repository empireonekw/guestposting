import LegalPage, { P, List, A, Mail } from '@/components/legal/LegalPage';
import LEGAL from '@/data/legal';
import BRAND from '@/data/brand';

export const metadata = {
  title: 'Seller & Payout Terms',
  description: `The rules for publishers selling guest posts on ${BRAND.name}: listings, orders, the link guarantee, commission and payouts through Stripe.`,
  alternates: { canonical: '/seller-terms' },
};

const sections = [
  {
    id: 'scope',
    title: 'About these terms',
    body: (
      <P>
        These terms apply if you list websites on {BRAND.name} as a seller (publisher). They add to our <A href="/terms">Terms of Service</A>, which also apply
        to you. By applying to sell, adding a website or accepting an order, you agree to both.
      </P>
    ),
  },
  {
    id: 'approval',
    title: 'Becoming a seller',
    body: (
      <List
        items={[
          'Our team reviews every new seller before their websites are shown to buyers. We may ask for more information, and may decline an application.',
          'You may only list websites you own or are authorised to publish on. We may ask you to prove ownership with a DNS record or a meta tag; verified websites get a Verified badge.',
          'You must be at least 18, and able to receive payouts through Stripe in your country (see section 7).',
        ]}
      />
    ),
  },
  {
    id: 'listings',
    title: 'Your listings',
    body: (
      <>
        <List
          items={[
            'Describe each website honestly: niches, language, country, link type, how long links stay live, links per post, whether posts are marked sponsored, turnaround and price.',
            'Our team checks each site’s metrics (such as DR, DA, traffic and spam score) and shows the dated result to buyers. Once we have checked a site, the numbers you type are kept for comparison only.',
            'Every new listing and every edit is reviewed before it goes live. We may approve it, ask you for changes, or reject it with a reason.',
            'Listings for link farms, private blog networks, hacked or expired-and-rebuilt sites with copied content, or sites with fake traffic will be rejected or removed.',
          ]}
        />
        <P>Prices are in US dollars and are the full price the buyer pays. Don&rsquo;t charge buyers extra for anything the listing already includes.</P>
      </>
    ),
  },
  {
    id: 'orders',
    title: 'Handling orders',
    body: (
      <List
        items={[
          'New orders come with everything you need: the article (or the topic to write about), target URL and anchor text. If you can\u2019t take an order, decline it straight away so the buyer is refunded.',
          'Publish within the turnaround on your listing, or agree a new date with the buyer in the order chat.',
          'Publish on the website ordered, with the link type, target URL and anchor text the buyer gave, and keep the post visible to visitors and search engines unless your listing says otherwise.',
          `If you write the article, offer the buyer up to ${LEGAL.revisionRounds} rounds of reasonable changes.`,
          'You may decline content that breaks your content rules or our Terms of Service. Tell the buyer why in the order chat.',
          'Keep all communication and payment for orders on the platform. Asking a buyer to pay you outside the site leads to removal from the marketplace.',
        ]}
      />
    ),
  },
  {
    id: 'guarantee',
    title: 'Keeping links live',
    body: (
      <>
        <P>
          You promise to keep each link live for the period on your listing (6 months, 1 year, 2 years, or {LEGAL.permanentGuaranteeMonths} months for
          &ldquo;permanent&rdquo;). That means you don&rsquo;t remove it, change it to nofollow, or take the page offline.
        </P>
        <P>
          If a buyer reports a removed link, you have {LEGAL.linkFixDays} days to restore it. If you don&rsquo;t, the buyer gets a replacement or refund under our
          {' '}<A href="/refund-policy">Refund Policy</A>, and the refunded amount is taken from your balance or future earnings.
        </P>
      </>
    ),
  },
  {
    id: 'fees',
    title: 'Commission',
    body: (
      <P>
        {LEGAL.commissionPercent !== null && LEGAL.commissionPercent !== undefined
          ? <>We keep a commission of {LEGAL.commissionPercent}% of the order price on each completed order. </>
          : <>We keep a commission on each completed order. The current rate is shown in your seller dashboard before you list a website. </>}
        It covers card processing, payment protection, support and the marketplace itself. You only pay commission on completed orders; nothing is charged
        for listing a website. We will give you at least 30 days&rsquo; notice before changing the rate, and the new rate only applies to orders placed after the
        change.
      </P>
    ),
  },
  {
    id: 'payouts',
    title: 'Payouts',
    body: (
      <>
        <P>Payouts are made through Stripe Connect. To get paid:</P>
        <List
          items={[
            'Connect a Stripe account from your seller dashboard. Stripe will ask for your identity, business and bank details and checks them; we don’t see your full bank details.',
            <>When a buyer pays, the money is held. When the order is complete (the buyer approves it, or {LEGAL.autoApproveDays} days pass after you deliver without a problem being raised), your earnings, minus commission, are added to your balance as <strong>pending</strong>.</>,
            <>Pending earnings become <strong>available</strong> {LEGAL.payoutHoldDays} days later. This short hold covers early problems with the link.</>,
            'Available earnings are paid to your bank account on Stripe’s payout schedule for your country. Stripe may charge payout or currency conversion fees, which it shows when you set up payouts.',
            'You can see every order, commission, refund and payout in your dashboard.',
          ]}
        />
        <P><strong className="text-ink">When payouts can be held or reversed</strong></P>
        <List
          items={[
            'If a buyer opens a dispute, the order’s earnings stay held until it is decided.',
            'If a buyer is refunded after you were paid (for example under the link guarantee), or files a chargeback, the amount is taken from your balance. If your balance is not enough, it is taken from future earnings.',
            'We may hold payouts while we investigate suspected fraud, fake listings or a breach of these terms, or if the law or Stripe requires it.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'stripe',
    title: 'Stripe Connected Account Agreement',
    body: (
      <P>
        Payment processing services for sellers on {BRAND.name} are provided by Stripe and are subject to the
        {' '}<A href="https://stripe.com/connect-account/legal">Stripe Connected Account Agreement</A>, which includes the
        {' '}<A href="https://stripe.com/legal/ssa">Stripe Terms of Service</A> (collectively, the &ldquo;Stripe Services Agreement&rdquo;). By agreeing to these terms
        or continuing to operate as a seller on {BRAND.name}, you agree to be bound by the Stripe Services Agreement, as the same may be modified by Stripe from
        time to time. As a condition of {BRAND.name} enabling payment processing services through Stripe, you agree to provide {BRAND.name} accurate and
        complete information about you and your business, and you authorize {BRAND.name} to share it and transaction information related to your use of the
        payment processing services provided by Stripe.
      </P>
    ),
  },
  {
    id: 'taxes',
    title: 'Taxes',
    body: (
      <P>
        You are responsible for reporting your earnings and paying your own taxes. Stripe or we may need your tax details and may report your earnings to
        tax authorities where the law requires it (for example Form 1099-K in the United States, or DAC7 reporting in the EU).
      </P>
    ),
  },
  {
    id: 'not-allowed',
    title: 'What sellers must not do',
    body: (
      <List
        items={[
          'list websites you don’t control, or give false metrics, traffic or ownership information;',
          'remove or change links you were paid for before the guarantee ends;',
          'take orders off the platform, or contact buyers to avoid commission;',
          'write or buy fake reviews, or pressure buyers about reviews;',
          'publish content that breaks our Terms of Service or the law, including undisclosed advertising where disclosure is required.',
        ]}
      />
    ),
  },
  {
    id: 'ending',
    title: 'Pausing or leaving',
    body: (
      <P>
        You can remove a website at any time once it has no open orders; your guarantees on links already sold continue. If we block or close your seller
        account, open orders are completed or refunded, and your available balance is paid out after any refunds, disputes and chargebacks are settled,
        unless we have found fraud.
      </P>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: <P>Questions about selling or payouts: email <Mail /> or message support from your dashboard.</P>,
  },
];

export default function Page() {
  return (
    <LegalPage
      path="/seller-terms"
      title="Seller & Payout Terms"
      intro={`For publishers selling guest posts on ${BRAND.name}: what we expect from your listings and orders, and how and when you get paid.`}
      sections={sections}
    />
  );
}
