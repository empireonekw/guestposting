'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, AlertCircle, CheckCircle2, Loader2, X, FileSpreadsheet, Download } from 'lucide-react';
import api from '@/lib/api';
import ListingForm from '@/components/listing/ListingForm';

const CSV_COLUMNS = [
  ['url', 'Required. The website address.'],
  ['niches', 'Required. Niche names or slugs, separated by | (e.g. SaaS|Business).'],
  ['price', 'Required. Guest post price in USD.'],
  ['language, country', 'Language code (en, de…) and 2-letter country code (us, gb…).'],
  ['dr, da, as', 'Ahrefs DR, Moz DA, Semrush Authority Score (0–100).'],
  ['ahrefs_traffic, keywords, semrush_traffic', 'Monthly organic traffic and keywords.'],
  ['top_countries', 'Up to 3, as code:share, e.g. us:62|gb:9|ca:6.'],
  ['link_type, link_validity, links_per_post', 'dofollow / nofollow; permanent, 24m, 12m or 6m; 1–5.'],
  ['google_news, sponsored, sitewide, foreign_language', 'yes or no.'],
  ['crypto, pharmacy', 'yes if you accept the topic. Gambling, betting and CBD sites can\u2019t be listed.'],
  ['link_insertion_price, turnaround_days', 'Optional.'],
  ['sample_urls, content_rules', 'Optional. Separate sample links with |.'],
];

const AddListing = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('manual');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  // Rows the server could not import: [{ row, url, message }]
  const [bulkErrors, setBulkErrors] = useState([]);

  const createListing = async (payload) => {
    await api.post('/listings', payload);
    router.push('/my-listings');
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setAlert({ type: 'error', message: 'Please select a CSV file to upload.' });
      return;
    }
    const data = new FormData();
    data.append('file', file);
    setLoading(true);
    try {
      const res = await api.post('/listings/bulk', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBulkErrors(res.data.errors || []);
      setAlert({ type: res.data.errors?.length ? 'error' : 'success', message: res.data.message || 'Upload complete.' });
      setFile(null);
    } catch (err) {
      setBulkErrors(err.response?.data?.errors || []);
      setAlert({ type: 'error', message: err.response?.data?.message || 'Bulk upload failed. Please check the file matches the template.' });
    }
    setLoading(false);
  };

  const tab = (id, label) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      aria-pressed={activeTab === id}
      className={`rounded-md px-5 py-1.5 text-[13px] font-medium transition-all ${
        activeTab === id ? 'border border-line bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Add a website</h1>
        <p className="mt-1 text-sm text-ink-soft">Our team reviews every website before buyers can see it.</p>
      </div>

      <div className="mb-6 flex w-fit items-center gap-1 rounded-lg border border-line bg-line-soft p-1">
        {tab('manual', 'One website')}
        {tab('bulk', 'Bulk CSV upload')}
      </div>

      {activeTab === 'manual' ? (
        <ListingForm mode="create" onSubmit={createListing} />
      ) : (
        <div className="space-y-6 rounded-2xl border border-line bg-white p-6 sm:p-8">
          {alert && (
            <div className={`flex items-start gap-3 rounded-lg border p-4 ${alert.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
              {alert.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
              <p className="flex-1 text-[13px] font-medium">{alert.message}</p>
              <button type="button" onClick={() => setAlert(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100"><X size={16} /></button>
            </div>
          )}

          <button
            type="button"
            onClick={() => document.getElementById('csvInput').click()}
            className="group flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-canvas p-10 text-center transition-all hover:border-brand-500 hover:bg-brand-50/30"
          >
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white shadow-sm">
              {file ? <FileSpreadsheet size={24} className="text-emerald-500" strokeWidth={1.5} /> : <UploadCloud size={24} className="text-brand-600" strokeWidth={1.5} />}
            </span>
            <span className="mb-1 text-sm font-medium text-ink">{file ? file.name : 'Click to choose your .csv file'}</span>
            <span className="text-[12px] text-ink-soft">Up to 1 MB and 1,000 rows</span>
          </button>
          <input id="csvInput" type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files[0])} />

          <div className="rounded-lg border border-line bg-canvas p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13px] font-semibold text-ink">Columns</h2>
              <a href="/listing-template.csv" download className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline">
                <Download size={14} /> Download the template
              </a>
            </div>
            <dl className="space-y-1.5 text-[13px]">
              {CSV_COLUMNS.map(([cols, text]) => (
                <div key={cols} className="grid gap-1 sm:grid-cols-[minmax(0,15rem)_1fr]">
                  <dt><code className="rounded border border-line bg-white px-1.5 py-0.5 text-[11px] text-ink">{cols}</code></dt>
                  <dd className="text-ink-soft">{text}</dd>
                </div>
              ))}
            </dl>
          </div>

          <button
            type="button"
            onClick={handleBulkUpload}
            disabled={loading || !file}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-2.5 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-slate-800 disabled:bg-line disabled:text-ink-faint disabled:shadow-none"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : 'Upload websites'}
          </button>

          {bulkErrors.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-red-200 bg-red-50/50">
              <p className="border-b border-red-200 px-4 py-3 text-[13px] font-semibold text-red-800">
                These rows were not imported. Fix them and upload just those rows again.
              </p>
              <ul className="max-h-64 divide-y divide-red-100 overflow-y-auto">
                {bulkErrors.map((e) => (
                  <li key={e.row} className="px-4 py-2 text-[13px] text-red-800">
                    <span className="font-semibold">Row {e.row}</span>
                    {e.url && <span className="text-red-700"> ({e.url})</span>}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AddListing;
