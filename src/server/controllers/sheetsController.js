import ExcelJS from 'exceljs';
import Listing from '../models/Listing';
import { json, serverError, queryParams } from '../http';
import { str } from '../validate';
import { rateLimit, MINUTE } from '../rateLimit';
import { getTaxonomy } from '../taxonomy';
import { hiddenSellerIds } from '../listingSearch';
import { LANGUAGE_NAMES } from '@/data/languages';
import { LINK_VALIDITY, labelOf } from '@/data/listingOptions';
import BRAND from '@/data/brand';

// Category sheets for sellers and admins: every live website, grouped by
// main niche, as Excel files they can download and share with their own
// clients (like LeapRank's site lists). One file per category, or one
// workbook with a tab per category.

const SITE = () => (process.env.FRONTEND_URL || 'https://guestposting.live').replace(/\/$/, '');

// Every live listing with its main categories (a site in "SaaS" also counts
// for its parent "Technology").
const loadSites = async (taxonomy) => {
  const hidden = await hiddenSellerIds();
  const rows = await Listing.find({
    status: 'approved',
    isDeleted: { $ne: true },
    ...(hidden.length ? { seller: { $nin: hidden } } : {}),
  })
    .select('url domain niches country language topCountries dr da authorityScore traffic semrushTraffic keywords linkType linkValidity linksPerPost googleNews markedSponsored turnaroundDays price linkInsertionPrice isVerified metrics autoMetrics seller')
    .populate('seller', 'name email')
    .sort({ dr: -1, traffic: -1 })
    .lean();
  const parentOf = new Map();
  const nameOf = new Map();
  taxonomy.niches.forEach((n) => {
    nameOf.set(n.slug, n.name);
    parentOf.set(n.slug, n.slug);
    n.children.forEach((c) => { nameOf.set(c.slug, c.name); parentOf.set(c.slug, n.slug); });
  });
  return rows.map((l) => ({
    ...l,
    categories: [...new Set((l.niches || []).map((s) => parentOf.get(s)).filter(Boolean))],
    nicheNames: (l.niches || []).map((s) => nameOf.get(s)).filter(Boolean),
  }));
};

// GET /api/sheets: the categories with how many sites each has.
export const getSheets = async () => {
  try {
    const taxonomy = await getTaxonomy();
    const sites = await loadSites(taxonomy);
    const counts = new Map();
    sites.forEach((s) => s.categories.forEach((c) => counts.set(c, (counts.get(c) || 0) + 1)));
    const categories = taxonomy.niches
      .map((n) => ({ slug: n.slug, name: n.name, sites: counts.get(n.slug) || 0 }))
      .filter((c) => c.sites > 0)
      .sort((a, b) => b.sites - a.sites || a.name.localeCompare(b.name));
    return json({ total: sites.length, categories, updatedAt: new Date() });
  } catch (error) {
    return serverError(error);
  }
};

const yes = (v) => (v ? 'Yes' : 'No');
const countryName = (taxonomy, code) => taxonomy.countries.find((c) => c.code === code)?.name || (code ? code.toUpperCase() : '');

// The columns. `admin` adds the seller's name and email.
const columns = (admin) => [
  { header: 'Website', key: 'domain', width: 28 },
  { header: 'Niches', key: 'niches', width: 30 },
  { header: 'Country', key: 'country', width: 16 },
  { header: 'Language', key: 'language', width: 12 },
  { header: 'DR', key: 'dr', width: 7 },
  { header: 'DA', key: 'da', width: 7 },
  { header: 'Authority Score', key: 'as', width: 10 },
  { header: 'GP Authority', key: 'gp', width: 10 },
  { header: 'Organic traffic (Ahrefs)', key: 'traffic', width: 14 },
  { header: 'Organic traffic (Semrush)', key: 'semrush', width: 14 },
  { header: 'Keywords', key: 'keywords', width: 11 },
  { header: 'Top countries', key: 'topCountries', width: 22 },
  { header: 'Link type', key: 'linkType', width: 11 },
  { header: 'Link stays', key: 'validity', width: 12 },
  { header: 'Links per post', key: 'links', width: 9 },
  { header: 'Google News', key: 'gnews', width: 9 },
  { header: 'Marked sponsored', key: 'sponsored', width: 11 },
  { header: 'Turnaround (days)', key: 'tat', width: 11 },
  { header: 'Guest post price ($)', key: 'price', width: 12 },
  { header: 'Link insertion price ($)', key: 'li', width: 13 },
  { header: 'Verified owner', key: 'verified', width: 10 },
  { header: 'Metrics checked', key: 'checked', width: 13 },
  { header: 'Order link', key: 'order', width: 34 },
  ...(admin ? [{ header: 'Seller', key: 'seller', width: 20 }, { header: 'Seller email', key: 'sellerEmail', width: 28 }] : []),
];

