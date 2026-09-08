import './config/env.js';
import * as Sentry from '@sentry/node';

const dsn = String(process.env.SENTRY_DSN || '').trim();

const redactEvent = (event) => {
    if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.query_string;
        if (event.request.headers) {
            const safeHeaders = { ...event.request.headers };
            for (const key of Object.keys(safeHeaders)) {
                if (/authorization|cookie|token|secret|key/i.test(key)) delete safeHeaders[key];
            }
            event.request.headers = safeHeaders;
        }
    }
    if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
    event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
        ...breadcrumb,
        data: undefined,
        message: breadcrumb.category === 'console' ? undefined : breadcrumb.message,
    }));
    return event;
};

if (dsn) {
    Sentry.init({
        dsn,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
        release: process.env.APP_RELEASE || process.env.GIT_COMMIT || undefined,
        sendDefaultPii: false,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.05),
        beforeSend: redactEvent,
    });
}

export const monitoringEnabled = Boolean(dsn);
