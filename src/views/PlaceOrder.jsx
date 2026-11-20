'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Send, ShieldCheck, Clock, FileText, PenLine } from 'lucide-react';
import api from '@/lib/api';
import useSession from '@/lib/useSession';
import { refreshLists } from '@/lib/buyerLists';
import Button from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import ArticleEditor from '@/components/editor/ArticleEditor';
import CouponField from '@/components/buying/CouponField';
import { compact, money } from '@/lib/format';

// One-form ordering: everything the publisher needs (the article or the
// topic, target URL and anchor text) is sent with the order, so they can
// publish straight away. Sellers and agencies can add their client's name.

const PlaceOrder = () => {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useSession();
  const [listing, setListing] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [f, setF] = useState({ contentSource: 'buyer', articleHtml: '', articleLink: '', targetUrl: '', anchorText: '', contentNotes: '', clientName: '' });
  const [words, setWords] = useState(0);
  const [showLink, setShowLink] = useState(false);
  const [coupon, setCoupon] = useState(null);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    api.get(`/listings/${id}`)
      .then(({ data }) => setListing(data))
      .catch((err) => setLoadError(err.response?.status === 404 ? 'This website is no longer available.' : 'Could not load this website.'));
  }, [id]);

  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); setFormError(''); };

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!f.targetUrl.trim()) err.targetUrl = 'Add the page your link should point to.';
    if (!f.anchorText.trim()) err.anchorText = 'Add the anchor text.';
    if (f.contentSource === 'buyer' && !f.articleHtml && !f.articleLink.trim()) err.articleHtml = 'Paste your article, or share a link to it.';
    if (f.contentSource === 'buyer' && f.articleHtml && words < 50) err.articleHtml = `The article looks too short (${words} words). Paste the full article.`;
    if (f.contentSource === 'seller' && f.contentNotes.trim().length < 20) err.contentNotes = 'Tell the publisher what to write about (at least 20 characters).';
    setErrors(err);
    if (Object.keys(err).length) {
      document.getElementById(Object.keys(err)[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSending(true);
    try {
      const body = {
        listingId: id,
        contentSource: f.contentSource,
        targetUrl: f.targetUrl.trim(),
        anchorText: f.anchorText.trim(),
        contentNotes: f.contentNotes.trim() || undefined,
        clientName: f.clientName.trim() || undefined,
        ...(f.contentSource === 'buyer' ? { articleHtml: f.articleHtml || undefined, articleLink: f.articleLink.trim() || undefined } : {}),
        ...(coupon ? { couponCode: coupon.code } : {}),
      };
      const { data } = await api.post('/orders', body);
      refreshLists();
      router.push(`/orders/${data._id}`);
    } catch (e2) {
      const message = e2.response?.data?.message || 'Could not place the order. Please try again.';
      const field = e2.response?.data?.field;
      if (field && ['targetUrl', 'anchorText', 'articleHtml', 'articleLink', 'contentNotes', 'clientName'].includes(field)) setErrors({ [field]: message });
      else setFormError(message);
      setSending(false);
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl p-10 text-center">
        <p className="text-[15px] text-ink-soft">{loadError}</p>
        <Button href="/sites" variant="secondary" className="mt-4">Find another site</Button>
      </div>
    );
  }
  if (!listing) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 size={26} className="animate-spin text-brand-500" /></div>;

  const writes = f.contentSource === 'seller';
  const days = (listing.turnaroundDays ?? 3) + (writes ? 2 : 0);
  const forOthers = user && user.role !== 'buyer';

  const choice = (value, Icon, title, text) => (
    <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${f.contentSource === value ? 'border-brand-500 bg-brand-50' : 'border-line bg-white hover:bg-canvas'}`}>
      <input type="radio" name="contentSource" value={value} checked={f.contentSource === value} onChange={() => set('contentSource', value)} className="mt-1 accent-brand-600" />
      <span>
        <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink"><Icon size={15} /> {title}</span>
        <span className="mt-0.5 block text-[12px] text-ink-soft">{text}</span>
      </span>
    </label>
  );

  return (
    <div className="mx-auto max-w-6xl pb-20">
      <Link href={`/sites/${listing.domain}`} className="mb-5 inline-flex items-center gap-2 text-[13px] font-medium text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Back to {listing.domain}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Order a guest post on {listing.domain}</h1>
      <p className="mt-1 text-[14px] text-ink-soft">Fill in this one form. The publisher gets everything at once and publishes your post.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <form id="order-form" onSubmit={submit} noValidate className="space-y-5 rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
          <div className="grid gap-2 sm:grid-cols-2">
            {choice('buyer', FileText, 'I have the article', 'Paste it below (formatting from Word or Google Docs is kept).')}
            {choice('seller', PenLine, 'The publisher writes it', `Tell them the topic. Adds about 2 days.`)}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target URL" required htmlFor="targetUrl" error={errors.targetUrl} hint="The page your link points to">
              <Input id="targetUrl" value={f.targetUrl} onChange={(e) => set('targetUrl', e.target.value)} placeholder="https://yoursite.com/page" error={errors.targetUrl} />
            </Field>
            <Field label="Anchor text" required htmlFor="anchorText" error={errors.anchorText} hint="The clickable words of your link">
              <Input id="anchorText" value={f.anchorText} onChange={(e) => set('anchorText', e.target.value)} maxLength={200} placeholder="e.g. project management software" error={errors.anchorText} />
            </Field>
          </div>

          {!writes && (
            <Field label="Your article" required htmlFor="articleHtml" error={errors.articleHtml} hint={listing.contentRules ? `Publisher’s rules: ${listing.contentRules}` : 'Include your link in the text, or the publisher adds it using the target URL and anchor above.'}>
              <ArticleEditor id="articleHtml" value={f.articleHtml} onChange={(html, meta) => { set('articleHtml', html); setWords(meta.words); }} error={errors.articleHtml} />
              {!showLink ? (
                <button type="button" onClick={() => setShowLink(true)} className="mt-2 text-[13px] font-medium text-brand-700 hover:underline">Or share a link to the article instead</button>
              ) : (
                <div className="mt-3">
                  <Input id="articleLink" value={f.articleLink} onChange={(e) => set('articleLink', e.target.value)} placeholder="https://docs.google.com/document/…" aria-label="Link to the article" error={errors.articleLink} />
                  {errors.articleLink && <p className="mt-1 text-[12px] font-medium text-danger">{errors.articleLink}</p>}
                </div>
              )}
            </Field>
          )}

          <Field
            label={writes ? 'What should the article be about?' : 'Notes for the publisher'}
            required={writes}
            htmlFor="contentNotes"
            error={errors.contentNotes}
            hint={writes && listing.contentRules ? `Publisher’s rules: ${listing.contentRules}` : undefined}
          >
            <Textarea id="contentNotes" value={f.contentNotes} onChange={(e) => set('contentNotes', e.target.value)} maxLength={5000} placeholder={writes ? 'Topic, angle, word count, keywords to use…' : 'Anything else the publisher should know (optional)'} error={errors.contentNotes} />
          </Field>

          <Field label="Client or project (optional)" htmlFor="clientName" hint={forOthers ? 'Ordering for a client? Only you and our team see this; the publisher doesn’t.' : 'For your own records. The publisher doesn’t see it.'}>
            <Input id="clientName" value={f.clientName} onChange={(e) => set('clientName', e.target.value)} maxLength={120} placeholder="e.g. Acme Ltd – March campaign" />
          </Field>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="text-[15px] font-semibold text-ink">{listing.domain}</p>
            <p className="mt-1 text-[13px] text-ink-soft">DR {listing.dr || '–'} · DA {listing.da || '–'} · {compact(listing.traffic)} traffic · {listing.linkType === 'nofollow' ? 'nofollow' : 'dofollow'}</p>
            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
              <span className="text-[14px] text-ink-soft">Price</span>
              <span className="text-right">
                {coupon && <span className="block text-[13px] tabular-nums text-ink-faint line-through">{money(listing.price)}</span>}
                <span className="text-2xl font-bold tabular-nums text-ink">{money(coupon ? coupon.total : listing.price)}</span>
              </span>
            </div>
            <div className="mt-3"><CouponField listingIds={[listing._id]} applied={coupon} onApply={setCoupon} /></div>
            <ul className="mt-4 space-y-2 text-[13px] text-ink-soft">
              <li className="flex gap-2"><Clock size={15} className="mt-0.5 shrink-0 text-brand-600" /> Published within about {days} day{days === 1 ? '' : 's'}</li>
              <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-600" /> We check your link when it goes live, then every month</li>
            </ul>
            {formError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">{formError}</p>}
            <Button type="submit" form="order-form" size="lg" className="mt-4 w-full" loading={sending}><Send size={16} /> Place order</Button>
            <p className="mt-3 text-[12px] text-ink-faint">
              By placing the order you agree to our <Link href="/terms" target="_blank" className="font-medium text-brand-700 hover:underline">Terms</Link> and{' '}
              <Link href="/refund-policy" target="_blank" className="font-medium text-brand-700 hover:underline">Refund Policy</Link>.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default PlaceOrder;
