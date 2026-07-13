import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import * as mercadoLibreService from './mercadoLibreService.js';

const getPublishableStock = (listing) => {
  const assignedStock = Number(listing?.publishedStock || 0);
  const stockBuffer = Number(listing?.stockBuffer || 0);
  return Math.max(assignedStock - stockBuffer, 0);
};

const syncMercadoLibreListingStock = async ({ userId, product, listing }) => {
  if (!product?.meliItemId) {
    return {
      status: 'skipped',
      reason: 'Producto sin publicacion vinculada de Mercado Libre.',
    };
  }

  if (!listing) {
    return {
      status: 'skipped',
      reason: 'No hay stock asignado a Mercado Libre. Primero haz un traspaso desde bodega/web.',
    };
  }

  const stockToPublish = getPublishableStock(listing);

  try {
    await mercadoLibreService.updateStock(userId, product.meliItemId, stockToPublish);

    const now = new Date();
    await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: { lastMeliSync: now },
      }),
      prisma.marketplaceListing.update({
        where: { id: listing.id },
        data: {
          lastSyncedAt: now,
          syncStatus: 'SYNCED_TO_MELI',
          status: 'ACTIVE',
        },
      }),
    ]);

    logger.info(`[Meli Sync] ${product.sku} -> ${stockToPublish} piezas publicables en Mercado Libre`);
    return {
      status: 'synced',
      stock: stockToPublish,
      message: `Mercado Libre actualizado a ${stockToPublish} piezas publicables.`,
    };
  } catch (error) {
    await prisma.marketplaceListing.update({
      where: { id: listing.id },
      data: { syncStatus: 'MELI_SYNC_ERROR', status: 'ERROR' },
    }).catch(() => {});

    logger.warn(`[Meli Sync] No se pudo sincronizar ${product.sku}: ${error.message}`);
    return {
      status: 'error',
      reason: error.message || 'No se pudo sincronizar Mercado Libre.',
    };
  }
};

export {
  getPublishableStock,
  syncMercadoLibreListingStock,
};
