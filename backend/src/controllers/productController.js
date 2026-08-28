// backend/src/controllers/productController.js @productController.js
import asyncHandler from 'express-async-handler';
import fs from 'fs/promises';
import path from 'path';
import prisma from '../config/prisma.js'; // Importar la instancia única de Prisma
import { NotFoundError, BadRequestError } from '../utils/errorUtils.js';
import * as meliService from '../services/mercadoLibreService.js';
import { getConfig } from '../services/configService.js';
import {
  getPublishableStock,
  syncMercadoLibreListingStock,
} from '../services/channelStockSyncService.js';
import {
  decorateProductAvailability,
  getProductAvailableStock,
} from '../utils/productAvailability.js';
import { hasEligiblePurchaseForReview } from '../services/productReviewService.js';
import logger from '../utils/logger.js';
import {
  normalizeMercadoLibreId,
  isMercadoLibreItemId,
  isSameMercadoLibreIdentifier,
  buildMercadoLibreFamilyName,
  normalizeGtin,
} from '../utils/mercadoLibreIdentifiers.js';

const SKU_PREFIX_BY_CATEGORY = {
  auriculares: 'AUR',
  audifonos: 'AUR',
  audífonos: 'AUR',
  audio: 'AUR',
  bocinas: 'BOC',
  bocina: 'BOC',
  parlantes: 'BOC',
  relojes: 'WTC',
  reloj: 'WTC',
  smartwatch: 'WTC',
  smartwatches: 'WTC',
  wearables: 'WTC',
  drones: 'DRN',
  drone: 'DRN',
  cargadores: 'CRG',
  cargador: 'CRG',
  cables: 'CBL',
  cable: 'CBL',
  energia: 'ENE',
  energía: 'ENE',
  gaming: 'GMG',
};

const normalizeSkuText = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const buildSkuPrefix = (category) => {
  const candidates = [category?.slug, category?.name].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeSkuText(candidate);
    if (SKU_PREFIX_BY_CATEGORY[normalized]) return SKU_PREFIX_BY_CATEGORY[normalized];

    const partialMatch = Object.entries(SKU_PREFIX_BY_CATEGORY).find(([key]) =>
      normalized.includes(normalizeSkuText(key))
    );
    if (partialMatch) return partialMatch[1];
  }

  const base = normalizeSkuText(category?.slug || category?.name || 'general').replace(/[^a-z0-9\s-]/g, '');
  const words = base.split(/[\s-]+/).filter(Boolean);

  if (words.length >= 2) {
    return words.map((word) => word[0]).join('').slice(0, 3).toUpperCase().padEnd(3, 'X');
  }

  return (words[0] || 'GEN').slice(0, 3).toUpperCase().padEnd(3, 'X');
};


const sanitizeSkuPrefix = (value) => {
  const normalized = normalizeSkuText(value || '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 3)
    .toUpperCase();

  return normalized.length >= 2 ? normalized.padEnd(3, 'X') : null;
};

const parseOptionalFloat = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseOptionalBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
};

const canViewCosts = (user) => {
  if (user?.role?.name === 'SUPER_ADMIN') return true;
  return (user?.role?.permissions || []).some((permission) => permission.name === 'finance:read_costs');
};

const stripCostFields = (record) => {
  if (!record) return record;
  const { costPrice, ...safeRecord } = record;
  return safeRecord;
};

const stripCostFieldsFromList = (records = []) => records.map(stripCostFields);

const normalizeMediaPayload = (media = []) => {
  if (!Array.isArray(media)) return [];

  const seen = new Set();
  return media.reduce((normalized, item) => {
    if (!item?.url) return normalized;

    const type = item.type || 'IMAGE';
    const uniqueKey = `${type}:${item.url}`;
    if (seen.has(uniqueKey)) return normalized;

    seen.add(uniqueKey);
    normalized.push({
      type,
      url: item.url,
      altText: item.altText || null,
    });
    return normalized;
  }, []);
};

const uploadsRoot = path.resolve(process.cwd(), 'uploads');