const rowFor = (l, taxonomy) => ({
  domain: l.domain || l.url,
  niches: l.nicheNames.join(', '),
  country: countryName(taxonomy, l.country),
  language: LANGUAGE_NAMES[l.language] || l.language || '',
  dr: l.dr ?? '',
  da: l.da ?? '',
  as: l.authorityScore ?? '',
  gp: Number.isFinite(l.autoMetrics?.gpScore) ? l.autoMetrics.gpScore : '',
  traffic: l.traffic ?? '',
  semrush: l.semrushTraffic ?? '',
  keywords: l.keywords ?? '',
  topCountries: (l.topCountries || []).map((c) => `${String(c.code).toUpperCase()} ${c.share}%`).join(', '),
  linkType: l.linkType === 'nofollow' ? 'Nofollow' : 'Dofollow',
  validity: labelOf(LINK_VALIDITY, l.linkValidity || 'permanent'),
  links: l.linksPerPost ?? 1,
  gnews: yes(l.googleNews),
  sponsored: yes(l.markedSponsored),
  tat: l.turnaroundDays ?? '',
  price: l.price ?? '',
  li: l.linkInsertionPrice ?? '',
  verified: yes(l.isVerified),
  checked: l.metrics?.source === 'checked' && l.metrics.updatedAt ? new Date(l.metrics.updatedAt) : '',
  order: { text: `${SITE()}/sites/${l.domain}`, hyperlink: `${SITE()}/sites/${l.domain}` },
  seller: l.seller?.name || '',
  sellerEmail: l.seller?.email || '',
});

// Excel tab names: at most 31 characters, none of : \ / ? * [ ], unique.
const tabName = (name, used) => {
  const base = String(name).replace(/[:\\/?*[\]]/g, '-').slice(0, 31) || 'Sheet';
  let out = base;
  for (let i = 2; used.has(out.toLowerCase()); i += 1) out = `${base.slice(0, 27)} (${i})`;
  used.add(out.toLowerCase());
  return out;
};

const addTab = (book, name, sites, taxonomy, admin, used) => {
  const ws = book.addWorksheet(tabName(name, used), { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns(admin);
  sites.forEach((l) => ws.addRow(rowFor(l, taxonomy)));
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5A3B8C' } };
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 32;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  ['price', 'li'].forEach((k) => { ws.getColumn(k).numFmt = '#,##0.00'; });
  ['traffic', 'semrush', 'keywords'].forEach((k) => { ws.getColumn(k).numFmt = '#,##0'; });
  ws.getColumn('checked').numFmt = 'yyyy-mm-dd';
  ws.getColumn('order').font = { color: { argb: 'FF5A3B8C' }, underline: true };
  return ws;
};

const fileSlug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// GET /api/sheets/download?category=<niche slug>|all
export const downloadSheet = async (request, params, user) => {
  try {
    const limited = rateLimit('sheet-download', user.id, { limit: 30, windowMs: 10 * MINUTE });
    if (limited) return limited;
    const q = queryParams(request);
    const category = str(q.category, 'category', 'Category', { required: false, max: 80 }) || 'all';
    const admin = user.role === 'admin';
    const taxonomy = await getTaxonomy();
    const sites = await loadSites(taxonomy);

    const book = new ExcelJS.Workbook();
    book.creator = BRAND.name;
    book.created = new Date();
    const used = new Set();
    let filename;
    if (category === 'all') {
      addTab(book, 'All sites', sites, taxonomy, admin, used);
      taxonomy.niches.forEach((n) => {
        const inCat = sites.filter((s) => s.categories.includes(n.slug));
        if (inCat.length) addTab(book, n.name, inCat, taxonomy, admin, used);
      });
      filename = `${fileSlug(BRAND.name)}-all-sites-by-category.xlsx`;
    } else {
      const niche = taxonomy.niches.find((n) => n.slug === category);
      if (!niche) return json({ message: 'Category not found' }, 404);
      addTab(book, niche.name, sites.filter((s) => s.categories.includes(niche.slug)), taxonomy, admin, used);
      filename = `${fileSlug(BRAND.name)}-${niche.slug}-sites.xlsx`;
    }
    const buffer = await book.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return serverError(error);
  }
};
