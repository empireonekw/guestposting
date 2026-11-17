'use client';

import { useSyncExternalStore } from 'react';

// The sites a visitor picked to compare side by side (up to 4). Kept in this
// browser only (it is a convenience, like an open tab), so it works signed
// out too. The /compare page itself takes the ids from its address.

import { MAX_COMPARE } from '@/data/compare';

export { MAX_COMPARE };
const KEY = 'compareSites';
const EMPTY = [];
let cache = null;
const listeners = new Set();

const read = () => {
  if (cache) return cache;
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    cache = Array.isArray(list) ? list.filter((x) => x && x.id).slice(0, MAX_COMPARE) : [];
  } catch {
    cache = [];
  }
  return cache;
};

const write = (list) => {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Private mode: it still works for this page.
  }
  listeners.forEach((l) => l());
};

const subscribe = (fn) => {
  listeners.add(fn);
  const onStorage = (e) => {
    if (e.key === KEY) {
      cache = null;
      fn();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
};

// Returns false when the list is already full.
export const toggleCompare = ({ id, domain }) => {
  const list = read();
  if (list.some((x) => x.id === id)) {
    write(list.filter((x) => x.id !== id));
    return true;
  }
  if (list.length >= MAX_COMPARE) return false;
  write([...list, { id, domain }]);
  return true;
};

// Replaces the list (the /compare page keeps it in step with what it shows).
export const setCompare = (list) => write(list.slice(0, MAX_COMPARE));
export const removeCompare = (id) => write(read().filter((x) => x.id !== id));
export const clearCompare = () => write([]);
export const compareHref = (list) => `/compare?ids=${list.map((x) => x.id).join(',')}`;

const useCompare = () => useSyncExternalStore(subscribe, read, () => EMPTY);

export default useCompare;
