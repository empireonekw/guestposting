'use client';

import { useState } from 'react';
import { Scale, Send, Gavel } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { FilePicker, FileLink } from './OrderFiles';
import { DISPUTE_OUTCOMES } from '@/data/orderStatus';
import { money } from '@/lib/format';

// The dispute card: what was said by each side, a reply box, and for our
// team the decision form.

const when = (d) => new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const ROLE_LABEL = { buyer: 'Buyer', seller: 'Publisher', admin: 'Our team' };

const Reply = ({ order, onAct, busy }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() && !file) { setError('Write your answer or attach a file.'); return; }
    const res = await onAct('dispute_reply', { text: text.trim(), fileId: file?.fileId });
    if (res?.message) setError(res.message);
    else { setText(''); setFile(null); }
  };
  return (
    <form onSubmit={submit} className="space-y-3 border-t border-line pt-4">
      <Field label={order.viewerRole === 'admin' ? 'Note to both sides' : 'Add your side'} htmlFor="dispute-reply" error={error}>
        <Textarea id="dispute-reply" value={text} onChange={(e) => { setText(e.target.value); setError(''); }} maxLength={5000} error={error} />
      </Field>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <FilePicker orderId={order._id} kind="evidence" value={file} onChange={setFile} label="Attach evidence" compact />
        <Button type="submit" variant="secondary" loading={busy}><Send size={16} /> Send</Button>
      </div>
    </form>
  );
};

const Decide = ({ order, onAct, busy }) => {
  const [outcome, setOutcome] = useState('');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState(String(order.turnaroundDays || 3));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!outcome) { setError('Choose a decision.'); return; }
    if (note.trim().length < 10) { setError('Explain the decision to both sides (at least 10 characters).'); return; }
    const res = await onAct('resolve', { outcome, amount: Number(amount), days: Number(days), note: note.trim() });
    if (res?.message) setError(res.message);
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-ink"><Gavel size={16} /> Decide this dispute</p>
      <div className="space-y-2">
        {DISPUTE_OUTCOMES.map((o) => (
          <label key={o.value} className={`flex cursor-pointer gap-3 rounded-lg border bg-white p-3 ${outcome === o.value ? 'border-brand-500' : 'border-line'}`}>
            <input type="radio" name="outcome" value={o.value} checked={outcome === o.value} onChange={() => { setOutcome(o.value); setError(''); }} className="mt-1 accent-brand-600" />
            <span>
              <span className="block text-[14px] font-medium text-ink">{o.label}</span>
              <span className="block text-[12px] text-ink-soft">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {outcome === 'refund_partial' && (
        <Field label={`Refund to the buyer (of ${money(order.price)})`} htmlFor="refund-amount">
          <Input id="refund-amount" type="number" min="1" max={order.price - 1} step="0.01" prefix="$" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      )}
      {outcome === 'redo' && (
        <Field label="Days to redo it" htmlFor="redo-days">
          <Input id="redo-days" type="number" min="1" max="30" value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
      )}
      <Field label="Explanation for both sides" required htmlFor="resolve-note" error={error}>
        <Textarea id="resolve-note" value={note} onChange={(e) => { setNote(e.target.value); setError(''); }} maxLength={2000} error={error} />
      </Field>
      <div className="flex justify-end"><Button type="submit" loading={busy}>Confirm decision</Button></div>
    </form>
  );
};

const OrderDispute = ({ order, onAct, busy }) => {
  const d = order.dispute;
  if (!d?.openedAt) return null;
  const has = (a) => order.actions?.includes(a);
  const resolution = d.resolution?.outcome ? DISPUTE_OUTCOMES.find((o) => o.value === d.resolution.outcome) : null;

  return (
    <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink"><Scale size={17} className="text-danger" /> Dispute</h2>
        {resolution
          ? <Badge tone="success">Decided</Badge>
          : new Date(d.respondBy) < new Date()
            ? <Badge tone="danger">Answer deadline passed · waiting for our decision</Badge>
            : <Badge tone="danger">Open · answers due {when(d.respondBy)}</Badge>}
      </div>

      {resolution && (
        <div className="mb-4 rounded-xl bg-emerald-50 p-4 text-[14px] text-emerald-900">
          <p className="font-semibold">{resolution.label}{d.resolution.amount ? ` (${money(d.resolution.amount)} back to the buyer)` : ''}</p>
          <p className="mt-1">{d.resolution.note}</p>
          <p className="mt-1 text-[12px] opacity-70">{when(d.resolution.at)}</p>
        </div>
      )}

      <ol className="space-y-3">
        {(d.evidence || []).map((ev, i) => (
          <li key={i} className="rounded-xl bg-canvas p-3">
            <p className="text-[12px] text-ink-faint">
              <span className="font-semibold text-ink">{ROLE_LABEL[ev.role] || ev.role}</span>
              {ev.by?.name && ev.role !== 'admin' ? ` · ${ev.by.name}` : ''} · {when(ev.at)}{i === 0 ? ' · opened the dispute' : ''}
            </p>
            {ev.text && <p className="mt-1 whitespace-pre-wrap text-[14px] text-ink">{ev.text}</p>}
            {ev.file?.fileId && <FileLink file={ev.file} className="mt-2" />}
          </li>
        ))}
      </ol>

      {has('dispute_reply') && <div className="mt-4"><Reply order={order} onAct={onAct} busy={busy} /></div>}
      {has('resolve') && <div className="mt-4"><Decide order={order} onAct={onAct} busy={busy} /></div>}
    </section>
  );
};

export default OrderDispute;
