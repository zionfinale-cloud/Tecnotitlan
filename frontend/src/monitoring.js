import * as Sentry from '@sentry/react';
import { env } from './config/runtimeEnv';

const dsn = String(env('REACT_APP_SENTRY_DSN', '') || '').trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: env('REACT_APP_SENTRY_ENVIRONMENT', import.meta.env.MODE),
    release: env('REACT_APP_RELEASE', ''),
    sendDefaultPii: false,
    tracesSampleRate: Number(env('REACT_APP_SENTRY_TRACES_SAMPLE_RATE', '0.05')),
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.query_string;
        delete event.request.headers;
      }
      if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
      return event;
    },
  });
}

export { Sentry };
export const monitoringEnabled = Boolean(dsn);
