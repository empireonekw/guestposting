import SavedSearch from './models/SavedSearch';
import Listing from './models/Listing';
import Notification from './models/Notification';
import { buildListingQuery } from './listingSearch';
import { sendEmailInBackground } from './sendEmail';
import { escapeHtml } from './escape';
import { ValidationError } from './validate';
import { FILTER_KEYS } from '@/components/site/filters';
import BRAND from '@/data/brand';

// Saved searches and their email alerts (Module 6).

const DAY = 24 * 60 * 60 * 1000;
export const PERIOD_MS = { daily: DAY, weekly: 7 * DAY };
export const MAX_SAVED_SEARCHES = 20;

// The /sites parameters a saved search may keep (filters and the sort).
const ALLOWED = new Set([...FILTER_KEYS, 'verified', 'category', 'sort']);

// Cleans the parameters and checks them with the real search, so a saved
// search always opens without an error.
export const cleanParams = async (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError('Search filters are missing', 'params');
  const params = {};
  Object.entries(raw).forEach(([k, v]) => {
    if (!ALLOWED.has(k) || v === undefined || v === null || v === '') return;
    if (typeof v !== 'string' && typeof v !== 'number') return;
    const text = String(v).trim().slice(0, 300);
    if (text) params[k] = text;
  });
  await buildListingQuery(params); // throws a ValidationError on bad values
  return params;
};

export const searchHref = (params) => {
  const qs = new URLSearchParams(params instanceof Map ? Object.fromEntries(params) : params).toString();
  return qs ? `/sites?${qs}` : '/sites';
};

// Live listings matching the search that went live after `since`. Older
// listings have no approvedAt, so their creation date stands in.
export const newMatches = async (params, since, limit = 5) => {
  const query = await buildListingQuery(params);
  const fresh = { $or: [{ approvedAt: { $gt: since } }, { approvedAt: null, createdAt: { $gt: since } }] };
  query.$and = [...(query.$and || []), fresh];
  const [count, top] = await Promise.all([
    Listing.countDocuments(query),
    Listing.find(query).select('domain price dr traffic').sort({ approvedAt: -1, createdAt: -1 }).limit(limit).lean(),
  ]);
  return { count, top };
};

export const countMatches = async (params) => Listing.countDocuments(await buildListingQuery(params));

const alertEmail = (user, search, { count, top }, href) => {
  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const rows = top.map((l) => `<li><a href="${escapeHtml(base)}/sites/${escapeHtml(l.domain)}">${escapeHtml(l.domain)}</a> &middot; DR ${Number(l.dr) || 0} &middot; $${Number(l.price) || 0}</li>`).join('');
  return `<div style="font-family:sans-serif;max-width:560px">
    <p>Hi ${escapeHtml(user.name || '')},</p>
    <p>${count} new website${count === 1 ? '' : 's'} match your saved search <strong>${escapeHtml(search.name)}</strong>:</p>
    <ul>${rows}</ul>
    <p><a href="${escapeHtml(base)}${escapeHtml(href)}" style="display:inline-block;background:#5A3B8C;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">See all matches</a></p>
    <p style="color:#858099;font-size:13px">You get this because you turned on alerts for this search. Change or stop them on <a href="${escapeHtml(base)}/saved-searches">Saved searches</a>.<br>${escapeHtml(BRAND.name)}</p>
  </div>`;
};

// Scheduled job: emails buyers about new sites matching their searches.
export const sendSavedSearchAlerts = async () => {
  const now = new Date();
  const due = await SavedSearch.find({ alerts: { $in: ['daily', 'weekly'] }, nextAlertAt: { $lte: now } })
    .populate('user', 'name email isSuspended')
    .limit(200);
  let sent = 0;
  for (const search of due) {
    const since = search.lastAlertAt || search.createdAt;
    let result = { count: 0, top: [] };
    try {
      // eslint-disable-next-line no-await-in-loop
      result = await newMatches(Object.fromEntries(search.params || []), since);
    } catch (error) {
      // A filter that no longer exists (a niche the admin removed): skip it.
      if (!(error instanceof ValidationError)) throw error;
    }
    const user = search.user;
    if (result.count > 0 && user && !user.isSuspended) {
      const href = searchHref(search.params);
      // eslint-disable-next-line no-await-in-loop
      await Notification.create({
        recipient: user._id,
        type: 'saved_search',
        message: `${result.count} new website${result.count === 1 ? '' : 's'} match your saved search “${search.name}”.`.slice(0, 500),
        link: href,
      });
      if (user.email) {
        sendEmailInBackground({
          email: user.email,
          subject: `${result.count} new site${result.count === 1 ? '' : 's'} for “${search.name}”`,
          html: alertEmail(user, search, result, href),
        }, 'Saved search alert');
      }
      sent += 1;
    }
    search.lastAlertAt = now;
    search.lastAlertCount = result.count;
    search.nextAlertAt = new Date(now.getTime() + (PERIOD_MS[search.alerts] || 7 * DAY));
    // eslint-disable-next-line no-await-in-loop
    await search.save();
  }
  return `${due.length} search(es) checked, ${sent} alert(s) sent`;
};
