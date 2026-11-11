// Fills a development database with made-up publisher listings so the
// /sites pages and filters can be tried out. Everything belongs to one demo
// seller (demo-publisher@example.com) and uses .example domains, which can
// never be real websites.
//
//   node --env-file=.env.local scripts/seed-demo-listings.mjs           (add 60 listings)
//   node --env-file=.env.local scripts/seed-demo-listings.mjs --remove  (delete them and the demo seller)
//
// Do not run this on the live site's database.

import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const DEMO_EMAIL = 'demo-publisher@example.com';
const REMOVE = process.argv.includes('--remove');

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is not set. Run with --env-file=.env.local.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
const users = db.collection('users');
const listings = db.collection('listings');

if (REMOVE) {
  const seller = await users.findOne({ email: DEMO_EMAIL });
  if (!seller) {
    console.log('No demo seller found. Nothing to remove.');
  } else {
    const orders = await db.collection('orders').countDocuments({ seller: seller._id });
    if (orders) {
      console.log(`The demo seller has ${orders} order(s); remove those first.`);
    } else {
      const { deletedCount } = await listings.deleteMany({ seller: seller._id });
      await users.deleteOne({ _id: seller._id });
      console.log(`Removed ${deletedCount} demo listing(s) and the demo seller.`);
    }
  }
  await mongoose.disconnect();
  process.exit(0);
}

// A deterministic random generator so every run makes the same data.
let seed = 42;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (lo, hi) => Math.round(lo + rand() * (hi - lo));

const WORDS = ['tech', 'pulse', 'daily', 'hub', 'wire', 'nest', 'guide', 'insider', 'journal', 'today', 'lab', 'post', 'zone', 'scope', 'times', 'mag'];
const NICHE_SETS = [
  ['technology-gadgets', 'saas'], ['business', 'startups-entrepreneurship'], ['finance', 'personal-finance'],
  ['health', 'fitness'], ['travel-tourism', 'hotels'], ['real-estate'], ['crypto-blockchain', 'defi'],
  ['home-garden', 'home-improvement'], ['home-services', 'plumbing', 'hvac'], ['digital-marketing', 'seo'],
  ['fashion', 'beauty'], ['sports', 'football'], ['education'], ['food-drink'], ['casino-gambling'], ['cbd-cannabis'],
  ['lifestyle', 'general'], ['news-magazines'], ['automotive', 'electric-vehicles'], ['legal'],
];
const COUNTRY_SETS = [
  ['us', 'ca', 'gb'], ['gb', 'us', 'ie'], ['ca', 'us', 'gb'], ['au', 'nz', 'us'], ['in', 'us', 'ae'],
  ['ae', 'in', 'sa'], ['de', 'at', 'ch'], ['fr', 'be', 'ca'], ['es', 'mx', 'ar'], ['br', 'pt', 'us'],
  ['sg', 'my', 'id'], ['pk', 'ae', 'gb'], ['ph', 'us', 'sg'], ['za', 'ng', 'ke'],
];
const LANG_BY_COUNTRY = { de: 'de', fr: 'fr', es: 'es', br: 'pt' };

let seller = await users.findOne({ email: DEMO_EMAIL });
if (!seller) {
  const password = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
  const { insertedId } = await users.insertOne({
    name: 'Demo Publisher', email: DEMO_EMAIL, password, role: 'seller',
    isSuspended: false, balance: 0, payoutDetails: '', createdAt: new Date(), updatedAt: new Date(),
  });
  seller = { _id: insertedId };
}

const existing = await listings.countDocuments({ seller: seller._id });
if (existing) {
  console.log(`The demo seller already has ${existing} listing(s). Run with --remove first to start again.`);
  await mongoose.disconnect();
  process.exit(0);
}

const now = Date.now();
const docs = [];
for (let i = 0; i < 60; i += 1) {
  const domain = `${pick(WORDS)}${pick(WORDS)}${i}.example`;
  const countries = pick(COUNTRY_SETS);
  const dr = between(15, 92);
  const traffic = Math.round(Math.pow(10, 2.5 + rand() * 4));
  const shares = [between(35, 80), between(5, 15), between(1, 6)];
  const history = Array.from({ length: 6 }, (_, m) => ({
    month: new Date(now - (5 - m) * 30 * 86400000),
    ahrefs: Math.round(traffic * (0.75 + rand() * 0.5)),
    semrush: Math.round(traffic * (0.6 + rand() * 0.6)),
  }));
  const niches = pick(NICHE_SETS);
  const isCasino = niches.includes('casino-gambling');
  const isCbd = niches.includes('cbd-cannabis');
  docs.push({
    seller: seller._id,
    url: `https://${domain}/`,
    domain,
    niches,
    category: niches[0],
    description: 'Demo listing for trying out the publisher list.',
    price: between(30, 900) + 0.9,
    linkInsertionPrice: rand() < 0.5 ? between(20, 400) : undefined,
    dr,
    da: Math.max(5, Math.min(99, dr + between(-15, 10))),
    authorityScore: Math.max(5, Math.min(99, dr + between(-20, 5))),
    traffic,
    semrushTraffic: Math.round(traffic * (0.5 + rand())),
    keywords: Math.round(traffic / between(3, 30)),
    trafficHistory: history,
    language: LANG_BY_COUNTRY[countries[0]] || 'en',
    country: countries[0],
    topCountries: countries.map((code, k) => ({ code, share: shares[k] })),
    linkType: rand() < 0.88 ? 'dofollow' : 'nofollow',
    linkValidity: pick(['permanent', 'permanent', 'permanent', '12m', '24m', '6m']),
    linksPerPost: pick([1, 1, 2, 2, 3]),
    googleNews: rand() < 0.2,
    markedSponsored: rand() < 0.3,
    acceptsSitewide: rand() < 0.15,
    acceptsForeignLanguage: rand() < 0.1,
    allowed: {
      casino: isCasino || rand() < 0.12,
      cbd: isCbd || rand() < 0.1,
      crypto: niches.includes('crypto-blockchain') || rand() < 0.25,
      pharmacy: rand() < 0.08,
      sports: rand() < 0.15,
    },
    turnaroundDays: pick([1, 1, 2, 3, 3, 5, 7]),
    sampleUrls: [],
    status: 'approved',
    isVerified: false,
    isFeatured: i < 3,
    featuredUntil: i < 3 ? new Date(now + 30 * 86400000) : undefined,
    isDeleted: false,
    createdAt: new Date(now - i * 3600000),
    updatedAt: new Date(now - i * 3600000),
  });
}

await listings.insertMany(docs);
console.log(`Added ${docs.length} demo listings for ${DEMO_EMAIL}. Remove them with --remove.`);
await mongoose.disconnect();