const getPublicBaseUrl = (req) =>
  (process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isPathInsideUploadsRoot = (absolutePath) => {
  const relativePath = path.relative(uploadsRoot, absolutePath);
  return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

const localUploadPathFromUrl = (url) => {
  try {
    const parsed = new URL(url, 'http://local');
    const pathname = decodeURIComponent(parsed.pathname);

    if (!pathname.startsWith('/uploads/')) return null;

    const relativePath = pathname
      .replace(/^\/uploads\//, '')
      .split('/')
      .filter(Boolean)
      .join(path.sep);
    const absolutePath = path.resolve(uploadsRoot, relativePath);

    return isPathInsideUploadsRoot(absolutePath) ? absolutePath : null;
  } catch (error) {
    return null;
  }
};

const moveFileSafely = async (sourcePath, destinationPath) => {
  if (sourcePath === destinationPath) return;

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });

  try {
    await fs.access(destinationPath);
    const error = new Error(`El archivo destino ya existe: ${destinationPath}`);
    error.code = 'EEXIST';
    throw error;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  try {
    await fs.rename(sourcePath, destinationPath);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fs.copyFile(sourcePath, destinationPath);
    await fs.unlink(sourcePath);
  }
};

const getNextMediaIndex = async (productUploadDir, sku) => {
  try {
    const filenames = await fs.readdir(productUploadDir);
    const mediaFilename = new RegExp(`^${escapeRegExp(sku)}-(\\d+)\\.[a-z0-9]+$`, 'i');
    const maxIndex = filenames.reduce((highest, filename) => {
      const match = filename.match(mediaFilename);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    return maxIndex + 1;
  } catch (error) {
    if (error.code === 'ENOENT') return 1;
    throw error;
  }
};

const isCanonicalProductMediaPath = ({ item, prefix, sku, publicBaseUrl }) => {
  try {
    const parsed = new URL(item.url, publicBaseUrl);
    const expectedPath = `/uploads/${prefix}/${sku}/`;
    return parsed.pathname.startsWith(expectedPath);
  } catch (error) {
    return false;
  }
};

const organizeProductMedia = async ({ media, sku, req }) => {
  const normalizedMedia = normalizeMediaPayload(media);
  if (!normalizedMedia.length || !sku) return normalizedMedia;

  const prefix = sku.split('-')[0] || 'GEN';
  const productUploadDir = path.join(uploadsRoot, prefix, sku);
  const publicBaseUrl = getPublicBaseUrl(req);

  let nextMediaIndex = await getNextMediaIndex(productUploadDir, sku);
  const organizedMedia = [];

  // Procesamos en serie: reordenar conserva las rutas existentes y cada alta nueva
  // obtiene el siguiente indice libre, sin sobrescribir fotos ya publicadas.
  for (const item of normalizedMedia) {
    if (isCanonicalProductMediaPath({ item, prefix, sku, publicBaseUrl })) {
      organizedMedia.push(item);
      continue;
    }

    const sourcePath = localUploadPathFromUrl(item.url);
    if (!sourcePath) {
      organizedMedia.push(item);
      continue;
    }

    try {
      await fs.access(sourcePath);
    } catch (error) {
      organizedMedia.push(item);
      continue;
    }

    const extension = (path.extname(sourcePath) || '.jpg').toLowerCase();
    let filename;
    let destinationPath;

    do {
      filename = `${sku}-${String(nextMediaIndex).padStart(2, '0')}${extension}`;
      destinationPath = path.join(productUploadDir, filename);
      nextMediaIndex += 1;
      try {
        await fs.access(destinationPath);
      } catch (error) {
        if (error.code === 'ENOENT') break;
        throw error;
      }
    } while (true);

    await moveFileSafely(sourcePath, destinationPath);
    organizedMedia.push({
      ...item,
      url: `${publicBaseUrl}/uploads/${prefix}/${sku}/${filename}`,
    });
  }

  return organizedMedia;
};

const normalizeCharacteristicsPayload = (characteristics = []) =>
  Array.isArray(characteristics)
    ? characteristics
        .filter((item) => item && item.key && item.value)
        .map((item) => ({
          key: String(item.key).trim(),
          value: String(item.value).trim(),
        }))
    : [];

const normalizeShortDescription = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, 280) : null;
};

// @desc    Crear un nuevo producto
// @route   POST /api/products
// @access  Private/Admin (now wrapped with asyncHandler)
const createProduct = asyncHandler(async (req, res, next) => {
  logger.info('[ProductCtrl] Intentando crear un nuevo producto');
  const {
    name,
    shortDescription,
    gtin,
    description,
    price,
    brand,
    categoryId,
    countInStock,
    media,
    costPrice,
    characteristics,
    productType,
    supplierInfo,
    supplierStock,
    supplierStockUnlimited,
    supplierLeadTimeMinutes,
    youtubeUrl,
    skuPrefix,
    shippingPayer,
    shippingCostEstimate,
    weightKg,
    lengthCm,
    widthCm,
    heightCm,
  } = req.body;

  // --- Generación de SKU ---
  // 1. Obtener prefijo de la categoría desde la BD
  let categoryPrefix = 'GEN';
  const createdProduct = await prisma.$transaction(async (tx) => {
    if (categoryId) {
      const category = await tx.category.findUnique({ where: { id: categoryId } });
      if (category) {
        categoryPrefix = sanitizeSkuPrefix(skuPrefix) || buildSkuPrefix(category);
      }
    }

    // 2. Obtener el siguiente número de la secuencia para productos
    const counter = await tx.counter.upsert({
      where: { id: 'productSku:' + categoryPrefix },
      update: { sequenceValue: { increment: 1 } },
      create: { id: 'productSku:' + categoryPrefix, sequenceValue: 1 },
    });

    // 3. Formatear el número con ceros a la izquierda (ej: 1 -> "0001")
    const formattedSeq = counter.sequenceValue.toString().padStart(3, '0');

    // 4. Crear el SKU
    const generatedSku = `${categoryPrefix}-${formattedSeq}`;

    // 5. Crear el producto
    const parsedCostPrice = canViewCosts(req.user) && costPrice ? parseFloat(costPrice) : null;
    const product = await tx.product.create({
      data: {
        userId: req.user.id,
        sku: generatedSku,
        name,
        shortDescription: normalizeShortDescription(shortDescription),
        gtin: normalizeGtin(gtin),
        description,
        price: parseFloat(price), // Convertir a número
        costPrice: parsedCostPrice,
        brand,
        categoryId,
        countInStock: parseInt(countInStock, 10) || 0, // Convertir a número entero
        productType: productType || 'IN_HOUSE', // Usar enums de Prisma
        supplierInfo,
        supplierStock: Math.max(parseInt(supplierStock, 10) || 0, 0),
        supplierStockUnlimited: parseOptionalBoolean(supplierStockUnlimited),
        supplierLeadTimeMinutes: Math.max(parseInt(supplierLeadTimeMinutes, 10) || 60, 0),
        youtubeUrl,
        shippingPayer: shippingPayer || 'CUSTOMER',
        shippingCostEstimate: parseOptionalFloat(shippingCostEstimate),
        weightKg: parseOptionalFloat(weightKg),
        lengthCm: parseOptionalFloat(lengthCm),
        widthCm: parseOptionalFloat(widthCm),
        heightCm: parseOptionalFloat(heightCm),
        characteristics: { create: normalizeCharacteristicsPayload(characteristics) },
      },
    });

    const initialQuantity = parseInt(countInStock, 10) || 0;
    const initialUnitCost = parsedCostPrice || 0;
    if (initialQuantity > 0) {
      await tx.inventoryMovement.create({
        data: {
          type: 'PURCHASE',
          productId: product.id,
          quantity: initialQuantity,
          unitCost: initialUnitCost,
          totalCost: initialQuantity * initialUnitCost,
          stockBefore: 0,
          stockAfter: initialQuantity,
          referenceType: 'PRODUCT_INITIAL_STOCK',
          referenceId: product.id,
          notes: 'Stock inicial al crear producto',
          createdById: req.user.id,
        },
      });
    }

    return product;
  });

  const organizedMedia = await organizeProductMedia({ media, sku: createdProduct.sku, req });

  if (organizedMedia.length) {
    await prisma.media.createMany({
      data: organizedMedia.map((item) => ({
        ...item,
        productId: createdProduct.id,
      })),
    });
  }

  const productWithMedia = await prisma.product.findUnique({
    where: { id: createdProduct.id },
    include: { media: true, characteristics: true },
  });

  res.status(201).json({ status: 'success', data: { product: productWithMedia } });
});

// @desc    Obtener todos los productos con paginación y búsqueda
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res, next) => {
  logger.info('[ProductCtrl] Obteniendo productos con paginación y búsqueda');
  const pageSize = Number(req.query.pageSize) || 10;
  const page = Number(req.query.pageNumber) || 1;
  const keyword = req.query.keyword;
  const { sortBy, showArchived } = req.query;

  // Construir el objeto de filtro dinámicamente
  const filter = {};
  // Por defecto, solo mostrar productos no archivados, a menos que se pida explícitamente.
  if (showArchived === 'true') {
    filter.isArchived = true; // { isArchived: true }
  } else {
    filter.isArchived = false; // { isArchived: false }
  }

  if (keyword) { // si hay una palabra clave de búsqueda, aplícala.
    filter.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { sku: { contains: keyword, mode: 'insensitive' } },
    ];
  }
    
  const categoryIdentifier = req.query.category;
  if (categoryIdentifier) {
    // En Prisma, podemos buscar por slug directamente si es único
    const categoryDoc = await prisma.category.findUnique({ where: { slug: categoryIdentifier } });

    if (categoryDoc) {
      filter.categoryId = categoryDoc.id;
    } else {
      // Si la categoría no existe, no devolvemos ningún producto.
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: { products: [], page: 1, pages: 0, count: 0 },
      });
    }
  }

  // Construir las opciones de ordenamiento
  const sortOptions = {};
  if (sortBy) {
    const [field, order] = sortBy.split('_');
    if (['price', 'countInStock', 'createdAt'].includes(field) && ['asc', 'desc'].includes(order)) {
      sortOptions[field] = order;
    }
  } else {
    sortOptions.createdAt = 'desc';
  }

  const count = await prisma.product.count({ where: filter });
  const products = await prisma.product.findMany({
    where: filter,
    include: {
      media: { take: 1, select: { url: true, altText: true } },
      category: { select: { name: true } }, // Poblar categoría
    },
    orderBy: sortOptions,
    take: pageSize,
    skip: pageSize * (page - 1),
  });

  const availableProducts = products.map(decorateProductAvailability);
  const safeProducts = canViewCosts(req.user)
    ? availableProducts
    : stripCostFieldsFromList(availableProducts);

  res.status(200).json({
    status: 'success',
    data: {
      products: safeProducts,
      page,
      pages: Math.ceil(count / pageSize),
    }
  });
});

