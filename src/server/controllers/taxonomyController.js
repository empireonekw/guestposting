import Niche from '../models/Niche';
import Country from '../models/Country';
import Listing from '../models/Listing';
import logActivity from '../logger';
import { json, readBody, serverError } from '../http';
import { str, bool, oneOf, ValidationError } from '../validate';
import { getTaxonomy, clearTaxonomyCache } from '../taxonomy';
import { slugify } from '@/data/niches';
import { CONTINENTS } from '@/data/countries';
import { BLOCKED_NICHES } from '@/data/listingOptions';

// Admin → Niches & countries. Listings store niche slugs and country codes,
// so those never change after creation: renaming only changes the name, and
// anything a listing uses can be hidden but not deleted.

const notDeleted = { isDeleted: { $ne: true } };
const CONTINENT_IDS = CONTINENTS.map((c) => c.id);
const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
// Two-letter codes Intl knows that aren't countries.
const NOT_COUNTRIES = new Set(['zz', 'eu', 'ez', 'un', 'qo', 'xa', 'xb']);

const countMap = (rows) => new Map(rows.map((r) => [r._id, r.n]));

// GET /api/admin/taxonomy: every niche and country, hidden ones too, with
// how many websites use each.
export const getAdminTaxonomy = async () => {
  try {
    await getTaxonomy(); // seeds the default lists on an empty database
    const [niches, countries, nicheUse, countryUse, topUse] = await Promise.all([
      Niche.find().sort({ order: 1, name: 1 }).lean(),
      Country.find().sort({ order: 1, name: 1 }).lean(),
      Listing.aggregate([{ $match: notDeleted }, { $unwind: '$niches' }, { $group: { _id: '$niches', n: { $sum: 1 } } }]),
      Listing.aggregate([{ $match: { ...notDeleted, country: { $nin: [null, ''] } } }, { $group: { _id: '$country', n: { $sum: 1 } } }]),
      Listing.aggregate([
        { $match: notDeleted },
        { $unwind: '$topCountries' },
        { $group: { _id: '$topCountries.code', n: { $sum: 1 } } },
      ]),
    ]);
    const nicheCount = countMap(nicheUse);
    const countryCount = countMap(countryUse);
    const topCount = countMap(topUse);
    return json({
      niches: niches.map((n) => ({
        name: n.name, slug: n.slug, parent: n.parent || null, isActive: n.isActive !== false, listings: nicheCount.get(n.slug) || 0,
        blocked: BLOCKED_NICHES.includes(n.slug),
      })),
      countries: countries.map((c) => ({
        code: c.code, name: c.name, slug: c.slug, continent: c.continent, isActive: c.isActive !== false,
        listings: countryCount.get(c.code) || 0,
        topCountryListings: topCount.get(c.code) || 0,
      })),
      continents: CONTINENTS,
    });
  } catch (error) {
    return serverError(error);
  }
};

// Niches are shown in A–Z order within their parent.
const sortSiblings = async (parent) => {
  const siblings = await Niche.find({ parent: parent || null }).collation({ locale: 'en' }).sort({ name: 1 }).select('_id');
  if (siblings.length) {
    await Niche.bulkWrite(siblings.map((n, i) => ({ updateOne: { filter: { _id: n._id }, update: { $set: { order: i } } } })));
  }
};

const changed = async (user, action, details) => {
  clearTaxonomyCache();
  await logActivity(user.id, action, null, details);
};

// POST /api/admin/taxonomy/niches { name, parent? }
export const createNiche = async (request, params, user) => {
  try {
    const body = await readBody(request);
    const name = str(body.name, 'name', 'Name', { min: 2, max: 80 });
    const slug = slugify(name);
    if (!slug) throw new ValidationError('Use letters or numbers in the name', 'name');
    let parent = null;
    if (body.parent) {
      parent = String(body.parent);
      const top = await Niche.findOne({ slug: parent, parent: null });
      if (!top) throw new ValidationError('Choose a main niche from the list', 'parent');
    }
    const existing = await Niche.findOne({ slug });
    if (existing) {
      return json({
        message: existing.isActive === false
          ? `"${existing.name}" already exists but is hidden. Show it instead.`
          : `A niche called "${existing.name}" already exists.`,
        field: 'name',
      }, 409);
    }
    await Niche.create({ name, slug, parent });
    await sortSiblings(parent);
    await changed(user, 'NICHE_CREATED', `Added niche ${name}${parent ? ` under ${parent}` : ''}`);
    return json({ name, slug, parent, isActive: true, listings: 0 }, 201);
  } catch (error) {
    return serverError(error);
  }
};

// PATCH /api/admin/taxonomy/niches/:slug { name?, isActive? }
export const updateNiche = async (request, params, user) => {
  try {
    const body = await readBody(request);
    const niche = await Niche.findOne({ slug: params.slug });
    if (!niche) return json({ message: 'Niche not found' }, 404);
    const name = str(body.name, 'name', 'Name', { required: false, min: 2, max: 80 });
    const isActive = bool(body.isActive, 'isActive', 'Shown');
    const notes = [];

    if (name && name !== niche.name) {
      // Listings keep the first niche's name as their category label.
      await Listing.updateMany({ 'niches.0': niche.slug }, { $set: { category: name } });
      notes.push(`renamed "${niche.name}" to "${name}"`);
      niche.name = name;
    }
    if (isActive !== undefined && isActive !== (niche.isActive !== false)) {
      notes.push(isActive ? 'shown' : 'hidden');
      niche.isActive = isActive;
    }
    if (!notes.length) return json({ message: 'Nothing changed' });
    await niche.save();
    if (name) await sortSiblings(niche.parent);
    await changed(user, 'NICHE_UPDATED', `Niche ${niche.slug}: ${notes.join(', ')}`);
    return json({ name: niche.name, slug: niche.slug, parent: niche.parent, isActive: niche.isActive });
  } catch (error) {
    return serverError(error);
  }
};

