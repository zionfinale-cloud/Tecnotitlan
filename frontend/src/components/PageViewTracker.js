import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/apiService';

const PageViewTracker = () => {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname.startsWith('/admin') || location.pathname === '/mail' || navigator.doNotTrack === '1') return undefined;
    const params = new URLSearchParams(location.search);
    const timer = window.setTimeout(() => {
      api.post('/analytics/view', { path: location.pathname, referrer: document.referrer || '', campaign: params.get('utm_source') || '' }).catch(() => {});
    }, 500);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);
  return null;
};

export default PageViewTracker;