// @desc    Obtener un producto por SKU
// @route   GET /api/products/:sku
// @access  Public
const getProductById = asyncHandler(async (req, res, next) => {
  logger.info(`[ProductCtrl] Obteniendo producto con SKU: ${req.params.sku}`);
  const query = { sku: req.params.sku.toUpperCase() };

  // Si el usuario no está autenticado o no tiene permiso para leer productos, no puede ver los archivados.
  const canViewArchived = req.user && req.user.role.permissions.some(p => p.name === 'product:read');
  if (!canViewArchived) {
    query.isArchived = false;
  }

  const product = await prisma.product.findFirst({
    where: query,
    include: {
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      category: { select: { id: true, name: true } },
      media: true,
      characteristics: true,
    },
  });

  if (product) {
    res.status(200).json({
      status: 'success',
      data: {
        product: canViewCosts(req.user)
          ? decorateProductAvailability(product)
          : stripCostFields(decorateProductAvailability(product)),
      },
    });
  } else {
    return next(new NotFoundError('Producto no encontrado'));
  }
});

// @desc    Actualizar un producto por SKU
// @route   PUT /api/products/:sku
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res, next) => {
  logger.info(`[ProductCtrl] Actualizando producto con SKU: ${req.params.sku}`);
  const {
    name,
    shortDescription,
    gtin,
    description,
    price,
    countInStock,
    categoryId,
    costPrice,
    youtubeUrl,
    brand,
    productType,
    supplierInfo,
    supplierStock,
    supplierStockUnlimited,
    supplierLeadTimeMinutes,
    media,
    characteristics,
    shippingPayer,
    shippingCostEstimate,
    weightKg,
    lengthCm,
    widthCm,
    heightCm,
  } = req.body;
  const product = await prisma.product.findUnique({ where: { sku: req.params.sku.toUpperCase() } });

  if (product) {
    const organizedMedia = Array.isArray(media)
      ? await organizeProductMedia({ media, sku: product.sku, req })
      : undefined;

    const updatedProduct = await prisma.$transaction(async (tx) => {
      if (Array.isArray(media)) {
        await tx.media.deleteMany({ where: { productId: product.id } });
      }

      if (Array.isArray(characteristics)) {
        await tx.characteristic.deleteMany({ where: { productId: product.id } });
      }

      return tx.product.update({
        where: { sku: req.params.sku.toUpperCase() },
        data: {
          name,
          ...(shortDescription !== undefined
            ? { shortDescription: normalizeShortDescription(shortDescription) }
            : {}),
          ...(gtin !== undefined ? { gtin: normalizeGtin(gtin) } : {}),
          description,
          price: parseFloat(price),
          countInStock: parseInt(countInStock, 10) || 0,
          categoryId,
          ...(canViewCosts(req.user)
            ? { costPrice: costPrice === '' || costPrice === undefined || costPrice === null ? null : parseFloat(costPrice) }
            : {}),
          brand,
          productType: productType || product.productType,
          supplierInfo,
          ...(supplierStock !== undefined
            ? { supplierStock: Math.max(parseInt(supplierStock, 10) || 0, 0) }
            : {}),
          ...(supplierStockUnlimited !== undefined
            ? {
              supplierStockUnlimited: parseOptionalBoolean(
                supplierStockUnlimited,
                product.supplierStockUnlimited
              ),
            }
            : {}),
          ...(supplierLeadTimeMinutes !== undefined
            ? {
              supplierLeadTimeMinutes: Math.max(
                parseInt(supplierLeadTimeMinutes, 10) || 0,
                0
              ),
            }
            : {}),
          youtubeUrl,
          shippingPayer: shippingPayer || product.shippingPayer,
          shippingCostEstimate: parseOptionalFloat(shippingCostEstimate),
          weightKg: parseOptionalFloat(weightKg),
          lengthCm: parseOptionalFloat(lengthCm),
          widthCm: parseOptionalFloat(widthCm),
          heightCm: parseOptionalFloat(heightCm),
          ...(Array.isArray(media) ? { media: { create: organizedMedia } } : {}),
          ...(Array.isArray(characteristics) ? { characteristics: { create: normalizeCharacteristicsPayload(characteristics) } } : {}),
        },
        include: { media: true, characteristics: true },
      });
    });
    res.status(200).json({ status: 'success', data: { product: updatedProduct } });
  } else {
    return next(new NotFoundError('Producto no encontrado'));
  }
});

// @desc    Archivar un producto por SKU (Soft Delete)
// @route   DELETE /api/products/:sku
// @access  Private/Admin
const archiveProduct = asyncHandler(async (req, res, next) => {
  logger.info(`[ProductCtrl] Archivando producto con SKU: ${req.params.sku}`);
  try {
    await prisma.product.update({
      where: { sku: req.params.sku.toUpperCase() },
      data: { isArchived: true },
    });
    res.status(200).json({ status: 'success', message: 'Producto archivado correctamente' });
  } catch (error) {
    // P2025 es el código de error de Prisma para "registro no encontrado"
    if (error.code === 'P2025') {
      return next(new NotFoundError('Producto no encontrado'));
    }
    next(error);
  }
});

// @desc    Restaurar un producto archivado por SKU
// @route   PUT /api/products/:sku/unarchive
// @access  Private/Admin
const unarchiveProduct = asyncHandler(async (req, res, next) => {
  logger.info(`[ProductCtrl] Restaurando producto con SKU: ${req.params.sku}`);
  try {
    await prisma.product.update({
      where: { sku: req.params.sku.toUpperCase() },
      data: { isArchived: false },
    });
    res.status(200).json({ status: 'success', message: 'Producto restaurado correctamente' });
  } catch (error) {
    if (error.code === 'P2025') {
      return next(new NotFoundError('Producto no encontrado'));
    }
    next(error);
  }
});

