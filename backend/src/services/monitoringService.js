import * as Sentry from '@sentry/node';

export const isMonitoringEnabled = () => Boolean(String(process.env.SENTRY_DSN || '').trim());

export const captureServerException = (error, { request, statusCode } = {}) => {
    if (!isMonitoringEnabled() || Number(statusCode || 500) < 500) return null;
    return Sentry.withScope((scope) => {
        scope.setTag('http.method', request?.method || 'UNKNOWN');
        scope.setTag('http.route', request?.route?.path || request?.path || 'unknown');
        if (request?.user?.id) scope.setUser({ id: request.user.id });
        return Sentry.captureException(error);
    });
};