// DELETE /api/admin/taxonomy/niches/:slug: only when nothing uses it.
export const deleteNiche = async (request, params, user) => {
  try {
    const niche = await Niche.findOne({ slug: params.slug });
    if (!niche) return json({ message: 'Niche not found' }, 404);
    const [used, children] = await Promise.all([
      Listing.countDocuments({ ...notDeleted, niches: niche.slug }),
      Niche.countDocuments({ parent: niche.slug }),
    ]);
    if (children) return json({ message: `Delete or move its ${children} sub-niche${children === 1 ? '' : 's'} first, or hide it instead.` }, 400);
    if (used) return json({ message: `${used} website${used === 1 ? ' uses' : 's use'} this niche. Hide it instead, so those listings keep it.` }, 400);
    await niche.deleteOne();
    await changed(user, 'NICHE_DELETED', `Deleted niche ${niche.name}`);
    return json({ message: `${niche.name} deleted` });
  } catch (error) {
    return serverError(error);
  }
};

const countryCode = (value) => {
  const code = str(value, 'code', 'Country code', { min: 2, max: 2 }).toLowerCase();
  // Intl knows every ISO 3166 region and returns nothing for unknown codes.
  if (!/^[a-z]{2}$/.test(code) || NOT_COUNTRIES.has(code) || !regionNames.of(code.toUpperCase())) {
    throw new ValidationError('Use a 2-letter ISO country code, like "us" or "de"', 'code');
  }
  return code;
};

// POST /api/admin/taxonomy/countries { code, name?, slug?, continent }
export const createCountry = async (request, params, user) => {
  try {
    const body = await readBody(request);
    const code = countryCode(body.code);
    const name = str(body.name, 'name', 'Name', { required: false, min: 2, max: 80 }) || regionNames.of(code.toUpperCase());
    const slug = slugify(str(body.slug, 'slug', 'Page address', { required: false, max: 80 }) || name);
    if (!slug) throw new ValidationError('Use letters or numbers in the page address', 'slug');
    const continent = oneOf(body.continent, 'continent', 'Continent', CONTINENT_IDS);

    const clash = await Country.findOne({ $or: [{ code }, { slug }] });
    if (clash) {
      const field = clash.code === code ? 'code' : 'slug';
      const hidden = clash.isActive === false ? ' It is hidden; show it instead.' : '';
      return json({ message: `${clash.name} already uses this ${field === 'code' ? 'code' : 'page address'}.${hidden}`, field }, 409);
    }
    const last = await Country.findOne().sort({ order: -1 }).select('order');
    await Country.create({ code, name, slug, continent, order: (last?.order ?? -1) + 1 });
    await changed(user, 'COUNTRY_CREATED', `Added country ${name} (${code.toUpperCase()})`);
    return json({ code, name, slug, continent, isActive: true, listings: 0, topCountryListings: 0 }, 201);
  } catch (error) {
    return serverError(error);
  }
};

// PATCH /api/admin/taxonomy/countries/:code { name?, continent?, isActive? }
export const updateCountry = async (request, params, user) => {
  try {
    const body = await readBody(request);
    const country = await Country.findOne({ code: String(params.code).toLowerCase() });
    if (!country) return json({ message: 'Country not found' }, 404);
    const name = str(body.name, 'name', 'Name', { required: false, min: 2, max: 80 });
    const continent = oneOf(body.continent, 'continent', 'Continent', CONTINENT_IDS, { required: false });
    const isActive = bool(body.isActive, 'isActive', 'Shown');
    const notes = [];
    if (name && name !== country.name) { notes.push(`renamed to "${name}"`); country.name = name; }
    if (continent && continent !== country.continent) { notes.push(`moved to ${continent}`); country.continent = continent; }
    if (isActive !== undefined && isActive !== (country.isActive !== false)) {
      notes.push(isActive ? 'shown' : 'hidden');
      country.isActive = isActive;
    }
    if (!notes.length) return json({ message: 'Nothing changed' });
    await country.save();
    await changed(user, 'COUNTRY_UPDATED', `Country ${country.code.toUpperCase()}: ${notes.join(', ')}`);
    return json({ code: country.code, name: country.name, slug: country.slug, continent: country.continent, isActive: country.isActive });
  } catch (error) {
    return serverError(error);
  }
};

// DELETE /api/admin/taxonomy/countries/:code: only when nothing uses it.
export const deleteCountry = async (request, params, user) => {
  try {
    const country = await Country.findOne({ code: String(params.code).toLowerCase() });
    if (!country) return json({ message: 'Country not found' }, 404);
    const used = await Listing.countDocuments({ ...notDeleted, $or: [{ country: country.code }, { 'topCountries.code': country.code }] });
    if (used) return json({ message: `${used} website${used === 1 ? ' uses' : 's use'} this country. Hide it instead.` }, 400);
    await country.deleteOne();
    await changed(user, 'COUNTRY_DELETED', `Deleted country ${country.name}`);
    return json({ message: `${country.name} deleted` });
  } catch (error) {
    return serverError(error);
  }
};