// @desc    Eliminar permanentemente un producto por SKU
// @route   DELETE /api/products/:sku/permanent
// @access  Private/Admin
const permanentlyDeleteProduct = asyncHandler(async (req, res, next) => {
  logger.info(`[ProductCtrl] Eliminando PERMANENTEMENTE producto con SKU: ${req.params.sku}`);
  try {
    // Añadir lógica para eliminar relaciones si es necesario (ej. OrderItems)
    await prisma.product.delete({ where: { sku: req.params.sku.toUpperCase() } });
    res.status(200).json({ status: 'success', message: 'Producto eliminado permanentemente' });
  } catch (error) {
    if (error.code === 'P2025') {
      return next(new NotFoundError('Producto no encontrado'));
    }
    next(error);
  }
});


// @desc    Actualizar el stock de un producto
// @route   PUT /api/products/:id/stock
// @access  Private/Admin
const updateProductStock = asyncHandler(async (req, res, next) => {
  logger.info(`[ProductCtrl] Actualizando stock del producto con ID: ${req.params.id}`);
  const { countInStock } = req.body;

  if (countInStock === undefined || typeof countInStock !== 'number' || countInStock < 0) {
    return next(new BadRequestError('El valor de stock proporcionado es inválido. Debe ser un número no negativo.'));
  }

  try {
    const updatedProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: req.params.id } });
      if (!product) {
        throw new NotFoundError('Producto no encontrado');
      }

      const difference = countInStock - product.countInStock;
      const updated = await tx.product.update({
        where: { id: req.params.id },
        data: { countInStock },
      });

      if (difference !== 0) {
        await tx.inventoryMovement.create({
          data: {
            type: difference > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
            productId: product.id,
            quantity: Math.abs(difference),
            unitCost: product.costPrice || 0,
            totalCost: Math.abs(difference) * (product.costPrice || 0),
            stockBefore: product.countInStock,
            stockAfter: countInStock,
            referenceType: 'MANUAL_STOCK_ADJUSTMENT',
            referenceId: product.id,
            notes: 'Ajuste manual de inventario',
            createdById: req.user?.id,
          },
        });
      }

      return updated;
    });
    res.status(200).json({ status: 'success', data: { product: updatedProduct } });
  } catch (error) {
    if (error.code === 'P2025') {
      return next(new NotFoundError('Producto no encontrado'));
    }
    next(error);
  }
});

// @desc    Obtener niveles de stock de todos los productos
// @route   GET /api/products/inventory/levels
// @access  Private/Admin
const getProductStockLevels = asyncHandler(async (req, res, next) => {
  logger.info('[ProductCtrl] Obteniendo niveles de stock de todos los productos');
  const products = await prisma.product.findMany({
    select: { name: true, countInStock: true, sku: true },
  });
  res.status(200).json({ status: 'success', results: products.length, data: { products } });
});

// @desc    Obtener productos con stock bajo
// @route   GET /api/products/inventory/low-stock
// @access  Private/Admin
const getLowStockProducts = asyncHandler(async (req, res, next) => {
  logger.info('[ProductCtrl] Obteniendo productos con stock bajo');
  // Prisma no soporta comparar dos campos directamente en un `where` de forma sencilla.
  // Se puede hacer con una consulta raw o filtrando en la aplicación.
  // Por ahora, usaremos un umbral fijo.
  const lowStockThreshold = 10; // O obtenerlo de la configuración
  const lowStockProducts = await prisma.product.findMany({
    where: { countInStock: { lte: lowStockThreshold } },
    select: { name: true, countInStock: true, sku: true },
  });

  res.status(200).json({
    status: 'success',
    results: lowStockProducts.length,
    data: { products: lowStockProducts },
  });
});

/**
 * @desc    Contar todos los productos
 * @route   GET /api/products/count
 * @access  Private/Admin
 */
const countProducts = asyncHandler(async (req, res) => {
  const count = await prisma.product.count();
  res.status(200).json({ status: 'success', data: { count } });
});

/**
 * @desc    Vincular un producto local con un item de Mercado Libre
 * @route   PUT /api/products/:id/link-meli
 * @access  Private/Admin
 */
