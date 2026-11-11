import LegalPage, { P, List, A, Mail } from '@/components/legal/LegalPage';
import LEGAL from '@/data/legal';
import BRAND from '@/data/brand';

export const metadata = {
  title: 'Terms of Service',
  description: `The rules for using ${BRAND.name}: accounts, ordering guest posts, payments, content rules and disputes.`,
  alternates: { canonical: '/terms' },
};

const us = LEGAL.entity;

const sections = [
  {
    id: 'about',
    title: 'About these terms',
    body: (
      <>
        <P>
          {BRAND.name} ({LEGAL.website}) is operated by {us}{LEGAL.registrationNumber ? `, registration number ${LEGAL.registrationNumber}` : ''}
          {' '}(&ldquo;{BRAND.name}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). These Terms of Service are an agreement between you and us. They apply
          when you visit the site, create an account, buy, or sell.
        </P>
        <P>
          These documents also form part of the agreement: our <A href="/privacy">Privacy Policy</A>, our <A href="/refund-policy">Refund &amp; Cancellation Policy</A> and,
          if you sell on {BRAND.name}, our <A href="/seller-terms">Seller &amp; Payout Terms</A>. By creating an account or placing an order you accept them.
          If you don&rsquo;t agree, please don&rsquo;t use the site.
        </P>
      </>
    ),
  },
  {
    id: 'service',
    title: 'What we do',
    body: (
      <>
        <P>
          {BRAND.name} is an online marketplace. Buyers (usually businesses, marketers and agencies) order sponsored articles, called guest posts,
          and link insertions on websites owned by independent publishers (&ldquo;sellers&rdquo;). We provide the listing, search, ordering, messaging
          and payment tools, and we review listings before they go live.
        </P>
        <List
          items={[
            'Each order is an agreement between the buyer and the seller. The seller writes or publishes the content on their own website; we do not own or run those websites.',
            'Sellers are independent businesses, not our employees or agents.',
            'Our team checks the numbers shown on listings (such as Domain Rating, traffic and spam score) and dates each check. These numbers come from third-party tools, change over time and are estimates.',
            'We do not promise any search ranking, traffic, sales or other result from a guest post or link.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Your account',
    body: (
      <List
        items={[
          'You must be at least 18 and able to enter a binding contract. If you use the site for a company, you confirm you may accept these terms for it.',
          'Give accurate details and keep them up to date. One person or business may hold one buyer account and one seller account.',
          'Keep your password safe. You are responsible for what happens under your account; tell us at once if you think someone else has used it.',
          'Sellers must be approved by our team before their websites are shown to buyers.',
        ]}
      />
    ),
  },
  {
    id: 'ordering',
    title: 'Ordering a guest post',
    body: (
      <>
        <P>Each listing shows its price, link type (dofollow or nofollow), how long the link stays live, the usual turnaround and the seller&rsquo;s content rules. An order works like this:</P>
        <List
          items={[
            <><strong>You order and pay.</strong> The price shown when you order is the price you pay.</>,
            <><strong>The seller accepts or declines</strong> within {LEGAL.sellerAcceptHours} hours. If they decline or don&rsquo;t answer, you get a full refund.</>,
            <><strong>You send the brief:</strong> your article (or topic), target URL and anchor text. The seller may turn down content that breaks their rules or ours.</>,
            <><strong>The seller publishes</strong> the post and sends you the live URL. Where the seller writes the article, you can review the draft first and ask for up to {LEGAL.revisionRounds} rounds of changes.</>,
            <><strong>You check the live post.</strong> If it matches the order, approve it. If you don&rsquo;t approve it or raise a problem within {LEGAL.autoApproveDays} days, the order is approved automatically.</>,
            <><strong>The order is complete</strong> and the seller is paid. The link is then covered by the guarantee described in our <A href="/refund-policy">Refund Policy</A>.</>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'payments',
    title: 'Prices and payments',
    body: (
      <List
        items={[
          'Prices are in US dollars. Your bank may charge its own fees for currency conversion.',
          'Payments are processed by Stripe. We never see or store your full card number.',
          'When you pay, the money is not sent to the seller straight away. It is held until the order is complete, and refunded to you if the order is cancelled or a dispute is decided in your favour.',
          'You receive a receipt by email for every payment. Prices on listings may change, but never for an order you have already paid for.',
          'Where sales tax or VAT applies, it is shown before you pay.',
          'Keep payments for orders on the platform. Paying a seller outside the site removes your refund and dispute protection, and breaks these terms.',
        ]}
      />
    ),
  },
  {
    id: 'content',
    title: 'Content and link rules',
    body: (
      <>
        <P>Buyers are responsible for the content, links and anchor text they supply, and confirm they have the right to publish them. You must not order content that:</P>
        <List
          items={[
            'is illegal where it is published or read, or promotes illegal goods or services;',
            'infringes anyone’s copyright, trademark or other rights, or copies other people’s work;',
            'is sexually explicit, hateful, harassing, violent or defamatory;',
            'contains malware, phishing, or links to sites that do;',
            'makes false or misleading claims, especially about health, medicine or money;',
            'promotes gambling, betting, casinos or CBD products (our payment provider does not support them), or prescription medicines.',
          ]}
        />
        <P>
          Some listings accept sensitive topics such as crypto. Those orders are only allowed where the topic is legal for both the buyer and the seller,
          and the content must not offer investment advice or promise returns. We may remove content or cancel and refund orders that break these rules.
        </P>
      </>
    ),
  },
  {
    id: 'sponsored',
    title: 'Sponsored links and search engines',
    body: (
      <>
        <P>
          Guest posts on {BRAND.name} are paid placements. Publishers may label them as sponsored or add attributes such as <code>rel=&quot;sponsored&quot;</code>
          {' '}where the listing says so, and must follow the advertising-disclosure laws that apply to them.
        </P>
        <P>
          Search engines have their own rules about paid links. You decide whether and how to use guest posts, and you accept that a search engine may ignore
          or penalise links. We are not responsible for changes in rankings or traffic.
        </P>
      </>
    ),
  },
  {
    id: 'messages',
    title: 'Messages and reviews',
    body: (
      <List
        items={[
          'Use the site’s messages to talk about orders. Don’t use them for spam, or to move orders or payments off the platform.',
          'To keep the marketplace safe and to settle disputes, our support team can read conversations between buyers and sellers.',
          'After an order is complete, the buyer can leave one honest review. Fake reviews, paid reviews and reviews in exchange for refunds are not allowed.',
        ]}
      />
    ),
  },
  {
    id: 'fees',
    title: 'Our fees',
    body: (
      <P>
        Buyers pay the price shown on the listing; we don&rsquo;t add a hidden buyer fee. If we ever add a service fee, it will be shown before you pay.
        We earn a commission from each completed sale, which sellers agree to in the <A href="/seller-terms">Seller &amp; Payout Terms</A>.
      </P>
    ),
  },
  {
    id: 'refunds',
    title: 'Cancellations, refunds and disputes',
    body: (
      <P>
        When you can cancel, what is refunded and how disputes are decided is set out in our <A href="/refund-policy">Refund &amp; Cancellation Policy</A>.
        If something goes wrong, please contact us before you ask your bank for a chargeback, so we can fix it faster.
      </P>
    ),
  },
  {
    id: 'ip',
    title: 'Intellectual property',
    body: (
      <List
        items={[
          `The ${BRAND.name} site, name, logo and software belong to us. You may not copy, scrape or resell them.`,
          'You keep ownership of the content you supply. You give the seller permission to publish it on the ordered website, and you give us permission to store and show it as needed to run the order.',
          'Where a seller writes the article, the buyer may use it as part of the order once the order is paid.',
        ]}
      />
    ),
  },
  {
    id: 'not-allowed',
    title: 'What you must not do',
    body: (
      <List
        items={[
          'break the law, or these terms, using the site;',
          'give false information, impersonate someone, or open accounts to get around a suspension;',
          'scrape the site, overload it, probe it for weaknesses, or get around its security or rate limits;',
          'avoid our fees by arranging orders or payments outside the platform with someone you met here;',
          'file chargebacks for orders that were delivered as described, or abuse refunds.',
        ]}
      />
    ),
  },
  {
    id: 'termination',
    title: 'Suspension and closing your account',
    body: (
      <>
        <P>
          You can close your account at any time by contacting us; open orders must be finished or cancelled first. We may suspend or close an account,
          or remove a listing, if it breaks these terms, if we suspect fraud, or if the law or our payment provider requires it. Where we can, we will
          tell you why.
        </P>
        <P>Paid orders that are still open when an account is closed are completed or refunded under our Refund Policy.</P>
      </>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers',
    body: (
      <P>
        We work hard to keep the site accurate and available, but we provide it &ldquo;as is&rdquo;. We don&rsquo;t guarantee that it will always be available or
        error-free, that listing metrics are exact, or that a seller will keep a website online. Nothing in these terms limits rights you have under consumer
        law that cannot be limited.
      </P>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: (
      <P>
        As far as the law allows, we are not liable for indirect or consequential losses, such as lost profits, lost rankings or lost data. Our total
        liability to you for any claim is limited to the amount you paid us, or that we paid you, for the order the claim is about, or if there is no
        order, the fees you paid us in the 12 months before the claim. We do not exclude liability for fraud, or for anything else that cannot be
        excluded by law.
      </P>
    ),
  },
  {
    id: 'indemnity',
    title: 'Your responsibility for claims',
    body: (
      <P>
        If someone makes a claim against us because of content you supplied, a website you listed, or your breach of these terms or the law, you agree to
        cover our reasonable costs of dealing with it.
      </P>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <P>
        {LEGAL.governingLaw
          ? <>These terms are governed by the laws of {LEGAL.governingLaw}, and its courts can decide disputes about them.</>
          : <>These terms are governed by the laws of the country where {us} is registered, and its courts can decide disputes about them.</>}
        {' '}If you are a consumer, you also keep the protection of the laws of the country you live in. Before going to court, please contact us so we
        can try to settle the issue.
      </P>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <P>
        We may update these terms as the site changes. We will show the new date at the top of this page and, for important changes, tell account holders
        by email or in the app at least 14 days before they apply. Orders already placed stay under the terms that applied when they were placed.
      </P>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <P>
        {us}{LEGAL.address.length ? `, ${LEGAL.address.join(', ')}` : ''}. Email <Mail />.
      </P>
    ),
  },
];

export default function Page() {
  return (
    <LegalPage
      path="/terms"
      title="Terms of Service"
      intro={`The rules for buying and selling on ${BRAND.name}, written to be read. Please take a few minutes to go through them.`}
      sections={sections}
    />
  );
}
