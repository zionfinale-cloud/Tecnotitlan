import test from 'node:test';
import assert from 'node:assert/strict';

import {
    chooseSafeWaWebVersion,
    extractWhatsAppFailure,
    getWhatsAppIdentityType,
    isValidWaWebVersion,
    isSupportedWhatsAppJid,
    resolveWhatsAppTarget,
    sendWhatsAppOnce,
} from '../src/services/whatsappSafetyPolicy.js';

test('clasifica PN, LID y grupo sin convertir identidades', () => {
    assert.equal(getWhatsAppIdentityType('523312345678@s.whatsapp.net'), 'PN');
    assert.equal(getWhatsAppIdentityType('123456789012345@lid'), 'LID');
    assert.equal(getWhatsAppIdentityType('120363000000000000@g.us'), 'GROUP');
});

test('acepta exclusivamente versiones WA Web completas', () => {
    assert.equal(isValidWaWebVersion([2, 3000, 123]), true);
    assert.equal(isValidWaWebVersion([2, 3000]), false);
    assert.equal(isValidWaWebVersion(['x', 3000, 123]), false);
});

test('prioriza cache de proceso para evitar cambios durante reconexion', () => {
    assert.deepEqual(chooseSafeWaWebVersion({ cached: [2, 3, 4], fetched: { isLatest: true, version: [9, 9, 9] } }), {
        version: [2, 3, 4], source: 'process-cache',
    });
});

test('solo acepta una version remota marcada como actual', () => {
    assert.deepEqual(chooseSafeWaWebVersion({ fetched: { isLatest: true, version: [2, 3, 4] } }), {
        version: [2, 3, 4], source: 'verified-fetch', shouldPersist: true,
    });
    assert.equal(chooseSafeWaWebVersion({ fetched: { isLatest: false, version: [9, 9, 9] } }).version, null);
});

test('usa cache persistida cuando la consulta remota es obsoleta', () => {
    assert.deepEqual(chooseSafeWaWebVersion({ fetched: { isLatest: false, version: [9, 9, 9] }, persisted: [2, 3, 4] }), {
        version: [2, 3, 4], source: 'persisted-cache',
    });
});

test('detecta 463 sin depender de JSON.stringify', () => {
    assert.deepEqual(extractWhatsAppFailure({ update: { messageStubParameters: ['463', 'Your account has been restricted'] } }).restriction, true);
    assert.equal(extractWhatsAppFailure({ error: { output: { statusCode: 463 } } }).code, 463);
    assert.equal(extractWhatsAppFailure({ status: 200, text: 'ok' }).restriction, false);
});

test('clasifica c.us como identidad telefonica', () => {
    assert.equal(getWhatsAppIdentityType('523312345678@c.us'), 'PN');
});

test('clasifica una identidad desconocida sin transformarla', () => {
    assert.equal(getWhatsAppIdentityType('cliente'), 'UNKNOWN');
});

test('reconoce los cuatro JID soportados', () => {
    for (const jid of ['1@s.whatsapp.net', '1@c.us', '1@lid', '1@g.us']) assert.equal(isSupportedWhatsAppJid(jid), true);
});

test('rechaza sufijos ajenos a WhatsApp', () => {
    assert.equal(isSupportedWhatsAppJid('1@example.com'), false);
});

test('rechaza componentes negativos de version', () => {
    assert.equal(isValidWaWebVersion([2, 3000, -1]), false);
});

test('rechaza componentes decimales de version', () => {
    assert.equal(isValidWaWebVersion([2, 3000, 1.5]), false);
});

test('cae al default incluido sin fuentes confiables', () => {
    assert.deepEqual(chooseSafeWaWebVersion(), { version: null, source: 'baileys-bundled-default' });
});

test('rechaza cache persistida mal formada', () => {
    assert.equal(chooseSafeWaWebVersion({ persisted: [2, 3] }).version, null);
});

test('detecta restriccion por reachout timelock', () => {
    assert.equal(extractWhatsAppFailure({ message: 'reachout timelock active' }).code, 463);
});

test('detecta 408 estructurado sin confundirlo con 463', () => {
    const failure = extractWhatsAppFailure({ error: { output: { statusCode: 408 } } });
    assert.equal(failure.code, 408);
    assert.equal(failure.restriction, false);
});

test('detecta 515 escrito en un mensaje', () => {
    assert.equal(extractWhatsAppFailure({ message: 'restart required (515)' }).code, 515);
});

test('ignora contenido binario durante la clasificacion de errores', () => {
    assert.equal(extractWhatsAppFailure({ payload: Buffer.from('463') }).code, null);
});

test('limita estructuras ciclicas sin lanzar una excepcion', () => {
    const value = { message: 'connection closed' };
    value.self = value;
    assert.doesNotThrow(() => extractWhatsAppFailure(value));
});

test('resuelve PN a LID desde cache sin consultar onWhatsApp', async () => {
    let lookups = 0;
    const socket = {
        onWhatsApp: async () => { lookups += 1; return []; },
        signalRepository: { lidMapping: { getLIDForPN: async () => '123@lid' } },
    };
    assert.equal((await resolveWhatsAppTarget(socket, '5233@s.whatsapp.net')).target, '123@lid');
    assert.equal(lookups, 0);
});

test('mantiene un LID entrante como destino inmutable', async () => {
    const socket = { onWhatsApp: async () => { throw new Error('no debe llamarse'); } };
    assert.equal((await resolveWhatsAppTarget(socket, '123@lid')).target, '123@lid');
});

test('exists false detiene el flujo antes de enviar', async () => {
    const socket = { onWhatsApp: async () => [{ exists: false, jid: '5233@s.whatsapp.net' }] };
    await assert.rejects(resolveWhatsAppTarget(socket, '5233@s.whatsapp.net'), { code: 'WHATSAPP_TARGET_NOT_FOUND' });
});

test('una falla tecnica de onWhatsApp detiene el flujo', async () => {
    const socket = { onWhatsApp: async () => { throw new Error('timeout'); } };
    await assert.rejects(resolveWhatsAppTarget(socket, '5233@s.whatsapp.net'), { code: 'WHATSAPP_LOOKUP_FAILED' });
});

test('envia texto exactamente una vez al destino resuelto', async () => {
    const calls = [];
    const socket = { sendMessage: async (...args) => { calls.push(args); return { key: { id: 'm1' } }; } };
    await sendWhatsAppOnce({ socket, target: '123@lid', payload: { text: 'hola' } });
    assert.deepEqual(calls, [['123@lid', { text: 'hola' }]]);
});

test('envia multimedia exactamente una vez y no reintenta un rechazo', async () => {
    let calls = 0;
    const socket = { sendMessage: async () => { calls += 1; throw new Error('463 restricted'); } };
    await assert.rejects(sendWhatsAppOnce({ socket, target: '123@lid', payload: { image: Buffer.from('x') } }));
    assert.equal(calls, 1);
});