const linkProductToMeli = asyncHandler(async (req, res, next) => {
  const { meliItemId } = req.body;
  const { id: productIdentifier } = req.params;
  const userId = req.user.id;
  const normalizedMeliItemId = normalizeMercadoLibreId(meliItemId);

  if (!normalizedMeliItemId) {
    return next(new BadRequestError('Se requiere el ID del artículo de Mercado Libre (meliItemId).'));
  }
  if (!isMercadoLibreItemId(normalizedMeliItemId)) {
    return next(new BadRequestError(
      `${normalizedMeliItemId} no es un ID de publicacion de Mercado Libre. Si es una categoria, dejala en "Categoria Meli"; para crear un anuncio nuevo usa "Publicar en Mercado Libre".`,
    ));
  }

  const normalizedIdentifier = String(productIdentifier || '').toUpperCase();
  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { id: productIdentifier },
        { sku: normalizedIdentifier },
      ],
    },
  });
  if (!product) {
    return next(new NotFoundError('Producto no encontrado'));
  }

  const linkedProduct = await prisma.product.findFirst({
    where: {
      meliItemId: normalizedMeliItemId,
      id: { not: product.id },
    },
    select: { sku: true, name: true },
  });
  if (linkedProduct) {
    return next(new BadRequestError(
      `La publicacion ${normalizedMeliItemId} ya esta vinculada a ${linkedProduct.sku} - ${linkedProduct.name}.`,
    ));
  }

  const existingListing = await prisma.marketplaceListing.findUnique({
    where: {
      productId_channel: {
        productId: product.id,
        channel: 'MERCADOLIBRE',
      },
    },
  });
  const assignedStock = Number(existingListing?.publishedStock || 0);
  if (assignedStock <= 0) {
    return next(new BadRequestError(
      'Antes de vincular la publicacion, traspasa al menos una pieza desde Bodega/Web a Mercado Libre. Tecnotitlan usara esa existencia asignada como unica fuente de stock.',
    ));
  }

  // Validar que el item de Meli existe y pertenece al usuario conectado.
  const meliItem = await meliService.getItem(userId, normalizedMeliItemId);
  if (!meliItem) {
    return next(new NotFoundError(`El articulo de Mercado Libre con ID ${normalizedMeliItemId} no se encontro o no tienes acceso a el.`));
  }

  const linkedAt = new Date();
  const remoteAvailableQuantity = Number(meliItem.available_quantity || 0);
  const listingRawData = {
    ...meliItem,
    tecnotitlan: {
      linkedAt: linkedAt.toISOString(),
      remoteAvailableQuantity,
      inventorySource: 'LOCAL_ASSIGNED_STOCK',
    },
  };
  const updatedProduct = await prisma.$transaction(async (tx) => {
    const nextProduct = await tx.product.update({
      where: { id: product.id },
      data: {
        meliItemId: String(meliItem.id || normalizedMeliItemId).toUpperCase(),
        meliPublicationUrl: meliItem.permalink || null,
        lastMeliSync: linkedAt,
      },
    });

    await tx.marketplaceListing.upsert({
      where: {
        productId_channel: {
          productId: product.id,
          channel: 'MERCADOLIBRE',
        },
      },
      update: {
        externalProductId: String(meliItem.id || normalizedMeliItemId).toUpperCase(),
        externalSku: product.sku,
        title: meliItem.title || product.name,
        price: Number(meliItem.price || product.price || 0),
        status: meliItem.status === 'active' ? 'ACTIVE' : 'READY',
        syncStatus: 'LINKED',
        lastSyncedAt: linkedAt,
        rawData: listingRawData,
      },
      create: {
        productId: product.id,
        channel: 'MERCADOLIBRE',
        externalProductId: String(meliItem.id || normalizedMeliItemId).toUpperCase(),
        externalSku: product.sku,
        title: meliItem.title || product.name,
        price: Number(meliItem.price || product.price || 0),
        publishedStock: 0,
        status: meliItem.status === 'active' ? 'ACTIVE' : 'READY',
        syncStatus: 'LINKED',
        lastSyncedAt: linkedAt,
        rawData: listingRawData,
      },
    });

    return nextProduct;
  });

  const marketplaceListing = await prisma.marketplaceListing.findUnique({
    where: {
      productId_channel: {
        productId: updatedProduct.id,
        channel: 'MERCADOLIBRE',
      },
    },
  });
  let syncResult = null;
  let syncWarning = null;

  try {
    syncResult = await syncMercadoLibreListingStock({
      userId,
      product: updatedProduct,
      listing: marketplaceListing,
    });
  } catch (syncError) {
    syncWarning = syncError.message;
    logger.warn(
      `[ProductCtrl] ${updatedProduct.sku} vinculado, pero no se concilio stock Meli: ${syncError.message}`
    );
  }

  res.status(200).json({
    status: 'success',
    message: syncWarning
      ? 'Publicacion vinculada. Revisa la sincronizacion de inventario.'
      : 'Publicacion vinculada y stock conciliado con el inventario asignado.',
    data: {
      product: updatedProduct,
      sync: syncResult,
      warning: syncWarning,
      remoteStockBeforeLink: remoteAvailableQuantity,
      assignedStock: Number(marketplaceListing?.publishedStock || assignedStock),
    },
  });
});

/**
 * @desc    Crear una nueva reseña
 * @route   POST /api/products/:sku/reviews
 * @access  Private
 */
