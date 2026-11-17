'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BellRing, BellOff, Loader2, Trash2, Pencil, ExternalLink, Check, X,
} from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { activeChips, SORTS } from '@/components/site/filters';

// Saved searches and their email alerts (Module 6).

const ALERTS = [
  { value: 'daily', label: 'Daily email' },
  { value: 'weekly', label: 'Weekly email' },
  { value: 'off', label: 'No emails' },
];

const day = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

const Row = ({ search, describe, onChange, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(search.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const chips = describe(search.params);
  const sort = SORTS.find((s) => s.value && s.value === search.params.sort);

  const save = async (changes) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.put(`/saved-searches/${search._id}`, changes);
      onChange(data);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the change.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save({ name: name.trim() }); }}>
              <input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="Search name" className="h-9 min-w-0 flex-1 rounded-lg border border-line px-2.5 text-sm outline-none focus:border-brand-500" />
              <button type="submit" disabled={busy} aria-label="Save name" className="rounded-lg p-2 text-brand-700 hover:bg-brand-50"><Check size={16} /></button>
              <button type="button" onClick={() => { setEditing(false); setName(search.name); }} aria-label="Cancel" className="rounded-lg p-2 text-ink-faint hover:bg-line-soft"><X size={16} /></button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link href={search.href} className="truncate text-[15px] font-semibold text-ink hover:text-brand-700">{search.name}</Link>
              <button type="button" onClick={() => setEditing(true)} aria-label={`Rename ${search.name}`} className="rounded p-1 text-ink-faint hover:bg-line-soft hover:text-ink"><Pencil size={13} /></button>
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {chips.length ? chips.map((c) => <Badge key={c.id}>{c.label}</Badge>) : <Badge>All publishers</Badge>}
            {sort && <Badge tone="brand">{sort.label}</Badge>}
          </div>
          <p className="mt-1.5 text-[12px] text-ink-faint">
            {search.matches === null ? 'Some filters no longer exist' : `${search.matches.toLocaleString()} site${search.matches === 1 ? '' : 's'} match now`}
            {' · '}saved {day(search.createdAt)}
            {search.lastAlertAt && search.alerts !== 'off' ? ` · last checked ${day(search.lastAlertAt)}` : ''}
          </p>
          {error && <p className="mt-1 text-[12px] font-medium text-danger">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Alerts for {search.name}</span>
            {search.alerts === 'off'
              ? <BellOff size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              : <BellRing size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-600" />}
            <select
              value={search.alerts}
              disabled={busy}
              onChange={(e) => save({ alerts: e.target.value })}
              className="h-9 rounded-lg border border-line bg-white pl-8 pr-2 text-[13px] text-ink outline-none focus:border-brand-500"
            >
              {ALERTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>
          <Button size="sm" variant="secondary" href={search.href} className="h-9"><ExternalLink size={13} /> Open</Button>
          <button type="button" onClick={() => onDelete(search)} aria-label={`Delete ${search.name}`} title="Delete" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint hover:bg-red-50 hover:text-danger">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </li>
  );
};

const SavedSearches = () => {
  const [data, setData] = useState(null);
  const [taxonomy, setTaxonomy] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/saved-searches').then(({ data: d }) => setData(d)).catch(() => setError('Could not load your saved searches.'));
    api.get('/taxonomy').then(({ data: t }) => setTaxonomy(t)).catch(() => {});
  }, []);

  const describe = useMemo(() => {
    const niches = new Map();
    (taxonomy?.niches || []).forEach((n) => {
      niches.set(n.slug, n);
      (n.children || []).forEach((c) => niches.set(c.slug, c));
    });
    return (params) => activeChips(params, { niches, countries: taxonomy?.countries || [], languages: taxonomy?.languages || [] });
  }, [taxonomy]);

  const change = (updated) => setData((d) => ({ ...d, searches: d.searches.map((s) => (s._id === updated._id ? updated : s)) }));
  const remove = async (search) => {
    if (!window.confirm(`Delete the saved search “${search.name}”?`)) return;
    try {
      await api.delete(`/saved-searches/${search._id}`);
      setData((d) => ({ ...d, searches: d.searches.filter((s) => s._id !== search._id) }));
    } catch {
      window.alert('Could not delete it. Please try again.');
    }
  };

  return (
    <div className="mx-auto max-w-5xl pb-20">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Saved searches</h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            Filters you saved on the publisher list. With alerts on, we email you when new sites that match go live.
          </p>
        </div>
        <Button href="/sites" variant="secondary">New search</Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
        {error ? (
          <p className="p-12 text-center text-[14px] text-danger">{error}</p>
        ) : !data ? (
          <div className="p-16 text-center"><Loader2 size={24} className="mx-auto animate-spin text-brand-500" /></div>
        ) : data.searches.length === 0 ? (
          <div className="p-16 text-center">
            <BellRing size={32} className="mx-auto mb-3 text-ink-faint opacity-60" strokeWidth={1.5} />
            <p className="text-[15px] font-semibold text-ink">No saved searches yet</p>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-soft">On the publisher list, set your filters (for example USA, SaaS, DR 50+) and press “Save search”.</p>
            <Button href="/sites" className="mt-4">Go to the publisher list</Button>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.searches.map((s) => <Row key={s._id} search={s} describe={describe} onChange={change} onDelete={remove} />)}
          </ul>
        )}
      </section>
      {data && data.searches.length > 0 && (
        <p className="mt-3 text-[12px] text-ink-faint">{data.searches.length} of {data.max} saved searches used.</p>
      )}
    </div>
  );
};

export default SavedSearches;
