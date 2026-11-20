import { fetchOnce } from '../safeFetch';
import { LANGUAGE_NAMES } from '@/data/languages';

// Facts we can read about a website ourselves, for free and without limits:
// does it load, over HTTPS, its name, description and language, and how old
// the domain is (from RDAP, the public domain-registration database).

const UA = 'GuestPostingSiteCheck/1.0 (+site details for sellers)';

const decode = (s) => String(s || '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, ' ').trim();

const metaContent = (html, name) => {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const n = tag.match(/\b(?:name|property)\s*=\s*["']?([^"'\s>]+)/i)?.[1]?.toLowerCase();
    if (n === name) return decode(tag.match(/\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i)?.slice(1).find(Boolean));
  }
  return '';
};

const sameSite = (host, domain) => host === domain || host === `www.${domain}` || host.endsWith(`.${domain}`);

// The home page, following up to 4 redirects within the same site.
const loadHome = async (domain) => {
  for (const scheme of ['https', 'http']) {
    let url = new URL(`${scheme}://${domain}/`);
    try {
      for (let hop = 0; hop < 5; hop += 1) {
        // eslint-disable-next-line no-await-in-loop
        const res = await fetchOnce(url, { userAgent: UA, timeoutMs: 8000, maxBytes: 300 * 1024 });
        if (res.status >= 300 && res.status < 400 && res.location) {
          const next = new URL(res.location, url);
          if (!sameSite(next.hostname.toLowerCase(), domain)) return { ok: false, finalUrl: next.toString(), status: res.status, error: `redirects to another site (${next.hostname})` };
          url = next;
          continue; // eslint-disable-line no-continue
        }
        // 401/403/429: the site is up but turns automated visitors away (bot
        // protection, e.g. Cloudflare). That still counts as "loads".
        const blocked = [401, 403, 429].includes(res.status);
        return {
          ok: (res.status >= 200 && res.status < 400) || blocked,
          blocked,
          status: res.status,
          finalUrl: url.toString(),
          https: url.protocol === 'https:',
          html: blocked ? '' : res.body || '',
        };
      }
      return { ok: false, error: 'too many redirects' };
    } catch (error) {
      if (scheme === 'http') return { ok: false, error: error.message === 'blocked address' ? 'not a public website' : error.message };
    }
  }
  return { ok: false, error: 'could not open the site' };
};

// Registration date from RDAP (rdap.org forwards to the right registry).
export const domainAge = async (domain) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { headers: { Accept: 'application/rdap+json', 'User-Agent': UA }, signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const reg = (data.events || []).find((e) => e.eventAction === 'registration')?.eventDate;
    const created = reg ? new Date(reg) : null;
    if (!created || Number.isNaN(created.getTime())) return null;
    return { createdAt: created, years: Math.floor((Date.now() - created.getTime()) / (365.25 * 86400000)) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const readSiteInfo = async (domain, { registrable } = {}) => {
  const [home, age] = await Promise.all([loadHome(domain), domainAge(registrable || domain)]);
  const html = home.html || '';
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]).slice(0, 140) || metaContent(html, 'og:title').slice(0, 140);
  const description = (metaContent(html, 'description') || metaContent(html, 'og:description')).slice(0, 300);
  const langRaw = html.match(/<html\b[^>]*\blang\s*=\s*["']?([a-zA-Z-]+)/i)?.[1]?.toLowerCase() || '';
  const language = LANGUAGE_NAMES[langRaw.split('-')[0]] ? langRaw.split('-')[0] : null;
  return {
    loads: home.ok,
    blocksBots: !!home.blocked,
    status: home.status || null,
    https: home.https ?? false,
    finalUrl: home.finalUrl || null,
    error: home.ok ? null : home.error || `the site answered ${home.status}`,
    title,
    description,
    language,
    domainCreatedAt: age?.createdAt || null,
    domainAgeYears: age?.years ?? null,
  };
};
