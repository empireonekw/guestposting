'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import {
  LayoutGrid, History, Layers, PlusSquare, Globe, ShoppingBag, Users, Settings, LogOut, Bell,
  Info, CheckCircle2, X, ChevronDown, PanelLeftClose, PanelLeftOpen, Menu, ArrowUpRight, Plus, ClipboardCheck,
  MessageSquare, Code2, Tags,
} from 'lucide-react';
import BRAND from '@/data/brand';
import Logo from '@/components/ui/Logo';

// The sidebar for each role, grouped into sections. An item with
// `children` opens a sub-list.
const menuFor = (role) => {
  if (role === 'admin') {
    return [
      { title: 'General', items: [
        { name: 'Overview', icon: LayoutGrid, path: '/admin' },
        { name: 'Messages', icon: MessageSquare, path: '/messages', badge: 'messages' },
        { name: 'Metrics report', icon: ClipboardCheck, path: '/admin/metrics' },
      ] },
      { title: 'Catalog', items: [
        { name: 'Listings', icon: Layers, path: '/admin/listings', children: [
          { name: 'All listings', path: '/admin/listings' },
          { name: 'Add new site', path: '/add-listing' },
          { name: 'Our own sites', path: '/my-listings' },
        ] },
        { name: 'Niches & countries', icon: Tags, path: '/admin/taxonomy' },
      ] },
      { title: 'Marketplace', items: [
        { name: 'Orders', icon: ShoppingBag, path: '/orders' },
        { name: 'Find sites', icon: Globe, path: '/sites' },
      ] },
      { title: 'People', items: [
        { name: 'Users', icon: Users, path: '/admin/users', badge: 'sellers' },
        { name: 'Activity log', icon: History, path: '/admin/logs' },
      ] },
      { title: 'System', items: [
        { name: 'Code flow', icon: Code2, path: '/admin/system' },
      ] },
      { title: 'Account', items: [
        { name: 'Settings', icon: Settings, path: '/profile' },
      ] },
    ];
  }
  if (role === 'seller') {
    return [
      { title: 'Selling', items: [
        { name: 'My websites', icon: Layers, path: '/my-listings' },
        { name: 'Add website', icon: PlusSquare, path: '/add-listing' },
        { name: 'My sales', icon: ShoppingBag, path: '/orders' },
        { name: 'Messages', icon: MessageSquare, path: '/messages', badge: 'messages' },
      ] },
      { title: 'Marketplace', items: [
        { name: 'Find sites', icon: Globe, path: '/sites' },
      ] },
      { title: 'Account', items: [
        { name: 'Settings', icon: Settings, path: '/profile' },
      ] },
    ];
  }
  return [
    { title: 'Buying', items: [
      { name: 'Find sites', icon: Globe, path: '/sites' },
      { name: 'My orders', icon: ShoppingBag, path: '/orders' },
      { name: 'Messages', icon: MessageSquare, path: '/messages', badge: 'messages' },
    ] },
    { title: 'Account', items: [
      { name: 'Settings', icon: Settings, path: '/profile' },
    ] },
  ];
};

const readCollapsed = () => {
  try {
    return localStorage.getItem('sidebarCollapsed') === '1';
  } catch {
    return false;
  }
};

