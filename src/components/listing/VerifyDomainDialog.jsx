'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, BadgeCheck } from 'lucide-react';
import api from '@/lib/api';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';

const CopyField = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the value is selectable anyway.
    }
  };
  return (
    <div>
      <p className="mb-1 text-[12px] font-semibold text-ink-soft">{label}</p>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 select-all break-all rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] text-ink">{value}</code>
        <button type="button" onClick={copy} aria-label={`Copy ${label}`} className="flex w-10 items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-line-soft hover:text-ink">
          {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
};

// Shows the DNS record or meta tag that proves ownership, and checks it.
const VerifyDomainDialog = ({ listingId, open, onClose, onVerified }) => {
  const [info, setInfo] = useState(null);
  const [method, setMethod] = useState('dns');
  const [state, setState] = useState({ loading: false, error: '', ok: '' });

  useEffect(() => {
    if (!open) return;
    setInfo(null);
    setState({ loading: false, error: '', ok: '' });
    api.get(`/listings/${listingId}/verification`)
      .then(({ data }) => setInfo(data))
      .catch((err) => setState({ loading: false, ok: '', error: err.response?.data?.message || 'Could not load the verification steps.' }));
  }, [open, listingId]);

  const check = async () => {
    setState({ loading: true, error: '', ok: '' });
    try {
      const { data } = await api.post(`/listings/${listingId}/verification`, { method });
      setInfo(data);
      setState({ loading: false, error: '', ok: data.message });
      onVerified?.();
    } catch (err) {
      setState({ loading: false, ok: '', error: err.response?.data?.message || 'The check failed. Please try again.' });
    }
  };

  const tab = (id, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={method === id}
      onClick={() => setMethod(id)}
      className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium ${method === id ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'}`}
    >
      {label}
    </button>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={info ? `Verify ${info.domain}` : 'Verify your website'}
      footer={info?.isVerified && state.ok ? (
        <Button onClick={onClose}>Done</Button>
      ) : (
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={check} loading={state.loading} disabled={!info}>Check now</Button>
        </>
      )}
    >
      {!info ? (
        <p className="py-6 text-center text-sm text-ink-soft">{state.error || 'Loading…'}</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Prove you own this site and buyers see a <span className="inline-flex items-center gap-1 font-semibold text-brand-700"><BadgeCheck size={14} /> Verified owner</span> badge. Use either method, then press <strong>Check now</strong>. Leave it in place: we check again every month.
          </p>
          <div role="tablist" className="flex gap-1 rounded-lg bg-line-soft p-1">
            {tab('dns', 'DNS TXT record')}
            {tab('meta', 'HTML meta tag')}
          </div>

          {method === 'dns' ? (
            <div className="space-y-3">
              <p className="text-[13px] text-ink-soft">In your domain&apos;s DNS settings (Cloudflare, GoDaddy, Namecheap…), add a new TXT record:</p>
              <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
                <CopyField label="Type" value="TXT" />
                <CopyField label="Name / host" value={info.instructions.dns.host} />
              </div>
              <CopyField label="Value" value={info.instructions.dns.value} />
              <p className="text-[12px] text-ink-faint">DNS changes usually show up within minutes but can take up to an hour.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] text-ink-soft">Paste this tag inside the <code>&lt;head&gt;</code> of your home page (https://{info.domain}/). In WordPress, a header-code plugin works.</p>
              <CopyField label="Meta tag" value={info.instructions.meta} />
            </div>
          )}

          {state.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{state.error}</p>}
          {state.ok && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">{state.ok}</p>}
        </div>
      )}
    </Dialog>
  );
};

export default VerifyDomainDialog;
