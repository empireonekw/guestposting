import fs from 'node:fs';
import path from 'node:path';

// "GP Authority": our own 0–100 site authority score, from Common Crawl's
// free web graph (see scripts/build-authority-index.mjs). Common Crawl ranks
// ~118 million domains by how strongly the rest of the web links to them;
// we keep the top 10 million in a sorted file on disk and binary-search it,
// so lookups are instant, free and unlimited.
//
// The score turns the rank into 0–100 on a log scale, shaped so it spreads
// out like DR does: rank 50 ≈ 87, rank 500 ≈ 78, rank 100k ≈ 56,
// rank 1M ≈ 44, rank 10M ≈ 30. Not in the top 10M → no score.

const DIR = () => process.env.AUTHORITY_INDEX_DIR || path.join(process.cwd(), 'data', 'authority');
const RELOAD_MS = 60 * 1000;

const state = globalThis.__authorityIndex || (globalThis.__authorityIndex = { fd: null, size: 0, meta: null, mtime: 0, checkedAt: 0 });

// Opens the index (again if it was rebuilt). Returns false when missing.
const open = () => {
  if (Date.now() - state.checkedAt < RELOAD_MS && state.fd !== null) return true;
  state.checkedAt = Date.now();
  const file = path.join(DIR(), 'domains.tsv');
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    if (state.fd !== null) fs.closeSync(state.fd);
    state.fd = null;
    state.meta = null;
    return false;
  }
  if (state.fd !== null && stat.mtimeMs === state.mtime) return true;
  if (state.fd !== null) fs.closeSync(state.fd);
  state.fd = fs.openSync(file, 'r');
  state.size = stat.size;
  state.mtime = stat.mtimeMs;
  try {
    state.meta = JSON.parse(fs.readFileSync(path.join(DIR(), 'meta.json'), 'utf8'));
  } catch {
    state.meta = null;
  }
  return true;
};

const buf = Buffer.alloc(512);

// Start of the line that contains byte `pos`.
const lineStart = (pos) => {
  if (pos <= 0) return 0;
  const from = Math.max(0, pos - buf.length);
  const n = fs.readSync(state.fd, buf, 0, pos - from, from);
  const i = buf.subarray(0, n).lastIndexOf(10); // '\n'
  return i === -1 ? from : from + i + 1;
};

// The line starting at `start`, and where the next one starts.
const lineAt = (start) => {
  const n = fs.readSync(state.fd, buf, 0, buf.length, start);
  const end = buf.subarray(0, n).indexOf(10);
  const len = end === -1 ? n : end;
  return { text: buf.toString('utf8', 0, len), next: start + len + 1 };
};

const find = (domain) => {
  let lo = 0;
  let hi = state.size;
  while (lo < hi) {
    const s = lineStart((lo + hi) >> 1);
    const { text, next } = lineAt(s);
    const [key, harmonic, pagerank] = text.split('\t');
    if (key === domain) return { harmonicPos: Number(harmonic), pagerankPos: Number(pagerank) };
    if (key < domain) lo = next;
    else hi = s;
  }
  return null;
};

export const scoreFromRank = (rank, total) => {
  if (!rank || !total) return null;
  const x = 1 - Math.log(Math.max(1, rank)) / Math.log(total);
  return Math.max(0, Math.min(100, Math.round(100 * x ** 0.6)));
};

// GP Authority for a domain (or its parent domain, for subdomains).
// Returns null when the index isn't built yet.
export const lookupAuthority = (rawDomain) => {
  if (!open()) return null;
  const host = String(rawDomain || '').toLowerCase().replace(/^www\./, '');
  const labels = host.split('.');
  for (let i = 0; i <= labels.length - 2; i += 1) {
    const candidate = labels.slice(i).join('.');
    const hit = find(candidate);
    if (hit) {
      const total = state.meta?.totalDomains;
      return {
        domain: candidate,
        rank: hit.harmonicPos,
        pagerankRank: hit.pagerankPos,
        total,
        score: scoreFromRank(hit.harmonicPos, total),
        release: state.meta?.release,
        ranked: true,
      };
    }
  }
  return { domain: host, ranked: false, score: null, release: state.meta?.release, indexed: state.meta?.indexedDomains };
};

export const authorityStatus = () => {
  const ready = open();
  return ready
    ? { ready: true, ...state.meta, sizeMb: Math.round(state.size / 1048576) }
    : { ready: false, hint: 'Run: npm run build:authority' };
};
