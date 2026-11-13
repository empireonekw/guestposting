'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Loader2, CheckCircle2, AlertCircle, X, Star, Clock } from 'lucide-react';
import api from '@/lib/api';
import useSession from '@/lib/useSession';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import OrderTracker from '@/components/order/OrderTracker';
import OrderActions from '@/components/order/OrderActions';
import OrderDispute from '@/components/order/OrderDispute';
import OrderChat from '@/components/order/OrderChat';
import LinkCard from '@/components/order/LinkCard';
import { FileLink } from '@/components/order/OrderFiles';
import { STATUS_LABEL, STATUS_TONE, WAITING_ON } from '@/data/orderStatus';
import { money } from '@/lib/format';

const when = (d) => (d ? new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

const EVENT_TEXT = {
  ordered: 'Order placed',
  accepted: 'Publisher accepted the order',
  brief: 'Brief sent',
  draft: 'Draft sent for review',
  draft_approved: 'Draft approved',
  revision_requested: 'Changes requested on the draft',
  published: 'Post published',
  redelivered: 'Live link updated',
  fix_requested: 'Fix requested',
  extended: 'Deadline extended',
  late: 'Deadline passed',
  completed: 'Order completed',
  cancelled: 'Order cancelled',
  dispute_opened: 'Dispute opened',
  dispute_reply: 'New message in the dispute',
  dispute_resolved: 'Dispute decided',
  link_lost: 'Link problem found: case opened',
  link_fixed: 'Link restored',
  link_escalated: 'Link not fixed in time: passed to our team',
  link_resolved: 'Lost-link case settled',
};
const WHO = { buyer: 'Buyer', seller: 'Publisher', admin: 'Our team', system: 'Automatic' };

const Row = ({ label, children }) => (
  <div className="grid gap-1 py-2.5 sm:grid-cols-[150px_1fr] sm:gap-4">
    <dt className="text-[13px] text-ink-faint">{label}</dt>
    <dd className="min-w-0 break-words text-[14px] text-ink">{children}</dd>
  </div>
);
const ExtLink = ({ href }) => (
  <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 text-brand-700 hover:underline">
    <span className="truncate">{href}</span><ExternalLink size={12} className="shrink-0" />
  </a>
);

const ReviewBox = ({ orderId, onDone }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/reviews', { orderId, rating, comment });
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'The review could not be saved.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
      <h2 className="text-[15px] font-semibold text-ink">Rate this publisher</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => setRating(n)} className={rating >= n ? 'text-amber-500' : 'text-line'}>
              <Star size={26} fill={rating >= n ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>
          ))}
        </div>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} placeholder="How did the order go?" aria-label="Your review" />
        {error && <p className="text-[12px] font-medium text-danger">{error}</p>}
        <div className="flex justify-end"><Button type="submit" loading={busy} disabled={comment.trim().length < 2}>Post review</Button></div>
      </form>
    </section>
  );
};

