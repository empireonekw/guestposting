'use client';

import { useEffect, useSyncExternalStore } from 'react';
import api from '@/lib/api';

// The signed-in buyer's saved sites and cart, shared by every heart and cart
// button on the page (Module 6). Loaded once from /api/lists; changes are
// shown straight away and sent to the server.

const EMPTY = { ready: false, saved: new Set(), cart: new Set() };
let state = EMPTY;
let loading = null;
const listeners = new Set();

const emit = (next) => {
  state = next;
  listeners.forEach((l) => l());
};

const signedIn = () => {
  try {
    return !!JSON.parse(localStorage.getItem('userInfo'))?.token;
  } catch {
    return false;
  }
};

export const loadLists = (force = false) => {
  if (!signedIn()) return Promise.resolve();
  if (loading && !force) return loading;
  loading = api.get('/lists')
    .then(({ data }) => emit({ ready: true, saved: new Set(data.saved), cart: new Set(data.cart) }))
    .catch(() => { loading = null; });
  return loading;
};

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const withItem = (list, id, on) => {
  const set = new Set(state[list]);
  if (on) set.add(id);
  else set.delete(id);
  emit({ ...state, [list]: set });
};

const errorText = (err, fallback) => err.response?.data?.message || fallback;

// Adds or removes one site. Throws a readable message if the server refuses.
export const setInList = async (list, id, on) => {
  const before = state[list].has(id);
  withItem(list, id, on);
  try {
    if (on) {
      const { data } = await api.post(`/${list}`, { listingId: id });
      if (data.skipped?.length && !data.added?.includes(id)) {
        withItem(list, id, before);
        throw new Error(data.skipped[0].message);
      }
    } else {
      await api.delete(`/${list}/${id}`);
    }
  } catch (err) {
    withItem(list, id, before);
    throw new Error(err instanceof Error && !err.response ? err.message : errorText(err, 'That didn’t work. Please try again.'));
  }
};

// Adds many sites to the cart at once. Returns the server's answer.
export const addManyToCart = async (ids) => {
  const { data } = await api.post('/cart', { listingIds: ids });
  emit({ ...state, cart: new Set([...state.cart, ...data.added]) });
  return data;
};

// After a checkout or removal elsewhere, reload the true state.
export const refreshLists = () => loadLists(true);

const useBuyerLists = () => {
  const snap = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  useEffect(() => { loadLists(); }, []);
  return snap;
};

export default useBuyerLists;
