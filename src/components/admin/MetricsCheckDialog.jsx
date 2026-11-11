'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import api from '@/lib/api';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Flag from '@/components/ui/Flag';
import { Field, Input, Select } from '@/components/ui/Field';
import { DEFAULT_COUNTRIES } from '@/data/countries';

const FIELDS = [
  ['dr', 'DR', 'Ahrefs Domain Rating, 0–100'],
  ['da', 'DA', 'Moz Domain Authority, 0–100'],
  ['authorityScore', 'AS', 'Semrush Authority Score, 0–100'],
  ['traffic', 'Organic traffic', 'Monthly visitors (Ahrefs)'],
  ['keywords', 'Organic keywords', 'Ahrefs'],
  ['semrushTraffic', 'Semrush traffic', 'Monthly visitors'],
  ['spamScore', 'Spam score %', 'Moz, 0–100'],
];

const today = () => new Date().toISOString().slice(0, 10);
const str = (v) => (v === undefined || v === null ? '' : String(v));
const COUNTRIES = [...DEFAULT_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));

// Our team's check of one site: the numbers they looked up, and the date.
// Each check also becomes a point on the site's traffic trend chart.
const MetricsCheckDialog = ({ row, onClose, onSaved }) => {
  const [form, setForm] = useState({});
  const [state, setState] = useState({ saving: false, error: '' });

  useEffect(() => {
    if (!row) return;
    setForm({
      ...Object.fromEntries(FIELDS.map(([k]) => [k, str(row[k])])),
      topCountries: row.topCountries?.length ? row.topCountries.map((c) => ({ code: c.code, share: str(c.share) })) : [{ code: '', share: '' }],
      checkedAt: today(),
    });
    setState({ saving: false, error: '' });
  }, [row]);

  if (!row) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setTop = (i, k, v) => set('topCountries', form.topCountries.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  const reported = row.sellerReported || {};
  const isPast = form.checkedAt && form.checkedAt.slice(0, 7) < today().slice(0, 7);

  const save = async () => {
    setState({ saving: true, error: '' });
    try {
      const body = { checkedAt: form.checkedAt, topCountries: (form.topCountries || []).filter((c) => c.code).map((c) => ({ code: c.code, share: c.share || 0 })) };
      FIELDS.forEach(([k]) => { if (form[k] !== '') body[k] = form[k]; });
      const { data } = await api.put(`/admin/listings/${row._id}/metrics`, body);
      onSaved?.(data.message);
    } catch (err) {
      setState({ saving: false, error: err.response?.data?.message || 'Could not save. Please try again.' });
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`Check metrics: ${row.domain}`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={state.saving}>{isPast ? 'Save as history' : 'Save check'}</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="text-[13px] text-ink-soft">
          Look the site up in your SEO tools and enter today&apos;s numbers. Buyers see them with the check date, and the seller can no longer change them. Use an earlier date to fill in past months of the traffic chart.
        </p>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <Field label="Check date" htmlFor="checkedAt" hint={isPast ? 'Earlier month: only the traffic history is updated.' : 'Today, or the day you looked the numbers up.'}>
            <Input id="checkedAt" type="date" max={today()} value={form.checkedAt || ''} onChange={(e) => set('checkedAt', e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {FIELDS.map(([k, label, hint]) => (
            <Field key={k} label={label} htmlFor={`m-${k}`} hint={Number.isFinite(reported[k]) ? `Seller said ${reported[k].toLocaleString()}` : hint}>
              <Input id={`m-${k}`} type="number" min="0" value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
            </Field>
          ))}
        </div>
        <Field label="Top traffic countries" hint="Up to 3, with the share of traffic from each.">
          <div className="space-y-2">
            {(form.topCountries || []).map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6">{c.code && <Flag code={c.code} />}</span>
                <Select value={c.code} onChange={(e) => setTop(i, 'code', e.target.value)} aria-label={`Country ${i + 1}`} className="flex-1">
                  <option value="">Choose a country</option>
                  {COUNTRIES.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                </Select>
                <Input type="number" min="0" max="100" step="0.1" value={c.share} onChange={(e) => setTop(i, 'share', e.target.value)} aria-label={`Share ${i + 1}`} className="!w-24" />
                <span className="text-sm text-ink-faint">%</span>
                <button type="button" onClick={() => set('topCountries', form.topCountries.filter((_, j) => j !== i))} aria-label={`Remove country ${i + 1}`} className="rounded-md p-2 text-ink-faint hover:bg-line-soft hover:text-ink"><X size={15} /></button>
              </div>
            ))}
            {(form.topCountries || []).length < 3 && (
              <Button size="sm" variant="ghost" onClick={() => set('topCountries', [...(form.topCountries || []), { code: '', share: '' }])}><Plus size={14} /> Add a country</Button>
            )}
          </div>
        </Field>
        {state.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{state.error}</p>}
      </div>
    </Dialog>
  );
};

export default MetricsCheckDialog;
