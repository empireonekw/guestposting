import { fetchOnce } from './safeFetch';

// The wording for each problem is in data/orderStatus.js (LINK_PROBLEM_TEXT).

// Checks a published guest post (Module 5): opens the live page and looks
// for the buyer's link.
//
//   verdict 'ok'          the link is there as promised
//   verdict 'warning'     there, but something is off that may be fine
//                         (different anchor text, the page asks search
//                         engines not to index it)
//   verdict 'problem'     the page is gone, the link is missing, it is
//                         nofollow when dofollow was promised, or the page
//                         now redirects to another website
//   verdict 'unverified'  we couldn't open the page (blocked, server error,
//                         timeout), so we can't tell
//
// Pages built with JavaScript after loading can't be read this way; their
// links show as missing.

const USER_AGENT = 'Mozilla/5.0 (compatible; GuestPostingLinkCheck/1.0; +https://guestposting.live/terms)';
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 5;

const HARD = ['page_gone', 'redirected_away', 'link_missing', 'nofollow'];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const decode = (text) => String(text)
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z0-9#]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

const squash = (text) => decode(String(text).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

// A URL in a comparable form: no scheme, no www., no trailing slash, no
// #fragment, no tracking parameters, other parameters sorted.
export const normalizeUrl = (value, base) => {
  let u;
  try {
    u = new URL(String(value).trim(), base);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !/^(utm_|ref$|fbclid$|gclid$)/i.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : '';
  const path = decodeURIComponent(u.pathname).replace(/\/+$/, '') || '';
  return `${u.hostname.replace(/^www\./, '').toLowerCase()}${path}${query}`;
};

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decode(m[1] ?? m[2] ?? m[3] ?? '') : null;
};

const onSite = (host, domain) => {
  const h = host.toLowerCase().replace(/^www\./, '');
  return !domain || h === domain || h.endsWith(`.${domain}`);
};

// Loads the page, following redirects that stay on the site.
const load = async (pageUrl, domain) => {
  let url = new URL(pageUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetchOnce(url, { maxBytes: MAX_BYTES, userAgent: USER_AGENT });
    if (res.status >= 300 && res.status < 400 && res.location) {
      const next = new URL(res.location, url);
      if (!['http:', 'https:'].includes(next.protocol) || !onSite(next.hostname, domain)) {
        return { status: res.status, finalUrl: next.toString(), redirectedAway: true };
      }
      url = next;
      continue; // eslint-disable-line no-continue
    }
    return { status: res.status, headers: res.headers, body: res.body, finalUrl: url.toString() };
  }
  return { status: 0, error: 'too many redirects', finalUrl: url.toString() };
};

// liveLink: the published post. targetUrl / anchorText: what the buyer
// ordered. domain: the ordered website. expectDofollow: the listing's promise.
export const checkLink = async ({ liveLink, targetUrl, anchorText, domain, expectDofollow = true }) => {
  const at = new Date();
  const base = { at, liveLink, problems: [] };
  const site = String(domain || '').toLowerCase().replace(/^www\./, '');
  let page;
  try {
    page = await load(liveLink, site);
  } catch (error) {
    const blocked = error.message === 'blocked address';
    return { ...base, verdict: 'unverified', problems: ['unreachable'], error: blocked ? 'The website does not point to a public server' : error.message };
  }
  const result = { ...base, httpStatus: page.status, finalUrl: page.finalUrl };

  if (page.redirectedAway) return { ...result, verdict: 'problem', problems: ['redirected_away'] };
  if (page.status === 404 || page.status === 410) return { ...result, verdict: 'problem', problems: ['page_gone'] };
  if (page.status !== 200) {
    return { ...result, verdict: 'unverified', problems: ['unreachable'], error: page.error || `The page answered with HTTP ${page.status}` };
  }

  const html = page.body || '';
  const problems = [];

  // Asked not to be indexed: <meta name="robots|googlebot" content="noindex">
  // or an X-Robots-Tag header.
  const metaNoindex = (html.match(/<meta\b[^>]*>/gi) || []).some((tag) => /^(robots|googlebot)$/i.test(attr(tag, 'name') || '') && /noindex/i.test(attr(tag, 'content') || ''));
  const headerNoindex = /noindex/i.test(String(page.headers?.['x-robots-tag'] || ''));
  const noindex = metaNoindex || headerNoindex;

  // Every <a> pointing at the target URL.
  const wanted = normalizeUrl(targetUrl);
  const links = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && links.length < 50) {
    const href = attr(m[1], 'href');
    if (href && wanted && normalizeUrl(href, page.finalUrl) === wanted) {
      const rel = (attr(m[1], 'rel') || '').toLowerCase().split(/\s+/).filter(Boolean);
      links.push({ rel, anchor: squash(m[2]) || attr(m[2], 'alt') || '' });
    }
  }

  const expected = squash(anchorText || '').toLowerCase();
  const anchorOk = (l) => !expected || l.anchor.toLowerCase() === expected || l.anchor.toLowerCase().includes(expected);
  const followed = (l) => !l.rel.some((r) => ['nofollow', 'sponsored', 'ugc'].includes(r));
  // The best of the matching links: dofollow with the right anchor first.
  const best = [...links].sort((a, b) => (Number(followed(b)) - Number(followed(a))) || (Number(anchorOk(b)) - Number(anchorOk(a))))[0];

  if (!best) problems.push('link_missing');
  else {
    if (expectDofollow && !followed(best)) problems.push('nofollow');
    if (!anchorOk(best)) problems.push('anchor_mismatch');
  }
  if (noindex) problems.push('noindex');

  const verdict = problems.some((p) => HARD.includes(p)) ? 'problem' : problems.length ? 'warning' : 'ok';
  return {
    ...result,
    verdict,
    problems,
    linkFound: !!best,
    rel: best ? best.rel.join(' ') : undefined,
    dofollow: best ? followed(best) : undefined,
    anchor: best?.anchor?.slice(0, 200),
    noindex,
  };
};
