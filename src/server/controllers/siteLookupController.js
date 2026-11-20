import { json, readBody, serverError } from '../http';
import { str, ValidationError } from '../validate';
import { rateLimit } from '../rateLimit';
import { lookupSite, normalizeDomain } from '../sitedata';

// POST /api/site-lookup { url }: the seller form's auto-fill. Signed-in users
// only, and rate limited: Ahrefs' licence lets us show DR for sites listed
// here, not run a public DR checker.
export const siteLookup = async (request, params, user) => {
  try {
    const limited = rateLimit('site-lookup', user.id, { limit: 30, windowMs: 10 * 60 * 1000 });
    if (limited) return limited;
    const url = str((await readBody(request)).url, 'url', 'Website address', { max: 2048 });
    if (!normalizeDomain(url)) throw new ValidationError('Enter a website address like example.com', 'url');
    return json(await lookupSite(url));
  } catch (error) {
    return serverError(error);
  }
};
