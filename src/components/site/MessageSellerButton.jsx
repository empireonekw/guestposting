'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import api from '@/lib/api';
import useSession from '@/lib/useSession';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Field';
import BRAND from '@/data/brand';

// Ask a website's seller a question before ordering.
const MessageSellerButton = ({ listing, className = '' }) => {
  const router = useRouter();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [state, setState] = useState({ sending: false, error: '' });

  const start = () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setOpen(true);
  };

  const send = async () => {
    setState({ sending: true, error: '' });
    try {
      const { data } = await api.post('/conversations', { kind: 'direct', listingId: listing._id, body });
      router.push(`/messages?c=${data._id}`);
    } catch (err) {
      setState({ sending: false, error: err.response?.data?.message || 'Could not send. Please try again.' });
    }
  };

  return (
    <>
      <Button variant="secondary" size="lg" className={className} onClick={start}><MessageSquare size={16} /> Message seller</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Message the seller of ${listing.domain}`}
        footer={(<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={send} loading={state.sending} disabled={!body.trim()}>Send</Button></>)}
      >
        <div className="space-y-3">
          <Textarea value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder="e.g. Do you accept articles about crypto? Can the link be dofollow?" aria-label="Message" />
          <p className="text-[12px] text-ink-faint">Keep payments on {BRAND.name}. Our team can read marketplace chats to keep everyone safe.</p>
          {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">{state.error}</p>}
        </div>
      </Dialog>
    </>
  );
};

export default MessageSellerButton;
