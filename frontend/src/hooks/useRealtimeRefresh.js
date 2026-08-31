import { useEffect, useRef } from 'react';
import { useRealtime } from '../context/RealtimeContext';

const normalizeTopics = (topics) => (Array.isArray(topics) ? topics : [topics]).filter(Boolean);

export const useRealtimeRefresh = (topics, callback, { delay = 250 } = {}) => {
  const { subscribe } = useRealtime();
  const callbackRef = useRef(callback);
  const timerRef = useRef(null);
  const topicKey = normalizeTopics(topics).sort().join('|');

  useEffect(() => { callbackRef.current = callback; }, [callback]);

  useEffect(() => {
    const accepted = new Set(topicKey.split('|').filter(Boolean));
    const unsubscribe = subscribe((event) => {
      if (!accepted.has('*') && !accepted.has(event.topic)) return;
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => callbackRef.current?.(event), delay);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timerRef.current);
    };
  }, [delay, subscribe, topicKey]);
};
