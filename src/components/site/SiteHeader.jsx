'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Star, TrendingUp, Search, Link2, Newspaper, Dices, Leaf, Bitcoin, PanelsTopLeft, Zap,
  Menu, X, ChevronDown, ChevronRight, LayoutGrid, User, LogOut, ShoppingBag, Layers, ShieldCheck,
} from 'lucide-react';
import Flag from '@/components/ui/Flag';
import Badge from '@/components/ui/Badge';
import { buttonClass } from '@/components/ui/Button';
import useSession from '@/lib/useSession';
import { SITE_LISTS } from '@/data/siteLists';

const LIST_ICONS = {
  star: Star, trending: TrendingUp, search: Search, link: Link2, newspaper: Newspaper,
  dice: Dices, leaf: Leaf, bitcoin: Bitcoin, layout: PanelsTopLeft, zap: Zap,
};

const MENUS = [
  { id: 'sites', label: 'Sites' },
  { id: 'niches', label: 'Niches' },
  { id: 'countries', label: 'Countries' },
  { id: 'services', label: 'Services' },
  { id: 'packages', label: 'Packages' },
  { id: 'tools', label: 'Tools' },
];

// Static menus. Items without href are planned features, shown as "Soon".
const SERVICES = [
  {
    title: 'Link building',
    items: [
      { label: 'Guest posts', href: '/sites', note: 'Articles on real publisher sites' },
      { label: 'Link insertions (niche edits)', href: '/sites/link-insertion', note: 'Your link in an existing article' },
      { label: 'Crypto guest posts', href: '/sites/crypto' },
      { label: 'Casino & gambling posts', href: '/sites/casino' },
    ],
  },
  {
    title: 'PR & local SEO',
    items: [
      { label: 'Press release distribution' },
      { label: 'Local citation building' },
    ],
  },
];

const PACKAGES = [
  {
    title: 'Sites by authority',
    items: [
      { label: 'DR 50+ sites', href: '/sites?minDR=50' },
      { label: 'DR 60+ sites', href: '/sites?minDR=60' },
      { label: 'DR 70+ sites', href: '/sites?minDR=70' },
    ],
  },
  {
    title: 'Sites by budget',
    items: [
      { label: 'Under $50', href: '/sites?maxPrice=50' },
      { label: 'Under $100', href: '/sites?maxPrice=100' },
      { label: 'Under $250', href: '/sites?maxPrice=250' },
    ],
  },
  {
    title: 'Bundles',
    items: [
      { label: 'Authority link packages' },
      { label: 'Niche bundles' },
      { label: 'Press release packages' },
    ],
  },
];

const TOOLS = [
  {
    title: 'For buyers',
    items: [
      { label: 'Publisher list with filters', href: '/sites' },
      { label: 'Bulk domain checker' },
      { label: 'Saved searches & alerts' },
    ],
  },
  {
    title: 'Free SEO tools',
    items: [
      { label: 'DA / DR checker' },
      { label: 'Dofollow link checker' },
    ],
  },
];

const MenuLink = ({ item, onNavigate }) =>
  item.href ? (
    <Link href={item.href} onClick={onNavigate} className="group block rounded-lg px-2 py-1.5 -mx-2 hover:bg-line-soft">
      <span className="text-sm font-medium text-ink group-hover:text-brand-700">{item.label}</span>
      {item.note && <span className="block text-[12px] text-ink-faint">{item.note}</span>}
    </Link>
  ) : (
    <span className="flex items-center gap-2 px-0 py-1.5 text-sm text-ink-faint">
      {item.label} <Badge>Soon</Badge>
    </span>
  );

const LinkColumns = ({ groups, onNavigate }) => (
  <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
    {groups.map((g) => (
      <div key={g.title}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{g.title}</p>
        <div className="space-y-0.5">
          {g.items.map((item) => <MenuLink key={item.label} item={item} onNavigate={onNavigate} />)}
        </div>
      </div>
    ))}
  </div>
);

