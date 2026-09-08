const VALID_JID_SUFFIXES = ['@s.whatsapp.net', '@c.us', '@lid', '@g.us'];

export const getWhatsAppIdentityType = (jid = '') => {
    const value = String(jid || '');
    if (value.endsWith('@lid')) return 'LID';
    if (value.endsWith('@g.us')) return 'GROUP';
    if (value.endsWith('@s.whatsapp.net') || value.endsWith('@c.us')) return 'PN';
    return 'UNKNOWN';
};

export const isValidWaWebVersion = (version) => (
    Array.isArray(version)
    && version.length === 3
    && version.every((part) => Number.isInteger(Number(part)) && Number(part) >= 0)
);

export const chooseSafeWaWebVersion = ({ fetched, cached, persisted } = {}) => {
    if (isValidWaWebVersion(cached)) return { version: cached.map(Number), source: 'process-cache' };
    if (fetched?.isLatest === true && isValidWaWebVersion(fetched.version)) {
        return { version: fetched.version.map(Number), source: 'verified-fetch', shouldPersist: true };
    }
    if (isValidWaWebVersion(persisted)) return { version: persisted.map(Number), source: 'persisted-cache' };
    return { version: null, source: 'baileys-bundled-default' };
};

const walkFailure = (value, accumulator, depth = 0) => {
    if (depth > 5 || value == null) return;
    if (value instanceof Error && value.message) accumulator.text.push(value.message);
    if (typeof value === 'string') {
        accumulator.text.push(value);
        return;
    }
    if (typeof value === 'number') {
        accumulator.numbers.push(value);
        return;
    }
    if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return;
    if (Array.isArray(value)) {
        value.slice(0, 30).forEach((entry) => walkFailure(entry, accumulator, depth + 1));
        return;
    }
    if (typeof value !== 'object') return;

    for (const [key, entry] of Object.entries(value).slice(0, 50)) {
        const normalizedKey = key.toLowerCase();
        if (['statuscode', 'status', 'code', 'errorcode'].includes(normalizedKey)) {
            const numeric = Number(entry);
            if (Number.isFinite(numeric)) accumulator.codes.push(numeric);
        }
        walkFailure(entry, accumulator, depth + 1);
    }
};

export const extractWhatsAppFailure = (value) => {
    const accumulator = { codes: [], numbers: [], text: [] };
    walkFailure(value, accumulator);
    const message = accumulator.text.join(' ').slice(0, 2000);
    const explicitCode = accumulator.codes.find((code) => [401, 403, 405, 408, 411, 428, 463, 500, 503, 515].includes(code));
    const textCode = message.match(/(?:^|\D)(401|403|405|408|411|428|463|500|503|515)(?:\D|$)/)?.[1];
    const restriction = Number(explicitCode || textCode) === 463 || /reach[ -]?out|time[ -]?lock|restricted|account has been restricted/i.test(message);

    return {
        code: restriction ? 463 : (explicitCode || (textCode ? Number(textCode) : null)),
        restriction,
        message,
    };
};

export const isSupportedWhatsAppJid = (jid = '') => VALID_JID_SUFFIXES.some((suffix) => String(jid).endsWith(suffix));

const isPhoneJid = (jid = '') => /@(s\.whatsapp\.net|c\.us)$/.test(String(jid || ''));

export const resolveWhatsAppTarget = async (socket, target) => {
    const value = String(target || '');
    if (value.endsWith('@lid') || value.endsWith('@g.us') || !socket?.onWhatsApp) {
        return { target: value, source: 'immutable' };
    }

    if (isPhoneJid(value) && socket?.signalRepository?.lidMapping?.getLIDForPN) {
        try {
            const knownLid = await socket.signalRepository.lidMapping.getLIDForPN(value);
            if (knownLid) return { target: knownLid, source: 'lid-cache' };
        } catch {
            // El fallo del cache no autoriza enviar; se valida el PN con el servidor.
        }
    }

    let availability;
    try {
        availability = await socket.onWhatsApp(value);
    } catch (cause) {
        const error = new Error(`No se pudo validar el destino WhatsApp: ${cause.message}`);
        error.code = 'WHATSAPP_LOOKUP_FAILED';
        throw error;
    }
    const match = (availability || []).find((item) => item?.exists && item?.jid);
    if (!match) {
        const error = new Error(`WhatsApp no encontro el destino ${value}; no se envio el mensaje.`);
        error.code = 'WHATSAPP_TARGET_NOT_FOUND';
        throw error;
    }

    if (isPhoneJid(match.jid) && socket?.signalRepository?.lidMapping?.getLIDForPN) {
        try {
            const mappedLid = await socket.signalRepository.lidMapping.getLIDForPN(match.jid);
            if (mappedLid) return { target: mappedLid, source: 'lid-after-validation' };
        } catch {
            // El PN confirmado sigue siendo el unico destino permitido.
        }
    }
    return { target: match.jid, source: 'validated-pn' };
};

export const sendWhatsAppOnce = ({ socket, target, payload, enqueue = (task) => task() }) => (
    enqueue(() => socket.sendMessage(target, payload))
);
