import SavedSearch, { ALERT_FREQUENCIES } from '../models/SavedSearch';
import { json, readBody, serverError } from '../http';
import { str, oneOf, objectId } from '../validate';
import { rateLimit, MINUTE } from '../rateLimit';
import {
  cleanParams, countMatches, searchHref, PERIOD_MS, MAX_SAVED_SEARCHES,
} from '../savedSearches';

// Module 6: a buyer's saved publisher-list searches, with optional alerts.

const view = (s, matches) => ({
  _id: s._id,
  name: s.name,
  params: Object.fromEntries(s.params || []),
  href: searchHref(s.params),
  alerts: s.alerts,
  lastAlertAt: s.lastAlertAt,
  nextAlertAt: s.alerts === 'off' ? null : s.nextAlertAt,
  createdAt: s.createdAt,
  matches,
});

const safeCount = (s) => countMatches(Object.fromEntries(s.params || [])).catch(() => null);

// GET /api/saved-searches
export const getSavedSearches = async (request, params, user) => {
  try {
    const rows = await SavedSearch.find({ user: user.id }).sort({ createdAt: -1 }).limit(MAX_SAVED_SEARCHES);
    const counts = await Promise.all(rows.map(safeCount));
    return json({ searches: rows.map((s, i) => view(s, counts[i])), max: MAX_SAVED_SEARCHES });
  } catch (error) {
    return serverError(error);
  }
};

// Alerts count new sites from now on, not ones already listed.
const startAlerts = (search, alerts) => {
  const now = new Date();
  search.alerts = alerts;
  if (alerts === 'off') {
    search.nextAlertAt = undefined;
  } else {
    search.lastAlertAt = now;
    search.nextAlertAt = new Date(now.getTime() + PERIOD_MS[alerts]);
  }
};

// POST /api/saved-searches { name, params, alerts }
export const createSavedSearch = async (request, params, user) => {
  try {
    const limited = rateLimit('saved-search', user.id, { limit: 30, windowMs: 10 * MINUTE });
    if (limited) return limited;
    const body = await readBody(request);
    const name = str(body.name, 'name', 'Name', { max: 80 });
    const alerts = oneOf(body.alerts, 'alerts', 'Alerts', ALERT_FREQUENCIES, { required: false }) || 'weekly';
    const filters = await cleanParams(body.params);
    const count = await SavedSearch.countDocuments({ user: user.id });
    if (count >= MAX_SAVED_SEARCHES) {
      return json({ message: `You can save up to ${MAX_SAVED_SEARCHES} searches. Delete one first.` }, 400);
    }
    const search = new SavedSearch({ user: user.id, name, params: filters });
    startAlerts(search, alerts);
    await search.save();
    return json(view(search, await safeCount(search)), 201);
  } catch (error) {
    return serverError(error);
  }
};

// PUT /api/saved-searches/:id { name?, alerts?, params? }
export const updateSavedSearch = async (request, params, user) => {
  try {
    const id = objectId(params.id, 'id', 'Saved search');
    const search = await SavedSearch.findOne({ _id: id, user: user.id });
    if (!search) return json({ message: 'Saved search not found' }, 404);
    const body = await readBody(request);
    const name = str(body.name, 'name', 'Name', { required: false, max: 80 });
    if (name) search.name = name;
    if (body.params !== undefined) search.params = await cleanParams(body.params);
    const alerts = oneOf(body.alerts, 'alerts', 'Alerts', ALERT_FREQUENCIES, { required: false });
    if (alerts && alerts !== search.alerts) startAlerts(search, alerts);
    await search.save();
    return json(view(search, await safeCount(search)));
  } catch (error) {
    return serverError(error);
  }
};

// DELETE /api/saved-searches/:id
export const deleteSavedSearch = async (request, params, user) => {
  try {
    const id = objectId(params.id, 'id', 'Saved search');
    const res = await SavedSearch.deleteOne({ _id: id, user: user.id });
    if (!res.deletedCount) return json({ message: 'Saved search not found' }, 404);
    return json({ deleted: id });
  } catch (error) {
    return serverError(error);
  }
};
