import Listing from '../models/Listing';
import { json, readBody, serverError } from '../http';
import { str } from '../validate';
import { rateLimit, clientIp, firstLimited, MINUTE, HOUR } from '../rateLimit';
import { hiddenSellerIds } from '../listingSearch';

// Free tools (Module 6): the bulk domain checker. Anyone can paste a list
// of domains and see which are on the marketplace and from what price.

export const MAX_DOMAINS = 500;

// "https://www.Example.com/blog?x" -> "example.com"; null if it isn't a domain.
export const toDomain = (raw) => {
  let text = String(raw || '').trim().toLowerCase();
  if (!text) return null;
  text = text.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^\/\//, '');
  text = text.split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.$/, '');
  if (text.length > 253 || !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(text)) return null;
  return text;
};

// POST /api/tools/domain-check { domains: "one per line or comma-separated" }
export const checkDomains = async (request) => {
  try {
    const ip = clientIp(request);
    const limited = firstLimited(
      rateLimit('domain-check', ip, { limit: 20, windowMs: 10 * MINUTE }),
      rateLimit('domain-check-hour', ip, { limit: 60, windowMs: HOUR }),
    );
    if (limited) return limited;
    const body = await readBody(request);
    const text = str(body.domains, 'domains', 'Domains', { max: 60000 });
    const entries = text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!entries.length) return json({ message: 'Paste at least one domain', field: 'domains' }, 400);

    const rows = [];
    const seen = new Set();
    for (const input of entries) {
      const domain = toDomain(input);
      const key = domain || `invalid:${input}`;
      if (seen.has(key)) continue; // eslint-disable-line no-continue
      seen.add(key);
      rows.push({ input: input.slice(0, 200), domain });
      if (rows.length > MAX_DOMAINS) break;
    }
    if (rows.length > MAX_DOMAINS) {
      return json({ message: `Check at most ${MAX_DOMAINS} domains at a time`, field: 'domains' }, 400);
    }

    const domains = rows.map((r) => r.domain).filter(Boolean);
    const hidden = await hiddenSellerIds();
    const listings = await Listing.find({
      domain: { $in: domains },
      status: 'approved',
      isDeleted: { $ne: true },
      ...(hidden.length ? { seller: { $nin: hidden } } : {}),
    })
      .select('domain price dr da traffic isVerified googleNews linkType')
      .sort({ isVerified: -1, price: 1 })
      .lean();

    // The cheapest offer per domain (verified sellers first on equal price).
    const best = new Map();
    const offers = new Map();
    listings.forEach((l) => {
      offers.set(l.domain, (offers.get(l.domain) || 0) + 1);
      const cur = best.get(l.domain);
      if (!cur || l.price < cur.price) best.set(l.domain, l);
    });

    const results = rows.map((r) => {
      if (!r.domain) return { input: r.input, domain: null, valid: false, listed: false };
      const l = best.get(r.domain);
      if (!l) return { input: r.input, domain: r.domain, valid: true, listed: false };
      return {
        input: r.input,
        domain: r.domain,
        valid: true,
        listed: true,
        listingId: String(l._id),
        offers: offers.get(r.domain),
        price: l.price,
        dr: l.dr,
        da: l.da,
        traffic: l.traffic,
        verified: !!l.isVerified,
        googleNews: !!l.googleNews,
        linkType: l.linkType,
      };
    });
    return json({
      results,
      counts: {
        checked: results.length,
        listed: results.filter((r) => r.listed).length,
        invalid: results.filter((r) => !r.valid).length,
      },
    });
  } catch (error) {
    return serverError(error);
  }
};