const OrderDetails = () => {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useSession();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast((t) => (t?.message === message ? null : t)), 6000);
  };

  const load = async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data);
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 403) router.push('/orders');
      else setError(err.response?.data?.message || 'Could not load the order.');
    }
  };
  useEffect(() => { load(); }, [id]);

  // Runs one workflow step. Returns { message, field } when it failed, so
  // the form can show the error next to the right field.
  const act = async (action, fields = {}) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/orders/${id}/action`, { action, ...fields });
      setOrder(data.order);
      notify('success', data.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return undefined;
    } catch (err) {
      const res = { message: err.response?.data?.message || 'That didn’t work. Please try again.', field: err.response?.data?.field };
      notify('error', res.message);
      if (err.response?.status === 409) load();
      return res;
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="mx-auto max-w-xl p-10 text-center text-[14px] text-ink-soft">{error}</p>;
  if (!order || !user) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 size={28} className="animate-spin text-brand-500" /></div>;
  }

  const role = order.viewerRole;
  const yourTurn = WAITING_ON[order.status] === role;
  const closed = ['completed', 'cancelled'].includes(order.status);
  const domain = order.site?.domain || order.listing?.domain;

  return (
    <div className="mx-auto max-w-7xl pb-20">
      {toast && (
        <div role="status" className={`fixed left-1/2 top-6 z-[100] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-xl border p-4 shadow-[var(--shadow-pop)] ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
          <p className="flex-1 text-[13px] font-medium">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100"><X size={16} /></button>
        </div>
      )}

      <Link href={role === 'admin' ? '/admin/orders' : '/orders'} className="mb-5 inline-flex items-center gap-2 text-[13px] font-medium text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> {role === 'admin' ? 'All orders' : role === 'seller' ? 'My sales' : 'My orders'}
      </Link>

      {/* Header */}
      <header className="mb-5 rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-2xl">{domain}</h1>
              <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status] || order.status}</Badge>
              {order.late && <Badge tone="warning"><Clock size={11} /> Late</Badge>}
              {yourTurn && <Badge tone="brand">Your turn</Badge>}
            </div>
            <p className="mt-1 text-[13px] text-ink-faint">
              Order #{String(order._id).slice(-6).toUpperCase()} · placed {when(order.createdAt)}
              {role !== 'buyer' && order.buyer && <> · buyer <span className="text-ink-soft">{order.buyer.name}</span>{role === 'admin' && order.buyer.email ? ` (${order.buyer.email})` : ''}</>}
              {role !== 'seller' && order.seller && <> · publisher <span className="text-ink-soft">{order.seller.name}</span>{role === 'admin' && order.seller.email ? ` (${order.seller.email})` : ''}</>}
            </p>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="text-2xl font-bold tabular-nums text-ink">{money(order.price)}</p>
            <p className="text-[12px] text-ink-faint">{order.paymentStatus === 'paid' ? 'Paid' : 'Payment not taken yet'}</p>
          </div>
        </div>
        <div className="mt-6">
          <OrderTracker order={order} />
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <OrderActions order={order} onAct={act} busy={busy} />
          <OrderDispute order={order} onAct={act} busy={busy} />
          <LinkCard order={order} onAct={act} busy={busy} />

          {/* What was ordered and delivered */}
          <section className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
            <h2 className="mb-1 text-[15px] font-semibold text-ink">Order details</h2>
            <dl className="divide-y divide-line">
              <Row label="Website"><ExtLink href={order.site?.url || `https://${domain}`} /></Row>
              {order.dueAt && !closed && <Row label="Deadline">{when(order.dueAt)}{order.late ? ' (passed)' : ''}</Row>}
              {order.contentSource && <Row label="Article">{order.contentSource === 'seller' ? 'Written by the publisher' : 'Provided by the buyer'}</Row>}
              {order.targetUrl && <Row label="Target URL"><ExtLink href={order.targetUrl} /></Row>}
              {order.anchorText && <Row label="Anchor text">{order.anchorText}</Row>}
              {(order.articleLink || order.articleFile?.fileId) && (
                <Row label={'Buyer’s article'}>
                  <div className="flex flex-col items-start gap-1.5">
                    {order.articleLink && <ExtLink href={order.articleLink} />}
                    {order.articleFile?.fileId && <FileLink file={order.articleFile} />}
                  </div>
                </Row>
              )}
              {order.contentNotes && <Row label="Instructions"><p className="whitespace-pre-wrap">{order.contentNotes}</p></Row>}
              {order.draft?.submittedAt && (
                <Row label={order.draftApprovedAt ? 'Approved draft' : 'Draft'}>
                  <div className="flex flex-col items-start gap-1.5">
                    {order.draft.link && <ExtLink href={order.draft.link} />}
                    {order.draft.file?.fileId && <FileLink file={order.draft.file} />}
                    {order.draft.text && <p className="max-h-64 w-full overflow-y-auto whitespace-pre-wrap rounded-lg bg-canvas p-3 text-[13px]">{order.draft.text}</p>}
                    <span className="text-[12px] text-ink-faint">Sent {when(order.draft.submittedAt)}{order.revisionCount ? ` · ${order.revisionCount} change round${order.revisionCount === 1 ? '' : 's'} used` : ''}</span>
                  </div>
                </Row>
              )}
              {order.liveLink && <Row label="Live post"><ExtLink href={order.liveLink} /></Row>}
              {order.refundAmount > 0 && <Row label="Refunded">{money(order.refundAmount)}</Row>}
            </dl>
          </section>

          {role === 'buyer' && order.status === 'completed' && !order.reviewed && (
            <ReviewBox orderId={order._id} onDone={() => { setOrder((o) => ({ ...o, reviewed: true })); notify('success', 'Thanks for your review.'); }} />
          )}

          {/* Timeline */}
          <section className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
            <h2 className="mb-3 text-[15px] font-semibold text-ink">History</h2>
            <ol className="relative space-y-3 border-l border-line pl-5">
              {[...(order.events || [])].reverse().map((ev, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" aria-hidden="true" />
                  <p className="text-[14px] text-ink">{EVENT_TEXT[ev.type] || ev.type}</p>
                  <p className="text-[12px] text-ink-faint">{WHO[ev.role] || ev.role} · {when(ev.at)}</p>
                  {ev.note && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] text-ink-soft">{ev.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-6">
            <OrderChat orderId={order._id} me={{ _id: user._id, name: user.name, role: user.role }} closed={closed} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
