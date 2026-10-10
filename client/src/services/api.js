import axios from 'axios';

// Vite env URL check chesi, slash format set chesthundi
const rawApiUrl = import.meta.env.VITE_API_URL;
const API_BASE = rawApiUrl 
  ? `${rawApiUrl.replace(/\/+$/, '')}${rawApiUrl.endsWith('/api') ? '' : '/api'}` 
  : '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Attach Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('brandtrace_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // FormData pampinappudu default application/json header theeseyali
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
}, (error) => Promise.reject(error));

// Response Interceptor: Handle Data & Errors
api.interceptors.response.use(
  (response) => {
    // CSV blobs download kosam full response ni allow chesthundi
    if (response.config.responseType === 'blob') {
      return response.data;
    }
    return response.data;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        localStorage.removeItem('brandtrace_token');
        localStorage.removeItem('brandtrace_user');
        window.location.href = '/login';
      }
    }
    const message = error.response?.data?.message || (error.response?.status === 500 ? 'Backend server error or cannot connect to API.' : error.message) || 'An unexpected error occurred.';
    return Promise.reject(new Error(message));
  }
);

export const authService = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me')
};

export const brandService = {
  getAll: (params) => api.get('/brands', { params }),
  getById: (id) => api.get(`/brands/${id}`),
  create: (formData) => api.post('/brands', formData),
  update: (id, formData) => api.put(`/brands/${id}`, formData),
  archive: (id) => api.delete(`/brands/${id}`)
};

export const assetService = {
  getAll: (params) => api.get('/assets', { params }),
  getByBrand: (brandId) => api.get(`/assets/brand/${brandId}`),
  create: (data) => api.post('/assets', data),
  update: (id, data) => api.put(`/assets/${id}`, data),
  delete: (id) => api.delete(`/assets/${id}`)
};

export const candidateService = {
  getAll: (params) => api.get('/candidates', { params }),
  getById: (id) => api.get(`/candidates/${id}`),
  importCandidates: (data) => api.post('/candidates/import', data)
};

export const scanService = {
  getAll: (params) => api.get('/scans', { params }),
  getById: (id) => api.get(`/scans/${id}`),
  getResults: (id) => api.get(`/scans/${id}/results`),
  createScan: (data) => api.post('/scans', data)
};

export const detectionService = {
  getAll: (params) => api.get('/detections', { params }),
  getById: (id) => api.get(`/detections/${id}`),
  updateStatus: (id, data) => api.patch(`/detections/${id}/status`, data),
  addNote: (id, data) => api.post(`/detections/${id}/notes`, data)
};

export const reportService = {
  getDetectionsCsvBlob: (params) => api.get('/reports/detections.csv', {
    params,
    responseType: 'blob'
  }),
  getScansCsvBlob: (params) => api.get('/reports/scans.csv', {
    params,
    responseType: 'blob'
  })
};

export const systemService = {
  getHealth: () => api.get('/health'),
  getSourceHealth: () => api.get('/sources/health'),
  getDashboardStats: (params) => api.get('/dashboard/stats', { params })
};

export default api;