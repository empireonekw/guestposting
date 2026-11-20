'use client';

import { useState } from 'react';
import { Copy, Check, Download, ChevronDown } from 'lucide-react';
import Button from '@/components/ui/Button';

// The buyer's article on the order page, formatted, with "Copy" (pastes
// with formatting into WordPress, Word or Google Docs) and "Download for
// Word". The HTML was cleaned on the server before it was saved
// (server/articleHtml.js), so it is safe to show.

const fileName = (domain) => `article-${String(domain || 'guest-post').replace(/[^a-z0-9.-]+/gi, '-')}.doc`;

const ArticleView = ({ html, words, domain }) => {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  if (!html) return null;

  const copy = async () => {
    const holder = document.createElement('div');
    holder.innerHTML = html;
    const text = holder.innerText;
    try {
      if (window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert('Copying was blocked by the browser. Select the article and press Ctrl/Cmd+C.');
    }
  };

  // Word opens an HTML document saved as .doc, keeping headings and links.
  const download = () => {
    const doc = `<html><head><meta charset="utf-8"><title>${domain || 'Article'}</title></head><body>${html}</body></html>`;
    const url = URL.createObjectURL(new Blob(['﻿', doc], { type: 'application/msword' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(domain);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy article'}</Button>
        <Button size="sm" variant="secondary" onClick={download}><Download size={14} /> Download for Word</Button>
        {words ? <span className="text-[12px] text-ink-faint">{words.toLocaleString()} words</span> : null}
      </div>
      <div className={`relative overflow-hidden rounded-lg border border-line bg-canvas/40 ${open ? '' : 'max-h-72'}`}>
        {/* eslint-disable-next-line react/no-danger */}
        <div className="article-body px-4 py-3 text-[14px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: html }} />
        {!open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />}
      </div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline" aria-expanded={open}>
        {open ? 'Show less' : 'Show the whole article'} <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
      </button>
    </div>
  );
};

export default ArticleView;
