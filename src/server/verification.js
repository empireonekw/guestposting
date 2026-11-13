import crypto from 'node:crypto';
import dns from 'node:dns';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { safeLookup } from './safeFetch';

// Proves a seller controls a domain, in one of two ways:
//   DNS:  a TXT record on the domain:  guestposting-verification=<token>
//   Meta: a tag in the home page <head>:
//         <meta name="guestposting-verification" content="<token>">
// Records made with the old name (letrank-verification) still count.

export const TXT_PREFIX = 'guestposting-verification=';
export const META_NAME = 'guestposting-verification';
const OLD_TXT_PREFIX = 'letrank-verification=';
const OLD_META_NAME = 'letrank-verification';

export const newToken = () => crypto.randomBytes(16).toString('hex');

export const instructions = (domain, token) => ({
  dns: { type: 'TXT', host: '@', domain, value: `${TXT_PREFIX}${token}` },
  meta: `<meta name="${META_NAME}" content="${token}">`,
});

// ---- DNS ----

export const checkDns = async (domain, token) => {
  let records;
  try {
    records = await dns.promises.resolveTxt(domain);
  } catch (error) {
    if (['ENODATA', 'ENOTFOUND'].includes(error.code)) {
      return { ok: false, error: `No TXT records found on ${domain} yet. DNS changes can take up to an hour.` };
    }
    return { ok: false, error: `Could not look up DNS for ${domain}.` };
  }
  const wanted = `${TXT_PREFIX}${token}`;
  const accepted = [wanted, `${OLD_TXT_PREFIX}${token}`];
  const found = records.some((chunks) => accepted.includes(chunks.join('').trim()));
  return found
    ? { ok: true }
    : { ok: false, error: `The TXT record "${wanted}" was not found on ${domain}. DNS changes can take up to an hour.` };
};

// ---- Meta tag ----

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 8000;

const getPage = (url) =>
  new Promise((resolve, reject) => {
    const lib = url.protocol === 'http:' ? http : https;
    const req = lib.get(
      url,
      { lookup: safeLookup, timeout: TIMEOUT_MS, headers: { 'User-Agent': 'GuestPostingVerifier/1.0 (+site ownership check)', Accept: 'text/html' } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolve({ redirect: res.headers.location });
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`the home page answered with HTTP ${res.statusCode}`));
          return;
        }
        let size = 0;
        const chunks = [];
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            // The <head> is at the start; the rest isn't needed.
            res.destroy();
            resolve({ body: Buffer.concat(chunks).toString('utf8') });
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8') }));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('the home page took too long to answer')));
    req.on('error', reject);
  });

const sameSite = (host, domain) => host === domain || host === `www.${domain}`;

const findMetaToken = (html) => {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const name = tag.match(/\bname\s*=\s*["']?([^"'\s>]+)/i)?.[1];
    if (name && [META_NAME, OLD_META_NAME].includes(name.toLowerCase())) {
      return tag.match(/\bcontent\s*=\s*["']?([^"'\s>]+)/i)?.[1] || '';
    }
  }
  return null;
};

export const checkMeta = async (domain, token) => {
  // http.get skips the lookup for IP addresses, so refuse them outright.
  if (net.isIP(domain)) return { ok: false, error: 'Verification needs a domain name, not an IP address.' };
  let url = new URL(`https://${domain}/`);
  try {
    // Follow up to 3 redirects, but only within the same site.
    for (let hop = 0; hop < 4; hop += 1) {
      // eslint-disable-next-line no-await-in-loop
      const page = await getPage(url);
      if (page.redirect) {
        const next = new URL(page.redirect, url);
        if (!['http:', 'https:'].includes(next.protocol) || !sameSite(next.hostname.toLowerCase(), domain)) {
          return { ok: false, error: `The home page redirects to another site (${next.hostname}). Add the tag on ${domain} itself.` };
        }
        url = next;
        continue; // eslint-disable-line no-continue
      }
      const found = findMetaToken(page.body || '');
      if (found === token) return { ok: true };
      return {
        ok: false,
        error: found === null
          ? `The verification meta tag was not found on https://${domain}/. If you use a cache plugin, clear it and try again.`
          : 'A verification meta tag was found, but its code does not match. Copy the tag again.',
      };
    }
    return { ok: false, error: 'The home page redirects too many times.' };
  } catch (error) {
    if (error.message === 'blocked address') return { ok: false, error: `${domain} does not point to a public web server.` };
    return { ok: false, error: `Could not open https://${domain}/: ${error.message}.` };
  }
};

export const checkOwnership = (method, domain, token) => (method === 'dns' ? checkDns(domain, token) : checkMeta(domain, token));
