import sanitizeHtml from 'sanitize-html';
import { ValidationError } from './validate';

// Guest post articles are stored as HTML from the Word-like editor. Before
// saving, everything except plain formatting is removed: no scripts, styles,
// images, iframes or event handlers, and links may only be http(s) or mailto.
// The publisher sees and copies exactly this cleaned HTML.

export const MAX_ARTICLE_CHARS = 200_000; // HTML; a very long article is ~60 KB
export const MIN_ARTICLE_WORDS = 50;

const OPTIONS = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'a',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: { a: ['href', 'title'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  // h1 becomes h2 (the post's own title is the page's h1).
  transformTags: {
    h1: 'h2',
    b: 'strong',
    i: 'em',
    a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer', target: '_blank' } }),
  },
  // Drop empty headings and list items (left over from pasted documents).
  exclusiveFilter: (frame) => ['h2', 'h3', 'h4', 'li'].includes(frame.tag) && !frame.text.trim(),
};
// rel/target are added by the transform, so allow them on links.
OPTIONS.allowedAttributes.a.push('rel', 'target');

export const plainText = (html) => sanitizeHtml(String(html || ''), { allowedTags: [], allowedAttributes: {} })
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export const wordCount = (html) => {
  const text = plainText(html);
  return text ? text.split(' ').length : 0;
};

// Returns cleaned HTML (or undefined when empty). Throws when it's too long.
export const cleanArticle = (html, { field = 'articleHtml', required = false, minWords = MIN_ARTICLE_WORDS } = {}) => {
  const raw = String(html ?? '');
  if (raw.length > MAX_ARTICLE_CHARS * 2) throw new ValidationError('The article is too long. Please shorten it or share it as a link.', field);
  const clean = sanitizeHtml(raw, OPTIONS).trim();
  const words = wordCount(clean);
  if (!words) {
    if (required) throw new ValidationError('Paste or write the article', field);
    return undefined;
  }
  if (clean.length > MAX_ARTICLE_CHARS) throw new ValidationError('The article is too long. Please shorten it or share it as a link.', field);
  if (words < minWords) throw new ValidationError(`The article looks too short (${words} words). Paste the full article.`, field);
  return clean;
};
