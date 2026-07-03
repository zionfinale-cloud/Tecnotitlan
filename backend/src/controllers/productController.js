// backend/src/controllers/productController.js @productController.js
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js'; // Importar la instancia única de Prisma
import { NotFoundError, BadRequestError } from '../utils/errorUtils.js';
import * as meliService from '../services/mercadoLibreService.js';
import logger from '../utils/logger.js';

// @desc    Crear un nuevo producto
// @route   POST /api/products
// @access  Private/Admin (now wrapped with asyncHandler)
const createProduct = asyncHandler(async (req, res, next) => {
  logger.info('[ProductCtrl] Intentando crear un nuevo producto');
  const { name, description, price, brand, categoryId, countInStock, media, costPrice, characteristics, productType, supplierInfo, youtubeUrl } = req.body;

  // --- Generación de SKU ---
  // 1. Obtener prefijo de la categoría desde la BD
  let categoryPrefix = 'GEN'; // Prefijo genérico por defecto
  const createdProduct = await prisma.$transaction(async (tx) => {
    if (categoryId) {
      const category = await tx.category.findUnique({ where: { id: categoryId } });
      if (category) {
        categoryPrefix = category.slug.toUpperCase();
      }
    }

    // 2. Obtener el siguiente número de la secuencia para productos
    const counter = await tx.counter.upsert({
      where: { id: 'productSku' },
      update: { sequenceValue: { increment: 1 } },
      create: { id: 'productSku', sequenceValue: 1 },
    });

    // 3. Formatear el número con ceros a la izquierda (ej: 1 -> "0001")
    const formattedSeq = counter.sequenceValue.toString().padStart(4, '0');

    // 4. Crear el SKU
    const generatedSku = `${categoryPrefix}-${formattedSeq}`;

    // 5. Crear el producto
    return tx.product.create({
      data: {
        userId: req.user.id,
        sku: generatedSku,
        name,
        description,
        price: parseFloat(price), // Convertir a número
        costPrice: costPrice ? parseFloat(costPrice) : null, // Convertir a número, si existe
        brand,
        categoryId,
        countInStock: parseInt(countInStock, 10), // Convertir a número entero
        productType: productType || 'IN_HOUSE', // Usar enums de Prisma
        supplierInfo,
        youtubeUrl,
        // media y characteristics se manejan como relaciones separadas
      },
    });
  });

  res.status(201).json({ status: 'success', data: { product: createdProduct } });
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

  res.status(200).json({
    status: 'success',
    data: {
      products,
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
      reviews: { include: { user: { select: { firstName: true, lastName: true } } } },
      category: { select: { id: true, name: true } },
    },
  });

  if (product) {
    res.status(200).json({ status: 'success', data: { product } });
  } else {
    return next(new NotFoundError('Producto no encontrado'));
  }
});

// @desc    Actualizar un producto por SKU
// @route   PUT /api/products/:sku
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res, next) => {
  logger.info(`[ProductCtrl] Actualizando producto con SKU: ${req.params.sku}`);
  const { name, description, price, countInStock, categoryId, costPrice, youtubeUrl, brand, productType, supplierInfo } = req.body;
  const product = await prisma.product.findUnique({ where: { sku: req.params.sku.toUpperCase() } });

  if (product) {
    const updatedProduct = await prisma.product.update({
      where: { sku: req.params.sku.toUpperCase() },
      data: {
        name,
        description,
        price: parseFloat(price),
        countInStock: parseInt(countInStock, 10),
        categoryId,
        costPrice: costPrice === '' || costPrice === undefined || costPrice === null ? null : parseFloat(costPrice),
        brand,
        productType: productType || product.productType,
        supplierInfo,
        youtubeUrl,
        // media y characteristics se actualizan por separado
      },
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
    const updatedProduct = await prisma.product.update({
      where: { id: req.params.id },
      data: { countInStock },
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
  const { id: productId } = req.params;
  const userId = req.user.id;

  if (!meliItemId) {
    return next(new BadRequestError('Se requiere el ID del artículo de Mercado Libre (meliItemId).'));
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return next(new NotFoundError('Producto no encontrado'));
  }

  // Validar que el item de Meli existe y pertenece al usuario
  const meliItem = await meliService.getItem(userId, meliItemId); // Este servicio debe seguir funcionando
  if (!meliItem) {
    return next(new NotFoundError(`El artículo de Mercado Libre con ID ${meliItemId} no se encontró o no tienes acceso a él.`));
  }

  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: {
      meliItemId: meliItem.id,
      meliPublicationUrl: meliItem.permalink,
    },
  });

  res.status(200).json({ status: 'success', data: { product: updatedProduct } });
});

/**
 * @desc    Crear una nueva reseña
 * @route   POST /api/products/:sku/reviews
 * @access  Private
 */
const createProductReview = asyncHandler(async (req, res, next) => {
  const { rating, comment } = req.body;
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

  // Opcional: Verificar si el usuario compró el producto.
  // const order = await prisma.order.findFirst({
  //   where: {
  //     userId: req.user.id,
  //     isPaid: true,
  //     orderItems: { some: { productId: product.id } },
  //   },
  // });
  // if (!order) {
  //   return next(new BadRequestError('Solo los clientes que compraron este producto pueden dejar una reseña.'));
  // }

  const review = await prisma.review.create({
    data: {
      name: req.user.name, // Esto ahora funcionará gracias al cambio en authMiddleware
      rating: Number(rating),
      comment,
      userId: req.user.id,
      productId: product.id,
    },
  });

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
    where: { isArchived: false, countInStock: { gt: 0 } },
    orderBy: { countInStock: 'desc' },
    take: 5,
    select: {
      sku: true,
      name: true,
      price: true,
      media: { take: 1 },
    },
  });

  res.status(200).json({
    status: 'success',
    data: { products },
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
    data: { products: topProducts },
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
  createProductReview,
  deleteProductReview,
  getTopProducts,
  getMostStockedProducts,
  exportProductsToCSV,
  bulkUpdateProducts,
};
