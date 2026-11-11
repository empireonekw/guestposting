// Module 1 data migration. Fills the new listing fields on listings created
// before Module 1: `domain` from the URL and `niches` from the old single
// `category`. It only adds fields and is safe to run more than once.
//
//   node --env-file=.env scripts/migrate-module1.mjs          (dry run)
//   node --env-file=.env scripts/migrate-module1.mjs --apply  (write changes)

import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');

// Old categories -> new niche slugs (see src/data/niches.js).
const CATEGORY_TO_NICHES = {
  technology: ['technology-gadgets'],
  'health & fitness': ['health', 'fitness'],
  'business & finance': ['business', 'finance'],
  'real estate': ['real-estate'],
  crypto: ['crypto-blockchain'],
  lifestyle: ['lifestyle'],
  general: ['general'],
};

const hostOf = (url) => {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
};

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is not set. Run with --env-file=.env (or .env.local).');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const listings = mongoose.connection.db.collection('listings');

const cursor = listings.find(
  { $or: [{ domain: { $exists: false } }, { niches: { $exists: false } }, { niches: { $size: 0 } }] },
  { projection: { url: 1, category: 1, domain: 1, niches: 1 } },
);

let changed = 0;
const unknown = new Map();
for await (const l of cursor) {
  const set = {};
  if (!l.domain) {
    const domain = hostOf(l.url);
    if (domain) set.domain = domain;
  }
  if (!l.niches || l.niches.length === 0) {
    const key = String(l.category || 'general').trim().toLowerCase();
    const niches = CATEGORY_TO_NICHES[key];
    if (!niches) unknown.set(l.category, (unknown.get(l.category) || 0) + 1);
    set.niches = niches || ['general'];
  }
  if (Object.keys(set).length) {
    changed += 1;
    if (APPLY) await listings.updateOne({ _id: l._id }, { $set: set });
  }
}

console.log(`${APPLY ? 'Updated' : 'Would update'} ${changed} listing(s).`);
if (unknown.size) {
  console.log('Categories with no matching niche (set to General):');
  unknown.forEach((n, c) => console.log(`  ${c}: ${n}`));
}
if (!APPLY && changed) console.log('Run again with --apply to save the changes.');

await mongoose.disconnect();
