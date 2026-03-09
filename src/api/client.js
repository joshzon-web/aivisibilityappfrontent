import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://ai-visibility-api-production.up.railway.app';

const api = axios.create({ baseURL: API_URL });

// Attach token to every request if logged in
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const signup = (email, password) =>
  api.post('/auth/signup', { email, password });

export const login = (email, password) =>
  api.post('/auth/login', { email, password });

export const getMe = () => api.get('/auth/me');

// Business search (Google Places)
export const searchBusinesses = (q) =>
  api.get('/businesses/search', { params: { q } });

// Tracked businesses
export const listBusinesses = () => api.get('/businesses');
export const deleteBusiness = (id) => api.delete(`/businesses/${id}`);

// Scans
export const runScan = (place_id, search_term, force_refresh = false) =>
  api.post('/scan', { place_id, search_term, force_refresh });

export const getBusinessScans = (businessId) =>
  api.get(`/businesses/${businessId}/scans`);

export const getScan = (id) => api.get(`/scans/${id}`);
export const deleteScan = (id) => api.delete(`/scans/${id}`);
