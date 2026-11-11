import LegalPage, { P, List, A, Mail } from '@/components/legal/LegalPage';
import LEGAL from '@/data/legal';
import BRAND from '@/data/brand';

export const metadata = {
  title: 'Refund & Cancellation Policy',
  description: `When orders on ${BRAND.name} can be cancelled, what is refunded, the link guarantee and how disputes are decided.`,
  alternates: { canonical: '/refund-policy' },
};

const sections = [
  {
    id: 'summary',
    title: 'In short',
    body: (
      <>
        <P>
          Your payment is held until you have received what you ordered. If the seller can&rsquo;t deliver, you get your money back. After delivery, the link is
          covered by a guarantee: if it disappears, the seller must restore it or you get a replacement or a refund.
        </P>
        <List
          items={[
            'Cancel before the seller accepts: full refund.',
            `Seller declines, or doesn’t answer within ${LEGAL.sellerAcceptHours} hours: full refund.`,
            'Seller can’t publish, or the published post doesn’t match the order and isn’t fixed: full refund.',
            `Link removed during the guarantee period and not restored within ${LEGAL.linkFixDays} days: replacement or refund.`,
          ]}
        />
      </>
    ),
  },
  {
    id: 'before-work',
    title: 'Cancelling before work starts',
    body: (
      <P>
        You can cancel an order for a full refund at any time until the seller accepts it. You also get a full refund if the seller declines the order, doesn&rsquo;t
        accept it within {LEGAL.sellerAcceptHours} hours, or their account or listing is removed before they deliver.
      </P>
    ),
  },
  {
    id: 'during-work',
    title: 'Cancelling while the order is in progress',
    body: (
      <>
        <P>Once the seller has accepted and you have sent your brief, the seller has started work. You can still cancel for a full refund if:</P>
        <List
          items={[
            'the seller hasn’t delivered within the turnaround shown on the listing plus 3 days, and hasn’t agreed a new date with you in the order chat;',
            `the seller wrote the article and it still doesn’t follow your brief after ${LEGAL.revisionRounds} rounds of changes;`,
            'the seller asks for more money than the order price, or asks you to pay outside the site.',
          ]}
        />
        <P>
          If you simply change your mind after the seller has written an article for you, we may refund the order minus the seller&rsquo;s fair writing
          cost, agreed with you through support. If you supplied the article yourself and it hasn&rsquo;t been published yet, you get a full refund.
        </P>
      </>
    ),
  },
  {
    id: 'after-delivery',
    title: 'Problems with the published post',
    body: (
      <>
        <P>You have {LEGAL.autoApproveDays} days after the seller sends the live URL to check it. Raise a problem in that time if:</P>
        <List
          items={[
            'the post or your link isn’t there, or the page can’t be opened;',
            'the link is nofollow, sponsored or ugc when the listing promised dofollow, or it points to the wrong URL or uses the wrong anchor text;',
            'the post is on a different website, or hidden from visitors or search engines (for example noindex) when the listing didn’t say so;',
            'the content was changed in a way you didn’t agree to.',
          ]}
        />
        <P>
          The seller gets {LEGAL.linkFixDays} days to fix it. If they don&rsquo;t, you get a full refund. If you don&rsquo;t raise a problem within
          {' '}{LEGAL.autoApproveDays} days, the order is approved automatically and the seller is paid; the link guarantee below still applies.
        </P>
      </>
    ),
  },
  {
    id: 'guarantee',
    title: 'Link guarantee',
    body: (
      <>
        <P>
          Every listing shows how long the link stays live: 6 months, 1 year, 2 years or permanent. We guarantee the link for that period, and for
          {' '}{LEGAL.permanentGuaranteeMonths} months on &ldquo;permanent&rdquo; listings.
        </P>
        <P>
          If the link is removed, changed to nofollow, or the page goes offline during that time, report it from the order page or by email. The seller has
          {' '}{LEGAL.linkFixDays} days to restore it. If they don&rsquo;t, you can choose a replacement post on a comparable website of similar price, or a refund. A
          refund is the full price in the first 3 months after publication, and after that a share of the price for the part of the guarantee period that is
          left.
        </P>
      </>
    ),
  },
  {
    id: 'not-covered',
    title: 'What isn’t refunded',
    body: (
      <List
        items={[
          'Changes in your search rankings, traffic, sales or a site’s metrics after publication. We don’t promise SEO results.',
          'A search engine ignoring, devaluing or penalising a link.',
          'Problems caused by your own content or target page, for example if your page goes offline or redirects.',
          'Orders you approved, once the guarantee period has ended.',
          'Content that breaks our Terms of Service, if the seller removes it for that reason.',
        ]}
      />
    ),
  },
  {
    id: 'how-to',
    title: 'How to ask for a refund',
    body: (
      <>
        <P>Open the order in your account and use the order chat or the option to report a problem, or email <Mail /> with:</P>
        <List items={['the order number or the website it is for;', 'what is wrong, with the live URL and screenshots if you have them;', 'what you would like: a fix, a replacement or a refund.']} />
        <P>We usually reply within 1 business day.</P>
      </>
    ),
  },
  {
    id: 'disputes',
    title: 'How disputes are decided',
    body: (
      <List
        items={[
          'We first ask the seller to fix the problem.',
          `If you can’t agree, either side can open a dispute. The other side has ${LEGAL.disputeAnswerDays} business days to answer and add evidence.`,
          'Our team reviews the order, messages, the listing and the live page, and decides: a full refund, a partial refund, a replacement, or releasing payment to the seller.',
          'We aim to decide within 5 business days of receiving both sides’ answers. While a dispute is open, the payment stays held.',
        ]}
      />
    ),
  },
  {
    id: 'payment',
    title: 'How refunds are paid',
    body: (
      <P>
        Refunds go back to the card or payment method you used, through our payment provider Stripe. We refund the full amount being returned, without
        taking a fee. Banks usually show the refund within 5–10 business days.
      </P>
    ),
  },
  {
    id: 'chargebacks',
    title: 'Chargebacks',
    body: (
      <P>
        Please contact us before you dispute a payment with your bank; we can usually solve the issue faster. If a chargeback is filed for an order that was
        delivered as described, we will send the bank the order evidence, and repeated unfounded chargebacks can lead to the account being closed. See also our
        {' '}<A href="/terms">Terms of Service</A>.
      </P>
    ),
  },
  {
    id: 'sellers',
    title: 'For sellers',
    body: (
      <P>
        When a buyer is refunded, the amount comes from the order&rsquo;s held payment, or from your balance if the order was already paid out. The
        {' '}<A href="/seller-terms">Seller &amp; Payout Terms</A> explain this in full.
      </P>
    ),
  },
];

export default function Page() {
  return (
    <LegalPage
      path="/refund-policy"
      title="Refund & Cancellation Policy"
      intro="When you can cancel an order, what you get back, and how we protect the links you paid for."
      sections={sections}
    />
  );
}
