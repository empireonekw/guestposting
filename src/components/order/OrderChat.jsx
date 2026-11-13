'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Paperclip, Loader2, X, MessageSquare } from 'lucide-react';
import api from '@/lib/api';
import BRAND from '@/data/brand';
import { FILE_ACCEPT } from '@/data/orderStatus';
import { FileLink, uploadOrderFile } from './OrderFiles';

// The order chat between buyer and publisher. New messages are picked up
// every few seconds while the tab is visible. Our team can also write here
// (shown as support).

const MAX_FILES = 3;
const timeOf = (d) => (d ? new Date(d).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

const OrderChat = ({ orderId, me, closed }) => {
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const fileInput = useRef(null);

  // Load, then poll for new messages. Only unseen messages are merged in, so
  // an unchanged list never re-renders (and never moves the scroll).
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const { data } = await api.get(`/messages/${orderId}`);
        if (stopped) return;
        setMessages((prev) => {
          const have = new Set(prev.map((m) => m._id));
          if (prev.length && data.every((m) => have.has(m._id))) return prev;
          const ids = new Set(data.map((m) => m._id));
          return [...data, ...prev.filter((m) => !ids.has(m._id) && m.isSending)];
        });
        setLoaded(true);
      } catch { /* try again on the next tick */ }
    };
    load();
    const timer = setInterval(load, 4000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [orderId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const addFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (files.length >= MAX_FILES) { setError(`Attach at most ${MAX_FILES} files per message.`); return; }
    setUploading(true);
    setError('');
    try {
      const saved = await uploadOrderFile(orderId, file, 'chat');
      setFiles((f) => [...f, saved]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body && !files.length) return;
    const tempId = `temp-${Date.now()}`;
    const sending = files;
    setMessages((prev) => [...prev, { _id: tempId, text: body, attachments: sending, sender: { _id: me._id, name: me.name }, isSending: true, createdAt: new Date().toISOString() }]);
    setText('');
    setFiles([]);
    setError('');
    try {
      const { data } = await api.post('/messages', { orderId, text: body, fileIds: sending.map((f) => f.fileId) });
      setMessages((prev) => (prev.some((m) => m._id === data._id) ? prev.filter((m) => m._id !== tempId) : prev.map((m) => (m._id === tempId ? data : m))));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      setText(body);
      setFiles(sending);
      setError(err.response?.data?.message || 'The message could not be sent.');
    }
  };

  return (
    <section className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
        <MessageSquare size={16} className="text-brand-600" />
        <h2 className="text-[15px] font-semibold text-ink">Order chat</h2>
        {me.role === 'admin' && <span className="ml-auto text-[12px] text-ink-faint">You write as {BRAND.supportName}</span>}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-canvas/50 px-4 py-4">
        {!loaded ? (
          <div className="flex h-full items-center justify-center"><Loader2 size={20} className="animate-spin text-brand-500" /></div>
        ) : messages.length === 0 ? (
          <p className="flex h-full items-center justify-center text-center text-[13px] text-ink-faint">No messages yet. Questions about the order go here.</p>
        ) : messages.map((m) => {
          const mine = String(m.sender?._id) === String(me._id);
          return (
            <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] ${
                m.fromTeam ? 'border border-brand-200 bg-brand-50 text-brand-900'
                  : mine ? 'bg-brand-600 text-white' : 'border border-line bg-white text-ink'
              } ${m.isSending ? 'opacity-60' : ''}`}
              >
                {!mine && <p className={`mb-0.5 text-[11px] font-semibold ${m.fromTeam ? 'text-brand-700' : 'text-ink-faint'}`}>{m.fromTeam ? BRAND.supportName : m.sender?.name}</p>}
                {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                {m.attachments?.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {m.attachments.map((f) => <FileLink key={String(f.fileId)} file={f} />)}
                  </div>
                )}
                <p className={`mt-1 text-[10px] ${mine && !m.fromTeam ? 'text-white/70' : 'text-ink-faint'}`}>{m.isSending ? 'Sending…' : timeOf(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="border-t border-line p-3">
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {files.map((f) => (
              <span key={String(f.fileId)} className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-brand-50 px-2 py-1 text-[12px] text-brand-900">
                <span className="truncate">{f.name}</span>
                <button type="button" onClick={() => setFiles((all) => all.filter((x) => x.fileId !== f.fileId))} aria-label={`Remove ${f.name}`}><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
        {error && <p className="mb-2 text-[12px] font-medium text-danger">{error}</p>}
        <div className="flex items-end gap-2">
          <input ref={fileInput} type="file" accept={FILE_ACCEPT} className="hidden" onChange={addFile} />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading || files.length >= MAX_FILES}
            aria-label="Attach a file"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-ink-soft hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
          </button>
          <label className="sr-only" htmlFor="chat-input">Message</label>
          <textarea
            id="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e); }}
            rows={1}
            maxLength={5000}
            placeholder={closed ? 'This order is closed, but you can still write.' : 'Write a message…'}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-line px-3 py-2 text-[14px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
          />
          <button type="submit" disabled={!text.trim() && !files.length} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40">
            <Send size={16} />
          </button>
        </div>
      </form>
    </section>
  );
};

export default OrderChat;
