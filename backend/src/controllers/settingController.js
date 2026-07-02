import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js'; // Importar la instancia Singleton

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
];

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
        prisma.setting.update({
            where: { key: setting.key },
            data: { value: setting.value },
        })
    );

    await prisma.$transaction(updatePromises);

    res.status(200).json({
        status: 'success',
        message: 'Configuraciones actualizadas correctamente.',
    });
});

export { getPublicSettings, getSettings, updateSettings };
