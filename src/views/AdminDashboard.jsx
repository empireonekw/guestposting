'use client';

import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { 
  Users, Layers, DollarSign, ShoppingCart, 
  CheckCircle, Star, ShieldCheck, CheckCircle2, AlertCircle, X, Loader2, Search, Ban
} from 'lucide-react';
import Pagination from '@/components/Pagination';

const TABS = [
  { key: 'pending', label: 'Pending Review' },
  { key: 'approved', label: 'Live Inventory' },
  { key: 'rejected', label: 'Rejected' },
];

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [listings, setListings] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [paging, setPaging] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  // Reject form: which listing it is open for, the reason typed, and sending state.
  const [rejecting, setRejecting] = useState({ id: null, reason: '', sending: false });
  
  // Custom Alert State
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });

  const showNotification = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: '', message: '' }), 5000);
  };

  const fetchStats = async () => {
    try {
      const { data: stats } = await api.get('/admin/stats');
      setData(stats);
    } catch (err) {
      showNotification('error', "Failed to fetch admin data.");
    } finally {
      setLoading(false);
    }
  };

  // The tab, page and search the admin is looking at right now. Fetches read
  // this instead of their own (possibly old) copy, and only the newest
  // request may update the list, so a slow response can't show the wrong tab.
  const queryRef = useRef({ activeTab, page, search });
  const requestSeq = useRef(0);
  useEffect(() => { queryRef.current = { activeTab, page, search }; }, [activeTab, page, search]);

  const fetchListings = async () => {
    const seq = ++requestSeq.current;
    const current = queryRef.current;
    setListLoading(true);
    try {
      const params = new URLSearchParams({ status: current.activeTab, page: String(current.page) });
      if (current.search.trim()) params.append('search', current.search.trim());
      const { data: res } = await api.get(`/listings/admin?${params.toString()}`);
      if (seq !== requestSeq.current) return;
      setListings(res.listings);
      setCounts(res.counts);
      setPaging({ page: res.page, pages: res.pages, total: res.total, limit: res.limit });
    } catch (err) {
      if (seq === requestSeq.current) showNotification('error', err.response?.data?.message || "Failed to fetch listings.");
    } finally {
      if (seq === requestSeq.current) setListLoading(false);
    }
  };

  const fetchAdminData = () => Promise.all([fetchStats(), fetchListings()]);

  useEffect(() => { fetchStats(); }, []);

  useEffect(() => {
    const t = setTimeout(fetchListings, 300);
    return () => clearTimeout(t);
  }, [activeTab, page, search]);

  // A new tab or search starts again from page 1.
  useEffect(() => { setPage(1); }, [activeTab, search]);

  // Action Handlers
  const handleApprove = async (id) => {
    try {
      await api.put(`/listings/${id}/approve`);
      showNotification('success', 'Listing approved successfully.');
      fetchAdminData();
    } catch (err) { showNotification('error', "Approval failed."); }
  };

  const handleVerify = async (id) => {
    try {
      await api.put(`/admin/listings/${id}/verify`);
      showNotification('success', 'Listing metrics verified.');
      fetchAdminData();
    } catch (err) { showNotification('error', "Verification failed."); }
  };

  const submitReject = async (e) => {
    e.preventDefault();
    if (rejecting.reason.trim().length < 5) {
      showNotification('error', 'Please write a reason of at least 5 characters. The seller will see it.');
      return;
    }
    setRejecting((r) => ({ ...r, sending: true }));
    try {
      await api.put(`/listings/${rejecting.id}/status`, { status: 'rejected', reason: rejecting.reason.trim() });
      showNotification('success', 'Listing rejected. The seller has been notified.');
      setRejecting({ id: null, reason: '', sending: false });
      fetchAdminData();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Rejection failed.');
      setRejecting((r) => ({ ...r, sending: false }));
    }
  };

  const handleToggleFeature = async (id) => {
    try {
      await api.put(`/admin/listings/${id}/feature`);
      showNotification('success', 'Feature status updated.');
      fetchAdminData();
    } catch (err) { showNotification('error', "Action failed."); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 space-y-4">
      <Loader2 size={32} className="animate-spin text-blue-500" />
      <p className="text-[13px] font-medium">Loading listings…</p>
    </div>
  );

  if (!data) return (
    <div className="max-w-7xl mx-auto p-10 text-center text-slate-500 text-[14px]">Could not load the admin dashboard. Please refresh the page.</div>
  );


  return (
    <div className="max-w-7xl mx-auto pb-20">
      
      {/* Custom Inline Alert */}
      {alert.show && (
        <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border shadow-sm ${
          alert.type === 'success' 
          ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800' 
          : 'bg-red-50/50 border-red-200 text-red-800'
        } animate-fade-in`} style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {alert.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" /> : <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />}
          <div className="flex-1">
            <p className="text-[13px] font-medium leading-snug">{alert.message}</p>
          </div>
          <button onClick={() => setAlert({ show: false, type: '', message: '' })} className="opacity-50 hover:opacity-100 transition-opacity">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Listings</h1>
        <p className="text-[14px] text-slate-500 mt-1">Approve new websites, reject them with a reason, and manage live inventory.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Listing Management Center */}
        <div className="xl:col-span-12 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[600px] overflow-hidden">
          
          {/* Tabs Header */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {TABS.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 flex items-center gap-2 ${
                      active ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${active ? 'bg-white shadow-sm text-slate-700' : 'bg-slate-100 text-slate-500'}`}>
                      {counts[tab.key] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
            <label className="relative lg:ml-auto lg:w-64">
              <span className="sr-only">Search listings by URL</span>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by URL..."
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] outline-none focus:border-blue-500"
              />
            </label>
          </div>

          {/* Table Area */}
          <div className="flex-1 overflow-y-auto bg-slate-50/30">
            <table className="w-full text-left border-collapse">
              <tbody className="divide-y divide-slate-100">
                {listLoading ? (
                  <tr>
                    <td className="p-16 text-center text-slate-400">
                      <Loader2 size={24} className="mx-auto animate-spin text-blue-500" />
                    </td>
                  </tr>
                ) : listings.length === 0 ? (
                  <tr>
                    <td className="p-16 text-center text-slate-400">
                      <Layers size={32} className="mx-auto mb-3 text-slate-300 opacity-50" strokeWidth={1.5} />
                      <p className="text-[14px] font-medium">No listings in this queue.</p>
                    </td>
                  </tr>
                ) : (
                  listings.map(site => (
                    <tr key={site._id} className="hover:bg-slate-50 transition-colors group bg-white">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-slate-900 text-[14px]">{site.url.replace(/^https?:\/\/(www\.)?/, '')}</p>
                          {site.isFeatured && <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded font-medium">Featured</span>}
                          {site.isVerified && <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded font-medium">Verified</span>}
                        </div>
                        <p className="text-[12px] font-medium text-slate-500 capitalize">
                          {site.category} • DA {site.da} • ${site.price} • Vendor: <span className="text-slate-700">{site.seller?.name || 'Unknown'}</span>
                        </p>
                        {site.status === 'rejected' && site.rejectionReason && (
                          <p className="text-[12px] text-red-700 mt-1">Reason: {site.rejectionReason}</p>
                        )}
                        {rejecting.id === site._id && (
                          <form onSubmit={submitReject} className="mt-3 flex flex-col sm:flex-row gap-2 w-full max-w-xl">
                            <label className="flex-1 min-w-[260px]">
                              <span className="sr-only">Reason for rejecting {site.url}</span>
                              <input
                                autoFocus
                                value={rejecting.reason}
                                onChange={(e) => setRejecting((r) => ({ ...r, reason: e.target.value }))}
                                maxLength={500}
                                placeholder="Reason the seller will see, e.g. traffic numbers don't match Ahrefs"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] outline-none focus:border-red-400 focus:ring-4 focus:ring-red-500/10"
                              />
                            </label>
                            <div className="flex gap-2">
                              <button type="submit" disabled={rejecting.sending} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-[12px] font-medium disabled:opacity-50">
                                {rejecting.sending ? 'Rejecting...' : 'Confirm reject'}
                              </button>
                              <button type="button" onClick={() => setRejecting({ id: null, reason: '', sending: false })} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-[12px] font-medium">
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </td>
                      <td className="p-4 pr-6 text-right whitespace-nowrap">
                        
                        {/* PENDING ACTIONS */}
                        {(activeTab === 'pending' || activeTab === 'rejected') && (
                          <div className="flex items-center justify-end gap-2">
                            {activeTab === 'pending' && rejecting.id !== site._id && (
                              <button
                                onClick={() => setRejecting({ id: site._id, reason: '', sending: false })}
                                className="bg-white border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-[12px] font-medium transition-all flex items-center gap-1.5"
                              >
                                <Ban size={14} /> Reject
                              </button>
                            )}
                            <button 
                              onClick={() => handleApprove(site._id)} 
                              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-[12px] font-medium transition-all shadow-sm"
                            >
                              Approve
                            </button>
                          </div>
                        )}

                        {/* ACTIVE ACTIONS */}
                        {activeTab === 'approved' && (
                          <div className="flex items-center justify-end gap-2">
                            {!site.isVerified && (
                              <button 
                                onClick={() => handleVerify(site._id)} 
                                className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-1.5"
                              >
                                <ShieldCheck size={14} /> Verify Data
                              </button>
                            )}
                            <button 
                              onClick={() => handleToggleFeature(site._id)} 
                              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-1.5 ${
                                site.isFeatured 
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                                : 'bg-white border border-amber-200 text-amber-600 hover:bg-amber-50'
                              }`}
                            >
                              <Star size={14} fill={site.isFeatured ? "currentColor" : "none"} /> 
                              {site.isFeatured ? 'Unfeature' : 'Feature Site'}
                            </button>
                          </div>
                        )}

                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 border-t border-slate-100">
            <Pagination page={paging.page} pages={paging.pages} total={paging.total} limit={paging.limit} onChange={setPage} label="listings" />
          </div>
        </div>

      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default AdminDashboard;