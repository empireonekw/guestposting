'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Search, X, Plus } from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Flag from '@/components/ui/Flag';
import { Field, Input, Select, Textarea, Checkbox } from '@/components/ui/Field';
import { compact, money, hostOf } from '@/lib/format';
import {
  LINK_TYPES, LINK_VALIDITY, RESTRICTED_TOPICS, MAX_NICHES, MAX_LINKS_PER_POST, MAX_SAMPLE_URLS, labelOf,
} from '@/data/listingOptions';

const STEPS = ['Site', 'Metrics', 'Link rules', 'Prices'];

// Which step each server field error belongs to.
const FIELD_STEP = {
  url: 0, niches: 0, language: 0, country: 0, description: 0,
  dr: 1, da: 1, authorityScore: 1, traffic: 1, keywords: 1, semrushTraffic: 1, topCountries: 1,
  linkType: 2, linkValidity: 2, linksPerPost: 2, googleNews: 2, markedSponsored: 2, acceptsSitewide: 2,
  acceptsForeignLanguage: 2, sampleUrls: 2, contentRules: 2, casino: 2, cbd: 2, crypto: 2, pharmacy: 2, sports: 2,
  price: 3, linkInsertionPrice: 3, turnaroundDays: 3,
};

const EMPTY = {
  url: '', niches: [], language: 'en', country: '', description: '',
  dr: '', da: '', authorityScore: '', traffic: '', keywords: '', semrushTraffic: '',
  topCountries: [{ code: '', share: '' }],
  linkType: 'dofollow', linkValidity: 'permanent', linksPerPost: '1',
  googleNews: false, markedSponsored: false, acceptsSitewide: false, acceptsForeignLanguage: false,
  allowed: { casino: false, cbd: false, crypto: false, pharmacy: false, sports: false },
  sampleUrls: [''], contentRules: '',
  price: '', linkInsertionPrice: '', turnaroundDays: '3',
};

const str = (v) => (v === undefined || v === null ? '' : String(v));

// A saved listing in the form's shape.
const fromListing = (l) => ({
  ...EMPTY,
  url: l.url || '',
  niches: l.niches?.length ? l.niches : [],
  language: l.language || 'en',
  country: l.country || '',
  description: l.description || '',
  dr: str(l.dr), da: str(l.da), authorityScore: str(l.authorityScore),
  traffic: str(l.traffic), keywords: str(l.keywords), semrushTraffic: str(l.semrushTraffic),
  topCountries: l.topCountries?.length ? l.topCountries.map((c) => ({ code: c.code, share: str(c.share) })) : EMPTY.topCountries,
  linkType: l.linkType || 'dofollow',
  linkValidity: l.linkValidity || 'permanent',
  linksPerPost: str(l.linksPerPost || 1),
  googleNews: !!l.googleNews, markedSponsored: !!l.markedSponsored,
  acceptsSitewide: !!l.acceptsSitewide, acceptsForeignLanguage: !!l.acceptsForeignLanguage,
  allowed: { ...EMPTY.allowed, ...(l.allowed || {}) },
  sampleUrls: l.sampleUrls?.length ? l.sampleUrls : [''],
  contentRules: l.contentRules || '',
  price: str(l.price), linkInsertionPrice: str(l.linkInsertionPrice), turnaroundDays: str(l.turnaroundDays ?? 3),
});

// The form's values as the API expects them.
const toPayload = (f, { includeUrl }) => ({
  ...(includeUrl ? { url: f.url.trim() } : {}),
  niches: f.niches,
  language: f.language,
  country: f.country,
  description: f.description,
  dr: f.dr, da: f.da, authorityScore: f.authorityScore,
  traffic: f.traffic, keywords: f.keywords, semrushTraffic: f.semrushTraffic,
  topCountries: f.topCountries.filter((c) => c.code).map((c) => ({ code: c.code, share: c.share || 0 })),
  linkType: f.linkType,
  linkValidity: f.linkValidity,
  linksPerPost: f.linksPerPost,
  googleNews: f.googleNews,
  markedSponsored: f.markedSponsored,
  acceptsSitewide: f.acceptsSitewide,
  acceptsForeignLanguage: f.acceptsForeignLanguage,
  allowed: f.allowed,
  sampleUrls: f.sampleUrls.map((u) => u.trim()).filter(Boolean),
  contentRules: f.contentRules,
  price: f.price,
  linkInsertionPrice: f.linkInsertionPrice,
  turnaroundDays: f.turnaroundDays,
});

