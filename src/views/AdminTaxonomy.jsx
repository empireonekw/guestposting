'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, PencilLine, Eye, EyeOff, Trash2, Loader2, CheckCircle2, AlertCircle, X, Tags, Globe2, CornerDownRight,
} from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Dialog from '@/components/ui/Dialog';
import Flag from '@/components/ui/Flag';
import { Field, Input, Select } from '@/components/ui/Field';

// Admin → Niches & countries: the lists behind the menus, filters, seller
// form and the /sites/niche and /sites/country pages.

const errorOf = (err, fallback) => err.response?.data?.message || fallback;
const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
const regionName = (code) => {
  try {
    if (!/^[a-z]{2}$/i.test(code) || code.toLowerCase() === 'zz') return '';
    return new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' }).of(code.toUpperCase()) || '';
  } catch {
    return '';
  }
};

const Notice = ({ alert, onClose }) => alert && (
  <div role="status" className={`mb-5 flex items-start gap-3 rounded-xl border p-4 ${alert.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
    {alert.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />}
    <p className="flex-1 text-[13px] font-medium">{alert.message}</p>
    <button type="button" onClick={onClose} aria-label="Dismiss" className="opacity-60 hover:opacity-100"><X size={16} /></button>
  </div>
);

const SearchBox = ({ value, onChange, label }) => (
  <label className="relative sm:w-64">
    <span className="sr-only">{label}</span>
    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={label}
      className="h-9 w-full rounded-lg border border-line bg-white pl-8 pr-3 text-[13px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
    />
  </label>
);

// Hide / rename / delete buttons shared by niche and country rows.
const RowActions = ({ item, busy, onRename, onToggle, onDelete, deleteBlocked }) => (
  <div className="flex shrink-0 items-center gap-1">
    <Button size="sm" variant="ghost" onClick={onRename} disabled={busy} aria-label={`Rename ${item.name}`}><PencilLine size={14} /><span className="hidden sm:inline">Rename</span></Button>
    <Button size="sm" variant="ghost" onClick={onToggle} disabled={busy} aria-label={`${item.isActive ? 'Hide' : 'Show'} ${item.name}`}>
      {item.isActive ? <EyeOff size={14} /> : <Eye size={14} />}<span className="hidden sm:inline">{item.isActive ? 'Hide' : 'Show'}</span>
    </Button>
    <Button
      size="sm"
      variant="ghost"
      className="text-danger hover:bg-red-50 hover:text-danger"
      onClick={onDelete}
      disabled={busy || !!deleteBlocked}
      title={deleteBlocked || `Delete ${item.name}`}
      aria-label={`Delete ${item.name}`}
    >
      <Trash2 size={14} />
    </Button>
  </div>
);

const AdminTaxonomy = () => {
  const [tab, setTab] = useState('niches');
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(null);
  const [query, setQuery] = useState('');
  const [continent, setContinent] = useState('all');
  // { kind: 'niche' | 'country', item } for the rename and delete dialogs.
  const [renaming, setRenaming] = useState(null);
  const [renameText, setRenameText] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [dialogError, setDialogError] = useState('');

  const [newNiche, setNewNiche] = useState({ name: '', parent: '' });
  const [newCountry, setNewCountry] = useState({ code: '', name: '', continent: '' });
  const [addError, setAddError] = useState({});

  const notify = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert((a) => (a?.message === message ? null : a)), 6000);
  };

  const load = async () => {
    try {
      const { data: d } = await api.get('/admin/taxonomy');
      setData(d);
      setLoadError('');
    } catch (err) {
      setLoadError(errorOf(err, 'Could not load niches and countries.'));
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setQuery(''); setAddError({}); }, [tab]);

  // Top-level niches with their sub-niches, filtered by the search box. A
  // sub-niche match keeps its parent visible.
  const nicheTree = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const hit = (n) => !q || n.name.toLowerCase().includes(q) || n.slug.includes(q);
    return data.niches
      .filter((n) => !n.parent)
      .map((top) => {
        const children = data.niches.filter((c) => c.parent === top.slug);
        const shown = hit(top) ? children : children.filter(hit);
        return { ...top, children: shown, childCount: children.length, visible: hit(top) || shown.length > 0 };
      })
      .filter((n) => n.visible);
  }, [data, query]);

  const countries = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.countries.filter((c) => (continent === 'all' || c.continent === continent)
      && (!q || c.name.toLowerCase().includes(q) || c.code === q || c.slug.includes(q)));
  }, [data, query, continent]);

  const topNiches = data ? data.niches.filter((n) => !n.parent) : [];
  const continentName = (id) => data?.continents.find((c) => c.id === id)?.name || id;

  // ---- Changes ----

  const save = async (key, request, success) => {
    setBusy(key);
    try {
      const { data: res } = await request();
      notify('success', success(res));
      await load();
      return true;
    } catch (err) {
      notify('error', errorOf(err, 'That didn’t work. Please try again.'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const addNiche = async (e) => {
    e.preventDefault();
    if (newNiche.name.trim().length < 2) { setAddError({ niche: 'Write a name of at least 2 characters.' }); return; }
    setBusy('add');
    try {
      const { data: res } = await api.post('/admin/taxonomy/niches', { name: newNiche.name.trim(), parent: newNiche.parent || undefined });
      notify('success', `${res.name} added. Sellers can choose it now.`);
      setNewNiche({ name: '', parent: newNiche.parent });
      setAddError({});
      await load();
    } catch (err) {
      setAddError({ niche: errorOf(err, 'Could not add the niche.') });
    } finally {
      setBusy(null);
    }
  };

  const addCountry = async (e) => {
    e.preventDefault();
    const code = newCountry.code.trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(code)) { setAddError({ code: 'Use a 2-letter code, like "us" or "de".' }); return; }
    if (!newCountry.continent) { setAddError({ continent: 'Choose a continent.' }); return; }
    setBusy('add');
    try {
      const { data: res } = await api.post('/admin/taxonomy/countries', {
        code, name: newCountry.name.trim() || undefined, continent: newCountry.continent,
      });
      notify('success', `${res.name} added. Its page is /sites/country/${res.slug}.`);
      setNewCountry({ code: '', name: '', continent: newCountry.continent });
      setAddError({});
      await load();
    } catch (err) {
      const field = err.response?.data?.field;
      setAddError({ [field === 'continent' ? 'continent' : 'code']: errorOf(err, 'Could not add the country.') });
    } finally {
      setBusy(null);
    }
  };

  const pathOf = (kind, item) => (kind === 'niche' ? `/admin/taxonomy/niches/${item.slug}` : `/admin/taxonomy/countries/${item.code}`);

  const toggle = (kind, item) => save(
    `${kind}:${item.slug}`,
    () => api.patch(pathOf(kind, item), { isActive: !item.isActive }),
    () => (item.isActive
      ? `${item.name} is hidden from menus, filters and the seller form. Listings that use it keep it.`
      : `${item.name} is shown again.`),
  );

  const setCountryContinent = (item, value) => save(
    `country:${item.slug}`,
    () => api.patch(pathOf('country', item), { continent: value }),
    () => `${item.name} moved to ${continentName(value)}.`,
  );

  const openRename = (kind, item) => { setRenaming({ kind, item }); setRenameText(item.name); setDialogError(''); };
  const submitRename = async (e) => {
    e.preventDefault();
    const name = renameText.trim();
    if (name.length < 2) { setDialogError('Write a name of at least 2 characters.'); return; }
    if (name === renaming.item.name) { setRenaming(null); return; }
    setBusy('dialog');
    try {
      await api.patch(pathOf(renaming.kind, renaming.item), { name });
      notify('success', `Renamed to ${name}. Its page address stays the same.`);
      setRenaming(null);
      await load();
    } catch (err) {
      setDialogError(errorOf(err, 'Could not rename it.'));
    } finally {
      setBusy(null);
    }
  };

  const openDelete = (kind, item) => { setDeleting({ kind, item }); setDialogError(''); };
  const submitDelete = async () => {
    setBusy('dialog');
    try {
      const { data: res } = await api.delete(pathOf(deleting.kind, deleting.item));
      notify('success', res.message);
      setDeleting(null);
      await load();
    } catch (err) {
      setDialogError(errorOf(err, 'Could not delete it.'));
    } finally {
      setBusy(null);
    }
  };

  const nicheDeleteBlock = (n) => {
    if (n.childCount) return 'Has sub-niches: delete them first, or hide it';
    if (n.listings) return `${plural(n.listings, 'website')} use this niche: hide it instead`;
    return null;
  };
  const countryUses = (c) => c.listings + c.topCountryListings;

  // ---- Render ----

  const nicheRow = (n, isChild) => (
    <li key={n.slug} className={`flex items-center gap-3 py-2.5 pr-2 ${isChild ? 'pl-9 sm:pl-12' : 'pl-4 sm:pl-6'} ${n.isActive ? '' : 'bg-canvas/60'}`}>
      {isChild && <CornerDownRight size={14} className="-ml-5 shrink-0 text-ink-faint" />}
      <div className="min-w-0 flex-1">
        <p className={`flex flex-wrap items-center gap-1.5 text-[14px] ${isChild ? 'text-ink' : 'font-semibold text-ink'} ${n.isActive ? '' : 'opacity-60'}`}>
          {n.name}
          {!n.isActive && <Badge>Hidden</Badge>}
          {n.blocked && <Badge tone="danger" title="Our payment provider doesn't allow gambling, betting or CBD">Not allowed by payments</Badge>}
        </p>
        <p className="text-[12px] text-ink-faint">
          {n.blocked && 'Never shown to buyers or sellers · '}/sites/niche/{n.slug} · {plural(n.listings, 'website')}
          {!isChild && n.childCount > 0 && ` · ${plural(n.childCount, 'sub-niche')}`}
        </p>
      </div>
      <RowActions
        item={n}
        busy={busy === `niche:${n.slug}`}
        onRename={() => openRename('niche', n)}
        onToggle={() => toggle('niche', n)}
        onDelete={() => openDelete('niche', n)}
        deleteBlocked={nicheDeleteBlock(n)}
      />
    </li>
  );

  return (
    <div className="mx-auto max-w-5xl pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Niches &amp; countries</h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          The lists buyers browse and sellers pick from. Page addresses never change once created, so links and listings keep working.
          Hide anything you don’t want shown; delete only works for items no website uses.
        </p>
      </div>

      <Notice alert={alert} onClose={() => setAlert(null)} />

      <div className="mb-4 flex gap-1" role="tablist">
        {[
          { key: 'niches', label: 'Niches', icon: Tags, count: data?.niches.length },
          { key: 'countries', label: 'Countries', icon: Globe2, count: data?.countries.length },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[14px] font-medium transition-colors ${active ? 'bg-white text-brand-800 shadow-[var(--shadow-card)]' : 'text-ink-soft hover:bg-white/60 hover:text-ink'}`}
            >
              <Icon size={16} /> {t.label}
              {t.count !== undefined && <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11px] tabular-nums text-ink-soft">{t.count}</span>}
            </button>
          );
        })}
      </div>

      {loadError && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-800">{loadError}</p>}
      {!data && !loadError && <div className="p-16 text-center"><Loader2 size={24} className="mx-auto animate-spin text-brand-500" /></div>}

      {data && tab === 'niches' && (
        <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
          <form onSubmit={addNiche} className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_220px_auto] sm:items-end sm:px-6">
            <Field label="New niche" htmlFor="niche-name" error={addError.niche}>
              <Input id="niche-name" value={newNiche.name} maxLength={80} onChange={(e) => setNewNiche((v) => ({ ...v, name: e.target.value }))} placeholder="e.g. Home Insurance" error={addError.niche} />
            </Field>
            <Field label="Where" htmlFor="niche-parent">
              <Select id="niche-parent" value={newNiche.parent} onChange={(e) => setNewNiche((v) => ({ ...v, parent: e.target.value }))}>
                <option value="">Main niche</option>
                {topNiches.map((n) => <option key={n.slug} value={n.slug}>Under {n.name}</option>)}
              </Select>
            </Field>
            <Button type="submit" loading={busy === 'add'}><Plus size={16} /> Add niche</Button>
          </form>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
            <p className="text-[13px] text-ink-soft">{plural(topNiches.length, 'main niche')}, {plural(data.niches.length - topNiches.length, 'sub-niche')}</p>
            <SearchBox value={query} onChange={setQuery} label="Search niches" />
          </div>
          {nicheTree.length === 0 ? (
            <p className="p-12 text-center text-[14px] text-ink-faint">No niches match “{query}”.</p>
          ) : (
            <ul className="divide-y divide-line">
              {nicheTree.map((n) => (
                <li key={n.slug}>
                  <ul className="divide-y divide-line-soft">
                    {nicheRow(n, false)}
                    {n.children.map((c) => nicheRow({ ...c, childCount: 0 }, true))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {data && tab === 'countries' && (
        <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]">
          <form onSubmit={addCountry} className="grid gap-3 border-b border-line p-4 sm:grid-cols-[110px_1fr_200px_auto] sm:items-end sm:px-6">
            <Field label="Code" htmlFor="country-code" error={addError.code}>
              <Input
                id="country-code"
                value={newCountry.code}
                maxLength={2}
                onChange={(e) => setNewCountry((v) => ({ ...v, code: e.target.value.toLowerCase() }))}
                placeholder="nz"
                error={addError.code}
                className="uppercase"
              />
            </Field>
            <Field label="Name" htmlFor="country-name" hint={newCountry.code.length === 2 && !newCountry.name ? regionName(newCountry.code) && `Leave empty for “${regionName(newCountry.code)}”` : undefined}>
              <Input id="country-name" value={newCountry.name} maxLength={80} onChange={(e) => setNewCountry((v) => ({ ...v, name: e.target.value }))} placeholder={regionName(newCountry.code) || 'Country name'} />
            </Field>
            <Field label="Continent" htmlFor="country-continent" error={addError.continent}>
              <Select id="country-continent" value={newCountry.continent} error={addError.continent} onChange={(e) => setNewCountry((v) => ({ ...v, continent: e.target.value }))}>
                <option value="">Choose…</option>
                {data.continents.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Button type="submit" loading={busy === 'add'}><Plus size={16} /> Add country</Button>
          </form>
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:px-6">
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
              {[{ id: 'all', name: 'All' }, ...data.continents].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setContinent(c.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium ${continent === c.id ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-line-soft'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="sm:ml-auto"><SearchBox value={query} onChange={setQuery} label="Search countries" /></div>
          </div>
          {countries.length === 0 ? (
            <p className="p-12 text-center text-[14px] text-ink-faint">No countries here.</p>
          ) : (
            <ul className="divide-y divide-line">
              {countries.map((c) => {
                const uses = countryUses(c);
                const rowBusy = busy === `country:${c.slug}`;
                return (
                  <li key={c.code} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 sm:flex-nowrap sm:px-6 ${c.isActive ? '' : 'bg-canvas/60'}`}>
                    <Flag code={c.code} name={c.name} className="shrink-0 rounded-[3px] text-[20px]" />
                    <div className={`min-w-0 flex-1 ${c.isActive ? '' : 'opacity-60'}`}>
                      <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold text-ink">
                        {c.name} <span className="text-[12px] font-normal uppercase text-ink-faint">{c.code}</span>
                        {!c.isActive && <Badge>Hidden</Badge>}
                      </p>
                      <p className="text-[12px] text-ink-faint">
                        /sites/country/{c.slug} · {plural(c.listings, 'website')} based here
                        {c.topCountryListings > 0 && ` · in ${plural(c.topCountryListings, 'site')}’ top traffic`}
                      </p>
                    </div>
                    <label className="w-40 shrink-0">
                      <span className="sr-only">Continent for {c.name}</span>
                      <Select value={c.continent} disabled={rowBusy} onChange={(e) => setCountryContinent(c, e.target.value)} className="h-8 text-[13px]">
                        {data.continents.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </Select>
                    </label>
                    <RowActions
                      item={c}
                      busy={rowBusy}
                      onRename={() => openRename('country', c)}
                      onToggle={() => toggle('country', c)}
                      onDelete={() => openDelete('country', c)}
                      deleteBlocked={uses ? `${plural(uses, 'website')} use this country: hide it instead` : null}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <Dialog open={!!renaming} onClose={() => busy !== 'dialog' && setRenaming(null)} title={renaming ? `Rename ${renaming.item.name}` : ''}>
        {renaming && (
          <form onSubmit={submitRename} className="space-y-4">
            <Field
              label="New name"
              htmlFor="rename"
              error={dialogError}
              hint={`The page address stays /sites/${renaming.kind}/${renaming.item.slug}.`}
            >
              <Input id="rename" autoFocus value={renameText} maxLength={80} onChange={(e) => { setRenameText(e.target.value); setDialogError(''); }} error={dialogError} />
            </Field>
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button variant="secondary" onClick={() => setRenaming(null)} disabled={busy === 'dialog'}>Cancel</Button>
              <Button type="submit" loading={busy === 'dialog'}>Save</Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={!!deleting}
        onClose={() => busy !== 'dialog' && setDeleting(null)}
        title={deleting ? `Delete ${deleting.item.name}?` : ''}
        size="sm"
        footer={deleting && (
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={busy === 'dialog'}>Cancel</Button>
            <Button variant="danger" onClick={submitDelete} loading={busy === 'dialog'}>Delete</Button>
          </>
        )}
      >
        {deleting && (
          <div className="space-y-2 text-[14px] text-ink-soft">
            <p>No website uses it, so nothing else changes. Its page /sites/{deleting.kind}/{deleting.item.slug} will stop working.</p>
            <p>This can’t be undone, but you can add it again later.</p>
            {dialogError && <p className="text-[13px] font-medium text-danger">{dialogError}</p>}
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default AdminTaxonomy;
