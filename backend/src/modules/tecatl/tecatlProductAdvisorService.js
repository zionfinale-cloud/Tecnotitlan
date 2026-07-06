import prisma from '../../config/prisma.js';
import { normalizeText } from './tecatlIntentService.js';

const stopWords = new Set([
  'hola',
  'busco',
  'quiero',
  'necesito',
  'precio',
  'stock',
  'tienes',
  'para',
  'con',
  'que',
  'cual',
  'me',
  'recomienda',
  'recomendacion',
  'producto',
  'comprar',
  'comprarme',
]);

const extractSearchTerms = (message = '') => {
  const normalized = normalizeText(message).replace(/[^a-z0-9\s-]/g, ' ');
  return normalized
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word))
    .slice(0, 6);
};

const toPublicProduct = (product) => ({
  id: product.id,
  sku: product.sku,
  name: product.name,
  description: product.description,
  price: product.price,
  countInStock: product.countInStock,
  category: product.category?.name || null,
  image: product.media?.[0]?.url || null,
  url: `/product/${product.sku}`,
  characteristics: product.characteristics?.slice(0, 4).map((item) => ({
    key: item.key,
    value: item.value,
  })) || [],
});

const searchProductsForMessage = async (message = '', limit = 3) => {
  const terms = extractSearchTerms(message);
  const where = {
    isArchived: false,
    ...(terms.length ? {
      OR: terms.flatMap((term) => [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { brand: { contains: term, mode: 'insensitive' } },
        { category: { name: { contains: term, mode: 'insensitive' } } },
      ]),
    } : {}),
  };

  const products = await prisma.product.findMany({
    where,
    include: {
      category: { select: { name: true, slug: true } },
      media: { take: 1, select: { url: true, altText: true } },
      characteristics: { take: 6 },
    },
    orderBy: [
      { countInStock: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });

  return products.map(toPublicProduct);
};

const buildProductRecommendationText = (products = []) => {
  if (!products.length) {
    return 'Por ahora no encontre un producto exacto con esa descripcion. Puedo pasarte con un asesor para revisar opciones o buscarlo por categoria.';
  }

  const lines = products.map((product, index) => {
    const stockText = product.countInStock > 0 ? `disponible (${product.countInStock} pza.)` : 'sin stock por ahora';
    const specs = product.characteristics.length
      ? ` Caracteristicas: ${product.characteristics.map((item) => `${item.key}: ${item.value}`).join(', ')}.`
      : '';
    return `${index + 1}. ${product.name} (${product.sku}) - $${product.price.toFixed(2)} MXN, ${stockText}.${specs}`;
  });

  return `Claro. Con lo que me dices, estas opciones de Tecnotitlan te pueden servir:\n${lines.join('\n')}\n\nSi quieres, te ayudo a elegir segun uso, presupuesto o compatibilidad.`;
};

export { buildProductRecommendationText, searchProductsForMessage };
