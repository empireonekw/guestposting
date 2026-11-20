'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search, SlidersHorizontal, Download, ArrowUp, ArrowDown, ArrowUpDown, ExternalLink, BadgeCheck, Loader2, Lock,
} from 'lucide-react';
import api from '@/lib/api';
import { compact, money } from '@/lib/format';
import useSession from '@/lib/useSession';
import Popover from '@/components/ui/Popover';
import Chip from '@/components/ui/Chip';
import Flag from '@/components/ui/Flag';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import BuyButton from './BuyButton';
import { SaveButton, CartButton, CompareToggle } from '@/components/buying/ListButtons';
import CompareBar from '@/components/buying/CompareBar';
import SaveSearchButton from '@/components/buying/SaveSearchButton';
import Sparkline from '@/components/ui/Sparkline';
import { Checkbox } from '@/components/ui/Field';
import Pagination from '@/components/Pagination';
import { LINK_TYPES, LINK_VALIDITY, RESTRICTED_TOPICS } from '@/data/listingOptions';
import {
  RANGE_FILTERS, YES_NO, LINKS_OPTIONS, TAT_OPTIONS, SORTS, splitList, activeChips, rangeText, FILTER_KEYS,
} from './filters';

const PAGE_SIZES = [25, 50, 100];

// ---------- filter panels ----------

const RangePanel = ({ f, params, onApply, close }) => {
  const [lo, setLo] = useState(params[`min${f.key}`] || '');
  const [hi, setHi] = useState(params[`max${f.key}`] || '');
  const apply = (min, max) => {
    onApply({ [`min${f.key}`]: min, [`max${f.key}`]: max });
    close();
  };
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-ink-faint">{f.hint}</p>
      {(f.presets || f.maxPresets) && (
        <div className="flex flex-wrap gap-1.5">
          {f.presets?.map((p) => (
            <button key={p} type="button" onClick={() => apply(String(p), '')} className="rounded-full border border-line px-3 py-1 text-[13px] font-medium text-ink-soft hover:border-brand-300 hover:text-brand-700">
              {compact(p)}+
            </button>
          ))}
          {f.maxPresets?.map((p) => (
            <button key={p} type="button" onClick={() => apply('', String(p))} className="rounded-full border border-line px-3 py-1 text-[13px] font-medium text-ink-soft hover:border-brand-300 hover:text-brand-700">
              Under ${p}
            </button>
          ))}
        </div>
      )}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          apply(lo, hi);
        }}
      >
        <div className="flex items-center gap-2">
          <input type="number" min="0" inputMode="numeric" placeholder="Min" value={lo} onChange={(e) => setLo(e.target.value)} aria-label={`Minimum ${f.label}`} className="h-9 w-full rounded-lg border border-line px-2.5 text-sm outline-none focus:border-brand-500" />
          <span className="text-ink-faint">–</span>
          <input type="number" min="0" inputMode="numeric" placeholder="Max" value={hi} onChange={(e) => setHi(e.target.value)} aria-label={`Maximum ${f.label}`} className="h-9 w-full rounded-lg border border-line px-2.5 text-sm outline-none focus:border-brand-500" />
        </div>
        <div className="flex justify-between">
          <Button size="sm" variant="ghost" onClick={() => apply('', '')}>Clear</Button>
          <Button size="sm" type="submit">Apply</Button>
        </div>
      </form>
    </div>
  );
};