const NichePicker = ({ taxonomy, value, onChange, error }) => {
  const [text, setText] = useState('');
  const all = useMemo(
    () => taxonomy.niches.flatMap((n) => [{ slug: n.slug, name: n.name }, ...n.children.map((c) => ({ slug: c.slug, name: c.name, parent: n.name }))]),
    [taxonomy.niches],
  );
  const byslug = useMemo(() => new Map(all.map((n) => [n.slug, n])), [all]);
  const t = text.trim().toLowerCase();
  const matches = t ? all.filter((n) => n.name.toLowerCase().includes(t)).slice(0, 12) : [];
  const toggle = (slug) => onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug].slice(0, MAX_NICHES));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((slug) => (
            <span key={slug} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-[13px] font-medium text-brand-800">
              {byslug.get(slug)?.name || slug}
              <button type="button" onClick={() => toggle(slug)} aria-label={`Remove ${byslug.get(slug)?.name || slug}`} className="rounded-full p-0.5 hover:bg-brand-100"><X size={13} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={value.length >= MAX_NICHES}
          placeholder={value.length >= MAX_NICHES ? `Up to ${MAX_NICHES} niches` : 'Type to find a niche, e.g. SaaS, Travel, Plumbing'}
          aria-label="Find a niche"
          className={`h-10 w-full rounded-[var(--radius-control)] border bg-white pl-9 pr-3 text-sm outline-none focus:ring-4 ${error ? 'border-red-300 focus:ring-red-500/10' : 'border-line focus:border-brand-500 focus:ring-brand-500/10'}`}
        />
        {matches.length > 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-[var(--shadow-pop)]">
            {matches.map((n) => (
              <button
                key={n.slug}
                type="button"
                onClick={() => { toggle(n.slug); setText(''); }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-line-soft"
              >
                <span>{n.name}{n.parent && <span className="text-ink-faint"> · {n.parent}</span>}</span>
                {value.includes(n.slug) && <Check size={14} className="text-brand-600" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ListingForm = ({ initial, mode = 'create', onSubmit, submitLabel }) => {
  const [taxonomy, setTaxonomy] = useState(null);
  const [form, setForm] = useState(initial ? fromListing(initial) : EMPTY);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/taxonomy').then(({ data }) => setTaxonomy(data)).catch(() => setMessage('Could not load the niche and country lists. Refresh the page to try again.'));
  }, []);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const setAllowed = (key, value) => setForm((f) => ({ ...f, allowed: { ...f.allowed, [key]: value } }));
  const setTop = (i, key, value) => setForm((f) => ({
    ...f,
    topCountries: f.topCountries.map((c, j) => (j === i ? { ...c, [key]: value } : c)),
  }));

  // Quick checks before moving on; the server checks everything again.
  const checkStep = (s) => {
    const e = {};
    if (s === 0) {
      if (mode === 'create' && !/\.[a-z]{2,}/i.test(form.url)) e.url = 'Enter the website address, e.g. example.com';
      if (form.niches.length === 0) e.niches = 'Choose at least one niche';
    }
    if (s === 1) {
      ['dr', 'da', 'authorityScore'].forEach((k) => {
        if (form[k] !== '' && (Number(form[k]) < 0 || Number(form[k]) > 100)) e[k] = 'Use a number from 0 to 100';
      });
      const sum = form.topCountries.reduce((t, c) => t + (Number(c.share) || 0), 0);
      if (sum > 100.5) e.topCountries = 'The shares add up to more than 100%';
    }
    if (s === 3) {
      if (!(Number(form.price) >= 1)) e.price = 'Enter a price of at least $1';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (checkStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async (e) => {
    e.preventDefault();
    if (step < STEPS.length - 1) return next();
    for (let s = 0; s < STEPS.length; s += 1) {
      if (!checkStep(s)) { setStep(s); return undefined; }
    }
    setSaving(true);
    setMessage('');
    try {
      await onSubmit(toPayload(form, { includeUrl: mode === 'create' }));
    } catch (err) {
      const data = err.response?.data || {};
      const field = data.field;
      setMessage(data.message || 'Could not save the listing. Please try again.');
      if (field) {
        setErrors({ [field]: data.message });
        if (FIELD_STEP[field] !== undefined) setStep(FIELD_STEP[field]);
      }
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  if (!taxonomy) {
    return <div className="rounded-xl border border-line p-10 text-center text-sm text-ink-soft">{message || 'Loading…'}</div>;
  }

  const countries = [...taxonomy.countries].sort((a, b) => a.name.localeCompare(b.name));
  const nicheName = (slug) => taxonomy.niches.flatMap((n) => [n, ...n.children]).find((n) => n.slug === slug)?.name || slug;

  return (
    <form onSubmit={submit} noValidate className="rounded-2xl border border-line bg-white">
      {/* Stepper */}
      <ol className="flex border-b border-line">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <button
              type="button"
              onClick={() => { if (i < step || checkStep(step)) setStep(i); }}
              aria-current={i === step ? 'step' : undefined}
              className={`flex w-full items-center justify-center gap-2 border-b-2 px-2 py-3.5 text-[13px] font-semibold ${
                i === step ? 'border-brand-600 text-brand-700' : i < step ? 'border-transparent text-ink' : 'border-transparent text-ink-faint'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-50 text-brand-700' : 'bg-line-soft text-ink-faint'}`}>
                {i < step ? <Check size={12} /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="space-y-5 p-5 sm:p-7">
        {message && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{message}</p>}

        {step === 0 && (
          <>
            <Field label="Website address" htmlFor="url" required error={errors.url} hint={mode === 'edit' ? 'The address cannot be changed. Add the site again if it moved.' : 'The home page of the site you publish on.'}>
              <Input id="url" value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="example.com" disabled={mode === 'edit'} error={errors.url} />
            </Field>
            <Field label={`Niches (up to ${MAX_NICHES})`} required error={errors.niches} hint="The first niche is the main one.">
              <NichePicker taxonomy={taxonomy} value={form.niches} onChange={(v) => set('niches', v)} error={errors.niches} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Language" htmlFor="language" error={errors.language}>
                <Select id="language" value={form.language} onChange={(e) => set('language', e.target.value)}>
                  {taxonomy.languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                </Select>
              </Field>
              <Field label="Main country" htmlFor="country" error={errors.country} hint="Where the site and most readers are.">
                <Select id="country" value={form.country} onChange={(e) => set('country', e.target.value)}>
                  <option value="">International</option>
                  {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="About the site" htmlFor="description" error={errors.description} hint="Optional. Shown to buyers.">
              <Textarea id="description" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={1000} placeholder="What the site covers and who reads it." />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            {initial?.metrics?.source === 'checked' ? (
              <p className="rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
                Our team checked these numbers on {new Date(initial.metrics.updatedAt).toLocaleDateString()}. Buyers see our checked numbers; if yours have changed, update them here and we&apos;ll check again.
              </p>
            ) : (
              <p className="text-sm text-ink-soft">Enter the numbers from your Ahrefs, Moz and Semrush accounts. Our team checks them before buyers see them as checked.</p>
            )}
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="DR (Ahrefs)" htmlFor="dr" error={errors.dr}><Input id="dr" type="number" min="0" max="100" value={form.dr} onChange={(e) => set('dr', e.target.value)} error={errors.dr} /></Field>
              <Field label="DA (Moz)" htmlFor="da" error={errors.da}><Input id="da" type="number" min="0" max="100" value={form.da} onChange={(e) => set('da', e.target.value)} error={errors.da} /></Field>
              <Field label="AS (Semrush)" htmlFor="as" error={errors.authorityScore}><Input id="as" type="number" min="0" max="100" value={form.authorityScore} onChange={(e) => set('authorityScore', e.target.value)} error={errors.authorityScore} /></Field>
              <Field label="Organic traffic (Ahrefs)" htmlFor="traffic" error={errors.traffic} hint="Monthly visitors"><Input id="traffic" type="number" min="0" value={form.traffic} onChange={(e) => set('traffic', e.target.value)} error={errors.traffic} /></Field>
              <Field label="Organic keywords (Ahrefs)" htmlFor="keywords" error={errors.keywords}><Input id="keywords" type="number" min="0" value={form.keywords} onChange={(e) => set('keywords', e.target.value)} error={errors.keywords} /></Field>
              <Field label="Organic traffic (Semrush)" htmlFor="semrush" error={errors.semrushTraffic} hint="Monthly visitors"><Input id="semrush" type="number" min="0" value={form.semrushTraffic} onChange={(e) => set('semrushTraffic', e.target.value)} error={errors.semrushTraffic} /></Field>
            </div>
            <Field label="Top traffic countries" error={errors.topCountries} hint="Up to 3, with the share of traffic from each.">
              <div className="space-y-2">
                {form.topCountries.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6">{c.code && <Flag code={c.code} />}</span>
                    <Select value={c.code} onChange={(e) => setTop(i, 'code', e.target.value)} aria-label={`Top country ${i + 1}`} className="flex-1">
                      <option value="">Choose a country</option>
                      {countries.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                    </Select>
                    <div className="relative w-28">
                      <Input type="number" min="0" max="100" step="0.1" value={c.share} onChange={(e) => setTop(i, 'share', e.target.value)} aria-label={`Share of top country ${i + 1}`} className="pr-7" />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">%</span>
                    </div>
                    <button type="button" onClick={() => set('topCountries', form.topCountries.filter((_, j) => j !== i).length ? form.topCountries.filter((_, j) => j !== i) : EMPTY.topCountries)} aria-label={`Remove top country ${i + 1}`} className="rounded-md p-2 text-ink-faint hover:bg-line-soft hover:text-ink">
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {form.topCountries.length < 3 && (
                  <Button size="sm" variant="ghost" onClick={() => set('topCountries', [...form.topCountries, { code: '', share: '' }])}>
                    <Plus size={14} /> Add a country
                  </Button>
                )}
              </div>
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Link type" htmlFor="linkType" error={errors.linkType}>
                <Select id="linkType" value={form.linkType} onChange={(e) => set('linkType', e.target.value)}>
                  {LINK_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
              <Field label="How long the link stays" htmlFor="validity" error={errors.linkValidity}>
                <Select id="validity" value={form.linkValidity} onChange={(e) => set('linkValidity', e.target.value)}>
                  {LINK_VALIDITY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
              <Field label="Links per post" htmlFor="links" error={errors.linksPerPost}>
                <Select id="links" value={form.linksPerPost} onChange={(e) => set('linksPerPost', e.target.value)}>
                  {Array.from({ length: MAX_LINKS_PER_POST }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Checkbox label="Included in Google News" checked={form.googleNews} onChange={(e) => set('googleNews', e.target.checked)} />
              <Checkbox label="Posts are marked as sponsored" description="The article carries a sponsored or partner label." checked={form.markedSponsored} onChange={(e) => set('markedSponsored', e.target.checked)} />
              <Checkbox label="Sells sidebar / footer / blogroll links" checked={form.acceptsSitewide} onChange={(e) => set('acceptsSitewide', e.target.checked)} />
              <Checkbox label="Accepts articles in other languages" checked={form.acceptsForeignLanguage} onChange={(e) => set('acceptsForeignLanguage', e.target.checked)} />
            </div>
            <Field label="Topics you accept" hint="Buyers filter on these. Leave unticked if you don't accept the topic.">
              <div className="grid gap-2.5 sm:grid-cols-3">
                {RESTRICTED_TOPICS.map((t) => (
                  <Checkbox key={t.key} label={t.label} checked={!!form.allowed[t.key]} onChange={(e) => setAllowed(t.key, e.target.checked)} />
                ))}
              </div>
            </Field>
            <Field label="Sample posts" error={errors.sampleUrls} hint={`Up to ${MAX_SAMPLE_URLS} links to sponsored posts already on the site.`}>
              <div className="space-y-2">
                {form.sampleUrls.map((u, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={u} onChange={(e) => set('sampleUrls', form.sampleUrls.map((x, j) => (j === i ? e.target.value : x)))} placeholder="https://example.com/a-sponsored-post" aria-label={`Sample post ${i + 1}`} />
                    {form.sampleUrls.length > 1 && (
                      <button type="button" onClick={() => set('sampleUrls', form.sampleUrls.filter((_, j) => j !== i))} aria-label={`Remove sample post ${i + 1}`} className="rounded-md p-2 text-ink-faint hover:bg-line-soft hover:text-ink"><X size={16} /></button>
                    )}
                  </div>
                ))}
                {form.sampleUrls.length < MAX_SAMPLE_URLS && (
                  <Button size="sm" variant="ghost" onClick={() => set('sampleUrls', [...form.sampleUrls, ''])}><Plus size={14} /> Add a sample</Button>
                )}
              </div>
            </Field>
            <Field label="Content rules" htmlFor="rules" error={errors.contentRules} hint="Word count, images, link rules, topics you refuse…">
              <Textarea id="rules" value={form.contentRules} onChange={(e) => set('contentRules', e.target.value)} maxLength={2000} placeholder="e.g. 800+ words, 1 image, no links to competitors." />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Guest post price" htmlFor="price" required error={errors.price} hint="In US dollars">
                <Input id="price" type="number" min="1" step="0.01" prefix="$" value={form.price} onChange={(e) => set('price', e.target.value)} error={errors.price} />
              </Field>
              <Field label="Link insertion price" htmlFor="li" error={errors.linkInsertionPrice} hint="Optional. Leave empty if you don't offer it.">
                <Input id="li" type="number" min="0" step="0.01" prefix="$" value={form.linkInsertionPrice} onChange={(e) => set('linkInsertionPrice', e.target.value)} error={errors.linkInsertionPrice} />
              </Field>
              <Field label="Turnaround (days)" htmlFor="tat" error={errors.turnaroundDays} hint="Usual time to publish">
                <Input id="tat" type="number" min="0" max="60" value={form.turnaroundDays} onChange={(e) => set('turnaroundDays', e.target.value)} error={errors.turnaroundDays} />
              </Field>
            </div>

            <div className="rounded-xl bg-canvas p-4 text-sm">
              <p className="mb-2 font-semibold text-ink">Review</p>
              <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                <div className="flex justify-between gap-3"><dt className="text-ink-soft">Website</dt><dd className="truncate font-medium">{hostOf(form.url) || '–'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-soft">Niches</dt><dd className="truncate text-right font-medium">{form.niches.map(nicheName).join(', ') || '–'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-soft">DR / DA / AS</dt><dd className="font-medium">{form.dr || '–'} / {form.da || '–'} / {form.authorityScore || '–'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-soft">Traffic</dt><dd className="font-medium">{compact(form.traffic)} Ahrefs · {compact(form.semrushTraffic)} Semrush</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-soft">Link</dt><dd className="font-medium">{labelOf(LINK_TYPES, form.linkType)}, {labelOf(LINK_VALIDITY, form.linkValidity).toLowerCase()}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-soft">Price</dt><dd className="font-medium">{form.price ? money(form.price) : '–'}</dd></div>
              </dl>
            </div>
            {mode === 'edit' && <p className="text-[13px] text-ink-soft">Saving sends the listing back to our team for review. It stays hidden from buyers until it is approved again.</p>}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-7">
        <Button variant="secondary" onClick={back} disabled={step === 0}>Back</Button>
        {step < STEPS.length - 1 ? (
          <Button type="submit">Next: {STEPS[step + 1]}</Button>
        ) : (
          <Button type="submit" loading={saving}>{submitLabel || (mode === 'edit' ? 'Save changes' : 'Submit for review')}</Button>
        )}
      </div>
    </form>
  );
};

export default ListingForm;
