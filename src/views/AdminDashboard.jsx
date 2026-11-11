'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Layers, Loader2, Search, Ban, Check, Star, ShieldCheck, PencilLine, MessageSquareWarning, RotateCcw,
  CheckCircle2, AlertCircle, X, ExternalLink,
} from 'lucide-react';
import api from '@/lib/api';
import Pagination from '@/components/Pagination';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Dialog from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { compact, money, hostOf } from '@/lib/format';

const TABS = [
  { key: 'pending', label: 'Pending review' },
  { key: 'changes_requested', label: 'Changes requested' },
  { key: 'approved', label: 'Live' },
  { key: 'rejected', label: 'Rejected' },
];

// What each review action does, for buttons, dialogs and messages.
const ACTIONS = {
  approved: { label: 'Approve', icon: Check },
  changes_requested: {
    label: 'Request changes',
    icon: MessageSquareWarning,
    title: 'Ask the seller for changes',
    field: 'What should the seller change?',
    hint: 'The seller sees this on My websites and by email. The listing stays off the marketplace until they edit it.',
    confirm: 'Send request',
    presets: [
      'Please add 2–3 sample guest posts from this site.',
      'Your traffic numbers don’t match our check. Please update them.',
      'Please add the main country and language of the site.',
      'The price looks wrong. Please check the guest post price.',
    ],
  },
  rejected: {
    label: 'Reject',
    icon: Ban,
    title: 'Reject listing',
    field: 'Reason for rejecting',
    hint: 'The seller sees this reason on My websites and by email.',
    confirm: 'Reject',
    presets: [
      'The site looks like a link farm or PBN.',
      'The site has too little real organic traffic.',
      'The site’s content is thin, copied or off-topic.',
      'We could not open the website.',
    ],
  },
  pending: { label: 'Move to pending', icon: RotateCcw },
};

