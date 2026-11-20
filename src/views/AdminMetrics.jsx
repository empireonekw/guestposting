'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, AlertTriangle, BadgeCheck, Copy, ExternalLink, Info, Plus } from 'lucide-react';
import api from '@/lib/api';
import Pagination from '@/components/Pagination';
import Badge from '@/components/ui/Badge';
import { compact } from '@/lib/format';
import MetricsCheckDialog from '@/components/admin/MetricsCheckDialog';

const VIEWS = [
  { id: 'flagged', label: 'Flagged' },
  { id: 'duplicates', label: 'Duplicate domains' },
  { id: 'seller', label: 'Waiting for a check' },
  { id: 'stale', label: 'Out of date' },
  { id: 'all', label: 'All listings' },
];

const FLAG_TONE = { traffic_drop: 'danger', spam: 'danger', mismatch: 'warning', suspicious: 'danger' };
const FLAG_LABEL = { traffic_drop: 'Traffic drop', spam: 'High spam score', mismatch: 'Numbers differ', suspicious: 'Looks fake' };

// Status of the free, automatic data sources (Ahrefs DR, GP Authority index).
const SiteDataStatus = ({ status }) => {
  if (!status) return null;
  const { ahrefs, authority } = status;
  const pill = (ok, text) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} /> {text}
    </span>
  );
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-[13px] text-slate-600">
      <p className="mb-2 font-semibold text-slate-900">Automatic site data (free)</p>
      <div className="flex flex-wrap items-center gap-2">
        {ahrefs?.enabled
          ? pill(!ahrefs.lastError || (ahrefs.lastOkAt && ahrefs.lastOkAt > ahrefs.lastErrorAt), `Ahrefs DR on · ${ahrefs.domains.toLocaleString()} domains looked up · ${ahrefs.batchSize} per request, ${ahrefs.gapSeconds} s apart`)
          : pill(false, 'Ahrefs DR off: add AHREFS_API_KEY to .env')}
        {authority?.ready
          ? pill(true, `GP Authority on · ${(authority.indexedDomains / 1e6).toFixed(1)}M domains · ${authority.release}`)
          : pill(false, 'GP Authority off: run npm run build:authority on the server')}
      </div>
      {ahrefs?.lastError && <p className="mt-2 text-[12px] text-red-700">Last Ahrefs error: {ahrefs.lastError}</p>}
      <p className="mt-2 text-[12px] text-slate-500">DR, GP Authority, domain age and whether the site loads refresh automatically every week. Sites whose numbers look fake are flagged <strong>Looks fake</strong>.</p>
    </div>
  );
};

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');

// Seller's number next to the real one; highlighted when far apart.
const Compare = ({ seller, real, isReal, big = false }) => {
  const show = (v) => (Number.isFinite(v) ? (big ? compact(v) : v) : '–');
  const far = isReal && Number.isFinite(seller) && Number.isFinite(real) && (big ? seller > real * 1.5 && seller - real >= 1000 : Math.abs(seller - real) >= 10);
  return (
    <div className="tabular-nums">
      <span className="font-semibold text-slate-900">{show(real)}</span>
      {Number.isFinite(seller) && isReal && (
        <span className={`block text-[11px] ${far ? 'font-semibold text-red-600' : 'text-slate-400'}`}>seller: {show(seller)}</span>
      )}
    </div>
  );
};

