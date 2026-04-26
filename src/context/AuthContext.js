import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe } from '../api/client';
import api from '../api/client';

const AuthContext = createContext(null);

// Default brand = RedRock Rep. Any field the user sets overrides this.
const DEFAULT_BRAND = {
  brand_name:    'RedRock Rep',
  logo_url:      null,
  primary_color: '#c8102e',
  support_email: null,
  cta_url:       null,
  cta_text:      null,
  share_footer:  null,
};

function readStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  // Initialise synchronously from localStorage — pages render immediately
  // on refresh instead of waiting for getMe() to round-trip.
  const [user, setUser] = useState(readStoredUser);
  const [brand, setBrand] = useState(DEFAULT_BRAND);

  // Only block rendering if we have a token but no cached user object yet
  // (i.e. the very first login ever on this device).
  const [loading, setLoading] = useState(() => {
    const hasToken = !!localStorage.getItem('token');
    const hasUser  = !!localStorage.getItem('user');
    return hasToken && !hasUser;
  });

  const fetchBrand = useCallback(async () => {
    try {
      const res = await api.get('/me/brand');
      setBrand({ ...DEFAULT_BRAND, ...res.data });
    } catch {
      setBrand(DEFAULT_BRAND);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    // Silently validate the token in the background.
    // If a cached user is already in state, loading is already false and
    // pages are rendering — this just keeps the server-side truth in sync.
    getMe()
      .then((res) => {
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
        fetchBrand(); // non-blocking — don't delay page render
        // Re-identify in Crisp on page refresh (Crisp may not have the session yet)
        if (window.$crisp && res.data?.email) {
          window.$crisp.push(['set', 'user:email', [res.data.email]]);
        }
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          // Token is genuinely invalid — clear everything
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
        // Network errors (server down) leave the cached user in place
        // so the UI doesn't log the user out on a bad connection.
      })
      .finally(() => setLoading(false));
  }, [fetchBrand]);

  const loginUser = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    fetchBrand();
    // Identify user in Crisp support widget
    if (window.$crisp && userData?.email) {
      window.$crisp.push(['set', 'user:email', [userData.email]]);
    }
  };

  const logoutUser = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setBrand(DEFAULT_BRAND);
    // Reset Crisp session so next user starts fresh
    if (window.$crisp) {
      window.$crisp.push(['do', 'session:reset']);
    }
  };

  const refreshBrand = fetchBrand;

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logoutUser, brand, refreshBrand }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
