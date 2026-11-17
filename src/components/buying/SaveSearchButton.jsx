'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BellPlus, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import useSession from '@/lib/useSession';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';

export const ALERT_OPTIONS = [
  { value: 'daily', label: 'Email me daily about new sites' },
  { value: 'weekly', label: 'Email me weekly about new sites' },
  { value: 'off', label: 'No emails, just save it' },
];

// "Save search" on the publisher list (Module 6): keeps the current filters
// with a name and, if wanted, emails about new matching sites.
const SaveSearchButton = ({ filters, defaultName }) => {
  const router = useRouter();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [alerts, setAlerts] = useState('weekly');
  const [state, setState] = useState({ loading: false, error: '', done: false });

  const start = () => {
    if (!user) {
      const here = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?next=${encodeURIComponent(here)}`);
      return;
    }
    setName(defaultName.slice(0, 80));
    setAlerts('weekly');
    setState({ loading: false, error: '', done: false });
    setOpen(true);
  };

  const save = async (e) => {
    e?.preventDefault();
    setState({ loading: true, error: '', done: false });
    try {
      await api.post('/saved-searches', { name: name.trim(), alerts, params: filters });
      setState({ loading: false, error: '', done: true });
    } catch (err) {
      setState({ loading: false, error: err.response?.data?.message || 'Could not save this search.', done: false });
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={start} title="Save these filters and get alerts">
        <BellPlus size={16} />
        <span className="hidden sm:inline">Save search</span>
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Save this search"
        footer={state.done ? (
          <>
            <Button variant="secondary" href="/saved-searches">See saved searches</Button>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={state.loading} disabled={!name.trim()}>Save search</Button>
          </>
        )}
      >
        {state.done ? (
          <p className="flex items-start gap-2 text-sm text-ink">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
            <span>
              Saved. {alerts === 'off' ? 'Open it any time from ' : `We’ll email you ${alerts} when new sites match. Manage it in `}
              <Link href="/saved-searches" className="font-medium text-brand-700 hover:underline">Saved searches</Link>.
            </span>
          </p>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <Field label="Name" htmlFor="ss-name" required>
              <Input id="ss-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. USA SaaS DR 50+" />
            </Field>
            <Field label="Alerts" htmlFor="ss-alerts" hint="Only websites that go live after today count as new.">
              <Select id="ss-alerts" value={alerts} onChange={(e) => setAlerts(e.target.value)}>
                {ALERT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">{state.error}</p>}
          </form>
        )}
      </Dialog>
    </>
  );
};

export default SaveSearchButton;
