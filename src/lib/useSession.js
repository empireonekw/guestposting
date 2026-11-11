'use client';

import { useEffect, useState } from 'react';

// The signed-in user from localStorage, or null. It is read after the first
// render so server-rendered pages and the browser agree on the first paint.
const useSession = () => {
  const [user, setUser] = useState(null);
  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem('userInfo')) || null);
    } catch {
      setUser(null);
    }
  }, []);
  const signOut = () => {
    localStorage.removeItem('userInfo');
    setUser(null);
  };
  return { user, signOut };
};

export default useSession;
