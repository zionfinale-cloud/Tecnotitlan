const runtime = typeof window !== 'undefined' ? (window.__TECNOTITLAN_ENV__ || {}) : {};

export const env = (name, fallback = '') => runtime[name]
  || import.meta.env[name]
  || import.meta.env[`VITE_${name.replace(/^REACT_APP_/, '')}`]
  || fallback;