const toPublicProductImageUrl = (url) => {
  if (!url || String(url).startsWith('data:') || String(url).startsWith('blob:')) {
    return null;
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const apiBaseUrl = getConfig().API_PUBLIC_URL || 'https://api.tecnotitlan.com.mx';
  try {
    return new URL(url, `${apiBaseUrl.replace(/\/$/, '')}/`).toString();
  } catch {
    return null;
  }
};

const publishProductToMeli = asyncHandler(async (req, res, next) => {
  // La ruta historicamente se llamo :id, pero la ficha administrativa usa el
  // SKU maestro en la URL. Resolver ambos evita publicar el producto equivocado
  // y mantiene compatibilidad con llamadas que ya mandan el UUID.
  const productReference = String(req.params.id || '').trim();
  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { id: productReference },
        { sku: productReference.toUpperCase() },
      ],
    },
    include: {
      media: true,
      characteristics: true,
      marketplaceListings: {
        where: { channel: 'MERCADOLIBRE' },
        take: 1,
      },
    },
  });

  if (!product) {
    return next(new NotFoundError('Producto local no encontrado.'));
  }
  if (req.body?.confirmCosts !== true) {
    return next(new BadRequestError(
      'Revisa y confirma la cotizacion de Mercado Libre antes de publicar.'
    ));
  }
  const categoryId = normalizeMercadoLibreId(req.body.categoryId);
  if (!categoryId) {
    return next(new BadRequestError('Selecciona una categoria valida de Mercado Libre.'));
  }

  const normalizeSku = (value) => String(value || '').trim().toUpperCase();
  const extractRemoteSku = (item) => {
    const attributeSku = (item?.attributes || []).find(
      (attribute) => normalizeSku(attribute?.id) === 'SELLER_SKU'
    );
    const variationSku = (item?.variations || []).flatMap((variation) => {
      const variationAttribute = (variation?.attributes || []).find(
        (attribute) => normalizeSku(attribute?.id) === 'SELLER_SKU'
      );
      return [variation?.seller_custom_field, variationAttribute?.value_name];
    });

    return [
      item?.seller_custom_field,
      attributeSku?.value_name,
      ...variationSku,
    ].map(normalizeSku).find(Boolean) || '';
  };
  const clearInvalidMeliLink = async (itemId, reason) => {
    logger.warn(
      `[Meli Publish] Limpiando vinculo invalido ${itemId} del producto ${product.sku}: ${reason}.`
    );
    await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: {
          meliItemId: null,
          meliPublicationUrl: null,
          lastMeliSync: null,
        },
      }),
      prisma.marketplaceListing.updateMany({
        where: {
          productId: product.id,
          channel: 'MERCADOLIBRE',
          externalProductId: itemId,
        },
        data: {
          externalProductId: null,
          syncStatus: 'PENDING_PUBLICATION',
        },
      }),
    ]);
  };

  const currentMeliItemId = normalizeMercadoLibreId(product.meliItemId);
  if (currentMeliItemId) {
    if (isSameMercadoLibreIdentifier(currentMeliItemId, categoryId)) {
      await clearInvalidMeliLink(currentMeliItemId, 'el ID guardado coincide con la categoria');
    } else {
      let remoteItem = null;
      try {
        remoteItem = await meliService.getItem(req.user.id, currentMeliItemId);
      } catch (error) {
        const status = Number(error?.response?.status || error?.statusCode || 0);
        if (![403, 404].includes(status)) {
          throw error;
        }
      }

      const remoteSku = extractRemoteSku(remoteItem);
      const localSku = normalizeSku(product.sku);
      if (remoteItem && remoteSku === localSku) {
        return next(new BadRequestError(
          `Este producto ya esta vinculado a ${currentMeliItemId} con el SKU ${product.sku}.`
        ));
      }

      await clearInvalidMeliLink(
        currentMeliItemId,
        remoteItem
          ? `el SKU remoto ${remoteSku || 'sin SKU'} no coincide con ${localSku}`
          : 'la publicacion ya no existe o no es accesible'
      );
    }
  }

  const listing = product.marketplaceListings[0];
  if (!listing || Number(listing.publishedStock || 0) <= 0) {
    return next(new BadRequestError(
      'Configura una oferta de stock mayor a cero para Mercado Libre desde Canales.'
    ));
  }

  const pictureSources = product.media
    .filter((media) => !media.type || String(media.type).toUpperCase() === 'IMAGE')
    .map((media) => toPublicProductImageUrl(media.url))
    .filter(Boolean)
    .slice(0, 12);

  if (pictureSources.length === 0) {
    return next(new BadRequestError(
      'Agrega al menos una imagen publica al producto antes de publicarlo en Mercado Libre.'
    ));
  }

  const submittedAttributes = Array.isArray(req.body.attributes) ? req.body.attributes : [];
  const attributes = submittedAttributes
    .map((attribute) => {
      const id = String(attribute?.id || '').trim();
      const valueId = String(attribute?.value_id ?? attribute?.valueId ?? '').trim();
      const valueName = String(attribute?.value_name ?? attribute?.valueName ?? '').trim();
      return {
        id,
        ...(valueId ? { value_id: valueId } : {}),
        ...(valueName ? { value_name: valueName } : {}),
      };
    })
    .filter((attribute) => attribute.id && (attribute.value_id || attribute.value_name));

  if (product.brand && !attributes.some(
    (attribute) => String(attribute.id).trim().toUpperCase() === 'BRAND'
  )) {
    attributes.push({ id: 'BRAND', value_name: product.brand });
  }

  const submittedGtin = attributes.find(
    (attribute) => String(attribute.id).trim().toUpperCase() === 'GTIN',
  )?.value_name;
  const emptyGtinReason = attributes.find(
    (attribute) => String(attribute.id).trim().toUpperCase() === 'EMPTY_GTIN_REASON',
  );
  const publishGtin = normalizeGtin(req.body.gtin ?? submittedGtin ?? product.gtin);
  if (publishGtin) {
    const existingGtin = attributes.findIndex(
      (attribute) => String(attribute.id).trim().toUpperCase() === 'GTIN',
    );
    const gtinAttribute = { id: 'GTIN', value_name: publishGtin };

    if (existingGtin >= 0) {
      attributes[existingGtin] = gtinAttribute;
    } else {
      attributes.push(gtinAttribute);
    }
    const emptyReasonIndex = attributes.findIndex(
      (attribute) => String(attribute.id).trim().toUpperCase() === 'EMPTY_GTIN_REASON',
    );
    if (emptyReasonIndex >= 0) attributes.splice(emptyReasonIndex, 1);
  }

  const categoryAttributes = await meliService.getCategoryAttributes(req.user.id, categoryId);
  const categoryGtin = categoryAttributes.find(
    (attribute) => String(attribute?.id || '').trim().toUpperCase() === 'GTIN'
  );
  const categoryEmptyGtinReason = categoryAttributes.find(
    (attribute) => String(attribute?.id || '').trim().toUpperCase() === 'EMPTY_GTIN_REASON'
  );
  const isGtinRequired = Boolean(categoryGtin?.tags?.required);
  const isGtinConditional = Boolean(categoryGtin?.tags?.conditional_required);
  if ((isGtinRequired && !publishGtin)
    || (isGtinConditional && !publishGtin && !emptyGtinReason)) {
    return res.status(400).json({
      status: 'error',
      message:
        isGtinRequired
          ? 'Mercado Libre exige el GTIN/EAN/UPC real para esta categoria.'
          : 'Mercado Libre exige el GTIN/EAN/UPC o un motivo valido por el que el producto no tiene codigo registrado.',
      code: 'MELI_GTIN_REQUIRED',
      field: 'gtin',
    });
  }
  if (!publishGtin && emptyGtinReason && categoryEmptyGtinReason?.values?.length) {
    const validReason = categoryEmptyGtinReason.values.find((value) =>
      String(value.id) === String(emptyGtinReason.value_id || '')
      || String(value.name).toLowerCase() === String(emptyGtinReason.value_name || '').toLowerCase()
    );
    if (!validReason) {
      return next(new BadRequestError('Selecciona un motivo de GTIN vacio valido para esta categoria.'));
    }
    emptyGtinReason.value_id = String(validReason.id);
    emptyGtinReason.value_name = validReason.name;
  }

  const getAttributeValue = (attributeId) =>
    attributes.find(
      (attribute) => String(attribute.id).trim().toUpperCase() === attributeId,
    )?.value_name || '';
  const familyName = buildMercadoLibreFamilyName({
    requestedFamilyName: req.body.familyName ?? req.body.family_name,
    brand: getAttributeValue('BRAND') || req.body.brand || product.brand,
    model: getAttributeValue('MODEL') || req.body.model,
    productName: product.name,
    sku: product.sku,
  });

  const existingSellerItems = await meliService.searchSellerItemsBySku(req.user.id, product.sku);
  if (existingSellerItems.length > 0) {
    const existingItem = existingSellerItems[0];
    return next(new BadRequestError(
      `Ya existe la publicacion ${existingItem.id} para el SKU ${product.sku}. Vinculala en lugar de crear otra.`
    ));
  }

  const stockToPublish = getPublishableStock(listing);
  const listingTypeId = String(req.body.listingTypeId || 'gold_special');
  const condition = String(req.body.condition || 'new');
  const pricing = await meliService.quotePublicationCosts(req.user.id, {
    targetNet: product.price,
    categoryId,
    listingTypeId,
    condition,
    weightKg: product.weightKg,
    lengthCm: product.lengthCm,
    widthCm: product.widthCm,
    heightCm: product.heightCm,
  });
  const packageAttributes = [
    ['SELLER_PACKAGE_HEIGHT', product.heightCm],
    ['SELLER_PACKAGE_LENGTH', product.lengthCm],
    ['SELLER_PACKAGE_WIDTH', product.widthCm],
    ['SELLER_PACKAGE_WEIGHT', Number(product.weightKg) * 1000],
  ];
  packageAttributes.forEach(([id, value]) => {
    if (!attributes.some((attribute) => attribute.id === id) && Number(value) > 0) {
      attributes.push({ id, value_name: String(Math.ceil(Number(value))) });
    }
  });
  const pictures = [];
  const pictureWarnings = [];
  for (const source of pictureSources) {
    try {
      const uploadedPicture = await meliService.uploadPictureFromUrl(req.user.id, source);
      const [width, height] = String(uploadedPicture?.max_size || '')
        .split('x')
        .map(Number);
      if (uploadedPicture?.id && width >= 500 && height >= 500) {
        pictures.push({ id: uploadedPicture.id });
      } else {
        pictureWarnings.push(`${source} (${uploadedPicture?.max_size || 'resolucion desconocida'})`);
      }
    } catch (error) {
      pictureWarnings.push(`${source} (${error.message})`);
    }
  }
  const payload = {
    category_id: categoryId,
    price: pricing.recommendedPrice,
    currency_id: 'MXN',
    available_quantity: stockToPublish,
    buying_mode: 'buy_it_now',
    listing_type_id: listingTypeId,
    condition,
    pictures,
    attributes,
    family_name: familyName,
    seller_custom_field: product.sku,
    shipping: {
      mode: pricing.shippingMode,
      free_shipping: true,
    },
  };

  const requestedCatalogProductId = normalizeMercadoLibreId(req.body.catalogProductId);
  if (requestedCatalogProductId) {
    const catalogProduct = await meliService.getCatalogProduct(req.user.id, requestedCatalogProductId);
    if (!catalogProduct || catalogProduct.status !== 'active') {
      return next(new BadRequestError('El producto de catalogo seleccionado no esta activo en Mercado Libre.'));
    }
    if (Array.isArray(catalogProduct.children_ids) && catalogProduct.children_ids.length > 0) {
      return next(new BadRequestError(
        'Seleccionaste una ficha padre del catalogo. Elige la variante especifica del producto.'
      ));
    }
    const knownPictureIds = new Set(pictures.map((picture) => picture.id));
    (catalogProduct.pictures || []).forEach((picture) => {
      if (picture?.id && !knownPictureIds.has(picture.id) && pictures.length < 12) {
        pictures.push({ id: picture.id });
        knownPictureIds.add(picture.id);
      }
    });
    payload.catalog_product_id = requestedCatalogProductId;
  }
  if (pictures.length === 0) {
    return next(new BadRequestError(
      'Ninguna imagen propia o de la ficha exacta de catalogo cumple los requisitos de Mercado Libre.'
    ));
  }

  let validation = await meliService.validateItem(req.user.id, payload);
  const requiresFreeShipping = (validation.warnings || []).some(
    (warningItem) => warningItem.code === 'item.shipping.mandatory_free_shipping'
  );
  if (requiresFreeShipping) {
    payload.shipping = {
      ...(payload.shipping || {}),
      free_shipping: true,
    };
    validation = await meliService.validateItem(req.user.id, payload);
  }
  const validationWarnings = (validation.warnings || [])
    .map((warningItem) => warningItem.message || warningItem.code)
    .filter(Boolean);

  const meliItem = await meliService.createItem(req.user.id, payload);

  if (publishGtin && publishGtin !== product.gtin) {
    await prisma.product.update({
      where: { id: product.id },
      data: { gtin: publishGtin },
    });
  }

  const now = new Date();
  const rawData = {
    ...meliItem,
    tecnotitlan: {
      publishedAt: now.toISOString(),
      inventorySource: product.productType === 'SUPPLIER_ON_DEMAND'
        ? 'SUPPLIER_ON_DEMAND'
        : 'LOCAL_ASSIGNED_STOCK',
      assignedStock: Number(listing.publishedStock || 0),
      stockBuffer: Number(listing.stockBuffer || 0),
      publishedStock: stockToPublish,
      pricing,
      validationWarnings,
      shipping: payload.shipping || null,
    },
  };

  let updatedProduct;
  try {
    updatedProduct = await prisma.$transaction(async (tx) => {
      const savedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          meliItemId: meliItem.id,
          meliPublicationUrl: meliItem.permalink || null,
          lastMeliSync: now,
        },
      });

      await tx.marketplaceListing.update({
        where: { id: listing.id },
        data: {
          externalProductId: meliItem.id,
          externalSku: product.sku,
          title: meliItem.title || familyName || product.name || product.sku,
          price: Number(meliItem.price ?? pricing.recommendedPrice),
          status: 'ACTIVE',
          syncStatus: 'SYNCED_TO_MELI',
          lastSyncedAt: now,
          rawData,
        },
      });

      return savedProduct;
    });
  } catch (error) {
    logger.error(
      `[Meli Publish] Mercado Libre creo ${meliItem.id}, pero no se pudo guardar el vinculo local: ${error.message}`
    );
    throw new BadRequestError(
      `Mercado Libre creo la publicacion ${meliItem.id}, pero Tecnotitlan no pudo guardar el vinculo. No vuelvas a publicar: usa la opcion avanzada para vincular ese ID.`
    );
  }

  let warning = [
    validationWarnings.length > 0
      ? `Mercado Libre publico con advertencias: ${validationWarnings.join('; ')}.`
      : null,
    pictureWarnings.length > 0
      ? `${pictureWarnings.length} imagen(es) se omitieron por resolucion insuficiente o error de carga.`
      : null,
  ].filter(Boolean).join(' ') || null;
  try {
    await meliService.createItemDescription(req.user.id, meliItem.id, product.description);
  } catch (error) {
    warning = [
      warning,
      `La publicacion ${meliItem.id} fue creada y vinculada, pero Mercado Libre rechazo la descripcion: ${error.message}`,
    ].filter(Boolean).join(' ');
    logger.warn(`[Meli Publish] ${warning}`);
  }

  res.status(201).json({
    status: 'success',
    message: `Producto publicado con ${stockToPublish} pieza(s) ofertadas en Mercado Libre.`,
    data: {
      product: updatedProduct,
      item: meliItem,
      assignedStock: Number(listing.publishedStock || 0),
      publishedStock: stockToPublish,
      warning,
    },
  });
});

