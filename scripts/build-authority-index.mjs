// Builds the local "GP Authority" index from Common Crawl's free web graph.
//
// Common Crawl crawls the public web and publishes, every few months, a
// ranking of ~118 million domains by how strongly the rest of the web links
// to them (harmonic centrality and PageRank). The file is sorted strongest
// first, so we only download its beginning: the top N domains (default 10
// million, about 300 MB of download). Domains further down get no score.
//
// The result is a sorted text file on this server's disk that
// src/server/sitedata/authority.js searches directly: no API, no limits.
//
//   node scripts/build-authority-index.mjs                 (top 10,000,000)
//   node scripts/build-authority-index.mjs --limit 2000000 (smaller, quicker)
//   CC_RELEASE=cc-main-2026-may-jun-jul node scripts/build-authority-index.mjs
//
// Re-run it when Common Crawl publishes a new release (every ~3 months; see
// commoncrawl.org/blog). Needs the `sort` command (macOS and Linux have it).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import https from 'node:https';
import readline from 'node:readline';
import { spawn } from 'node:child_process';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const RELEASE = process.env.CC_RELEASE || arg('release', 'cc-main-2026-may-jun-jul');
const LIMIT = Number(arg('limit', process.env.CC_LIMIT || 10_000_000));
const BASE = `https://data.commoncrawl.org/projects/hyperlinkgraph/${RELEASE}/domain/${RELEASE}`;
const DIR = process.env.AUTHORITY_INDEX_DIR || path.join(process.cwd(), 'data', 'authority');

const get = (url) => new Promise((resolve, reject) => {
  https.get(url, { headers: { 'User-Agent': 'GuestPostingAuthorityIndex/1.0' } }, (res) => {
    if (res.statusCode !== 200) {
      res.resume();
      reject(new Error(`${url} answered ${res.statusCode}`));
      return;
    }
    resolve(res);
  }).on('error', reject);
});

const text = async (url) => {
  const res = await get(url);
  let body = '';
  for await (const chunk of res) body += chunk;
  return body;
};

// "com.example.blog" -> "blog.example.com"
const unreverse = (rev) => rev.split('.').reverse().join('.');

const main = async () => {
  if (!Number.isInteger(LIMIT) || LIMIT < 1000) throw new Error('--limit must be a whole number of at least 1000');
  fs.mkdirSync(DIR, { recursive: true });
  const work = fs.mkdtempSync(path.join(DIR, '.build-'));
  const raw = path.join(work, 'raw.tsv');
  const sorted = path.join(work, 'domains.tsv');

  const stats = await text(`${BASE}-domain.stats`);
  const total = Number(stats.match(/^nodes=(\d+)/m)?.[1]);
  if (!total) throw new Error('Could not read the domain count from the .stats file');
  console.log(`Release ${RELEASE}: ${total.toLocaleString()} domains. Taking the top ${LIMIT.toLocaleString()}.`);

  // Stream: download → gunzip → first LIMIT lines → "domain\tharmonicPos\tpagerankPos".
  const res = await get(`${BASE}-domain-ranks.txt.gz`);
  const gunzip = zlib.createGunzip();
  res.pipe(gunzip);
  const lines = readline.createInterface({ input: gunzip, crlfDelay: Infinity });
  const out = fs.createWriteStream(raw);
  let n = 0;
  const started = Date.now();
  for await (const line of lines) {
    if (line.startsWith('#')) continue;
    const [harmonicPos, , prPos, , rev] = line.split('\t');
    if (!rev) continue;
    if (!out.write(`${unreverse(rev)}\t${harmonicPos}\t${prPos}\n`)) await new Promise((r) => out.once('drain', r));
    n += 1;
    if (n % 1_000_000 === 0) console.log(`  ${n.toLocaleString()} domains read (${Math.round((Date.now() - started) / 1000)} s)`);
    if (n >= LIMIT) break;
  }
  // Stop downloading the rest of the 2 GB file.
  res.destroy();
  await new Promise((r) => out.end(r));
  console.log(`Read ${n.toLocaleString()} domains. Sorting by name…`);

  // Byte-order sort, so the lookup can binary-search the file.
  await new Promise((resolve, reject) => {
    const p = spawn('sort', ['-t', '\t', '-k1,1', '-S', '25%', '-o', sorted, raw], { env: { ...process.env, LC_ALL: 'C' }, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`sort failed (${code})`))));
    p.on('error', reject);
  });
  fs.rmSync(raw);

  const meta = { release: RELEASE, totalDomains: total, indexedDomains: n, builtAt: new Date().toISOString(), source: `${BASE}-domain-ranks.txt.gz` };
  fs.writeFileSync(path.join(work, 'meta.json'), JSON.stringify(meta, null, 2));

  // Swap the new index in only when it is complete.
  for (const f of ['domains.tsv', 'meta.json']) fs.renameSync(path.join(work, f), path.join(DIR, f));
  fs.rmSync(work, { recursive: true, force: true });
  console.log(`Done: ${path.join(DIR, 'domains.tsv')} (${(fs.statSync(path.join(DIR, 'domains.tsv')).size / 1048576).toFixed(0)} MB). Restart the site (or wait a minute) to use it.`);
};

main().catch((error) => {
  console.error('Building the authority index failed:', error.message);
  process.exit(1);
});
