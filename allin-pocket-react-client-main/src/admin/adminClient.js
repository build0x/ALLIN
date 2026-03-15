import axios from 'axios';

export const ADMIN_TOKEN_KEY = 'ADMIN_TOKEN';

const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';
const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
const localIP = window.location.hostname;

export const adminApiBaseURL =
  isProduction || isStaging
    ? `${window.location.origin}/admin-api`
    : `${protocol}://${localIP}:5700/admin-api`;

const adminClient = axios.create({
  baseURL: adminApiBaseURL,
  timeout: 15000,
});

export const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY);

export const setAdminToken = (token) => {
  if (token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
};

adminClient.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default adminClient;
