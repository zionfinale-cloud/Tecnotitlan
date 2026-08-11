const normalizeCode = (value) => {
    const code = Number(value);
    return Number.isFinite(code) ? code : null;
};

export const isProtectedWhatsAppDisconnect = ({ statusCode, message = '' } = {}) => {
    const code = normalizeCode(statusCode);
    const lowerMessage = String(message || '').toLowerCase();

    return [401, 403, 411, 463, 500].includes(code)
        || lowerMessage.includes('logged out')
        || lowerMessage.includes('bad session')
        || lowerMessage.includes('multidevice mismatch')
        || lowerMessage.includes('unauthorized')
        || lowerMessage.includes('forbidden')
        || lowerMessage.includes('too many')
        || lowerMessage.includes('rate limit');
};

export const isTransientWhatsAppDisconnect = ({ statusCode, message = '' } = {}) => {
    const code = normalizeCode(statusCode);
    const lowerMessage = String(message || '').toLowerCase();

    if ([401, 403, 411, 463, 500].includes(code)) return false;

    return [405, 408, 428, 503].includes(code)
        || lowerMessage.includes('connection failure')
        || lowerMessage.includes('connection closed')
        || lowerMessage.includes('connection lost')
        || lowerMessage.includes('timed out')
        || lowerMessage.includes('service unavailable');
};

export const getSessionLockRetryDelayMs = ({
    lockAgeMs = 0,
    staleAfterMs = 120_000,
    graceMs = 5_000,
} = {}) => {
    const safeAgeMs = Math.max(0, Number(lockAgeMs) || 0);
    const safeStaleAfterMs = Math.max(0, Number(staleAfterMs) || 0);
    const safeGraceMs = Math.max(1_000, Number(graceMs) || 0);

    return Math.max(
        safeGraceMs,
        safeStaleAfterMs - safeAgeMs + safeGraceMs,
    );
};
