// Domain Rating from Ahrefs' free public endpoint.
//
//   POST https://api.ahrefs.com/v3/public/domain-rating-free
//   body { targets: [up to 1000 domains] }, header Authorization: Bearer <key>
//
// The key is free (Ahrefs account → Account settings → API keys) and goes in
// AHREFS_API_KEY. Without it, DR lookups are switched off and sellers type
// their DR as before.
//
// Licence (ahrefs.com/legal/domain-rating-license): we may show DR on our
// own pages with "Domain Rating by Ahrefs" (Ahrefs linked to ahrefs.com)
// next to it. We must not resell DR, offer it as a stand-alone data product,
// or harvest it in bulk to build a dataset. So we only look up domains that
// are listed (or being listed) on this marketplace.
//
// Load: every caller goes through one queue, so this server sends at most one
// request (of up to 1000 domains) every 5 seconds, however many lookups are
// asked for at once. 2500 domains = 3 requests, sent 0 s, 5 s and 10 s apart.

const ENDPOINT = 'https://api.ahrefs.com/v3/public/domain-rating-free';
export const BATCH_SIZE = 1000;
export const GAP_MS = 5000;
const TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;

export const ATTRIBUTION = { text: 'Domain Rating by Ahrefs', href: 'https://ahrefs.com/' };

export const ahrefsEnabled = () => !!process.env.AHREFS_API_KEY;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Shared across hot reloads and every module copy in this process.
const queue = globalThis.__ahrefsQueue || (globalThis.__ahrefsQueue = { tail: Promise.resolve(), lastAt: 0, stats: { requests: 0, domains: 0, failures: 0, lastError: null, lastErrorAt: null, lastOkAt: null } });

// Runs `task` after every earlier task, and at least GAP_MS after the last
// request was sent.
const enqueue = (task) => {
  const run = queue.tail.then(async () => {
    const wait = queue.lastAt + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    queue.lastAt = Date.now();
    return task();
  });
  // A failed task must not block the ones behind it.
  queue.tail = run.catch(() => {});
  return run;
};

export const normalizeDomain = (raw) => {
  let s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (!/^https?:\/\//.test(s)) s = `https://${s}`;
  try {
    const host = new URL(s).hostname.replace(/^www\./, '').replace(/\.$/, '');
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
  } catch {
    return null;
  }
};

// One request for up to BATCH_SIZE domains. Retries on 429 / 5xx with
// growing waits (Ahrefs may throttle "without notice").
const requestBatch = async (domains) => {
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.AHREFS_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ targets: domains }),
        signal: controller.signal,
      });
    } catch (error) {
      res = { ok: false, status: 0, text: async () => (error.name === 'AbortError' ? 'timed out' : 'could not connect') };
    } finally {
      clearTimeout(timer);
    }
    queue.stats.requests += 1;
    if (res.ok) {
      const data = await res.json();
      const rows = data?.domain_rating?.targets || [];
      queue.stats.domains += domains.length;
      queue.stats.lastOkAt = Date.now();
      return rows;
    }
    const retryable = res.status === 429 || res.status === 0 || res.status >= 500;
    if (!retryable || attempt >= MAX_RETRIES) {
      const detail = (await res.text().catch(() => '')).slice(0, 160);
      const message = res.status === 401 || res.status === 403
        ? 'Ahrefs refused the API key (check AHREFS_API_KEY)'
        : `Ahrefs answered ${res.status || 'nothing'}${detail ? `: ${detail}` : ''}`;
      queue.stats.failures += 1;
      queue.stats.lastError = message;
      queue.stats.lastErrorAt = Date.now();
      throw new Error(message);
    }
    // 429/5xx: wait longer each time (10 s, 20 s, 40 s), on top of the 5 s gap.
    await sleep(GAP_MS * 2 ** (attempt + 1));
    queue.lastAt = Date.now();
  }
};

// DR for any number of domains. Splits them into batches of 1000 and sends
// the batches one after another, 5 seconds apart. Resolves to a Map
// domain -> DR (0–100, one decimal). Domains Ahrefs has no data for are
// missing from the map. `onProgress(done, total)` is called after each batch.
export const getDomainRatings = async (rawDomains, { onProgress } = {}) => {
  const result = new Map();
  if (!ahrefsEnabled()) return result;
  const domains = [...new Set(rawDomains.map(normalizeDomain).filter(Boolean))];
  for (let i = 0; i < domains.length; i += BATCH_SIZE) {
    const batch = domains.slice(i, i + BATCH_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const rows = await enqueue(() => requestBatch(batch));
    rows.forEach((row) => {
      const d = normalizeDomain(row.target);
      if (d && Number.isFinite(row.domain_rating)) result.set(d, Math.round(row.domain_rating * 10) / 10);
    });
    onProgress?.(Math.min(i + BATCH_SIZE, domains.length), domains.length);
  }
  return result;
};

export const getDomainRating = async (domain) => {
  const map = await getDomainRatings([domain]);
  return map.get(normalizeDomain(domain)) ?? null;
};

export const ahrefsStatus = () => ({ enabled: ahrefsEnabled(), batchSize: BATCH_SIZE, gapSeconds: GAP_MS / 1000, ...queue.stats });
