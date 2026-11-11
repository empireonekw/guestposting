import crypto from 'node:crypto';

// In-memory request telemetry for the admin "Code flow" page: the last 15
// minutes of requests per area of the app (pages and API groups), recent
// server errors, how traffic arrives (Cloudflare / nginx), and email sends.
//
// It lives in this server process only (the site runs as one PM2 process),
// starts empty after a restart, and never keeps IP addresses or query
// strings: visitors are counted by a salted hash that is thrown away with
// the window.

const WINDOW_MS = 15 * 60 * 1000;
const RATE_MS = 5 * 60 * 1000; // requests/min is averaged over 5 minutes
const MAX_SAMPLES = 20000;
const MAX_ERRORS = 15;

const store = globalThis.__lrTelemetry || (globalThis.__lrTelemetry = {
  startedAt: Date.now(),
  salt: crypto.randomBytes(16).toString('hex'),
  groups: {}, // name -> { samples: [{t, ms, s}], errors: [{t, s, path, message}] }
  hits: [], // every request seen by proxy.js: { t, api, cf, proxied, v }
  email: { sent: [], failed: [], lastError: null, lastErrorAt: null, lastOkAt: null },
});

// Which box on the Code flow page a request belongs to.
const GROUPS = {
  auth: 'auth',
  listings: 'listings',
  taxonomy: 'listings',
  orders: 'orders',
  reviews: 'orders',
  messages: 'messages',
  conversations: 'messages',
  notifications: 'messages',
  admin: 'admin',
  users: 'users',
  contact: 'contact',
};
export const groupOf = (pathname) => GROUPS[String(pathname).split('/')[2]] || 'other';

const trim = (list, now) => {
  const cutoff = now - WINDOW_MS;
  let i = 0;
  while (i < list.length && list[i].t < cutoff) i += 1;
  if (i) list.splice(0, i);
  if (list.length > MAX_SAMPLES) list.splice(0, list.length - MAX_SAMPLES);
};

const group = (name) => {
  if (!store.groups[name]) store.groups[name] = { samples: [], errors: [] };
  return store.groups[name];
};

// One finished request (called by route() in http.js, and for pages).
export const recordRequest = (name, { ms, status, path, message }) => {
  try {
    const now = Date.now();
    const g = group(name);
    g.samples.push({ t: now, ms: Math.round(ms), s: status });
    trim(g.samples, now);
    if (status >= 500) {
      g.errors.push({ t: now, s: status, path: String(path || '').split('?')[0].slice(0, 120), message: String(message || `HTTP ${status}`).slice(0, 300) });
      if (g.errors.length > MAX_ERRORS) g.errors.shift();
    }
  } catch {
    // Telemetry must never break a request.
  }
};

// Every request as it enters the app (called by proxy.js).
export const recordHit = ({ pathname, headers }) => {
  try {
    const now = Date.now();
    const ip = headers.get('cf-connecting-ip') || headers.get('x-real-ip') || (headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'direct';
    store.hits.push({
      t: now,
      api: pathname.startsWith('/api/'),
      cf: !!headers.get('cf-connecting-ip') || !!headers.get('cf-ray'),
      // Our nginx config (scripts/server/setup.sh) sets X-Real-IP; Next.js
      // itself adds X-Forwarded-For, so that header proves nothing.
      proxied: !!headers.get('x-real-ip'),
      v: crypto.createHash('sha256').update(store.salt + ip + (headers.get('user-agent') || '')).digest('hex').slice(0, 16),
    });
    trim(store.hits, now);
  } catch {
    // ignore
  }
};

export const recordEmail = (ok, message) => {
  const now = Date.now();
  const e = store.email;
  (ok ? e.sent : e.failed).push({ t: now });
  trim(e.sent, now);
  trim(e.failed, now);
  if (ok) e.lastOkAt = now;
  else {
    e.lastError = String(message || 'Unknown error').slice(0, 300);
    e.lastErrorAt = now;
  }
};

const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

// Requests per minute for each of the last 15 minutes (oldest first).
const perMinute = (samples, now, errorTest = () => false) => {
  const buckets = Array.from({ length: 15 }, () => ({ n: 0, e: 0 }));
  samples.forEach((x) => {
    const i = 14 - Math.floor((now - x.t) / 60000);
    if (i >= 0 && i < 15) {
      buckets[i].n += 1;
      if (errorTest(x)) buckets[i].e += 1;
    }
  });
  return buckets;
};

export const groupSummary = (name) => {
  const now = Date.now();
  const g = group(name);
  trim(g.samples, now);
  const recent = g.samples.filter((x) => x.t >= now - RATE_MS);
  const times = g.samples.map((x) => x.ms);
  return {
    perMin: Math.round((recent.length / (RATE_MS / 60000)) * 10) / 10,
    total: g.samples.length,
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    serverErrors: g.samples.filter((x) => x.s >= 500).length,
    clientErrors: g.samples.filter((x) => x.s >= 400 && x.s < 500).length,
    lastAt: g.samples.at(-1)?.t || null,
    series: perMinute(g.samples, now, (x) => x.s >= 500),
    recentErrors: [...g.errors].filter((e) => e.t >= now - WINDOW_MS).reverse(),
  };
};

export const trafficSummary = () => {
  const now = Date.now();
  trim(store.hits, now);
  const recent = store.hits.filter((h) => h.t >= now - RATE_MS);
  const pages = store.hits.filter((h) => !h.api);
  return {
    perMin: Math.round((recent.length / (RATE_MS / 60000)) * 10) / 10,
    total: store.hits.length,
    visitors: new Set(recent.map((h) => h.v)).size,
    viaCloudflare: store.hits.length ? Math.round((store.hits.filter((h) => h.cf).length / store.hits.length) * 100) : null,
    viaProxy: store.hits.length ? Math.round((store.hits.filter((h) => h.proxied).length / store.hits.length) * 100) : null,
    series: perMinute(store.hits, now),
    pages: {
      perMin: Math.round((pages.filter((h) => h.t >= now - RATE_MS).length / (RATE_MS / 60000)) * 10) / 10,
      total: pages.length,
      lastAt: pages.at(-1)?.t || null,
      series: perMinute(pages, now),
    },
  };
};

export const emailSummary = () => {
  const now = Date.now();
  const e = store.email;
  trim(e.sent, now);
  trim(e.failed, now);
  return { sent: e.sent.length, failed: e.failed.length, lastError: e.lastError, lastErrorAt: e.lastErrorAt, lastOkAt: e.lastOkAt };
};

export const telemetryStartedAt = () => store.startedAt;
export const WINDOW_MINUTES = WINDOW_MS / 60000;
