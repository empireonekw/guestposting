'use client';

import { useState } from 'react';
import { CheckCircle2, Send, CalendarPlus, AlertTriangle, XCircle, ExternalLink } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Field, Input, Textarea, Select } from '@/components/ui/Field';
import { FilePicker } from './OrderFiles';

// The "Next step" card on the order page. It only offers what the server
// listed in order.actions, and sends each one to POST /orders/:id/action
// through onAct(action, fields).

const dateText = (d) => (d ? new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

// One line explaining where the order stands, for this viewer.
export const statusLine = (o) => {
  const r = o.viewerRole;
  const left = (o.rules?.revisionRounds || 0) - (o.revisionCount || 0);
  switch (o.status) {
    case 'pending_acceptance':
      return r === 'seller'
        ? `Accept or decline this order by ${dateText(o.acceptBy)}, or it is cancelled automatically.`
        : `Waiting for the publisher to accept, at the latest by ${dateText(o.acceptBy)}.`;
    case 'awaiting_brief':
      return r === 'buyer' ? 'Send your brief so the publisher can start.' : 'Waiting for the buyer’s brief.';
    case 'writing': {
      const what = o.contentSource === 'seller' && !o.draftApprovedAt ? 'writing the article' : 'publishing the post';
      const due = o.dueAt ? ` Due ${dateText(o.dueAt)}.` : '';
      if (o.late) return r === 'seller' ? `This order is late.${due} Publish it, or agree a new date with the buyer in the chat.` : `The publisher is late.${due} You can give more time${o.actions?.includes('cancel') ? ', or cancel the order' : ''}.`;
      return r === 'seller' ? `Your turn: ${what}.${due}` : `The publisher is ${what}.${due}`;
    }
    case 'content_review':
      return r === 'buyer'
        ? `Review the draft below. Approve it, or ask for changes (${left} round${left === 1 ? '' : 's'} left).`
        : 'Waiting for the buyer to review your draft.';
    case 'published':
      return r === 'buyer'
        ? `Your post is live. Check it and approve it by ${dateText(o.reviewBy)}, or it is approved automatically.`
        : `Waiting for the buyer to check the post. It is approved automatically on ${dateText(o.reviewBy)}.`;
    case 'completed':
      return `Completed ${dateText(o.completedAt)}${o.completedBy === 'auto' ? ' (approved automatically)' : ''}.`;
    case 'cancelled':
      return `Cancelled ${dateText(o.cancelledAt)}${o.cancelReason ? `: ${o.cancelReason}` : '.'}`;
    case 'disputed':
      return 'This order is in dispute. Both sides can add their evidence below, and our team will decide.';
    default:
      return '';
  }
};

// A textarea with a submit button, shown after clicking a "reveal" button.
const NoteAction = ({ label, icon: Icon, variant = 'secondary', field, hint, required = true, min = 5, onSubmit, busy, fileKind, orderId, submitLabel, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  if (!open) {
    return <Button variant={variant} onClick={() => setOpen(true)}>{Icon && <Icon size={16} />} {label}</Button>;
  }
  const submit = async (e) => {
    e.preventDefault();
    if ((required && text.trim().length < min) || (!required && text.trim() && text.trim().length < min)) {
      setError(`Please write at least ${min} characters.`);
      return;
    }
    const err = await onSubmit({ text: text.trim(), fileId: file?.fileId });
    if (err) setError(err);
  };
  return (
    <form onSubmit={submit} className="w-full space-y-3 rounded-xl border border-line bg-canvas p-4">
      <Field label={field} hint={hint} error={error} required={required}>
        <Textarea value={text} onChange={(e) => { setText(e.target.value); setError(''); }} maxLength={2000} autoFocus placeholder={placeholder} error={error} />
      </Field>
      {fileKind && <FilePicker orderId={orderId} kind={fileKind} value={file} onChange={setFile} label="Attach evidence" />}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
        <Button type="submit" variant={variant === 'danger' ? 'danger' : 'primary'} loading={busy}>{submitLabel || label}</Button>
      </div>
    </form>
  );
};

const BriefForm = ({ order, onAct, busy }) => {
  const [f, setF] = useState({ contentSource: 'buyer', targetUrl: '', anchorText: '', articleLink: '', contentNotes: '' });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!f.targetUrl.trim()) err.targetUrl = 'Add the page you want the link to point to.';
    if (!f.anchorText.trim()) err.anchorText = 'Add the anchor text.';
    if (f.contentSource === 'buyer' && !f.articleLink.trim() && !file) err.articleLink = 'Upload your article or paste a link to it.';
    if (f.contentSource === 'seller' && f.contentNotes.trim().length < 20) err.contentNotes = 'Tell the publisher what to write about (at least 20 characters).';
    setErrors(err);
    if (Object.keys(err).length) return;
    const res = await onAct('brief', { ...f, articleFileId: file?.fileId });
    if (res?.field) setErrors({ [res.field]: res.message });
  };

  const choice = (value, title, text) => (
    <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${f.contentSource === value ? 'border-brand-500 bg-brand-50' : 'border-line hover:bg-canvas'}`}>
      <input type="radio" name="contentSource" value={value} checked={f.contentSource === value} onChange={() => set('contentSource', value)} className="mt-1 accent-brand-600" />
      <span>
        <span className="block text-[14px] font-semibold text-ink">{title}</span>
        <span className="block text-[12px] text-ink-soft">{text}</span>
      </span>
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {choice('buyer', 'I’ll provide the article', 'Upload it or share a link. The publisher publishes it.')}
        {choice('seller', 'The publisher writes it', `You approve the draft first (up to ${order.rules?.revisionRounds} rounds of changes).`)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target URL" required htmlFor="b-url" error={errors.targetUrl} hint="The page your link points to">
          <Input id="b-url" value={f.targetUrl} onChange={(e) => set('targetUrl', e.target.value)} placeholder="https://yoursite.com/page" error={errors.targetUrl} />
        </Field>
        <Field label="Anchor text" required htmlFor="b-anchor" error={errors.anchorText} hint="The clickable words of the link">
          <Input id="b-anchor" value={f.anchorText} onChange={(e) => set('anchorText', e.target.value)} maxLength={200} error={errors.anchorText} />
        </Field>
      </div>
      {f.contentSource === 'buyer' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your article" error={errors.articleLink}>
            <FilePicker orderId={order._id} kind="article" value={file} onChange={(v) => { setFile(v); setErrors((e) => ({ ...e, articleLink: undefined })); }} label="Upload the article" />
          </Field>
          <Field label="…or a link to it" htmlFor="b-link" hint="Google Docs, Dropbox…">
            <Input id="b-link" value={f.articleLink} onChange={(e) => set('articleLink', e.target.value)} placeholder="https://docs.google.com/…" />
          </Field>
        </div>
      )}
      <Field
        label={f.contentSource === 'seller' ? 'What should the article be about?' : 'Instructions for the publisher'}
        required={f.contentSource === 'seller'}
        htmlFor="b-notes"
        error={errors.contentNotes}
        hint={order.listing?.contentRules ? `Publisher’s rules: ${order.listing.contentRules}` : undefined}
      >
        <Textarea id="b-notes" value={f.contentNotes} onChange={(e) => set('contentNotes', e.target.value)} maxLength={5000} placeholder={f.contentSource === 'seller' ? 'Topic, angle, word count, keywords, links to include…' : 'Anything the publisher should know (optional)'} error={errors.contentNotes} />
      </Field>
      <div className="flex justify-end"><Button type="submit" loading={busy}><Send size={16} /> Send brief</Button></div>
    </form>
  );
};

const DraftForm = ({ order, onAct, busy }) => {
  const [f, setF] = useState({ link: '', text: '' });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!f.link.trim() && !f.text.trim() && !file) { setError('Upload the draft, paste a link or paste the text.'); return; }
    const res = await onAct('draft', { link: f.link, text: f.text, fileId: file?.fileId });
    if (res?.message) setError(res.message);
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {order.revisionCount > 0 && <p className="text-[13px] text-ink-soft">Send the revised draft ({order.revisionCount} of {order.rules?.revisionRounds} change rounds used).</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Draft file"><FilePicker orderId={order._id} kind="draft" value={file} onChange={setFile} label="Upload the draft" /></Field>
        <Field label="…or a link" htmlFor="d-link"><Input id="d-link" value={f.link} onChange={(e) => setF((x) => ({ ...x, link: e.target.value }))} placeholder="https://docs.google.com/…" /></Field>
      </div>
      <Field label="…or paste the text" htmlFor="d-text" error={error}>
        <Textarea id="d-text" value={f.text} onChange={(e) => { setF((x) => ({ ...x, text: e.target.value })); setError(''); }} maxLength={20000} className="min-h-32" error={error} />
      </Field>
      <div className="flex justify-end"><Button type="submit" loading={busy}><Send size={16} /> Send draft for approval</Button></div>
    </form>
  );
};

const DeliverForm = ({ order, onAct, busy }) => {
  const [liveLink, setLiveLink] = useState(order.liveLink || '');
  const [error, setError] = useState('');
  const again = order.status === 'published';
  const submit = async (e) => {
    e.preventDefault();
    if (!liveLink.trim()) { setError('Paste the URL of the published post.'); return; }
    const res = await onAct('deliver', { liveLink });
    if (res?.message) setError(res.message);
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Field label={again ? 'Update the live URL' : 'Live URL of the published post'} required htmlFor="live" error={error} hint={`Must be on ${order.site?.domain || 'the ordered website'}, with the buyer’s link and anchor text.`}>
        <Input id="live" value={liveLink} onChange={(e) => { setLiveLink(e.target.value); setError(''); }} placeholder={`https://${order.site?.domain || 'example.com'}/your-post`} error={error} />
      </Field>
      <div className="flex justify-end"><Button type="submit" loading={busy} variant={again ? 'secondary' : 'primary'}><Send size={16} /> {again ? 'Update link' : 'Mark as published'}</Button></div>
    </form>
  );
};