// Checkbox list with a search box (niches, countries, languages).
const MultiPanel = ({ items, selected, onToggle, placeholder, onClear }) => {
  const [text, setText] = useState('');
  const shown = useMemo(() => {
    const t = text.trim().toLowerCase();
    return t ? items.filter((i) => i.label.toLowerCase().includes(t)) : items;
  }, [items, text]);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-9 w-full rounded-lg border border-line pl-8 pr-2.5 text-sm outline-none focus:border-brand-500" />
      </div>
      <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
        {shown.length === 0 && <p className="px-1 py-2 text-[13px] text-ink-faint">No matches.</p>}
        {shown.map((i) => (
          <label key={i.value} className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-line-soft ${i.indent ? 'pl-6 text-ink-soft' : 'text-ink'}`}>
            <input type="checkbox" className="h-3.5 w-3.5 accent-brand-600" checked={selected.includes(i.value)} onChange={() => onToggle(i.value)} />
            {i.flag && <Flag code={i.flag} name={i.label} />}
            <span className="truncate">{i.label}</span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="border-t border-line pt-2">
          <Button size="sm" variant="ghost" onClick={onClear}>Clear {selected.length} selected</Button>
        </div>
      )}
    </div>
  );
};

const ChoicePanel = ({ options, value, onPick }) => (
  <div className="space-y-0.5">
    {options.map((o) => (
      <label key={o.value || 'any'} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] text-ink hover:bg-line-soft">
        <input type="radio" className="accent-brand-600" checked={(value || '') === o.value} onChange={() => onPick(o.value)} />
        {o.label}
      </label>
    ))}
  </div>
);

// ---------- table pieces ----------

const SortHeader = ({ label, sub, sortKey, sort, onSort, className = '' }) => {
  const active = sort?.startsWith(`${sortKey}_`);
  const Icon = !active ? ArrowUpDown : sort.endsWith('_asc') ? ArrowUp : ArrowDown;
  return (
    <th scope="col" className={`px-3 py-3 text-right ${className}`} aria-sort={active ? (sort.endsWith('_asc') ? 'ascending' : 'descending') : undefined}>
      <button type="button" onClick={() => onSort(sortKey)} aria-label={`Sort by ${sub ? `${sub} ` : ''}${label}`} className={`ml-auto inline-flex items-center gap-1 text-[12px] font-semibold ${active ? 'text-brand-700' : 'text-ink-soft hover:text-ink'}`}>
        <span className="text-right leading-tight">
          {sub && <span className="block text-[10px] font-medium uppercase tracking-wide text-ink-faint">{sub}</span>}
          {label}
        </span>
        <Icon size={12} />
      </button>
    </th>
  );
};

const NicheList = ({ slugs, niches, max = 3 }) => {
  const names = (slugs || []).map((s) => niches.get(s)?.name || s);
  if (!names.length) return <span className="text-ink-faint">–</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {names.slice(0, max).map((n) => <Badge key={n}>{n}</Badge>)}
      {names.length > max && <Badge title={names.slice(max).join(', ')}>+{names.length - max}</Badge>}
    </div>
  );
};

const TopCountries = ({ list, countries }) => {
  if (!list?.length) return <span className="text-ink-faint">–</span>;
  return (
    <div className="space-y-1">
      {list.map((c) => (
        <div key={c.code} className="flex items-center justify-end gap-1.5 text-[12px] tabular-nums text-ink-soft">
          <Flag code={c.code} name={countries.find((x) => x.code === c.code)?.name} />
          {c.share < 0.1 ? '<0.1' : Number(c.share).toFixed(1)}%
        </div>
      ))}
    </div>
  );
};

const history = (listing, key) => (listing.trafficHistory || []).map((p) => p[key]);

// ---------- main ----------

const SitesExplorer = ({ data, params, fixed = {}, taxonomy, basePath, error }) => {
  const router = useRouter();
  const { user } = useSession();
  const [pending, startTransition] = useTransition();
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState(params.q || '');
  const [exporting, setExporting] = useState(false);

  useEffect(() => setSearch(params.q || ''), [params.q]);

  const niches = useMemo(() => {
    const map = new Map();
    taxonomy.niches.forEach((n) => {
      map.set(n.slug, n);
      n.children.forEach((c) => map.set(c.slug, c));
    });
    return map;
  }, [taxonomy.niches]);

  const nicheItems = useMemo(
    () => taxonomy.niches.flatMap((n) => [
      { value: n.slug, label: n.name },
      ...n.children.map((c) => ({ value: c.slug, label: c.name, indent: true })),
    ]),
    [taxonomy.niches],
  );
  const countryItems = useMemo(
    () => [...taxonomy.countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.code, label: c.name, flag: c.code })),
    [taxonomy.countries],
  );
  const languageItems = useMemo(() => taxonomy.languages.map((l) => ({ value: l.code, label: l.name })), [taxonomy.languages]);

  const locked = new Set(Object.keys(fixed));
  const isLocked = (...keys) => keys.some((k) => locked.has(k));

  // Every change rewrites the page address, so searches can be shared and
  // bookmarked, and the server renders the new results.
  const update = (changes, { keepPage = false } = {}) => {
    const next = { ...params, ...changes };
    if (!keepPage) delete next.page;
    Object.keys(next).forEach((k) => {
      if (next[k] === '' || next[k] === undefined || next[k] === null || locked.has(k)) delete next[k];
    });
    const qs = new URLSearchParams(next).toString();
    startTransition(() => {
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    });
  };

  const toggleIn = (key, value) => {
    const current = splitList(params[key]);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update({ [key]: next.join(',') });
  };

  const onSort = (key) => {
    const desc = `${key}_desc`;
    update({ sort: params.sort === desc ? `${key}_asc` : desc }, { keepPage: false });
  };

  const changePage = (page) => {
    update({ page: page > 1 ? String(page) : '' }, { keepPage: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToLogin = () => {
    const here = `${window.location.pathname}${window.location.search}`;
    router.push(`/login?next=${encodeURIComponent(here)}`);
  };

  const exportCsv = async () => {
    if (!user) return goToLogin();
    setExporting(true);
    try {
      const q = { ...params, ...fixed };
      delete q.page;
      delete q.limit;
      const res = await api.get(`/listings/export?${new URLSearchParams(q).toString()}`, { responseType: 'blob' });
      const href = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = href;
      a.download = 'guestposting-publishers.csv';
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      window.alert('The export failed. Please try again.');
    } finally {
      setExporting(false);
    }
    return undefined;
  };

  const chips = activeChips(params, { niches, countries: taxonomy.countries, languages: taxonomy.languages });
  const fixedChips = activeChips(fixed, { niches, countries: taxonomy.countries, languages: taxonomy.languages });
  const removeChip = (chip) => {
    if (chip.list) {
      update({ [chip.list]: splitList(params[chip.list]).filter((v) => v !== chip.value).join(',') });
    } else {
      update(Object.fromEntries(chip.keys.map((k) => [k, ''])));
    }
  };
  const clearAll = () => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])));

  // What "Save search" keeps: the page's own filters, the chosen ones and the sort.
  const savedFilters = { ...params, ...fixed };
  delete savedFilters.page;
  delete savedFilters.limit;
  const searchName = [...fixedChips, ...chips].map((c) => c.label).join(', ') || 'All publishers';

  const topicsActive = RESTRICTED_TOPICS.some((t) => params[t.key] === 'yes');
  const moreActive = ['sitewide', 'foreign', 'linkInsertion', 'maxTat'].some((k) => params[k]);
  const activeCount = chips.length;
  const { listings, total, page, pages, limit } = data;

  const rangeLabel = (f) => {
    const lo = params[`min${f.key}`];
    const hi = params[`max${f.key}`];
    return lo || hi ? rangeText(f, lo, hi) : f.label;
  };

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-3 flex items-center gap-2 md:hidden">
        <Button variant="secondary" size="sm" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
          <SlidersHorizontal size={14} /> Filters{activeCount ? ` (${activeCount})` : ''}
        </Button>
      </div>
      <div className={`${showFilters ? 'flex' : 'hidden'} flex-wrap gap-2 md:flex`}>
        {RANGE_FILTERS.slice(0, 3).map((f) => (
          <Popover key={f.key} label={rangeLabel(f)} active={!!(params[`min${f.key}`] || params[`max${f.key}`])} disabled={isLocked(`min${f.key}`, `max${f.key}`)}>
            {(close) => <RangePanel f={f} params={params} onApply={update} close={close} />}
          </Popover>
        ))}
        <Popover label={`Niche${splitList(params.niche).length ? ` (${splitList(params.niche).length})` : ''}`} active={!!params.niche} disabled={isLocked('niche')}>
          <MultiPanel items={nicheItems} selected={splitList(params.niche)} onToggle={(v) => toggleIn('niche', v)} onClear={() => update({ niche: '' })} placeholder="Search niches" />
        </Popover>
        <Popover label={`Country${splitList(params.country).length ? ` (${splitList(params.country).length})` : ''}`} active={!!params.country} disabled={isLocked('country')}>
          <MultiPanel items={countryItems} selected={splitList(params.country)} onToggle={(v) => toggleIn('country', v)} onClear={() => update({ country: '' })} placeholder="Search countries" />
        </Popover>
        <Popover label={`Language${splitList(params.lang).length ? ` (${splitList(params.lang).length})` : ''}`} active={!!params.lang} disabled={isLocked('lang')}>
          <MultiPanel items={languageItems} selected={splitList(params.lang)} onToggle={(v) => toggleIn('lang', v)} onClear={() => update({ lang: '' })} placeholder="Search languages" />
        </Popover>
        {RANGE_FILTERS.slice(3).map((f) => (
          <Popover key={f.key} label={rangeLabel(f)} active={!!(params[`min${f.key}`] || params[`max${f.key}`])} disabled={isLocked(`min${f.key}`, `max${f.key}`)}>
            {(close) => <RangePanel f={f} params={params} onApply={update} close={close} />}
          </Popover>
        ))}
        <Popover label="Link type" active={!!params.linkType} disabled={isLocked('linkType')} width="sm:w-52">
          {(close) => <ChoicePanel options={[{ value: '', label: 'Any' }, ...LINK_TYPES]} value={params.linkType} onPick={(v) => { update({ linkType: v }); close(); }} />}
        </Popover>
        <Popover label="Link validity" active={!!params.validity} disabled={isLocked('validity')} width="sm:w-52">
          <div className="space-y-1.5">
            {LINK_VALIDITY.map((o) => (
              <Checkbox key={o.value} label={o.label} checked={splitList(params.validity).includes(o.value)} onChange={() => toggleIn('validity', o.value)} />
            ))}
          </div>
        </Popover>
        <Popover label="Links per post" active={!!params.links} disabled={isLocked('links')} width="sm:w-52">
          {(close) => <ChoicePanel options={LINKS_OPTIONS} value={params.links} onPick={(v) => { update({ links: v }); close(); }} />}
        </Popover>
        <Popover label="Google News" active={!!params.gnews} disabled={isLocked('gnews')} width="sm:w-44">
          {(close) => <ChoicePanel options={YES_NO} value={params.gnews} onPick={(v) => { update({ gnews: v }); close(); }} />}
        </Popover>
        <Popover label="Marked sponsored" active={!!params.sponsored} disabled={isLocked('sponsored')} width="sm:w-44">
          {(close) => <ChoicePanel options={YES_NO} value={params.sponsored} onPick={(v) => { update({ sponsored: v }); close(); }} />}
        </Popover>
        <Popover label="Topics allowed" active={topicsActive} width="sm:w-64">
          <div className="space-y-2">
            <p className="text-[12px] text-ink-faint">Only show sites that accept:</p>
            {RESTRICTED_TOPICS.map((t) => (
              <Checkbox key={t.key} label={t.label} disabled={isLocked(t.key)} checked={params[t.key] === 'yes' || fixed[t.key] === 'yes'} onChange={(e) => update({ [t.key]: e.target.checked ? 'yes' : '' })} />
            ))}
          </div>
        </Popover>
        <Popover label="More" active={moreActive} align="right" width="sm:w-72">
          <div className="space-y-3">
            <Checkbox label="Link insertions available" description="Add a link to an existing article" disabled={isLocked('linkInsertion')} checked={params.linkInsertion === 'yes' || fixed.linkInsertion === 'yes'} onChange={(e) => update({ linkInsertion: e.target.checked ? 'yes' : '' })} />
            <Checkbox label="Sidebar / footer / blogroll links" disabled={isLocked('sitewide')} checked={params.sitewide === 'yes' || fixed.sitewide === 'yes'} onChange={(e) => update({ sitewide: e.target.checked ? 'yes' : '' })} />
            <Checkbox label="Accepts articles in other languages" disabled={isLocked('foreign')} checked={params.foreign === 'yes'} onChange={(e) => update({ foreign: e.target.checked ? 'yes' : '' })} />
            <div>
              <p className="mb-1 text-[12px] font-semibold text-ink-soft">Turnaround</p>
              <ChoicePanel options={TAT_OPTIONS} value={params.maxTat || fixed.maxTat} onPick={(v) => update({ maxTat: v })} />
            </div>
          </div>
        </Popover>
      </div>

      {/* Active filters */}
      {(chips.length > 0 || fixedChips.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {fixedChips.map((c) => (
            <Chip key={`fixed-${c.id}`} className="border-line bg-line-soft text-ink-soft">
              <Lock size={11} />
              {c.flag && <Flag code={c.flag} name={c.label} />}
              {c.label}
            </Chip>
          ))}
          {chips.map((c) => (
            <Chip key={c.id} onRemove={() => removeChip(c)}>
              {c.flag && <Flag code={c.flag} name={c.label} />}
              {c.label}
            </Chip>
          ))}
          {chips.length > 0 && (
            <button type="button" onClick={clearAll} className="px-1 text-[13px] font-medium text-ink-soft underline-offset-2 hover:text-danger hover:underline">
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Results toolbar */}
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <p className="shrink-0 text-[15px] font-semibold text-ink" aria-live="polite">
          {total === 0 ? 'No results' : `Showing ${((page - 1) * limit + 1).toLocaleString()}–${Math.min(page * limit, total).toLocaleString()} of ${total.toLocaleString()} results`}
          {pending && <Loader2 size={14} className="ml-2 inline animate-spin text-brand-600" />}
        </p>
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: search.trim() });
          }}
        >
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => { if (search.trim() !== (params.q || '')) update({ q: search.trim() }); }}
            placeholder="Search by website or niche"
            aria-label="Search by website or niche"
            className="h-10 w-full rounded-[var(--radius-control)] border border-line pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
          />
        </form>
        <div className="flex gap-2">
          <select
            value={String(limit)}
            onChange={(e) => update({ limit: e.target.value === '25' ? '' : e.target.value })}
            aria-label="Results per page"
            className="h-10 rounded-[var(--radius-control)] border border-line bg-white px-2.5 text-sm text-ink outline-none focus:border-brand-500"
          >
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
          <select
            value={params.sort || ''}
            onChange={(e) => update({ sort: e.target.value })}
            aria-label="Sort by"
            className="h-10 min-w-0 flex-1 rounded-[var(--radius-control)] border border-line bg-white px-2.5 text-sm text-ink outline-none focus:border-brand-500 lg:flex-none"
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <SaveSearchButton filters={savedFilters} defaultName={searchName} />
          <Button variant="secondary" onClick={exportCsv} loading={exporting} title={user ? 'Download these results as CSV' : 'Sign in to export'}>
            {!exporting && <Download size={16} />}
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      {/* Results */}
      <div className={`mt-4 transition-opacity ${pending ? 'opacity-60' : ''}`}>
        {listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <p className="text-base font-semibold text-ink">No publishers match these filters.</p>
            <p className="mt-1 text-sm text-ink-soft">Try removing a filter or widening a range.</p>
            {chips.length > 0 && <Button variant="secondary" className="mt-4" onClick={clearAll}>Clear all filters</Button>}
          </div>
        ) : (
          <>
            {/* Required next to DR data by Ahrefs' Domain Rating licence. */}
            <p className="mb-1.5 hidden text-right text-[11px] text-ink-faint md:block">
              DR: Domain Rating by <a href="https://ahrefs.com/" target="_blank" rel="noopener noreferrer" className="underline">Ahrefs</a>
            </p>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
              <table className="w-full min-w-[1160px] border-collapse text-sm">
                <thead className="border-b-2 border-brand-600 bg-canvas">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-[12px] font-semibold text-ink-soft">Website</th>
                    <SortHeader label="AS" sub="Semrush" sortKey="as" sort={params.sort} onSort={onSort} />
                    <SortHeader label="DA" sub="Moz" sortKey="da" sort={params.sort} onSort={onSort} />
                    <SortHeader label="DR" sub="Ahrefs" sortKey="dr" sort={params.sort} onSort={onSort} />
                    <th scope="col" className="px-3 py-3 text-left text-[12px] font-semibold text-ink-soft">Niche</th>
                    <th scope="col" className="px-3 py-3 text-left text-[12px] font-semibold text-ink-soft">Language</th>
                    <SortHeader label="Traffic" sub="Ahrefs" sortKey="traffic" sort={params.sort} onSort={onSort} />
                    <SortHeader label="Keywords" sub="Ahrefs" sortKey="keywords" sort={params.sort} onSort={onSort} />
                    <th scope="col" className="px-3 py-3 text-right text-[12px] font-semibold text-ink-soft">Top countries</th>
                    <SortHeader label="Traffic" sub="Semrush" sortKey="semrush" sort={params.sort} onSort={onSort} />
                    <SortHeader label="Price" sortKey="price" sort={params.sort} onSort={onSort} />
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Order</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {listings.map((l) => (
                    <tr key={l._id} className={`align-middle hover:bg-canvas ${l.isFeatured ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/sites/${l.domain}`} className="font-semibold text-ink hover:text-brand-700">
                            {l.domain || l.url}
                          </Link>
                          <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Open ${l.domain} in a new tab`} className="text-ink-faint hover:text-brand-700">
                            <ExternalLink size={12} />
                          </a>
                          {l.isVerified && <BadgeCheck size={15} className="text-brand-600" aria-label="Verified" />}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {l.isFeatured && <Badge tone="warning">Featured</Badge>}
                          {l.googleNews && <Badge tone="brand">Google News</Badge>}
                          {l.linkType === 'nofollow' && <Badge>Nofollow</Badge>}
                          {l.markedSponsored && <Badge>Sponsored tag</Badge>}
                        </div>
                        <CompareToggle listing={l} className="mt-1.5" />
                      </td>
                      <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{l.authorityScore || '–'}</td>
                      <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{l.da || '–'}</td>
                      <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{l.dr || '–'}</td>
                      <td className="max-w-52 px-3 py-3.5"><NicheList slugs={l.niches} niches={niches} /></td>
                      <td className="px-3 py-3.5 text-ink-soft">{taxonomy.languages.find((x) => x.code === l.language)?.name || '–'}</td>
                      <td className="px-3 py-3.5 text-right">
                        <Sparkline values={history(l, 'ahrefs')} className="ml-auto" />
                        <span className="font-semibold tabular-nums">{compact(l.traffic)}</span>
                      </td>
                      <td className="px-3 py-3.5 text-right font-semibold tabular-nums">{compact(l.keywords)}</td>
                      <td className="px-3 py-3.5"><TopCountries list={l.topCountries} countries={taxonomy.countries} /></td>
                      <td className="px-3 py-3.5 text-right">
                        <Sparkline values={history(l, 'semrush')} className="ml-auto" />
                        <span className="font-semibold tabular-nums">{compact(l.semrushTraffic)}</span>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <span className="font-bold tabular-nums text-ink">{money(l.price)}</span>
                        {l.linkInsertionPrice > 0 && <span className="block text-[11px] text-ink-faint">Insertion {money(l.linkInsertionPrice)}</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <SaveButton listing={l} />
                          <CartButton listing={l} />
                          <BuyButton listing={l} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone cards */}
            <p className="mb-2 text-[11px] text-ink-faint md:hidden">
              DR: Domain Rating by <a href="https://ahrefs.com/" target="_blank" rel="noopener noreferrer" className="underline">Ahrefs</a>
            </p>
            <ul className="space-y-3 md:hidden">
              {listings.map((l) => (
                <li key={l._id} className="rounded-xl border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/sites/${l.domain}`} className="flex items-center gap-1.5 font-semibold text-ink">
                        <span className="truncate">{l.domain || l.url}</span>
                        {l.isVerified && <BadgeCheck size={15} className="shrink-0 text-brand-600" aria-label="Verified" />}
                      </Link>
                      <div className="mt-1.5"><NicheList slugs={l.niches} niches={niches} max={2} /></div>
                      <CompareToggle listing={l} className="mt-2" />
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold tabular-nums text-ink">{money(l.price)}</p>
                      {l.linkInsertionPrice > 0 && <p className="text-[11px] text-ink-faint">Insertion {money(l.linkInsertionPrice)}</p>}
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-4 gap-2 rounded-lg bg-canvas p-2.5 text-center">
                    {[['DR', l.dr], ['DA', l.da], ['AS', l.authorityScore], ['Traffic', compact(l.traffic)]].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[10px] font-semibold uppercase text-ink-faint">{k}</dt>
                        <dd className="text-sm font-semibold tabular-nums text-ink">{v || '–'}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[12px] text-ink-soft">
                      {(l.topCountries || []).slice(0, 3).map((c) => (
                        <span key={c.code} className="inline-flex items-center gap-1">
                          <Flag code={c.code} name={taxonomy.countries.find((x) => x.code === c.code)?.name} /> {Number(c.share).toFixed(0)}%
                        </span>
                      ))}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <SaveButton listing={l} />
                      <CartButton listing={l} />
                      <BuyButton listing={l} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination page={page} pages={pages} total={total} limit={limit} onChange={changePage} label="publishers" />
          </>
        )}
      </div>

      <CompareBar />
    </div>
  );
};

export default SitesExplorer;
