import { json } from './http';

// In-memory fixed-window rate limiter. The site runs as one PM2 process
// (ecosystem.config.cjs), so a per-process map is enough; if it is ever
// scaled to several processes this needs a shared store such as Redis.
const buckets = globalThis.__rateLimitBuckets || (globalThis.__rateLimitBuckets = new Map());

let lastSweep = Date.now();
const sweep = (now) => {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

// Where a request comes from (see clientIp.js).
export { clientIp } from './clientIp';

// Counts one hit for `key` under `name`. Returns a 429 response once the
// limit is passed within the window, otherwise null.
export const rateLimit = (name, key, { limit, windowMs }) => {
  const now = Date.now();
  sweep(now);
  const id = `${name}:${key}`;
  let bucket = buckets.get(id);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(id, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    const minutes = Math.max(1, Math.ceil(retryAfter / 60));
    const res = json({ message: `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` }, 429);
    res.headers.set('Retry-After', String(retryAfter));
    return res;
  }
  return null;
};

// Runs several limits and returns the first refusal, if any.
export const firstLimited = (...results) => results.find(Boolean) || null;

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
