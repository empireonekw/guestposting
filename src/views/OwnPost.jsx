'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, ShieldCheck, Send } from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import ArticleEditor from '@/components/editor/ArticleEditor';

// "Log a post on my site": a seller published a client's guest post on one of
// their own websites (an outside client, not a marketplace order). It is
// saved with the client's name, the live link is checked straight away, and
// then it is monitored every month like any sold link. No fee, no buyer.

const OwnPost = () => {
  const router = useRouter();
  const [sites, setSites] = useState(null);
  const [f, setF] = useState({ listingId: '', clientName: '', price: '', targetUrl: '', anchorText: '', liveLink: '', articleHtml: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get('/listings/my-listings')
      .then(({ data }) => {
        const list = (data.listings || []).filter((l) => !l.isDeleted);
        setSites(list);
        if (list.length === 1) setF((x) => ({ ...x, listingId: list[0]._id }));
      })
      .catch(() => setSites([]));
  }, []);

  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); setFormError(''); };
  const site = sites?.find((s) => s._id === f.listingId);

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!f.listingId) err.listingId = 'Choose the website you published on.';
    if (!f.targetUrl.trim()) err.targetUrl = 'Add the page the link points to.';
    if (!f.anchorText.trim()) err.anchorText = 'Add the anchor text.';
    if (!f.liveLink.trim()) err.liveLink = 'Paste the URL of the published post.';
    setErrors(err);
    if (Object.keys(err).length) return;
    setSending(true);
    try {
      const { data } = await api.post('/orders/own', {
        ...f,
        price: f.price === '' ? undefined : f.price,
        clientName: f.clientName.trim() || undefined,
        articleHtml: f.articleHtml || undefined,
      });
      router.push(`/orders/${data._id}`);
    } catch (e2) {
      const message = e2.response?.data?.message || 'Could not save the post. Please try again.';
      const field = e2.response?.data?.field;
      if (field && f[field] !== undefined) setErrors({ [field]: message });
      else setFormError(message);
      setSending(false);
    }
  };

  if (!sites) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 size={26} className="animate-spin text-brand-500" /></div>;

  return (
    <div className="mx-auto max-w-3xl pb-20">
      <Link href="/orders" className="mb-5 inline-flex items-center gap-2 text-[13px] font-medium text-ink-soft hover:text-ink"><ArrowLeft size={16} /> My sales</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Log a post on my site</h1>
      <p className="mt-1 text-[14px] text-ink-soft">
        Published a guest post for an outside client on one of your own websites? Log it here to keep a record and have us check the link every month. No fee is charged.
      </p>

      {sites.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-[14px] text-ink-soft">You don&rsquo;t have any websites listed yet.</p>
          <Button href="/add-listing" className="mt-4">Add a website</Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-6 space-y-5 rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Website" required htmlFor="listingId" error={errors.listingId}>
              <Select id="listingId" value={f.listingId} onChange={(e) => set('listingId', e.target.value)} error={errors.listingId}>
                <option value="">Choose…</option>
                {sites.map((s) => <option key={s._id} value={s._id}>{s.domain || s.url}</option>)}
              </Select>
            </Field>
            <Field label="Client (optional)" htmlFor="clientName" hint="Only you and our team see this">
              <Input id="clientName" value={f.clientName} onChange={(e) => set('clientName', e.target.value)} maxLength={120} placeholder="e.g. Acme Ltd" />
            </Field>
            <Field label="Target URL" required htmlFor="targetUrl" error={errors.targetUrl} hint="The page the link points to">
              <Input id="targetUrl" value={f.targetUrl} onChange={(e) => set('targetUrl', e.target.value)} placeholder="https://client-site.com/page" error={errors.targetUrl} />
            </Field>
            <Field label="Anchor text" required htmlFor="anchorText" error={errors.anchorText}>
              <Input id="anchorText" value={f.anchorText} onChange={(e) => set('anchorText', e.target.value)} maxLength={200} error={errors.anchorText} />
            </Field>
            <Field label="Live URL of the post" required htmlFor="liveLink" error={errors.liveLink} hint={site ? `Must be on ${site.domain}` : undefined}>
              <Input id="liveLink" value={f.liveLink} onChange={(e) => set('liveLink', e.target.value)} placeholder={`https://${site?.domain || 'yoursite.com'}/post`} error={errors.liveLink} />
            </Field>
            <Field label="Price you charged (optional)" htmlFor="price" hint="For your own records">
              <Input id="price" type="number" min="0" step="0.01" prefix="$" value={f.price} onChange={(e) => set('price', e.target.value)} />
            </Field>
          </div>
          <Field label="Article (optional)" htmlFor="ownArticle" hint="Keep a copy of what was published." error={errors.articleHtml}>
            <ArticleEditor id="ownArticle" value={f.articleHtml} onChange={(html) => set('articleHtml', html)} minHeight="min-h-[180px]" error={errors.articleHtml} />
          </Field>
          <p className="flex gap-2 rounded-lg bg-canvas px-3 py-2 text-[13px] text-ink-soft">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-600" />
            We open the live URL now to check the link is there, then every month for as long as the listing&rsquo;s link promise lasts.
          </p>
          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">{formError}</p>}
          <div className="flex justify-end"><Button type="submit" loading={sending}><Send size={16} /> Save post</Button></div>
        </form>
      )}
    </div>
  );
};

export default OwnPost;