const AdminMetrics = () => {
  // ?view=stale etc. opens that tab (links from the Overview page).
  const [view, setView] = useState(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    return VIEWS.some((x) => x.id === v) ? v : 'flagged';
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data: d } = await api.get(`/admin/metrics-report?view=${view}&page=${page}`);
      setData(d);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the report.');
    }
  }, [view, page]);

  useEffect(() => { load(); }, [load]);

  const saved = (message) => {
    setChecking(null);
    setNotice(message);
    load();
  };

  const s = data?.summary;

  return (
    <div className="mx-auto max-w-7xl pb-16">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Metrics report</h1>
        <p className="mt-1 text-sm text-slate-500">Real metrics against what sellers entered, with listings that need a look.</p>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2.5">
          <Info size={18} className="mt-0.5 shrink-0" />
          <span>Our team checks every site&apos;s numbers and enters them here with a date. Re-check each site at least every {data?.staleAfterDays || 30} days; older checks show under <strong>Out of date</strong>. Sites you add yourself go live straight away.</span>
        </p>
        <Link href="/add-listing" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-blue-700"><Plus size={14} /> Add a site</Link>
      </div>

      <SiteDataStatus status={data?.siteData} />

      {s && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Listings', s.total],
            ['Checked by us', s.real],
            ['Verified owners', s.verified],
            ['Flagged', s.flagged],
            ['Duplicate domains', s.duplicates],
            ['Out of date', s.stale],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[12px] font-medium text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{(value || 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => { setView(v.id); setPage(1); }}
            className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium ${view === v.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {notice && <p className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700">{notice}</p>}
      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">{error}</p>}

      {!data ? (
        <p className="py-16 text-center text-sm text-slate-500">Loading…</p>
      ) : view === 'duplicates' ? (
        <div className="space-y-3">
          {data.duplicates.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">No domain is listed more than once.</p>}
          {data.duplicates.map((d) => (
            <div key={d.domain} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 flex items-center gap-2 font-semibold text-slate-900"><Copy size={15} className="text-amber-600" /> {d.domain} <Badge tone="warning">{d.count} listings</Badge></p>
              <ul className="divide-y divide-slate-100 text-sm">
                {d.listings.map((l) => (
                  <li key={String(l.id)} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-slate-700">{l.sellerName || 'Unknown seller'} <span className="text-slate-400">{l.sellerEmail}</span></span>
                    <span className="flex items-center gap-3">
                      {l.isVerified && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-blue-700"><BadgeCheck size={13} /> Owner verified</span>}
                      <Badge>{l.status}</Badge>
                      <span className="font-semibold tabular-nums">${l.price}</span>
                      <Link href={`/edit-listing/${l.id}`} className="text-[13px] font-medium text-blue-700 hover:underline">Edit</Link>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-slate-500">Only one seller can prove ownership. Ask the others to verify, or reject their listings.</p>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[12px] font-semibold text-slate-500">
                <tr>
                  <th className="p-3 pl-4">Website</th>
                  <th className="p-3">DR</th>
                  <th className="p-3">DA</th>
                  <th className="p-3">Traffic</th>
                  <th className="p-3">Spam</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Problems</th>
                  <th className="p-3 pr-4 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-slate-500">Nothing here.</td></tr>
                )}
                {data.rows.map((r) => {
                  const isReal = r.metrics?.source === 'checked';
                  return (
                    <tr key={r._id} className="align-top">
                      <td className="p-3 pl-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                          {r.domain}
                          {r.isVerified && <BadgeCheck size={14} className="text-blue-600" aria-label="Owner verified" />}
                          <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="text-slate-300 hover:text-blue-600" aria-label={`Open ${r.domain}`}><ExternalLink size={12} /></a>
                        </div>
                        <p className="text-[12px] text-slate-500">{r.seller?.name} · <span className="capitalize">{r.status}</span></p>
                      </td>
                      <td className="p-3"><Compare seller={r.sellerReported?.dr} real={r.dr} isReal={isReal} /></td>
                      <td className="p-3"><Compare seller={r.sellerReported?.da} real={r.da} isReal={isReal} /></td>
                      <td className="p-3"><Compare seller={r.sellerReported?.traffic} real={r.traffic} isReal={isReal} big /></td>
                      <td className="p-3 tabular-nums">{Number.isFinite(r.spamScore) ? `${r.spamScore}%` : '–'}</td>
                      <td className="p-3 text-[12px]">
                        {isReal ? <span className="text-slate-700">Checked {fmt(r.metrics.updatedAt)}</span> : <span className="text-amber-700">Seller&apos;s numbers</span>}
                      </td>
                      <td className="p-3">
                        {(r.flags || []).length === 0 ? <span className="text-slate-400">–</span> : (
                          <ul className="space-y-1">
                            {r.flags.map((f) => (
                              <li key={f.type} className="max-w-72">
                                <Badge tone={FLAG_TONE[f.type] || 'neutral'}><AlertTriangle size={11} /> {FLAG_LABEL[f.type] || f.type}</Badge>
                                <span className="mt-0.5 block text-[12px] text-slate-500">{f.message}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setChecking(r)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700"
                          >
                            <ClipboardCheck size={13} /> {isReal ? 'Re-check' : 'Check metrics'}
                          </button>
                          <Link href={`/edit-listing/${r._id}`} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50">Edit</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <MetricsCheckDialog row={checking} onClose={() => setChecking(null)} onSaved={saved} />
          <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} label="listings" />
        </>
      )}
    </div>
  );
};

export default AdminMetrics;
