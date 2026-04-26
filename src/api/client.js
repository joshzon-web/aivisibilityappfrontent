import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({ baseURL: API_URL });

// Attach token to every request if logged in
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 clear the stale token so the user gets redirected to login
// rather than seeing an empty dashboard forever.
// Also retry transient failures (network errors / 5xx) on idempotent GETs once
// — fixes intermittent "Couldn't load X" errors when the API has a brief blip
// (cold start, dropped connection, transient 502 from the proxy, etc.).
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/auth';
      return Promise.reject(error);
    }

    const cfg = error?.config;
    const status = error?.response?.status;
    const isNetworkError = !error?.response; // no response = network/CORS/timeout
    const isServerError = status >= 500 && status < 600;
    const isGet = (cfg?.method || 'get').toLowerCase() === 'get';

    // Only retry idempotent GETs, only once, only on transient failures.
    if (cfg && isGet && !cfg._retried && (isNetworkError || isServerError)) {
      cfg._retried = true;
      await new Promise((r) => setTimeout(r, 500));
      return api(cfg);
    }

    return Promise.reject(error);
  }
);

export default api;

// Auth
export const signup = (email, password, first_name, last_name) =>
  api.post('/auth/signup', { email, password, first_name, last_name });

export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const getMe = () => api.get('/auth/me');
export const verifyEmail = (token) => api.get('/auth/verify-email', { params: { token } });
export const resendVerification = (email) => api.post('/auth/resend-verification', { email });
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });
export const resetPassword = (token, password) => api.post('/auth/reset-password', { token, password });

// Business search (Google Places)
export const searchBusinesses = (q) =>
  api.get('/businesses/search', { params: { q } });

// Tracked businesses
export const listBusinesses = () => api.get('/businesses');
export const getBusiness = (id) => api.get(`/businesses/${id}`);
export const deleteBusiness = (id) => api.delete(`/businesses/${id}`);
export const updateBusinessSchedule = (id, scheduled_interval) =>
  api.patch(`/businesses/${id}`, { scheduled_interval });

// Note: updateBusinessSearchLabel is also exported below alongside the
// scan/probe helpers, where the pre-scan label probe lives.

// Scans
// opts: { force_refresh?: bool, search_label_override?: string }
export const runScan = (place_id, search_term, opts = {}) => {
  const body = {
    place_id,
    search_term,
    force_refresh: !!opts.force_refresh,
  };
  if (opts.search_label_override && opts.search_label_override.trim()) {
    body.search_label_override = opts.search_label_override.trim();
  }
  return api.post('/scan', body);
};

// Prospecting scan — not added to tracked businesses list
export const runProspectingScan = (place_id, search_term, opts = {}) => {
  const body = { place_id, search_term, source: 'prospecting' };
  if (opts.search_label_override && opts.search_label_override.trim()) {
    body.search_label_override = opts.search_label_override.trim();
  }
  return api.post('/scan', body);
};

// Pre-scan probe: resolve the area we'd use for prompts (single Places Details
// call, no LLM cost) so the user can confirm / override before burning a scan.
export const probeBusinessLabel = (place_id) =>
  api.get('/businesses/probe-label', { params: { place_id } });

// Post-hoc edit of the search area for an already-tracked business.
export const updateBusinessSearchLabel = (id, search_label) =>
  api.patch(`/businesses/${id}/search_label`, { search_label });

export const getBusinessScans = (businessId, search_term = null) =>
  api.get(`/businesses/${businessId}/scans`, {
    params: search_term ? { search_term } : {},
  });

export const getBusinessTerms = (id) => api.get(`/businesses/${id}/terms`);

export const getScan = (id) => api.get(`/scans/${id}`);
export const deleteScan = (id) => api.delete(`/scans/${id}`);

// Share links (auth required for management; public for viewing)
export const getShareInfo    = (id) => api.get(`/scans/${id}/share`);
export const createShareLink = (id) => api.post(`/scans/${id}/share`);
export const extendShareLink = (id) => api.post(`/scans/${id}/share/extend`);
export const revokeShareLink = (id) => api.delete(`/scans/${id}/share`);

// Clients (agency folders)
export const listClients = () => api.get('/clients');
export const createClient = (name, notes, contact_name, contact_email) =>
  api.post('/clients', { name, notes, contact_name, contact_email });
export const updateClient = (id, fields) => api.patch(`/clients/${id}`, fields);
export const deleteClient = (id) => api.delete(`/clients/${id}`);
export const assignBusinessToClient = (bizId, clientId) =>
  api.post(`/businesses/${bizId}/assign-client`, { client_id: clientId });

// Billing
export const getBillingStatus    = ()     => api.get('/billing/status');
export const createCheckout      = (plan) => api.post('/billing/checkout', { plan });
export const createPortalSession = ()     => api.post('/billing/portal');

// Public — no auth header sent (uses raw axios)
export const getSharedScan = (token) =>
  axios.get(`${API_URL}/share/scan/${token}`).then(r => r.data);
