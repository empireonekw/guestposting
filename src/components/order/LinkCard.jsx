'use client';

import { useState } from 'react';
import { ShieldCheck, RefreshCw, CheckCircle2, XCircle, AlertTriangle, HelpCircle, Flag, ChevronDown } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Field, Input, Textarea } from '@/components/ui/Field';
import {
  LINK_STATUS_LABEL, LINK_STATUS_TONE, LINK_CASE_LABEL, LINK_PROBLEM_TEXT, OPEN_CASE,
} from '@/data/orderStatus';
import { money } from '@/lib/format';

// Module 5 on the order page: the latest automatic check of the live link,
// the link guarantee, and lost-link cases.

const day = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
const when = (d) => (d ? new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

// One line of the checklist. state: true (pass), false (fail), null (unknown).
const Item = ({ state, children }) => (
  <li className="flex items-start gap-2 text-[14px]">
    {state === true && <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />}
    {state === false && <XCircle size={16} className="mt-0.5 shrink-0 text-danger" />}
    {state === null && <HelpCircle size={16} className="mt-0.5 shrink-0 text-ink-faint" />}
    {state === 'warn' && <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />}
    <span className={state === false ? 'text-ink' : 'text-ink-soft'}>{children}</span>
  </li>
);

const Checklist = ({ last, expectDofollow }) => {
  if (!last) return <p className="text-[14px] text-ink-soft">Not checked yet.</p>;
  const p = last.problems || [];
  if (last.verdict === 'unverified') {
    return <Item state={null}>We couldn&rsquo;t open the page{last.error ? ` (${last.error})` : ''}. We&rsquo;ll try again.</Item>;
  }
  const pageOk = !p.includes('page_gone') && !p.includes('redirected_away');
  return (
    <ul className="space-y-1.5">
      <Item state={pageOk}>{pageOk ? 'The page is live' : LINK_PROBLEM_TEXT[p.find((x) => ['page_gone', 'redirected_away'].includes(x))]}</Item>
      {pageOk && <Item state={!!last.linkFound}>{last.linkFound ? 'Your link is on the page' : LINK_PROBLEM_TEXT.link_missing}</Item>}
      {last.linkFound && expectDofollow && <Item state={!p.includes('nofollow')}>{p.includes('nofollow') ? `The link is ${last.rel || 'nofollow'}, not dofollow` : 'The link is dofollow'}</Item>}
      {last.linkFound && <Item state={p.includes('anchor_mismatch') ? 'warn' : true}>{p.includes('anchor_mismatch') ? `Anchor text is “${last.anchor}”, not the one ordered` : `Anchor text matches${last.anchor ? `: “${last.anchor}”` : ''}`}</Item>}
      {pageOk && <Item state={last.noindex ? 'warn' : true}>{last.noindex ? LINK_PROBLEM_TEXT.noindex : 'Search engines may index the page'}</Item>}
    </ul>
  );
};

const NoteForm = ({ label, field, onSubmit, busy, variant = 'secondary', icon: Icon }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  if (!open) return <Button variant={variant} onClick={() => setOpen(true)}>{Icon && <Icon size={16} />} {label}</Button>;
  const submit = async (e) => {
    e.preventDefault();
    if (text.trim().length < 5) { setError('Please write at least 5 characters.'); return; }
    const err = await onSubmit(text.trim());
    if (err) setError(err);
  };
  return (
    <form onSubmit={submit} className="w-full space-y-3 rounded-xl border border-line bg-canvas p-4">
      <Field label={field} error={error} required>
        <Textarea value={text} onChange={(e) => { setText(e.target.value); setError(''); }} maxLength={1000} autoFocus error={error} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
        <Button type="submit" loading={busy}>{label}</Button>
      </div>
    </form>
  );
};

const ResolveForm = ({ order, onAct, busy }) => {
  const [outcome, setOutcome] = useState('');
  const [amount, setAmount] = useState(order.suggestedRefund ? String(order.suggestedRefund) : '');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const options = [
    { value: 'replaced', label: 'Replacement arranged', hint: 'A comparable post was published elsewhere. Monitoring of this link stops.' },
    { value: 'refunded', label: 'Refund the buyer', hint: `Suggested by the Refund Policy: ${money(order.suggestedRefund || 0)}.` },
    { value: 'closed', label: 'Close without action', hint: 'False alarm, or the buyer agreed. Monitoring continues.' },
  ];
  const submit = async (e) => {
    e.preventDefault();
    if (!outcome) { setError('Choose a decision.'); return; }
    if (note.trim().length < 5) { setError('Explain the decision to both sides.'); return; }
    const res = await onAct('link_resolve', { outcome, amount: Number(amount), note: note.trim() });
    if (res?.message) setError(res.message);
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
      <p className="text-[14px] font-semibold text-ink">Settle this lost link</p>
      {options.map((o) => (
        <label key={o.value} className={`flex cursor-pointer gap-3 rounded-lg border bg-white p-3 ${outcome === o.value ? 'border-brand-500' : 'border-line'}`}>
          <input type="radio" name="link-outcome" value={o.value} checked={outcome === o.value} onChange={() => { setOutcome(o.value); setError(''); }} className="mt-1 accent-brand-600" />
          <span>
            <span className="block text-[14px] font-medium text-ink">{o.label}</span>
            <span className="block text-[12px] text-ink-soft">{o.hint}</span>
          </span>
        </label>
      ))}
      {outcome === 'refunded' && (
        <Field label="Refund amount" htmlFor="link-refund">
          <Input id="link-refund" type="number" min="0.01" step="0.01" prefix="$" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      )}
      <Field label="Explanation for both sides" required htmlFor="link-note" error={error}>
        <Textarea id="link-note" value={note} onChange={(e) => { setNote(e.target.value); setError(''); }} maxLength={2000} error={error} />
      </Field>
      <div className="flex justify-end"><Button type="submit" loading={busy}>Confirm</Button></div>
    </form>
  );
};

const LinkCard = ({ order, onAct, busy }) => {
  const [showHistory, setShowHistory] = useState(false);
  if (!order.liveLink) return null;
  const has = (a) => order.actions?.includes(a);
  const link = order.link || {};
  const last = link.last;
  const kase = link.case;
  const open = OPEN_CASE.includes(kase?.status);
  const status = link.status || last?.verdict;
  const expectDofollow = (order.linkType || 'dofollow') === 'dofollow';
  const monitored = order.status === 'completed' && link.guaranteeUntil;

  return (
    <section className={`rounded-2xl border bg-white p-5 shadow-[var(--shadow-card)] sm:p-6 ${open ? 'border-red-200' : 'border-line'}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><ShieldCheck size={17} className="text-brand-600" /> Link check</h2>
        {status && <Badge tone={LINK_STATUS_TONE[status]}>{LINK_STATUS_LABEL[status] || status}</Badge>}
      </div>

      {open && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-[14px] text-red-900">
          <p className="font-semibold">{LINK_CASE_LABEL[kase.status]}</p>
          <p className="mt-1">{kase.reason}</p>
          <p className="mt-1 text-[12px] opacity-80">
            Opened {when(kase.openedAt)}{kase.openedBy === 'buyer' ? ' after the buyer’s report' : kase.openedBy === 'admin' ? ' by our team' : ' by our automatic check'}
            {kase.status === 'open' ? ` · the publisher has until ${when(kase.fixBy)} to fix it` : ''}
          </p>
        </div>
      )}
      {!open && kase?.status && (
        <p className="mb-4 rounded-xl bg-canvas p-3 text-[13px] text-ink-soft">
          Last lost-link case: <span className="font-medium text-ink">{LINK_CASE_LABEL[kase.status]}</span> {day(kase.resolvedAt)}
          {kase.refundAmount ? ` · ${money(kase.refundAmount)} refunded` : ''}{kase.note ? ` · ${kase.note}` : ''}
        </p>
      )}

      <Checklist last={last} expectDofollow={expectDofollow} />

      <dl className="mt-4 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
        <div className="flex justify-between gap-3"><dt className="text-ink-faint">Last checked</dt><dd className="text-ink">{when(link.lastCheckedAt) || '–'}</dd></div>
        {monitored && link.status !== 'ended' && <div className="flex justify-between gap-3"><dt className="text-ink-faint">Next check</dt><dd className="text-ink">{day(link.nextCheckAt)}</dd></div>}
        {monitored && <div className="flex justify-between gap-3"><dt className="text-ink-faint">Guaranteed until</dt><dd className="text-ink">{day(link.guaranteeUntil)}</dd></div>}
        <div className="flex justify-between gap-3"><dt className="text-ink-faint">Promised</dt><dd className="text-ink">{expectDofollow ? 'Dofollow' : 'Nofollow'}</dd></div>
      </dl>
      {order.status === 'completed' && !monitored && <p className="mt-3 text-[12px] text-ink-faint">Monitoring starts within a day for orders completed before link checks existed.</p>}

      {(has('check_link') || has('report_link') || has('link_fixed') || has('link_open_case')) && (
        <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-line pt-4">
          {has('link_fixed') && <Button loading={busy} onClick={() => onAct('link_fixed')}><CheckCircle2 size={16} /> I&rsquo;ve fixed it</Button>}
          {has('check_link') && <Button variant="secondary" loading={busy} onClick={() => onAct('check_link')}><RefreshCw size={16} /> Check now</Button>}
          {has('report_link') && (
            <NoteForm label="Report a problem" icon={Flag} variant="ghost" field="What is wrong with the link?" busy={busy}
              onSubmit={async (text) => (await onAct('report_link', { note: text }))?.message} />
          )}
          {has('link_open_case') && (
            <NoteForm label="Open a case" icon={Flag} variant="ghost" field="What is wrong?" busy={busy}
              onSubmit={async (text) => (await onAct('link_open_case', { reason: text }))?.message} />
          )}
        </div>
      )}
      {has('link_resolve') && <div className="mt-4"><ResolveForm order={order} onAct={onAct} busy={busy} /></div>}

      {order.linkChecks?.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-1 text-[13px] font-medium text-ink-soft hover:text-ink" aria-expanded={showHistory}>
            Check history ({order.linkChecks.length}) <ChevronDown size={14} className={showHistory ? 'rotate-180' : ''} />
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1.5">
              {order.linkChecks.map((c) => (
                <li key={c._id} className="flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
                  <Badge tone={LINK_STATUS_TONE[c.verdict]}>{LINK_STATUS_LABEL[c.verdict] || c.verdict}</Badge>
                  <span>{when(c.at)}</span>
                  <span className="text-ink-faint">{c.source === 'monitor' ? 'monthly check' : c.source === 'delivery' ? 'on delivery' : 'checked by hand'}</span>
                  {c.problems?.length > 0 && <span>· {c.problems.map((p) => LINK_PROBLEM_TEXT[p] || p).join('; ')}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

export default LinkCard;