const createProductReview = asyncHandler(async (req, res, next) => {
  const { rating, comment } = req.body;
  const normalizedRating = Number(rating);
  const normalizedComment = String(comment || '').trim();

  if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    return next(new BadRequestError('La calificacion debe ser un numero entero entre 1 y 5.'));
  }

  if (normalizedComment.length < 3 || normalizedComment.length > 1000) {
    return next(new BadRequestError('La opinion debe tener entre 3 y 1000 caracteres.'));
  }

  const product = await prisma.product.findUnique({ where: { sku: req.params.sku.toUpperCase() } });

  if (!product) {
    return next(new NotFoundError('Producto no encontrado'));
  }

  const alreadyReviewed = await prisma.review.findFirst({
    where: { productId: product.id, userId: req.user.id },
  });
  if (alreadyReviewed) {
    return next(new BadRequestError('Ya has calificado este producto.'));
  }

  const hasEligiblePurchase = await hasEligiblePurchaseForReview({
    prismaClient: prisma,
    userId: req.user.id,
    productId: product.id,
  });
  if (!hasEligiblePurchase) {
    return next(new BadRequestError(
      'Solo los clientes con una compra pagada de este producto pueden dejar una resena.',
    ));
  }

  let review;
  try {
    review = await prisma.review.create({
      data: {
        name: req.user.name,
        rating: normalizedRating,
        comment: normalizedComment,
        userId: req.user.id,
        productId: product.id,
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return next(new BadRequestError('Ya has calificado este producto.'));
    }
    throw error;
  }

  // Recalcular el rating promedio y el número de reseñas del producto
  const stats = await prisma.review.aggregate({
    where: { productId: product.id },
    _avg: { rating: true },
    _count: { id: true },
  });

  await prisma.product.update({
    where: { id: product.id },
    data: {
      rating: stats._avg.rating || 0,
      numReviews: stats._count.id || 0,
    },
  });

  res.status(201).json({
    status: 'success',
    message: 'Reseña añadida correctamente',
    data: { review },
  });
});

/**
 * @desc    Get products with the most stock
 * @route   GET /api/products/most-stock
 * @access  Public
 */
const getMostStockedProducts = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({
    where: { isArchived: false },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      sku: true,
      name: true,
      price: true,
      countInStock: true,
      productType: true,
      supplierStock: true,
      supplierStockUnlimited: true,
      supplierLeadTimeMinutes: true,
      media: { take: 1 },
    },
  });
  const availableProducts = products
    .map(decorateProductAvailability)
    .filter((product) => {
      const available = getProductAvailableStock(product);
      return available === null || available > 0;
    })
    .sort((left, right) => {
      if (left.availableStock === null) return -1;
      if (right.availableStock === null) return 1;
      return right.availableStock - left.availableStock;
    })
    .slice(0, 5);

  res.status(200).json({
    status: 'success',
    data: { products: availableProducts },
  });
});

