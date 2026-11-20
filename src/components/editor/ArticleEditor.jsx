'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder, CharacterCount } from '@tiptap/extensions';
import {
  Bold, Italic, Underline, Strikethrough, Heading2, Heading3, List, ListOrdered, Quote, Link2, Link2Off, Undo2, Redo2, RemoveFormatting,
} from 'lucide-react';

// A Word-like editor for guest post articles. Pasting from Word or Google
// Docs keeps headings, bold, lists and links. The HTML it produces is cleaned
// again on the server (server/articleHtml.js) before it is stored.

const Tool = ({ label, active, disabled, onClick, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()} // keep the text selection
    onClick={onClick}
    className={`flex h-8 w-8 items-center justify-center rounded-md text-ink-soft hover:bg-line-soft hover:text-ink disabled:opacity-40 ${active ? 'bg-brand-50 text-brand-700' : ''}`}
  >
    {children}
  </button>
);
const Sep = () => <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />;

const ArticleEditor = ({ value, onChange, placeholder = 'Paste or write your article here…', error, id, minHeight = 'min-h-[280px]' }) => {
  // The editor manages its own state; React Compiler memoising this
  // component kept the toolbar from ever updating.
  'use no memo';
  const editor = useEditor({
    // Re-render on every change so the toolbar shows bold/headings/etc.
    shouldRerenderOnTransaction: true,
    // Rendered only in the browser (Next.js renders pages on the server first).
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
      }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
    ],
    content: value || '',
    editorProps: {
      // A pasted document title (h1) becomes a heading; the post's own
      // title on the publisher's site is the page's h1.
      transformPastedHTML: (html) => html.replace(/<(\/?)h1\b/gi, '<$1h2'),
      attributes: {
        ...(id ? { id } : {}),
        class: `article-body ${minHeight} max-w-none px-4 py-3 text-[15px] leading-relaxed text-ink outline-none`,
        'aria-label': 'Article',
        'aria-multiline': 'true',
        role: 'textbox',
      },
    },
    onUpdate: ({ editor: e }) => onChange?.(e.isEmpty ? '' : e.getHTML(), { words: e.storage.characterCount.words() }),
  });

  const e = editor;
  const state = e ? {
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      words: e.storage.characterCount.words(),
    } : null;

  const setLink = () => {
    const previous = editor.getAttributes('link').href || '';
    const href = window.prompt('Link address (URL)', previous || 'https://');
    if (href === null) return;
    if (!href.trim() || href.trim() === 'https://') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run();
  };

  const c = () => editor.chain().focus();

  return (
    <div className={`overflow-hidden rounded-[var(--radius-control)] border bg-white focus-within:ring-4 ${error ? 'border-red-300 focus-within:ring-red-500/10' : 'border-line focus-within:border-brand-500 focus-within:ring-brand-500/10'}`}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-canvas/60 px-2 py-1.5" role="toolbar" aria-label="Formatting">
        {editor && state ? (
          <>
            <Tool label="Bold" active={state.bold} onClick={() => c().toggleBold().run()}><Bold size={15} /></Tool>
            <Tool label="Italic" active={state.italic} onClick={() => c().toggleItalic().run()}><Italic size={15} /></Tool>
            <Tool label="Underline" active={state.underline} onClick={() => c().toggleUnderline().run()}><Underline size={15} /></Tool>
            <Tool label="Strikethrough" active={state.strike} onClick={() => c().toggleStrike().run()}><Strikethrough size={15} /></Tool>
            <Sep />
            <Tool label="Heading" active={state.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></Tool>
            <Tool label="Subheading" active={state.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></Tool>
            <Tool label="Bulleted list" active={state.bullet} onClick={() => c().toggleBulletList().run()}><List size={16} /></Tool>
            <Tool label="Numbered list" active={state.ordered} onClick={() => c().toggleOrderedList().run()}><ListOrdered size={16} /></Tool>
            <Tool label="Quote" active={state.quote} onClick={() => c().toggleBlockquote().run()}><Quote size={15} /></Tool>
            <Sep />
            <Tool label="Add or edit link" active={state.link} onClick={setLink}><Link2 size={16} /></Tool>
            <Tool label="Remove link" disabled={!state.link} onClick={() => c().unsetLink().run()}><Link2Off size={16} /></Tool>
            <Tool label="Clear formatting" onClick={() => c().unsetAllMarks().clearNodes().run()}><RemoveFormatting size={15} /></Tool>
            <Sep />
            <Tool label="Undo" disabled={!state.canUndo} onClick={() => c().undo().run()}><Undo2 size={15} /></Tool>
            <Tool label="Redo" disabled={!state.canRedo} onClick={() => c().redo().run()}><Redo2 size={15} /></Tool>
            <span className="ml-auto pr-1 text-[12px] tabular-nums text-ink-faint">{state.words.toLocaleString()} word{state.words === 1 ? '' : 's'}</span>
          </>
        ) : <span className="h-8" />}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

export default ArticleEditor;
