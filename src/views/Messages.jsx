'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageSquare, LifeBuoy, Send, ArrowLeft, Plus, Lock, CheckCircle2, RotateCcw, Search, Ban, Globe,
} from 'lucide-react';
import api from '@/lib/api';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';

const when = (d) => {
  const date = new Date(d);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const NewSupportDialog = ({ open, onClose, onCreated }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [state, setState] = useState({ sending: false, error: '' });
  const send = async () => {
    setState({ sending: true, error: '' });
    try {
      const { data } = await api.post('/conversations', { kind: 'support', subject, body });
      setSubject('');
      setBody('');
      setState({ sending: false, error: '' });
      onCreated(data._id);
    } catch (err) {
      setState({ sending: false, error: err.response?.data?.message || 'Could not send. Please try again.' });
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Contact LetRank support"
      footer={(<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={send} loading={state.sending} disabled={!subject.trim() || !body.trim()}>Send</Button></>)}
    >
      <div className="space-y-4">
        <Field label="Subject" htmlFor="sup-subject"><Input id="sup-subject" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Question about my order" /></Field>
        <Field label="Message" htmlFor="sup-body"><Textarea id="sup-body" value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder="How can we help?" /></Field>
        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-800">{state.error}</p>}
      </div>
    </Dialog>
  );
};

const Messages = () => {
  const router = useRouter();
  const user = JSON.parse(localStorage.getItem('userInfo'));
  const isAdmin = user?.role === 'admin';
  const boxes = isAdmin
    ? [{ id: 'support', label: 'Support queue' }, { id: 'mine', label: 'My chats' }, { id: 'all', label: 'All chats' }]
    : [{ id: 'mine', label: 'My chats' }];

  const [box, setBox] = useState(boxes[0].id);
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(() => new URLSearchParams(window.location.search).get('c'));
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const endRef = useRef(null);
  const lastAt = useRef(null);

  const loadList = useCallback(async () => {
    try {
      const status = box === 'support' ? 'open' : 'all';
      const { data } = await api.get(`/conversations?box=${box}&status=${status}&limit=100`);
      setList(data.conversations);
    } catch {
      // Keep the old list; the next poll tries again.
    }
  }, [box]);

  useEffect(() => {
    loadList();
    const t = setInterval(() => { if (!document.hidden) loadList(); }, 8000);
    return () => clearInterval(t);
  }, [loadList]);

  // Open a thread, then poll it for new messages.
  useEffect(() => {
    if (!selected) { setThread(null); setMessages([]); return undefined; }
    let stopped = false;
    lastAt.current = null;
    setError('');
    const first = async () => {
      try {
        const { data } = await api.get(`/conversations/${selected}`);
        if (stopped) return;
        setThread(data.conversation);
        setMessages(data.messages);
        lastAt.current = data.messages.at(-1)?.createdAt || null;
        loadList();
      } catch (err) {
        if (!stopped) setError(err.response?.data?.message || 'Could not open this conversation.');
      }
    };
    const poll = async () => {
      if (document.hidden || stopped) return;
      try {
        const after = lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : '';
        const { data } = await api.get(`/conversations/${selected}${after}`);
        if (stopped) return;
        setThread(data.conversation);
        if (data.messages.length) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m._id));
            return [...prev, ...data.messages.filter((m) => !seen.has(m._id))];
          });
          lastAt.current = data.messages.at(-1).createdAt;
        }
      } catch {
        // Try again next tick.
      }
    };
    first();
    const t = setInterval(poll, 4000);
    return () => { stopped = true; clearInterval(t); };
  }, [selected, loadList]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length, selected]);

  const open = (id) => {
    setSelected(id);
    router.replace(id ? `/messages?c=${id}` : '/messages', { scroll: false });
  };

  const send = async (e) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const { data } = await api.post(`/conversations/${selected}`, { body });
      setMessages((prev) => [...prev, data]);
      lastAt.current = data.createdAt;
      setDraft('');
      loadList();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status) => {
    try {
      await api.patch(`/conversations/${selected}`, { status });
      setThread((t) => ({ ...t, status }));
      loadList();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update this chat.');
    }
  };

  const shown = list.filter((c) => {
    const t = filter.trim().toLowerCase();
    return !t || `${c.title} ${c.subject} ${c.lastMessage}`.toLowerCase().includes(t);
  });

  return (
    <div className="pb-4">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Messages</h1>
          <p className="mt-1 text-[15px] text-ink-soft">
            {isAdmin ? 'Answer support questions and keep an eye on every conversation.' : 'Chat with sellers, buyers and LetRank support.'}
          </p>
        </div>
        {!isAdmin && (
          <Button onClick={() => setNewOpen(true)}><LifeBuoy size={16} /> Contact support</Button>
        )}
      </div>

      <div className="grid h-[calc(100vh-220px)] min-h-[520px] overflow-hidden rounded-3xl border border-line bg-white shadow-[var(--shadow-card)] md:grid-cols-[340px_1fr]">
        {/* Conversation list */}
        <aside className={`flex min-h-0 flex-col border-r border-line ${selected ? 'hidden md:flex' : 'flex'}`}>
          {boxes.length > 1 && (
            <div className="flex gap-1 border-b border-line p-2" role="tablist">
              {boxes.map((b) => (
                <button key={b.id} type="button" role="tab" aria-selected={box === b.id} onClick={() => { setBox(b.id); open(null); }}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[13px] font-medium ${box === b.id ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-canvas'}`}>
                  {b.label}
                </button>
              ))}
            </div>
          )}
          <div className="border-b border-line p-3">
            <label className="relative block">
              <span className="sr-only">Search conversations</span>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search" className="h-9 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm outline-none focus:border-brand-500" />
            </label>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {shown.length === 0 && (
              <li className="px-6 py-14 text-center text-sm text-ink-faint">
                <MessageSquare size={24} className="mx-auto mb-2" />
                {box === 'support' ? 'No open support questions.' : 'No conversations yet.'}
              </li>
            )}
            {shown.map((c) => (
              <li key={c._id}>
                <button type="button" onClick={() => open(c._id)}
                  className={`flex w-full items-start gap-3 border-b border-line-soft px-4 py-3.5 text-left ${selected === c._id ? 'bg-brand-50/60' : 'hover:bg-canvas'}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${c.kind === 'support' ? 'bg-brand-gradient text-white' : 'bg-brand-100 text-brand-700'}`}>
                    {c.kind === 'support' ? <LifeBuoy size={17} /> : (c.title || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-[14px] ${c.unread ? 'font-bold text-ink' : 'font-semibold text-ink'}`}>{c.title}</span>
                      <span className="shrink-0 text-[11px] text-ink-faint">{when(c.lastMessageAt)}</span>
                    </span>
                    {c.subject && <span className="block truncate text-[12px] font-medium text-ink-soft">{c.subject}</span>}
                    <span className="flex items-center gap-2">
                      <span className={`truncate text-[13px] ${c.unread ? 'text-ink' : 'text-ink-faint'}`}>{c.lastFromTeam ? 'Support: ' : ''}{c.lastMessage}</span>
                      {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {c.status === 'closed' && <span className="rounded bg-line-soft px-1.5 text-[10px] font-semibold uppercase text-ink-faint">Closed</span>}
                      {isAdmin && c.waitingForTeam && <span className="rounded bg-amber-50 px-1.5 text-[10px] font-semibold uppercase text-amber-700">Needs reply</span>}
                      {c.readOnly && <span className="rounded bg-line-soft px-1.5 text-[10px] font-semibold uppercase text-ink-faint">View only</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Thread */}
        <section className={`min-h-0 flex-col ${selected ? 'flex' : 'hidden md:flex'}`}>
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center text-ink-faint">
              <MessageSquare size={36} strokeWidth={1.5} />
              <p className="mt-3 text-[15px] font-medium text-ink-soft">Choose a conversation</p>
              {!isAdmin && <p className="mt-1 text-sm">or <button type="button" onClick={() => setNewOpen(true)} className="font-semibold text-brand-700 hover:underline">contact support</button>. To talk to a seller, open their website and press <strong>Message seller</strong>.</p>}
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
                <button type="button" onClick={() => open(null)} aria-label="Back to conversations" className="rounded-lg p-1.5 text-ink-soft hover:bg-canvas md:hidden"><ArrowLeft size={18} /></button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{thread?.title || 'Loading…'}</p>
                  <p className="flex items-center gap-2 truncate text-[12px] text-ink-faint">
                    {thread?.subject}
                    {thread?.listing && <Link href={`/sites/${thread.listing.domain}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Globe size={12} /> {thread.listing.domain}</Link>}
                  </p>
                </div>
                {isAdmin && thread && (
                  <Link href={`/admin/users?search=${encodeURIComponent(thread.participants.find((p) => p.role !== 'admin')?.name || '')}`} className="hidden items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:bg-canvas sm:inline-flex">
                    <Ban size={13} /> Manage user
                  </Link>
                )}
                {thread?.kind === 'support' && (
                  thread.status === 'open'
                    ? <button type="button" onClick={() => setStatus('closed')} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:bg-canvas"><CheckCircle2 size={13} /> Mark solved</button>
                    : <button type="button" onClick={() => setStatus('open')} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:bg-canvas"><RotateCcw size={13} /> Reopen</button>
                )}
              </header>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-canvas/60 px-4 py-5 sm:px-6">
                {messages.map((m) => (
                  <div key={m._id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm ${m.mine ? 'rounded-br-md bg-brand-600 text-white' : m.fromTeam ? 'rounded-bl-md border border-brand-200 bg-brand-50 text-ink' : 'rounded-bl-md border border-line bg-white text-ink'}`}>
                      {!m.mine && (
                        <p className={`mb-0.5 text-[12px] font-semibold ${m.fromTeam ? 'text-brand-700' : 'text-ink-soft'}`}>
                          {m.sender.name}{m.fromTeam && isAdmin && m.sender.staff ? ` · ${m.sender.staff}` : ''}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{m.body}</p>
                      <p className={`mt-1 text-right text-[10px] ${m.mine ? 'text-white/70' : 'text-ink-faint'}`}>{when(m.createdAt)}</p>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              {error && <p className="border-t border-red-200 bg-red-50 px-5 py-2 text-[13px] text-red-800">{error}</p>}
              {thread?.readOnly ? (
                <p className="flex items-center gap-2 border-t border-line px-5 py-3.5 text-[13px] text-ink-faint"><Lock size={14} /> You can read this chat but only the two people in it can write.</p>
              ) : (
                <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3 sm:p-4">
                  <label className="sr-only" htmlFor="chat-draft">Message</label>
                  <textarea
                    id="chat-draft"
                    rows={1}
                    value={draft}
                    maxLength={2000}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={thread?.kind === 'support' && isAdmin ? 'Reply as LetRank support…' : 'Write a message… (Enter to send)'}
                    className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-[14px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                  />
                  <Button type="submit" loading={sending} disabled={!draft.trim()} className="h-11" aria-label="Send">{!sending && <Send size={16} />}</Button>
                </form>
              )}
            </>
          )}
        </section>
      </div>

      <NewSupportDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => { setNewOpen(false); setBox('mine'); open(id); loadList(); }} />
      {isAdmin && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-faint"><Plus size={12} /> To contact a specific user, press Message next to them on the Users page.</p>
      )}
    </div>
  );
};

export default Messages;
