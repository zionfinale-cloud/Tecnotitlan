import prisma from '../config/prisma.js';
import { getConfig } from './configService.js';
import { getStatus as getWhatsAppStatus } from './whatsappService.js';

const present = (value) => Boolean(String(value || '').trim());

export const calculateReadiness = ({ staffTotal, staffWithTwoFactor, meliConnections, config, whatsapp }) => {
  const provider = String(whatsapp?.provider || config.WHATSAPP_PROVIDER || 'disabled').toLowerCase();
  const whatsappReady = provider === 'cloud'
    ? Boolean(whatsapp?.connected && whatsapp?.webhookReady)
    : provider === 'baileys'
      ? Boolean(whatsapp?.connected && whatsapp?.adminGroupConfigured)
      : false;
  const paymentReady = Boolean(
    (present(config.STRIPE_SECRET_KEY) && present(config.STRIPE_WEBHOOK_SECRET))
    || present(config.PAYPAL_CLIENT_ID),
  );

  const checks = [
    {
      id: 'staff-2fa', label: '2FA del equipo', ready: staffTotal > 0 && staffWithTwoFactor === staffTotal,
      detail: `${staffWithTwoFactor}/${staffTotal} cuentas de personal protegidas`, action: '/admin/userlist',
    },
    {
      id: 'token-encryption', label: 'Cifrado de integraciones',
      ready: present(process.env.TOKEN_ENCRYPTION_KEY || process.env.SESSION_SECRET || process.env.JWT_SECRET),
      detail: 'AES-256-GCM disponible para secretos y tokens', action: '/admin/security',
    },
    {
      id: 'mercadolibre', label: 'Mercado Libre', ready: meliConnections > 0,
      detail: meliConnections > 0 ? `${meliConnections} cuenta(s) conectada(s)` : 'Falta conectar una cuenta vendedora',
      action: '/admin/settings/mercadolibre',
    },
    {
      id: 'whatsapp', label: 'WhatsApp operativo', ready: whatsappReady,
      detail: provider === 'cloud'
        ? (whatsappReady ? 'Cloud API y webhook configurados' : 'Completa Cloud API y su webhook')
        : provider === 'baileys'
          ? (whatsappReady ? 'Sesión y grupo administrativo listos' : 'Falta sesión activa o grupo administrativo')
          : 'Selecciona un proveedor seguro',
      action: '/admin/settings/whatsapp',
    },
    {
      id: 'email', label: 'Correo transaccional',
      ready: present(config.SMTP_HOST) && present(config.SMTP_USER) && present(config.SMTP_PASS),
      detail: 'SMTP para avisos, recuperación y atención', action: '/admin/settings/system',
    },
    {
      id: 'payments', label: 'Pagos y webhooks', ready: paymentReady,
      detail: paymentReady ? 'Al menos un proveedor de pagos está listo' : 'Configura Stripe completo o PayPal',
      action: '/admin/settings/system',
    },
    {
      id: 'health', label: 'Salud y despliegue', ready: true,
      detail: 'Sondas independientes para web, API y base de datos', action: '/admin/security',
    },
  ];
  const readyCount = checks.filter((check) => check.ready).length;
  return { score: Math.round((readyCount / checks.length) * 100), readyCount, total: checks.length, checks };
};

export const getOperationalReadiness = async () => {
  const [staffTotal, staffWithTwoFactor, meliConnections] = await Promise.all([
    prisma.user.count({ where: { role: { name: { not: 'USER' } } } }),
    prisma.user.count({ where: { role: { name: { not: 'USER' } }, twoFactorEnabled: true } }),
    prisma.meliIntegration.count(),
  ]);
  return calculateReadiness({
    staffTotal,
    staffWithTwoFactor,
    meliConnections,
    config: getConfig(),
    whatsapp: getWhatsAppStatus(),
  });
};