// The review actions offered on each tab, for one row and for a selection.
const TAB_ACTIONS = {
  pending: ['approved', 'changes_requested', 'rejected'],
  changes_requested: ['approved', 'rejected', 'pending'],
  approved: ['changes_requested', 'rejected'],
  rejected: ['approved', 'changes_requested', 'pending'],
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [listings, setListings] = useState([]);
  const [counts, setCounts] = useState({});
  const [paging, setPaging] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(null); // id of the row (or 'bulk') being saved
  // The reason dialog: { status, ids, site } while open.
  const [asking, setAsking] = useState(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [alert, setAlert] = useState(null);

  const notify = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert((a) => (a?.message === message ? null : a)), 6000);
  };

  // ?status=changes_requested opens that tab (links from the Overview page).
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('status');
    if (TABS.some((t) => t.key === s)) setActiveTab(s);
  }, []);

  // Only the newest request may update the list, so a slow response can't
  // show the wrong tab.
  const queryRef = useRef({ activeTab, page, search });
  const requestSeq = useRef(0);
  useEffect(() => { queryRef.current = { activeTab, page, search }; }, [activeTab, page, search]);

  const fetchListings = async () => {
    const seq = ++requestSeq.current;
    const current = queryRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: current.activeTab, page: String(current.page) });
      if (current.search.trim()) params.append('search', current.search.trim());
      const { data } = await api.get(`/listings/admin?${params.toString()}`);
      if (seq !== requestSeq.current) return;
      setListings(data.listings);
      setCounts(data.counts);
      setPaging({ page: data.page, pages: data.pages, total: data.total, limit: data.limit });
      // Keep only selections that are still on screen.
      setSelected((prev) => new Set(data.listings.map((l) => l._id).filter((id) => prev.has(id))));
    } catch (err) {
      if (seq === requestSeq.current) notify('error', err.response?.data?.message || 'Failed to load listings.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchListings, 250);
    return () => clearTimeout(t);
  }, [activeTab, page, search]);

  // A new tab or search starts again from page 1 with nothing selected.
  useEffect(() => { setPage(1); setSelected(new Set()); }, [activeTab, search]);

  const allOnPage = listings.length > 0 && listings.every((l) => selected.has(l._id));
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(listings.map((l) => l._id)));
  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Sends one review (single row or the selection). Reasons come from the dialog.
  const review = async (status, ids, reason, bulk) => {
    setBusy(bulk ? 'bulk' : ids[0]);
    try {
      if (!bulk) {
        await api.put(`/listings/${ids[0]}/status`, { status, reason });
        const done = {
          approved: 'Listing approved. It is now live.',
          rejected: 'Listing rejected. The seller has been told why.',
          changes_requested: 'Request sent. The seller has been notified.',
          pending: 'Listing moved back to pending.',
        };
        notify('success', done[status]);
      } else {
        const { data } = await api.post('/listings/admin/bulk', { ids, status, reason });
        notify(data.skipped?.length ? 'error' : 'success', data.message);
      }
      setSelected(new Set());
      setAsking(null);
      fetchListings();
    } catch (err) {
      const message = err.response?.data?.message || 'That didn’t work. Please try again.';
      if (asking) setNoteError(message);
      else notify('error', message);
    } finally {
      setBusy(null);
    }
  };

  const start = (status, ids, { bulk = false, site } = {}) => {
    if (ACTIONS[status].presets) {
      setNote('');
      setNoteError('');
      setAsking({ status, ids, bulk, site });
    } else {
      review(status, ids, undefined, bulk);
    }
  };

  const submitNote = (e) => {
    e.preventDefault();
    if (note.trim().length < 5) {
      setNoteError('Please write at least 5 characters. The seller will see it.');
      return;
    }
    review(asking.status, asking.ids, note.trim(), asking.bulk);
  };

  const rowAction = async (path, message, id) => {
    setBusy(id);
    try {
      await api.put(path);
      notify('success', message);
      fetchListings();
    } catch (err) {
      notify('error', err.response?.data?.message || 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  const actions = TAB_ACTIONS[activeTab];
  const dialogAction = asking ? ACTIONS[asking.status] : null;

  return (
    <div className="mx-auto max-w-7xl pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Listings</h1>
        <p className="mt-1 text-[14px] text-ink-soft">Review new websites: approve them, ask the seller for changes, or reject them with a reason. Select several to review them together.</p>
      </div>

      {alert && (
        <div
          role="status"
          className={`mb-5 flex items-start gap-3 rounded-xl border p-4 ${alert.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}
        >
          {alert.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />}
          <p className="flex-1 text-[13px] font-medium">{alert.message}</p>
          <button type="button" onClick={() => setAlert(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100"><X size={16} /></button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
        {/* Tabs and search */}
        <div className="flex flex-col gap-3 border-b border-line px-4 pb-3 pt-4 sm:px-6 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-1" role="tablist">
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${active ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-line-soft hover:text-ink'}`}
                >
                  {tab.label}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${active ? 'bg-white text-brand-700 shadow-sm' : 'bg-line-soft text-ink-soft'}`}>
                    {counts[tab.key] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="relative lg:ml-auto lg:w-64">
            <span className="sr-only">Search listings by URL</span>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by URL…"
              className="h-9 w-full rounded-lg border border-line bg-white pl-8 pr-3 text-[13px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
            />
          </label>
        </div>

        {/* Select all, and the actions for the selection */}
        <div className={`flex min-h-12 flex-wrap items-center gap-2 border-b border-line px-4 py-2 sm:px-6 ${selected.size ? 'bg-brand-50/60' : 'bg-canvas/40'}`}>
          <label className="mr-2 flex cursor-pointer items-center gap-2 text-[13px] text-ink-soft">
            <input
              type="checkbox"
              checked={allOnPage}
              onChange={toggleAll}
              disabled={!listings.length}
              className="h-4 w-4 cursor-pointer rounded border-line accent-brand-600"
            />
            {selected.size ? <span className="font-semibold text-ink">{selected.size} selected</span> : 'Select all on this page'}
          </label>
          {selected.size > 0 && (
            <>
              {actions.map((status) => {
                const a = ACTIONS[status];
                const Icon = a.icon;
                return (
                  <Button
                    key={status}
                    size="sm"
                    variant={status === 'approved' ? 'primary' : status === 'rejected' ? 'danger' : 'secondary'}
                    loading={busy === 'bulk' && !asking && status === 'approved'}
                    disabled={busy === 'bulk'}
                    onClick={() => start(status, [...selected], { bulk: true })}
                  >
                    <Icon size={14} /> {a.label}
                  </Button>
                );
              })}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </>
          )}
        </div>

        {/* Rows */}
        {loading && !listings.length ? (
          <div className="p-16 text-center"><Loader2 size={24} className="mx-auto animate-spin text-brand-500" /></div>
        ) : listings.length === 0 ? (
          <div className="p-16 text-center text-ink-faint">
            <Layers size={32} className="mx-auto mb-3 opacity-50" strokeWidth={1.5} />
            <p className="text-[14px] font-medium">No listings here.</p>
          </div>
        ) : (
          <ul className={`divide-y divide-line ${loading ? 'opacity-60' : ''}`}>
            {listings.map((site) => {
              const sellerState = site.seller?.role === 'seller' ? site.seller.sellerStatus || 'approved' : null;
              const rowNote = site.status === 'rejected' ? site.rejectionReason : site.status === 'changes_requested' ? site.reviewNote : null;
              const checked = selected.has(site._id);
              const rowBusy = busy === site._id;
              const domain = site.domain || hostOf(site.url);
              return (
                <li key={site._id} className={`flex flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center ${checked ? 'bg-brand-50/40' : 'hover:bg-canvas/50'}`}>
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(site._id)}
                      aria-label={`Select ${domain}`}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-line accent-brand-600"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <a href={site.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[14px] font-semibold text-ink hover:text-brand-700">
                          {domain} <ExternalLink size={12} className="text-ink-faint" />
                        </a>
                        {site.isVerified && <Badge tone="brand">Verified</Badge>}
                        {site.isFeatured && <Badge tone="warning">Featured</Badge>}
                        {site.metrics?.source === 'checked' ? <Badge tone="success">Metrics checked</Badge> : <Badge>Seller’s numbers</Badge>}
                        {sellerState === 'pending' && <Badge tone="warning">Seller not approved yet</Badge>}
                        {sellerState === 'blocked' && <Badge tone="danger">Seller blocked</Badge>}
                      </div>
                      <p className="mt-1 text-[12px] text-ink-soft">
                        <span className="capitalize">{site.category || 'No niche'}</span>
                        {' · '}DR {site.dr || 0} · DA {site.da || 0} · {compact(site.traffic)} traffic · {money(site.price)}
                        {' · '}by <span className="text-ink">{site.seller?.name || 'Unknown'}</span>
                        {site.createdAt && <> · added {fmtDate(site.createdAt)}</>}
                      </p>
                      {rowNote && (
                        <p className={`mt-1.5 text-[12px] ${site.status === 'rejected' ? 'text-red-700' : 'text-brand-800'}`}>
                          <span className="font-semibold">{site.status === 'rejected' ? 'Reason: ' : 'Asked for: '}</span>{rowNote}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pl-7 lg:justify-end lg:pl-0">
                    {activeTab === 'approved' && (
                      <>
                        {!site.isVerified && (
                          <Button size="sm" variant="secondary" disabled={rowBusy} onClick={() => rowAction(`/admin/listings/${site._id}/verify`, 'Listing metrics verified.', site._id)}>
                            <ShieldCheck size={14} /> Verify data
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={rowBusy}
                          onClick={() => rowAction(`/admin/listings/${site._id}/feature`, site.isFeatured ? 'Listing unfeatured.' : 'Listing featured for 30 days.', site._id)}
                        >
                          <Star size={14} fill={site.isFeatured ? 'currentColor' : 'none'} /> {site.isFeatured ? 'Unfeature' : 'Feature'}
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" href={`/edit-listing/${site._id}`}>
                      <PencilLine size={14} /> Edit
                    </Button>
                    {actions.filter((s) => s !== 'pending').map((status) => {
                      const a = ACTIONS[status];
                      const Icon = a.icon;
                      return (
                        <Button
                          key={status}
                          size="sm"
                          variant={status === 'approved' ? 'primary' : 'secondary'}
                          className={status === 'rejected' ? 'text-danger hover:border-red-200 hover:bg-red-50' : ''}
                          loading={rowBusy && status === 'approved'}
                          disabled={rowBusy}
                          onClick={() => start(status, [site._id], { site: domain })}
                        >
                          <Icon size={14} /> {a.label}
                        </Button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-line px-6">
          <Pagination page={paging.page} pages={paging.pages} total={paging.total} limit={paging.limit} onChange={setPage} label="listings" />
        </div>
      </section>

      <Dialog
        open={!!asking}
        onClose={() => busy !== 'bulk' && setAsking(null)}
        title={dialogAction ? `${dialogAction.title}${asking.bulk ? ` (${asking.ids.length})` : ''}` : ''}
      >
        {asking && (
          <form onSubmit={submitNote} className="space-y-4">
            <p className="text-[13px] text-ink-soft">
              {asking.bulk ? `${asking.ids.length} selected listings` : asking.site}
              {asking.bulk && ' get the same message. Each seller gets one notification and one email.'}
            </p>
            <Field label={dialogAction.field} hint={dialogAction.hint} error={noteError} htmlFor="review-note" required>
              <Textarea
                id="review-note"
                autoFocus
                value={note}
                maxLength={500}
                onChange={(e) => { setNote(e.target.value); setNoteError(''); }}
                error={noteError}
                placeholder="Write it for the seller"
              />
            </Field>
            <div>
              <p className="mb-2 text-[12px] font-medium text-ink-faint">Quick picks</p>
              <div className="flex flex-wrap gap-1.5">
                {dialogAction.presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setNote(p); setNoteError(''); }}
                    className="rounded-full border border-line px-2.5 py-1 text-left text-[12px] text-ink-soft hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button variant="secondary" onClick={() => setAsking(null)} disabled={!!busy}>Cancel</Button>
              <Button type="submit" variant={asking.status === 'rejected' ? 'danger' : 'primary'} loading={!!busy}>
                {dialogAction.confirm}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