const Layout = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [liveToast, setLiveToast] = useState(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
  const [chatCount, setChatCount] = useState(0);
  const [waitingSellers, setWaitingSellers] = useState(0);
  const userInfo = JSON.parse(localStorage.getItem('userInfo'));
  const userId = userInfo?._id;
  const role = userInfo?.role;

  // Notifications are refreshed every few seconds while the tab is visible;
  // a newly arrived chat message pops the live toast.
  useEffect(() => {
    if (!userId) return undefined;
    let seen = null;
    let stopped = false;

    const fetchNotifs = async () => {
      if (document.hidden) return;
      try {
        const { data } = await api.get('/notifications');
        if (stopped) return;
        if (seen) {
          const fresh = data.find((n) => !seen.has(n._id) && n.type === 'message' && !n.isRead);
          if (fresh) {
            setLiveToast(fresh);
            setTimeout(() => setLiveToast(null), 5000);
          }
        }
        seen = new Set(data.map((n) => n._id));
        setNotifications((prev) => (JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
      } catch {
        // Try again on the next tick.
      }
    };

    fetchNotifs();
    const timer = setInterval(fetchNotifs, 5000);
    const onVisible = () => { if (!document.hidden) fetchNotifs(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  useEffect(() => { setMobileOpen(false); setShowNotifs(false); }, [pathname]);

  // Unread chats (and, for admins, support questions waiting for a reply).
  useEffect(() => {
    if (!userId) return undefined;
    let stopped = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const { data } = await api.get('/conversations/unread');
        if (!stopped) setChatCount((data.unread || 0) + (data.supportWaiting || 0));
        if (role === 'admin') {
          const { data: w } = await api.get('/admin/users?seller=pending&limit=1');
          if (!stopped) setWaitingSellers(w.total || 0);
        }
      } catch {
        // Try again later.
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { stopped = true; clearInterval(t); };
  }, [userId, pathname, role]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem('sidebarCollapsed', c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  };

  const handleNotifClick = async (notif) => {
    try {
      if (!notif.isRead) {
        await api.put(`/notifications/${notif._id}`);
        setNotifications((prev) => prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n)));
      }
    } catch {
      // Still open the link.
    }
    setShowNotifs(false);
    router.push(notif.link);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Ignore; the next refresh shows the real state.
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userInfo');
    router.push('/login');
  };

  const sections = menuFor(role);
  const isActive = (path) => pathname === path;
  const groupOpen = (item) => openGroups[item.name] ?? item.children?.some((c) => isActive(c.path));
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const firstName = userInfo?.name?.split(' ')[0] || 'there';
  const canAddSite = role === 'seller' || role === 'admin';
  const wide = !collapsed || mobileOpen; // labels shown

  const itemClass = (active) => `group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-all ${
    active ? 'bg-white font-semibold text-ink shadow-[var(--shadow-card)]' : 'font-medium text-ink-soft hover:bg-white/70 hover:text-ink'
  } ${wide ? '' : 'justify-center px-0'}`;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className={`flex items-center gap-2 px-4 pt-4 ${wide ? '' : 'flex-col'}`}>
        <Link href="/" aria-label={`${BRAND.name} home`} className={`flex min-w-0 items-center rounded-2xl bg-white px-3 py-3 shadow-[var(--shadow-card)] ${wide ? 'flex-1' : ''}`}>
          <Logo size="sm" compact={!wide} />
        </Link>
        <button
          type="button"
          onClick={mobileOpen ? () => setMobileOpen(false) : toggleCollapsed}
          aria-label={mobileOpen ? 'Close menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-white hover:text-ink"
        >
          {mobileOpen ? <X size={18} /> : collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav aria-label="Dashboard" className="mt-4 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        {sections.map((section) => (
          <div key={section.title}>
            {wide ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{section.title}</p>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-line" />
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                if (item.children && wide) {
                  const open = groupOpen(item);
                  return (
                    <li key={item.name}>
                      <button
                        type="button"
                        onClick={() => setOpenGroups((g) => ({ ...g, [item.name]: !open }))}
                        aria-expanded={open}
                        className={itemClass(false)}
                      >
                        <Icon size={18} className="shrink-0 text-ink-faint group-hover:text-ink-soft" />
                        <span className="flex-1 text-left">{item.name}</span>
                        <ChevronDown size={15} className={`text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      {open && (
                        <ul className="ml-[22px] mt-1 space-y-0.5 border-l border-line pl-3">
                          {item.children.map((c) => (
                            <li key={c.path}>
                              <Link
                                href={c.path}
                                className={`block rounded-lg px-3 py-2 text-[13.5px] ${isActive(c.path) ? 'bg-white font-semibold text-ink shadow-[var(--shadow-card)]' : 'text-ink-soft hover:bg-white/70 hover:text-ink'}`}
                              >
                                {c.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                }
                const active = isActive(item.path) || item.children?.some((c) => isActive(c.path));
                return (
                  <li key={item.name}>
                    <Link href={item.path} className={`${itemClass(active)} relative`} title={wide ? undefined : item.name}>
                      <Icon size={18} className={`shrink-0 ${active ? 'text-brand-600' : 'text-ink-faint group-hover:text-ink-soft'}`} />
                      {wide && <span className="flex-1">{item.name}</span>}
                      {item.badge === 'messages' && chatCount > 0 && (
                        <span className={`rounded-full bg-brand-600 px-1.5 text-[11px] font-bold leading-5 text-white ${wide ? '' : 'absolute right-1 top-1'}`} aria-label={`${chatCount} unread`}>
                          {chatCount > 99 ? '99+' : chatCount}
                        </span>
                      )}
                      {item.badge === 'sellers' && waitingSellers > 0 && (
                        <span className={`rounded-full bg-amber-500 px-1.5 text-[11px] font-bold leading-5 text-white ${wide ? '' : 'absolute right-1 top-1'}`} aria-label={`${waitingSellers} sellers waiting for approval`} title="Sellers waiting for approval">
                          {waitingSellers}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-4">
        <div className={`flex items-center gap-3 ${wide ? '' : 'flex-col'}`}>
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
            {userInfo?.name?.charAt(0).toUpperCase()}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-canvas" aria-hidden="true" />
          </span>
          {wide && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-ink">{userInfo?.name}</p>
              <p className="truncate text-[12px] text-ink-faint">{userInfo?.email || <span className="capitalize">{role}</span>}</p>
            </div>
          )}
          <button type="button" onClick={handleLogout} aria-label="Sign out" title="Sign out" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint hover:bg-white hover:text-ink">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Desktop sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-canvas transition-[width] duration-200 lg:block ${collapsed ? 'w-[84px]' : 'w-[272px]'}`}>
        {sidebar}
      </aside>

      {/* Phone / tablet sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="relative h-full w-[280px] max-w-[85vw] bg-canvas shadow-[var(--shadow-pop)]">{sidebar}</aside>
        </div>
      )}

      <div className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-[84px]' : 'lg:pl-[272px]'}`}>
        <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 bg-canvas/90 px-4 backdrop-blur sm:px-8">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-white lg:hidden">
            <Menu size={20} />
          </button>
          <p className="truncate text-[15px] text-ink-soft">
            Welcome back, <span className="font-semibold text-ink">{firstName}</span>
          </p>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifs((s) => !s)}
                aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
                aria-expanded={showNotifs}
                className="relative flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink-soft shadow-[var(--shadow-card)] hover:text-ink"
              >
                <Bell size={18} />
                {unreadCount > 0 && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white" />}
              </button>
              {showNotifs && (
                <div className="absolute right-0 mt-3 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-pop)]">
                  <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-faint">Notifications</span>
                    {unreadCount > 0 && (
                      <button type="button" onClick={handleMarkAllRead} className="text-[12px] font-semibold text-brand-700 hover:underline">Mark all read</button>
                    )}
                  </div>
                  <div className="max-h-[380px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-ink-faint">
                        <CheckCircle2 size={24} strokeWidth={1.5} className="mb-2" />
                        <p className="text-[13px]">All caught up.</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          type="button"
                          key={n._id}
                          onClick={() => handleNotifClick(n)}
                          className={`flex w-full items-start gap-3 border-b border-line-soft px-4 py-3 text-left ${!n.isRead ? 'bg-brand-50/50 hover:bg-brand-50' : 'hover:bg-canvas'}`}
                        >
                          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${!n.isRead ? 'bg-brand-600' : 'bg-transparent'}`} />
                          <span className="flex-1">
                            <span className={`block text-[13px] leading-snug ${!n.isRead ? 'font-medium text-ink' : 'text-ink-soft'}`}>{n.message}</span>
                            <span className="mt-1 block text-[11px] text-ink-faint">{new Date(n.createdAt).toLocaleString()}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <Link href="/" className="hidden h-11 items-center gap-1.5 rounded-full bg-ink px-5 text-[14px] font-semibold text-white hover:bg-brand-900 md:inline-flex">
              View live site <ArrowUpRight size={16} />
            </Link>
            {canAddSite && (
              <Link href="/add-listing" className="bg-brand-gradient inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-white shadow-lg shadow-brand-600/25 hover:brightness-110 sm:px-5">
                <Plus size={17} /> <span className="hidden sm:inline">Add site</span>
              </Link>
            )}
          </div>
        </header>

        <main className="px-4 pb-12 pt-2 sm:px-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>

      {liveToast && (
        <div className="fixed bottom-6 right-6 z-50 flex w-80 items-start gap-3 rounded-2xl bg-ink p-4 pr-12 text-white shadow-[var(--shadow-pop)]">
          <Info size={16} className="mt-0.5 shrink-0 text-brand-300" />
          <div>
            <p className="mb-0.5 text-[13px] font-semibold">New message</p>
            <p className="text-[13px] leading-snug text-mist/80">{liveToast.message}</p>
          </div>
          <button type="button" onClick={() => setLiveToast(null)} aria-label="Dismiss" className="absolute right-3 top-3 p-1 text-mist/60 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Layout;
