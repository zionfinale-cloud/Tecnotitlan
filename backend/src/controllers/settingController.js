import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js'; // Importar la instancia Singleton
import { BadRequestError } from '../utils/errorUtils.js';
import { loadConfigFromDB } from '../services/configService.js';

const PUBLIC_SETTING_KEYS = [
    'site_name',
    'site_slogan',
    'contact_email',
    'social_facebook',
    'social_instagram',
    'social_tiktok',
    'social_youtube',
    'social_whatsapp',
    'accent_color',
    'primary_color',
    'logo_url',
    'currency_symbol',
    'page_privacy_policy',
    'page_terms_of_service',
    'hero_eyebrow',
    'hero_title',
    'hero_highlight',
    'hero_subtitle',
    'hero_cta_text',
    'hero_cta_href',
    'hero_image_url',
    'home_promos',
    'home_category_icons',
];

const SENSITIVE_SETTING_DEFINITIONS = [
    { key: 'SMTP_HOST', label: 'Servidor SMTP', type: 'string' },
    { key: 'SMTP_PORT', label: 'Puerto SMTP', type: 'string' },
    { key: 'SMTP_USER', label: 'Usuario SMTP', type: 'string' },
    { key: 'SMTP_PASS', label: 'Contrasena SMTP', type: 'password' },
    { key: 'EMAIL_FROM', label: 'Remitente de correos', type: 'string' },
    { key: 'SUPPORT_EMAIL', label: 'Correo de soporte', type: 'string' },
    { key: 'ADMIN_WHATSAPP_NUMBER', label: 'WhatsApp administrador', type: 'string' },
    { key: 'API_PUBLIC_URL', label: 'URL publica de la API', type: 'string' },
    { key: 'WHATSAPP_PROVIDER', label: 'Proveedor WhatsApp (disabled/baileys)', type: 'string' },
    { key: 'WHATSAPP_AUTH_STORAGE', label: 'Almacenamiento sesion WhatsApp (database/file)', type: 'string' },
    { key: 'WHATSAPP_AUTH_DIR', label: 'Carpeta persistente WhatsApp', type: 'string' },
    { key: 'WHATSAPP_AUTO_CONNECT', label: 'WhatsApp auto conectar al iniciar', type: 'string' },
    { key: 'WHATSAPP_KEEP_ALIVE_INTERVAL_MS', label: 'WhatsApp intervalo de vigilancia (ms)', type: 'string' },
    { key: 'WHATSAPP_PAUSED_RETRY_AFTER_MS', label: 'WhatsApp reintento despues de pausa (ms)', type: 'string' },
    { key: 'WHATSAPP_AUTO_RETRY_PAUSED', label: 'WhatsApp reintentar si esta pausado', type: 'string' },
    { key: 'WHATSAPP_AUTO_ROTATE_SESSION_ON_LOGOUT', label: 'WhatsApp rotar sesion automaticamente al cerrar sesion', type: 'string' },
    { key: 'N8N_ORDER_WEBHOOK_URL', label: 'Webhook n8n pedidos', type: 'password' },
    { key: 'N8N_SUPPORT_WEBHOOK_URL', label: 'Webhook n8n soporte', type: 'password' },
    { key: 'STRIPE_SECRET_KEY', label: 'Stripe secret key', type: 'password' },
    { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe webhook secret', type: 'password' },
    { key: 'PAYPAL_CLIENT_ID', label: 'PayPal client ID', type: 'string' },
    { key: 'MERCADOLIBRE_APP_ID', label: 'Mercado Libre app ID', type: 'string' },
    { key: 'MERCADOLIBRE_CLIENT_SECRET', label: 'Mercado Libre secret', type: 'password' },
    { key: 'MERCADOLIBRE_REDIRECT_URI', label: 'Mercado Libre redirect URI', type: 'string' },
    { key: 'TIKTOK_SHOP_APP_KEY', label: 'TikTok Shop app key', type: 'string' },
    { key: 'TIKTOK_SHOP_APP_SECRET', label: 'TikTok Shop app secret', type: 'password' },
    { key: 'TIKTOK_SHOP_REDIRECT_URI', label: 'TikTok Shop redirect URI', type: 'string' },
    { key: 'TIKTOK_SHOP_AUTH_BASE_URL', label: 'TikTok Shop auth base URL', type: 'string' },
    { key: 'TIKTOK_SHOP_API_BASE_URL', label: 'TikTok Shop API base URL', type: 'string' },
];

const SENSITIVE_SETTING_KEYS = new Set(SENSITIVE_SETTING_DEFINITIONS.map((setting) => setting.key));
const maskValue = (value = '', type = 'string') => {
    if (!value || type !== 'password') return value || '';
    return value.length <= 8 ? '********' : `${value.slice(0, 4)}********${value.slice(-4)}`;
};

const getPublicSettings = asyncHandler(async (req, res) => {
    const settings = await prisma.setting.findMany({
        where: { key: { in: PUBLIC_SETTING_KEYS } },
        select: { key: true, value: true, type: true },
    });
    res.json({ status: 'success', data: settings });
});

// @desc    Obtener todas las configuraciones
// @route   GET /api/settings
// @access  Private/Admin
const getSettings = asyncHandler(async (req, res) => {
    const settings = await prisma.setting.findMany({
        where: { isEditable: true }
    });
    res.json({
        status: 'success',
        data: settings,
    });
});

const getSystemSettings = asyncHandler(async (req, res) => {
    const settings = await prisma.setting.findMany({
        where: { key: { in: Array.from(SENSITIVE_SETTING_KEYS) } },
        select: { key: true, value: true, type: true, description: true },
    });

    const settingsMap = settings.reduce((acc, setting) => {
        acc[setting.key] = setting;
        return acc;
    }, {});

    const data = SENSITIVE_SETTING_DEFINITIONS.map((definition) => {
        const setting = settingsMap[definition.key];
        return {
            ...definition,
            value: maskValue(setting?.value || process.env[definition.key] || '', definition.type),
            hasValue: Boolean(setting?.value || process.env[definition.key]),
            source: setting?.value ? 'database' : (process.env[definition.key] ? 'environment' : 'empty'),
        };
    });

    res.json({ status: 'success', data });
});

// @desc    Actualizar configuraciones (en lote)
// @route   PUT /api/settings
// @access  Private/Admin
const updateSettings = asyncHandler(async (req, res) => {
    const { settings } = req.body; // Espera un array de { key, value }

    if (!Array.isArray(settings) || settings.length === 0) {
        res.status(400);
        throw new Error('Se esperaba un array de configuraciones.');
    }

    // Usamos una transacción para asegurar que todas las actualizaciones se completen o ninguna lo haga.
    const updatePromises = settings.map(setting =>
        prisma.setting.upsert({
            where: { key: setting.key },
            update: {
                value: setting.value,
                ...(setting.type ? { type: setting.type } : {}),
            },
            create: {
                key: setting.key,
                value: setting.value,
                type: setting.type || 'string',
            },
        })
    );

    await prisma.$transaction(updatePromises);

    res.status(200).json({
        status: 'success',
        message: 'Configuraciones actualizadas correctamente.',
    });
});

const updateSystemSettings = asyncHandler(async (req, res) => {
    const { settings } = req.body;

    if (!Array.isArray(settings)) {
        throw new BadRequestError('Se esperaba un array de configuraciones.');
    }

    const updates = settings
        .filter((setting) => SENSITIVE_SETTING_KEYS.has(setting.key))
        .filter((setting) => String(setting.value || '').trim() !== '' && !String(setting.value).includes('********'));

    if (updates.length === 0) {
        res.status(200).json({
            status: 'success',
            message: 'No hubo cambios sensibles que guardar.',
        });
        return;
    }

    await prisma.$transaction(updates.map((setting) => prisma.setting.upsert({
        where: { key: setting.key },
        update: {
            value: String(setting.value),
            type: setting.type || 'string',
            isEditable: true,
        },
        create: {
            key: setting.key,
            value: String(setting.value),
            type: setting.type || 'string',
            isEditable: true,
        },
    })));

    await loadConfigFromDB();

    res.status(200).json({
        status: 'success',
        message: 'Configuracion sensible actualizada correctamente.',
    });
});

export { getPublicSettings, getSettings, updateSettings, getSystemSettings, updateSystemSettings };
