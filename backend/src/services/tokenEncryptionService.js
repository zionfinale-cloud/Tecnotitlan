import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import { encryptSecret, isEncryptedSecret, redactTokenPayload } from '../utils/secretCrypto.js';

export const encryptStoredIntegrationTokens = async () => {
  const [meliIntegrations, tiktokIntegrations] = await Promise.all([
    prisma.meliIntegration.findMany(),
    prisma.tikTokShopIntegration.findMany(),
  ]);

  let migrated = 0;
  for (const integration of meliIntegrations) {
    const needsTokenMigration = !isEncryptedSecret(integration.accessToken)
      || (integration.refreshToken && !isEncryptedSecret(integration.refreshToken));
    const sanitizedRaw = redactTokenPayload(integration.rawData);
    if (needsTokenMigration || JSON.stringify(sanitizedRaw) !== JSON.stringify(integration.rawData)) {
      await prisma.meliIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: encryptSecret(integration.accessToken),
          refreshToken: encryptSecret(integration.refreshToken),
          rawData: sanitizedRaw,
        },
      });
      migrated += 1;
    }
  }

  for (const integration of tiktokIntegrations) {
    const needsTokenMigration = !isEncryptedSecret(integration.accessToken)
      || (integration.refreshToken && !isEncryptedSecret(integration.refreshToken))
      || (integration.shopCipher && !isEncryptedSecret(integration.shopCipher));
    const sanitizedRaw = redactTokenPayload(integration.rawData);
    if (needsTokenMigration || JSON.stringify(sanitizedRaw) !== JSON.stringify(integration.rawData)) {
      await prisma.tikTokShopIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: encryptSecret(integration.accessToken),
          refreshToken: encryptSecret(integration.refreshToken),
          shopCipher: encryptSecret(integration.shopCipher),
          rawData: sanitizedRaw,
        },
      });
      migrated += 1;
    }
  }

  logger.info(`[Security] Tokens de integraciones cifrados/verificados: ${migrated} migrados.`);
  return migrated;
};
