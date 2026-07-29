import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getSessionLockRetryDelayMs,
    isProtectedWhatsAppDisconnect,
    isTransientWhatsAppDisconnect,
} from '../src/services/whatsappLifecyclePolicy.js';

test('protects invalid or rate-limited WhatsApp sessions', () => {
    assert.equal(isProtectedWhatsAppDisconnect({ statusCode: 401 }), true);
    assert.equal(isProtectedWhatsAppDisconnect({ statusCode: 500 }), true);
    assert.equal(isProtectedWhatsAppDisconnect({ message: 'Too many requests' }), true);
});

test('treats code 405 Connection Failure as transient', () => {
    const disconnect = {
        statusCode: 405,
        message: 'Connection Failure',
    };

    assert.equal(isProtectedWhatsAppDisconnect(disconnect), false);
    assert.equal(isTransientWhatsAppDisconnect(disconnect), true);
});

test('does not downgrade a protected code because of a generic message', () => {
    const disconnect = {
        statusCode: 401,
        message: 'Connection Failure',
    };

    assert.equal(isProtectedWhatsAppDisconnect(disconnect), true);
    assert.equal(isTransientWhatsAppDisconnect(disconnect), false);
});

test('recognizes common temporary connection failures', () => {
    assert.equal(isTransientWhatsAppDisconnect({ statusCode: 408 }), true);
    assert.equal(isTransientWhatsAppDisconnect({ statusCode: 503 }), true);
    assert.equal(isTransientWhatsAppDisconnect({ message: 'Connection closed' }), true);
});

test('calculates a delayed retry after a rolling deployment handoff', () => {
    assert.equal(getSessionLockRetryDelayMs({
        lockAgeMs: 30_000,
        staleAfterMs: 120_000,
        graceMs: 5_000,
    }), 95_000);

    assert.equal(getSessionLockRetryDelayMs({
        lockAgeMs: 130_000,
        staleAfterMs: 120_000,
        graceMs: 5_000,
    }), 5_000);
});