const SitesPanel = ({ onNavigate }) => (
  <div>
    <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
      {SITE_LISTS.map((l) => {
        const Icon = LIST_ICONS[l.icon] || Star;
        return (
          <Link key={l.slug} href={`/sites/${l.slug}`} onClick={onNavigate} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-line-soft">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon size={16} /></span>
            <span className="text-sm font-medium text-ink">{l.menuTitle}</span>
          </Link>
        );
      })}
    </div>
    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-sm font-semibold">
      <Link href="/sites" onClick={onNavigate} className="inline-flex items-center gap-1 text-brand-700 hover:underline">All publishers <ChevronRight size={14} /></Link>
      <Link href="/sites/country" onClick={onNavigate} className="inline-flex items-center gap-1 text-brand-700 hover:underline">Sites by country <ChevronRight size={14} /></Link>
      <Link href="/sites/niche" onClick={onNavigate} className="inline-flex items-center gap-1 text-brand-700 hover:underline">Sites by niche <ChevronRight size={14} /></Link>
    </div>
  </div>
);

// Top-level niches grouped A-Z.
const NichesPanel = ({ niches, onNavigate }) => {
  const groups = {};
  niches.forEach((n) => {
    const letter = n.name[0].toUpperCase();
    (groups[letter] = groups[letter] || []).push(n);
  });
  return (
    <div>
      <div className="columns-2 gap-8 md:columns-4 lg:columns-5">
        {Object.keys(groups).sort().map((letter) => (
          <div key={letter} className="mb-3 break-inside-avoid">
            <p className="mb-1 text-[12px] font-bold text-brand-600">{letter}</p>
            {groups[letter].map((n) => (
              <Link key={n.slug} href={`/sites/niche/${n.slug}`} onClick={onNavigate} className="block py-0.5 text-[13px] text-ink-soft hover:text-brand-700">
                {n.name}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <Link href="/sites/niche" onClick={onNavigate} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        All niches and sub-niches <ChevronRight size={14} />
      </Link>
    </div>
  );
};

const CountriesPanel = ({ countries, continents, onNavigate }) => {
  const withSites = continents.filter((c) => countries.some((x) => x.continent === c.id));
  const [tab, setTab] = useState(withSites[0]?.id);
  const shown = countries.filter((c) => c.continent === tab);
  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-8">
      <div role="tablist" aria-label="Continents" className="flex gap-1 overflow-x-auto md:w-44 md:flex-col md:overflow-visible">
        {withSites.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={tab === c.id}
            onClick={() => setTab(c.id)}
            onMouseEnter={() => setTab(c.id)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium ${tab === c.id ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-line-soft'}`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="flex-1">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((c) => (
            <Link key={c.code} href={`/sites/country/${c.slug}`} onClick={onNavigate} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-ink-soft hover:bg-line-soft hover:text-ink">
              <Flag code={c.code} name={c.name} />
              {c.name}
            </Link>
          ))}
        </div>
        <Link href="/sites/country" onClick={onNavigate} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          All countries <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
};

const accountLinks = (user) => {
  if (!user) return [];
  const links = [
    { label: user.role === 'seller' ? 'My sales' : 'My orders', href: '/orders', icon: ShoppingBag },
  ];
  if (user.role === 'seller' || user.role === 'admin') {
    links.push({ label: 'My websites', href: '/my-listings', icon: Layers });
  }
  links.push({ label: 'Account settings', href: '/profile', icon: User });
  if (user.role === 'admin') links.push({ label: 'Admin', href: '/admin', icon: ShieldCheck });
  return links;
};

const SiteHeader = ({ taxonomy }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useSession();
  const [open, setOpen] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeTimer = useRef(null);
  const accountRef = useRef(null);

  // Close everything after navigating.
  useEffect(() => {
    setOpen(null);
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(null);
        setAccountOpen(false);
        setMobileOpen(false);
      }
    };
    const onDown = (e) => { if (!accountRef.current?.contains(e.target)) setAccountOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const hoverOpen = (id) => {
    clearTimeout(closeTimer.current);
    setOpen(id);
  };
  const hoverClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 150);
  };
  const done = () => {
    setOpen(null);
    setMobileOpen(false);
  };

  const panel = (id) => {
    switch (id) {
      case 'sites': return <SitesPanel onNavigate={done} />;
      case 'niches': return <NichesPanel niches={taxonomy.niches} onNavigate={done} />;
      case 'countries': return <CountriesPanel countries={taxonomy.countries} continents={taxonomy.continents} onNavigate={done} />;
      case 'services': return <LinkColumns groups={SERVICES} onNavigate={done} />;
      case 'packages': return <LinkColumns groups={PACKAGES} onNavigate={done} />;
      case 'tools': return <LinkColumns groups={TOOLS} onNavigate={done} />;
      default: return null;
    }
  };

  const logout = () => {
    signOut();
    router.push('/');
  };

  return (
    // No backdrop-filter here: it would make the fixed mobile menu position
    // itself inside the header instead of the whole screen.
    <header className="sticky top-0 z-50 border-b border-line bg-white" onMouseLeave={hoverClose}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="LetRank home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">L</span>
          <span className="text-lg font-semibold tracking-tight text-ink">LetRank</span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
          {MENUS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-expanded={open === m.id}
              onMouseEnter={() => hoverOpen(m.id)}
              onClick={() => setOpen(open === m.id ? null : m.id)}
              className={`inline-flex h-16 items-center gap-1 border-b-2 px-3 text-sm font-medium transition-colors ${
                open === m.id ? 'border-brand-600 text-ink' : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              {m.label}
              <ChevronDown size={14} className={`transition-transform ${open === m.id ? 'rotate-180' : ''}`} />
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2" onMouseEnter={hoverClose}>
          {user ? (
            <div ref={accountRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((o) => !o)}
                aria-expanded={accountOpen}
                className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2.5 text-sm font-medium text-ink hover:bg-line-soft"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-[12px] font-semibold text-brand-700">
                  {user.name?.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-28 truncate sm:inline">{user.name}</span>
                <ChevronDown size={14} />
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-56 rounded-xl border border-line bg-white p-1.5 shadow-[var(--shadow-pop)]">
                  {accountLinks(user).map(({ label, href, icon: Icon }) => (
                    <Link key={href} href={href} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-soft hover:bg-line-soft hover:text-ink">
                      <Icon size={16} /> {label}
                    </Link>
                  ))}
                  <button type="button" onClick={logout} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-soft hover:bg-line-soft hover:text-ink">
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="hidden px-3 text-sm font-medium text-ink-soft hover:text-ink sm:inline">Sign in</Link>
              <Link href="/register" className={buttonClass({ size: 'sm' })}>Get started</Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink hover:bg-line-soft lg:hidden"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full hidden border-b border-line bg-white shadow-[var(--shadow-pop)] lg:block" onMouseEnter={() => hoverOpen(open)}>
          <div className="mx-auto max-h-[calc(100vh-5rem)] max-w-7xl overflow-y-auto px-6 py-6">{panel(open)}</div>
        </div>
      )}

      {/* Phone and tablet menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-line px-4">
            <span className="text-lg font-semibold text-ink">Menu</span>
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-line-soft">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2">
            <Link href="/sites" onClick={done} className="flex items-center gap-2 border-b border-line py-3.5 text-base font-semibold text-ink">
              <LayoutGrid size={18} className="text-brand-600" /> All publishers
            </Link>
            {MENUS.map((m) => (
              <div key={m.id} className="border-b border-line">
                <button
                  type="button"
                  aria-expanded={mobileSection === m.id}
                  onClick={() => setMobileSection(mobileSection === m.id ? null : m.id)}
                  className="flex w-full items-center justify-between py-3.5 text-base font-medium text-ink"
                >
                  {m.label}
                  <ChevronDown size={18} className={`text-ink-faint transition-transform ${mobileSection === m.id ? 'rotate-180' : ''}`} />
                </button>
                {mobileSection === m.id && <div className="pb-4">{panel(m.id)}</div>}
              </div>
            ))}
            {user ? (
              <div className="py-3">
                {accountLinks(user).map(({ label, href, icon: Icon }) => (
                  <Link key={href} href={href} onClick={done} className="flex items-center gap-2.5 py-2.5 text-base text-ink-soft">
                    <Icon size={18} /> {label}
                  </Link>
                ))}
                <button type="button" onClick={logout} className="flex items-center gap-2.5 py-2.5 text-base text-ink-soft">
                  <LogOut size={18} /> Sign out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 py-4">
                <Link href="/login" onClick={done} className={buttonClass({ variant: 'secondary' })}>Sign in</Link>
                <Link href="/register" onClick={done} className={buttonClass()}>Get started</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;
