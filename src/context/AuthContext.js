import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe } from '../api/client';
import api from '../api/client';

const AuthContext = createContext(null);

// Default brand = RedRock Rep. Any field the user sets overrides this.
const DEFAULT_BRAND = {
  brand_name:    'RedRock Rep',
  logo_url:      null,           // null → use /redrock-logo.svg
  primary_color: '#c8102e',
  support_email: null,
  cta_url:       null,
  cta_text:      null,
  share_footer:  null,
};

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [brand, setBrand]   = useState(DEFAULT_BRAND);
  const [loading, setLoading] = useState(true);

  const fetchBrand = useCallback(async () => {
    try {
      const res = await api.get('/me/brand');
      // Merge user overrides on top of defaults so null fields fall back
      setBrand({ ...DEFAULT_BRAND, ...res.data });
    } catch {
      setBrand(DEFAULT_BRAND);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getMe()
        .then((res) => {
          setUser(res.data);
          return fetchBrand();
        })
        .catch((err) => {
          // Only clear the token for auth errors (401/403).
          // Network errors (server down, timeout) should NOT log the user out —
          // their token is still valid and the server will come back.
          const status = err?.response?.status;
          if (status === 401 || status === 403) {
            localStorage.removeItem('token');
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchBrand]);

  const loginUser = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
    fetchBrand();
  };

  const logoutUser = () => {
    localStorage.removeItem('token');
    setUser(null);
    setBrand(DEFAULT_BRAND);
  };

  // Exposed so Settings page can trigger a refresh after saving changes.
  const refreshBrand = fetchBrand;

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logoutUser, brand, refreshBrand }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