/**
 * @desc    Get top selling products
 * @route   GET /api/products/top
 * @access  Public
 */
const getTopProducts = asyncHandler(async (req, res) => {
  // Esta consulta es más compleja en Prisma y a menudo se resuelve con una consulta raw
  // o agrupando en la aplicación. Aquí una aproximación con `groupBy`.
  const topItems = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: { order: { isPaid: true } },
    _sum: { qty: true },
    orderBy: { _sum: { qty: 'desc' } },
    take: 5,
  });

  const productIds = topItems.map(item => item.productId);

  const topProducts = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isArchived: false,
    },
    // No se puede ordenar por `totalSold` directamente aquí. Se ordena en la app.
  });

  res.status(200).json({
    status: 'success',
    data: { products: topProducts.map(decorateProductAvailability) },
  });
});

/**
 * @desc    Delete a product review
 * @route   DELETE /api/products/:sku/reviews/:reviewId
 * @access  Private/Admin
 */
const deleteProductReview = asyncHandler(async (req, res, next) => {
  const { sku, reviewId } = req.params;

  const product = await prisma.product.findUnique({ where: { sku: sku.toUpperCase() } });
  if (!product) {
    return next(new NotFoundError('Producto no encontrado'));
  }

  try {
    await prisma.review.delete({ where: { id: reviewId } });

    // Recalcular stats después de eliminar
    const stats = await prisma.review.aggregate({
      where: { productId: product.id },
      _avg: { rating: true },
      _count: { id: true },
    });

    await prisma.product.update({
      where: { id: product.id },
      data: {
        rating: stats._avg.rating || 0,
        numReviews: stats._count.id || 0,
      },
    });

    res.status(200).json({ status: 'success', message: 'Reseña eliminada' });
  } catch (error) {
    if (error.code === 'P2025') {
      return next(new NotFoundError('Reseña no encontrada'));
    }
    next(error);
  }
});

/**
 * @desc    Exportar productos a CSV
 * @route   GET /api/products/export/csv
 * @access  Private/Admin
 */
const exportProductsToCSV = asyncHandler(async (req, res, next) => {
  logger.info('[ProductCtrl] Exportando productos a CSV');
  const { keyword, category: categorySlug, sortBy } = req.query;

  // 1. Reutilizar la lógica de filtrado y ordenamiento de getProducts
  const filter = {};
  if (keyword) {
    filter.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { sku: { contains: keyword, mode: 'insensitive' } },
    ];
  }

  if (categorySlug) {
    const categoryDoc = await prisma.category.findUnique({ where: { slug: categorySlug } });
    if (categoryDoc) {
      filter.categoryId = categoryDoc.id;
    } else {
      return res.status(200).send(''); // Enviar CSV vacío si la categoría no existe
    }
  }

  const sortOptions = {};
  if (sortBy) {
    const [field, order] = sortBy.split('_');
    if (['price', 'countInStock', 'createdAt'].includes(field) && ['asc', 'desc'].includes(order)) {
      sortOptions[field] = order;
    }
  } else {
    sortOptions.createdAt = 'desc';
  }

  // 2. Obtener todos los productos que coinciden, sin paginación
  const products = await prisma.product.findMany({
    where: filter,
    include: { category: { select: { name: true } } },
    orderBy: sortOptions,
  });

  // 3. Construir el CSV
  const csvFields = ['SKU', 'Nombre', 'Precio', 'Costo', 'Categoría', 'Stock', 'Marca', 'Descripción'];
  const csvHeader = csvFields.join(',');

  const csvRows = products.map(product => {
    const escapeCsvField = (field) => {
      if (field === null || field === undefined) return '';
      const stringField = String(field);
      if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
      }
      return stringField;
    };
    return [
      escapeCsvField(product.sku),
      escapeCsvField(product.name),
      product.price,
      product.costPrice,
      escapeCsvField(product.category ? product.category.name : 'Sin categoría'),
      product.countInStock,
      escapeCsvField(product.brand),
      escapeCsvField(product.description)
    ].join(',');
  }); // <-- Este paréntesis estaba en la línea incorrecta

  const csvString = [csvHeader, ...csvRows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="productos.csv"');
  res.status(200).send(csvString);
});

/**
 * @desc    Actualizar productos en lote
 * @route   PUT /api/products/bulk-update
 * @access  Private/Admin
 */
const bulkUpdateProducts = asyncHandler(async (req, res, next) => {
  const { productIds, updates } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return next(new BadRequestError('Se requiere un array de IDs de productos.'));
  }
  if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
    return next(new BadRequestError('Se requieren los datos a actualizar.'));
  }

  // Filtrar los campos permitidos para la actualización en lote para seguridad
  const allowedUpdates = {};
  if (updates.categoryId) {
    allowedUpdates.categoryId = updates.categoryId;
  }
  // Añadir más campos permitidos aquí

  if (Object.keys(allowedUpdates).length === 0) {
    return next(new BadRequestError('No se proporcionaron campos válidos para actualizar.'));
  }

  const result = await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data: allowedUpdates,
  });

  res.status(200).json({
    status: 'success',
    message: `${result.count} productos actualizados correctamente.`,
    data: result,
 });
});

export {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  archiveProduct,
  unarchiveProduct,
  permanentlyDeleteProduct,
  updateProductStock, // Exportar la nueva función
  getProductStockLevels,
  getLowStockProducts,
  countProducts,
  linkProductToMeli, // Exportar la nueva función
  publishProductToMeli,
  createProductReview,
  deleteProductReview,
  getTopProducts,
  getMostStockedProducts,
  exportProductsToCSV,
  bulkUpdateProducts,
};
