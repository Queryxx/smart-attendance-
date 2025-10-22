export const IMG_FORMAT = 'png';

// API base URL used by the frontend when calling the backend.
// - In dev, keep empty string to leverage Vite's proxy (see vite.config.js).
// - In preview/production, fall back to VITE_API_BASE or localhost:4000.
export const API_BASE = (import.meta && import.meta.env && import.meta.env.DEV)
  ? ''
  : (import.meta.env?.VITE_API_BASE || 'http://localhost:4000');