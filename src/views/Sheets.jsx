'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Download, Link2, Check, Loader2, Search } from 'lucide-react';
import api from '@/lib/api';
import useSession from '@/lib/useSession';
import Button from '@/components/ui/Button';

// Site sheets for sellers and admins: every live website on the marketplace,
// grouped by category, as Excel files to download or share (a share link
// opens this page on that category for any signed-in seller or admin).

const saveBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const fileNameFrom = (header, fallback) => header?.match(/filename="([^"]+)"/)?.[1] || fallback;

const Sheets = () => {
  const { user } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);
  const [copied, setCopied] = useState(null);
  const [shared, setShared] = useState(null);

  useEffect(() => {
    api.get('/sheets')
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(err.response?.data?.message || 'Could not load the sheets.'));
    const c = new URLSearchParams(window.location.search).get('category');
    if (c) setShared(c);
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.categories || []).filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [data, query]);
  const sharedCat = data?.categories.find((c) => c.slug === shared);

  const download = async (category) => {
    setBusy(category);
    try {
      const res = await api.get(`/sheets/download?category=${encodeURIComponent(category)}`, { responseType: 'blob' });
      saveBlob(res.data, fileNameFrom(res.headers['content-disposition'], `${category}-sites.xlsx`));
    } catch {
      window.alert('The download failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const share = async (slug) => {
    const link = `${window.location.origin}/sheets?category=${slug}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(slug);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt('Copy this link', link);
    }
  };

  return (
    <div className="mx-auto max-w-5xl pb-20">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Site sheets</h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            Every live website on the marketplace, by category, as Excel sheets: price, DR, DA, traffic, country, link type and an order link for each.
            {user?.role === 'admin' ? ' As an admin your sheets also include the seller.' : ''} Share them with your clients, then order the sites they pick.
          </p>
        </div>
        <Button onClick={() => download('all')} loading={busy === 'all'} disabled={!data?.total}>
          <Download size={16} /> All sites (one tab per category)
        </Button>
      </div>

      {sharedCat && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] text-brand-900">Someone shared the <strong>{sharedCat.name}</strong> sheet with you ({sharedCat.sites} site{sharedCat.sites === 1 ? '' : 's'}).</p>
          <Button onClick={() => download(sharedCat.slug)} loading={busy === sharedCat.slug}><Download size={16} /> Download it</Button>
        </div>
      )}

      {error && <p className="rounded-xl bg-red-50 p-4 text-[14px] text-red-800">{error}</p>}
      {!data && !error && <div className="p-16 text-center"><Loader2 size={24} className="mx-auto animate-spin text-brand-500" /></div>}

      {data && (
        <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-[13px] text-ink-soft">{data.total.toLocaleString()} live sites in {data.categories.length} categories</p>
            <label className="relative sm:w-64">
              <span className="sr-only">Search categories</span>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search categories"
                className="h-9 w-full rounded-lg border border-line bg-white pl-8 pr-3 text-[13px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10" />
            </label>
          </div>
          {shown.length === 0 ? (
            <p className="p-12 text-center text-[14px] text-ink-faint">No categories match.</p>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((c) => (
                <li key={c.slug} className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 ${c.slug === shared ? 'bg-brand-50/50' : ''}`}>
                  <FileSpreadsheet size={20} className="shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink">{c.name}</p>
                    <p className="text-[12px] text-ink-faint">{c.sites.toLocaleString()} site{c.sites === 1 ? '' : 's'}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => share(c.slug)}>
                    {copied === c.slug ? <Check size={14} /> : <Link2 size={14} />} {copied === c.slug ? 'Link copied' : 'Share'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => download(c.slug)} loading={busy === c.slug}>
                    <Download size={14} /> Excel
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <p className="mt-3 text-[12px] text-ink-faint">Share links work for signed-in sellers and admins. Sheets always show the latest prices and numbers when downloaded.</p>
    </div>
  );
};

export default Sheets;