const ExtendAction = ({ onAct, busy, action, label = 'Give more time' }) => {
  const [days, setDays] = useState('3');
  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`days-${action}`}>Extra days</label>
      <Select id={`days-${action}`} value={days} onChange={(e) => setDays(e.target.value)} className="h-10 w-28">
        {[1, 2, 3, 5, 7, 14].map((d) => <option key={d} value={d}>{d} day{d === 1 ? '' : 's'}</option>)}
      </Select>
      <Button variant="secondary" loading={busy} onClick={() => onAct(action, { days: Number(days) })}><CalendarPlus size={16} /> {label}</Button>
    </div>
  );
};

const OrderActions = ({ order, onAct, busy }) => {
  const has = (a) => order.actions?.includes(a);
  const role = order.viewerRole;
  const noteAct = (action, extra = {}) => async ({ text, fileId }) => {
    const res = await onAct(action, { reason: text, note: text, fileId, ...extra });
    return res?.message;
  };
  // Dispute and link actions have their own cards.
  const any = order.actions?.some((a) => !['dispute_reply', 'resolve', 'check_link', 'report_link', 'link_fixed', 'link_open_case', 'link_resolve'].includes(a));

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
      <h2 className="text-[15px] font-semibold text-ink">Next step</h2>
      <p className={`mt-1 text-[14px] ${order.late ? 'font-medium text-amber-700' : 'text-ink-soft'}`}>{statusLine(order)}</p>
      {order.status === 'published' && order.liveLink && (
        <a href={order.liveLink} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-700 hover:underline">
          Open the live post <ExternalLink size={14} />
        </a>
      )}

      {any && (
        <div className="mt-5 space-y-4">
          {has('accept') && (
            <div className="flex flex-wrap gap-2">
              <Button loading={busy} onClick={() => onAct('accept')}><CheckCircle2 size={16} /> Accept order</Button>
              <NoteAction label="Decline" icon={XCircle} variant="secondary" field="Why are you declining?" hint="The buyer sees this." onSubmit={noteAct('decline')} busy={busy} submitLabel="Decline order" />
            </div>
          )}
          {has('brief') && <BriefForm order={order} onAct={onAct} busy={busy} />}
          {has('draft') && <DraftForm order={order} onAct={onAct} busy={busy} />}
          {has('approve_draft') && (
            <div className="flex flex-wrap items-start gap-2">
              <Button loading={busy} onClick={() => onAct('approve_draft')}><CheckCircle2 size={16} /> Approve draft</Button>
              {has('request_revision') && (
                <NoteAction label="Ask for changes" field="What should be changed?" onSubmit={noteAct('request_revision')} busy={busy} submitLabel="Send change request" />
              )}
            </div>
          )}
          {has('deliver') && <DeliverForm order={order} onAct={onAct} busy={busy} />}
          {has('approve') && (
            <div className="flex flex-wrap items-start gap-2">
              <Button loading={busy} onClick={() => onAct('approve')}><CheckCircle2 size={16} /> Approve and complete</Button>
              <NoteAction label={'Something’s wrong'} icon={AlertTriangle} field="What needs fixing?" hint={`For example: the link is missing, nofollow, or the wrong anchor text. The publisher gets ${order.rules?.linkFixDays} days to fix it.`} onSubmit={noteAct('request_fix')} busy={busy} submitLabel="Ask for a fix" />
            </div>
          )}
          {has('extend') && <ExtendAction onAct={onAct} busy={busy} action="extend" />}
          {has('admin_extend') && <ExtendAction onAct={onAct} busy={busy} action="admin_extend" label="Extend deadline" />}
          {has('admin_complete') && <Button variant="secondary" loading={busy} onClick={() => onAct('admin_complete')}><CheckCircle2 size={16} /> Mark completed</Button>}

          {(has('cancel') || has('dispute') || has('admin_cancel')) && (
            <div className="flex flex-wrap items-start gap-2 border-t border-line pt-4">
              {has('cancel') && (
                <NoteAction
                  label="Cancel order"
                  icon={XCircle}
                  variant="ghost"
                  field={role === 'seller' ? 'Why are you cancelling?' : 'Reason (optional)'}
                  required={role === 'seller'}
                  hint={role === 'seller' ? 'The buyer sees this.' : undefined}
                  onSubmit={noteAct('cancel')}
                  busy={busy}
                  submitLabel="Cancel order"
                />
              )}
              {has('dispute') && (
                <NoteAction
                  label="Open a dispute"
                  icon={AlertTriangle}
                  variant="ghost"
                  field="What went wrong?"
                  min={10}
                  hint={`The other side has ${order.rules?.disputeAnswerDays} business days to answer, then our team decides.`}
                  onSubmit={noteAct('dispute')}
                  busy={busy}
                  fileKind="evidence"
                  orderId={order._id}
                  submitLabel="Open dispute"
                />
              )}
              {has('admin_cancel') && (
                <NoteAction label="Cancel order (admin)" icon={XCircle} variant="danger" field="Reason" hint="Both sides see this." onSubmit={noteAct('admin_cancel')} busy={busy} submitLabel="Cancel order" />
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default OrderActions;
