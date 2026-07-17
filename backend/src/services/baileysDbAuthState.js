import crypto from 'crypto';
import prisma from '../config/prisma.js';
import config from '../config/env.js';

const getSessionSecret = () => {
    const secret = config.SESSION_SECRET || config.JWT_SECRET;
    if (!secret) {
        throw new Error('SESSION_SECRET o JWT_SECRET es requerido para cifrar la sesion de WhatsApp.');
    }
    return crypto.createHash('sha256').update(secret).digest();
};

const encode = (value, BufferJSON) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getSessionSecret(), iv);
    const plaintext = JSON.stringify(value, BufferJSON.replacer);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    return {
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
    };
};

const decode = (storedValue, BufferJSON) => {
    if (!storedValue) return null;

    const value = typeof storedValue === 'string' ? JSON.parse(storedValue) : storedValue;
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        getSessionSecret(),
        Buffer.from(value.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'));

    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(value.encrypted, 'base64')),
        decipher.final(),
    ]).toString('utf8');

    return JSON.parse(plaintext, BufferJSON.reviver);
};

export const useDatabaseAuthState = async (baileysModule, provider = 'baileys') => {
    const { BufferJSON, initAuthCreds, proto } = baileysModule;

    const readData = async (key) => {
        const row = await prisma.whatsAppAuthState.findUnique({
            where: {
                provider_key: { provider, key },
            },
        });

        try {
            return decode(row?.value, BufferJSON);
        } catch (error) {
            throw new Error(`No se pudo descifrar la sesion de WhatsApp (${key}). Revisa que SESSION_SECRET no haya cambiado.`);
        }
    };

    const writeData = async (key, value) => {
        await prisma.whatsAppAuthState.upsert({
            where: {
                provider_key: { provider, key },
            },
            create: {
                provider,
                key,
                value: encode(value, BufferJSON),
            },
            update: {
                value: encode(value, BufferJSON),
            },
        });
    };

    const removeData = async (key) => {
        await prisma.whatsAppAuthState.deleteMany({
            where: { provider, key },
        });
    };

    const creds = (await readData('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}:${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const operations = [];
                    Object.entries(data).forEach(([type, entries]) => {
                        Object.entries(entries).forEach(([id, value]) => {
                            operations.push(value ? writeData(`${type}:${id}`, value) : removeData(`${type}:${id}`));
                        });
                    });
                    await Promise.all(operations);
                },
            },
        },
        saveCreds: () => writeData('creds', creds),
        clearState: () => prisma.whatsAppAuthState.deleteMany({ where: { provider } }),
    };
};

export const clearDatabaseAuthState = async (provider = 'baileys') => {
    await prisma.whatsAppAuthState.deleteMany({ where: { provider } });
};
