import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import { env } from '../config/runtimeEnv';

const API_ORIGIN = env('REACT_APP_API_URL', 'http://localhost:5000').replace(/\/$/, '');

export const RealtimeContext = createContext({
  connected: false,
  lastEvent: null,
  subscribe: () => () => {},
});

export const RealtimeProvider = ({ children }) => {
  const { userInfo } = useContext(AuthContext);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const listenersRef = useRef(new Set());

  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  useEffect(() => {
    const socket = io(API_ORIGIN, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('data:changed', (event) => {
      setLastEvent(event);
      listenersRef.current.forEach((listener) => listener(event));
      window.dispatchEvent(new CustomEvent('tecnotitlan:realtime', { detail: event }));
    });
    socket.on('whatsapp:status', (status) => window.dispatchEvent(new CustomEvent('tecnotitlan:whatsapp-status', { detail: status })));
    socket.on('whatsapp:qr', (qr) => window.dispatchEvent(new CustomEvent('tecnotitlan:whatsapp-qr', { detail: qr })));
    socket.on('whatsapp:message', (message) => window.dispatchEvent(new CustomEvent('tecnotitlan:whatsapp-message', { detail: message })));
    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [userInfo?.id]);

  const value = useMemo(() => ({ connected, lastEvent, subscribe }), [connected, lastEvent, subscribe]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export const useRealtime = () => useContext(RealtimeContext);
