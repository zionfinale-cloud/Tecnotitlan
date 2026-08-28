import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';
import * as mercadoLibreService from './mercadoLibreService.js';

const getPublishableStock = (listing) => {
  const normalizeStock = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const assignedStock = normalizeStock(listing?.publishedStock);
  const stockBuffer = normalizeStock(listing?.stockBuffer);
  return Math.max(assignedStock - stockBuffer, 0);
};

const syncMercadoLibreListingStock = async ({ userId, product, listing, confirmedPrice = null }) => {
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
    if (confirmedPrice !== null) {
      await mercadoLibreService.updatePriceAndStock(userId, product.meliItemId, {
        price: confirmedPrice,
        stock: stockToPublish,
      });
    } else {
      await mercadoLibreService.updateStock(userId, product.meliItemId, stockToPublish);
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: { lastMeliSync: now },
      }),
      prisma.marketplaceListing.update({
        where: { id: listing.id },
        data: {
          ...(confirmedPrice !== null ? { price: Number(confirmedPrice) } : {}),
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
      price: confirmedPrice !== null ? Number(confirmedPrice) : null,
      message: confirmedPrice !== null
        ? `Mercado Libre actualizado a $${Number(confirmedPrice).toFixed(2)} y ${stockToPublish} piezas publicables.`
        : `Mercado Libre actualizado a ${stockToPublish} piezas publicables.`,
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
