import connectDB from './db';
import Niche from './models/Niche';
import Country from './models/Country';
import { DEFAULT_NICHES } from '@/data/niches';
import { DEFAULT_COUNTRIES, CONTINENTS } from '@/data/countries';
import { LANGUAGES } from '@/data/languages';
import { BLOCKED_NICHES } from '@/data/listingOptions';

// Niches our payment provider doesn't allow never reach menus, filters or
// forms (see listingOptions.js). Admins still see them in Niches & countries.
const allowedNiche = (n) => !BLOCKED_NICHES.includes(n.slug);

// Niches, countries and languages for menus, filters and forms. The first
// call on an empty database seeds the default lists; after that the admin's
// edits in the database win. Results are cached for a minute.

const CACHE_MS = 60 * 1000;
const cache = globalThis.__taxonomy || (globalThis.__taxonomy = { data: null, at: 0, pending: null });

const seedIfEmpty = async () => {
  if ((await Niche.estimatedDocumentCount()) === 0) {
    const docs = DEFAULT_NICHES.flatMap((n) => [
      { name: n.name, slug: n.slug, parent: null, order: n.order },
      ...n.children.map((c) => ({ name: c.name, slug: c.slug, parent: n.slug, order: c.order })),
    ]);
    // ordered:false so a second server process seeding at the same moment
    // only hits duplicate-key errors, which are ignored.
    await Niche.insertMany(docs, { ordered: false }).catch((e) => { if (e.code !== 11000) throw e; });
  }
  if ((await Country.estimatedDocumentCount()) === 0) {
    await Country.insertMany(DEFAULT_COUNTRIES, { ordered: false }).catch((e) => { if (e.code !== 11000) throw e; });
  }
};

const load = async () => {
  await connectDB();
  await seedIfEmpty();
  const [nicheRows, countryRows] = await Promise.all([
    Niche.find({ isActive: true }).sort({ order: 1, name: 1 }).lean(),
    Country.find({ isActive: true }).sort({ order: 1, name: 1 }).lean(),
  ]);

  const shown = nicheRows.filter(allowedNiche);
  const top = shown.filter((n) => !n.parent);
  const niches = top.map((n) => ({
    name: n.name,
    slug: n.slug,
    children: shown
      .filter((c) => c.parent === n.slug)
      .map((c) => ({ name: c.name, slug: c.slug })),
  }));
  const countries = countryRows.map(({ code, name, slug, continent }) => ({ code, name, slug, continent }));

  return { niches, countries, continents: CONTINENTS, languages: LANGUAGES };
};

// The built-in lists, used when the database can't be reached so menus and
// forms still render.
const defaults = () => ({
  niches: DEFAULT_NICHES.filter(allowedNiche).map((n) => ({ name: n.name, slug: n.slug, children: n.children.filter(allowedNiche).map(({ name, slug }) => ({ name, slug })) })),
  countries: DEFAULT_COUNTRIES.map(({ code, name, slug, continent }) => ({ code, name, slug, continent })),
  continents: CONTINENTS,
  languages: LANGUAGES,
});

export const getTaxonomy = async () => {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (!cache.pending) {
    cache.pending = load()
      .then((data) => {
        cache.data = data;
        cache.at = Date.now();
        return data;
      })
      .catch((error) => {
        console.error('Taxonomy: using built-in lists:', error.message);
        return cache.data || defaults();
      })
      .finally(() => {
        cache.pending = null;
      });
  }
  return cache.pending;
};

// Call after the admin changes niches or countries.
export const clearTaxonomyCache = () => {
  cache.data = null;
  cache.at = 0;
};

// slug -> niche (top level or sub-niche), with the parent for sub-niches.
export const nicheIndex = (taxonomy) => {
  const map = new Map();
  taxonomy.niches.forEach((n) => {
    map.set(n.slug, { name: n.name, slug: n.slug, parent: null, children: n.children });
    n.children.forEach((c) => map.set(c.slug, { name: c.name, slug: c.slug, parent: n.slug, children: [] }));
  });
  return map;
};
