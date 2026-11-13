'use client';

import { useRef, useState } from 'react';
import { Paperclip, FileText, X, Loader2, Download } from 'lucide-react';
import api from '@/lib/api';
import { FILE_ACCEPT, MAX_FILE_BYTES } from '@/data/orderStatus';

// Uploading and downloading order files. Downloads go through the API with
// the login token, so the browser gets the file as a blob and saves it.

export const sizeText = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export const uploadOrderFile = async (orderId, file, kind) => {
  if (file.size > MAX_FILE_BYTES) throw new Error(`Files can be at most ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  try {
    // Same as the CSV upload: axios swaps this for the real multipart header with its boundary.
    const { data } = await api.post(`/orders/${orderId}/files`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return data;
  } catch (err) {
    throw new Error(err.response?.data?.message || 'The upload failed. Please try again.');
  }
};

export const FileLink = ({ file, className = '' }) => {
  const [busy, setBusy] = useState(false);
  if (!file?.fileId) return null;
  const download = async () => {
    setBusy(true);
    try {
      const { data } = await api.get(`/files/${file.fileId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name || 'file';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      window.alert('Could not download the file.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className={`inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-left text-[13px] text-ink hover:border-brand-300 hover:bg-brand-50 ${className}`}
    >
      {busy ? <Loader2 size={14} className="shrink-0 animate-spin text-brand-600" /> : <FileText size={14} className="shrink-0 text-brand-600" />}
      <span className="truncate">{file.name}</span>
      {file.size ? <span className="shrink-0 text-[11px] text-ink-faint">{sizeText(file.size)}</span> : null}
      <Download size={13} className="shrink-0 text-ink-faint" />
    </button>
  );
};

// "Attach a file" for a form: uploads straight away and reports the saved
// file (or null when removed) through onChange.
export const FilePicker = ({ orderId, kind, value, onChange, label = 'Attach a file', compact = false }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onChange(await uploadOrderFile(orderId, file, kind));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <input ref={input} type="file" accept={FILE_ACCEPT} className="hidden" onChange={pick} />
      {value ? (
        <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-[13px] text-brand-900">
          <FileText size={14} className="shrink-0" />
          <span className="truncate">{value.name}</span>
          <span className="shrink-0 text-[11px] opacity-70">{sizeText(value.size)}</span>
          <button type="button" onClick={() => onChange(null)} aria-label={`Remove ${value.name}`} className="shrink-0 rounded p-0.5 hover:bg-brand-100"><X size={13} /></button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className={`inline-flex items-center gap-2 rounded-lg border border-dashed border-line text-[13px] font-medium text-ink-soft hover:border-brand-300 hover:text-brand-700 disabled:opacity-60 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />} {busy ? 'Uploading…' : label}
        </button>
      )}
      {!value && !compact && <p className="mt-1 text-[11px] text-ink-faint">PDF, Word, text or image · up to {MAX_FILE_BYTES / 1024 / 1024} MB</p>}
      {error && <p className="mt-1 text-[12px] font-medium text-danger">{error}</p>}
    </div>
  );
};
