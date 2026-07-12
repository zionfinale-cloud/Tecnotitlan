import prisma from '../../config/prisma.js';
import { normalizeText } from './tecatlIntentService.js';

const stopWords = new Set([
  'hola',
  'voy',
  'vas',
  'van',
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
  'son',
  'tiene',
  'trae',
  'incluye',
  'tipo',
]);

const intentTermMap = {
  viaje: ['viaje', 'viajar', 'viajero', 'viajera', 'powerbank', 'bateria', 'cable', 'cargador', 'audifonos', 'auriculares', 'audio'],
  viajar: ['viaje', 'viajar', 'viajero', 'viajera', 'powerbank', 'bateria', 'cable', 'cargador', 'audifonos', 'auriculares', 'audio'],
  bateria: ['bateria', 'powerbank', 'energia', 'carga', 'cargador', 'cable', 'usb-c', 'tipo-c'],
  cargar: ['bateria', 'powerbank', 'energia', 'carga', 'cargador', 'cable', 'usb-c', 'tipo-c'],
  carga: ['bateria', 'powerbank', 'energia', 'carga', 'cargador', 'cable', 'usb-c', 'tipo-c'],
  usbc: ['usb-c', 'usb c', 'tipo c', 'type c', 'cargador', 'cable'],
  usb: ['usb-c', 'usb c', 'tipo c', 'type c', 'cargador', 'cable'],
  compatible: ['compatibilidad', 'compatible', 'usb-c', 'bluetooth', 'android', 'iphone'],
  musica: ['audio', 'audifonos', 'auriculares', 'bocina', 'bluetooth'],
  llamadas: ['audio', 'audifonos', 'auriculares', 'microfono', 'bluetooth'],
  gaming: ['gaming', 'control', 'consola', 'hdmi', 'juego'],
  regalo: ['regalo', 'premium', 'util', 'practico'],
  coche: ['auto', 'coche', 'carro', 'cargador', 'cable'],
  carro: ['auto', 'coche', 'carro', 'cargador', 'cable'],
};

const extractSearchTerms = (message = '') => {
  const normalized = normalizeText(message).replace(/[^a-z0-9\s-]/g, ' ');
  const baseTerms = normalized
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word))
    .slice(0, 6);

  const expandedTerms = baseTerms.flatMap((term) => [term, ...(intentTermMap[term] || [])]);
  return [...new Set(expandedTerms)].slice(0, 12);
};

const normalizeToken = (value = '') => normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim();

const internalCharacteristicKeys = new Set([
  'etiquetas tecatl',
  'etiqueta tecatl',
  'tags tecatl',
  'tecatl tags',
]);

const isInternalCharacteristic = (item = {}) => internalCharacteristicKeys.has(normalizeToken(item.key));

const toCharacteristic = (item) => ({
  key: item.key,
  value: item.value,
});

const getPublicCharacteristics = (product) => (product.characteristics || [])
  .filter((item) => !isInternalCharacteristic(item))
  .slice(0, 4);

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
  characteristics: product.characteristics?.map(toCharacteristic) || [],
  publicCharacteristics: getPublicCharacteristics({
    characteristics: product.characteristics?.map(toCharacteristic) || [],
  }),
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
        {
          characteristics: {
            some: {
              OR: [
                { key: { contains: term, mode: 'insensitive' } },
                { value: { contains: term, mode: 'insensitive' } },
              ],
            },
          },
        },
      ]),
    } : {}),
  };

  const products = await prisma.product.findMany({
    where,
    include: {
      category: { select: { name: true, slug: true } },
      media: { take: 1, select: { url: true, altText: true } },
      characteristics: true,
    },
    orderBy: [
      { countInStock: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });

  return products.map(toPublicProduct);
};

const findProductsBySkus = async (skus = []) => {
  const uniqueSkus = [...new Set(skus.filter(Boolean).map((sku) => sku.toUpperCase()))];
  if (!uniqueSkus.length) return [];

  const products = await prisma.product.findMany({
    where: {
      sku: { in: uniqueSkus },
      isArchived: false,
    },
    include: {
      category: { select: { name: true, slug: true } },
      media: { take: 1, select: { url: true, altText: true } },
      characteristics: true,
    },
    take: 5,
  });

  return products.map(toPublicProduct);
};

const productKnowledgeText = (product) => [
  product.name,
  product.sku,
  product.description,
  product.category,
  ...(product.characteristics || []).flatMap((item) => [item.key, item.value]),
].filter(Boolean).map(normalizeToken).join(' ');

const hasAny = (text, terms) => terms.some((term) => text.includes(normalizeToken(term)));

const buildProductDetailAnswer = (message = '', product) => {
  if (!product) return null;

  const normalizedMessage = normalizeToken(message);
  const knowledge = productKnowledgeText(product);

  const asksConnector = hasAny(normalizedMessage, ['tipo c', 'usb c', 'usb-c', 'type c']);
  const asksCharge = hasAny(normalizedMessage, ['carga', 'cargar', 'cargador', 'entrada', 'conector']);
  const asksBluetooth = hasAny(normalizedMessage, ['bluetooth', 'inalambrico', 'inalambricos']);
  const asksCompatibility = hasAny(normalizedMessage, ['compatible', 'compatibilidad', 'iphone', 'android']);

  if (asksConnector || asksCharge) {
    if (hasAny(knowledge, ['usb c', 'usb-c', 'tipo c', 'type c'])) {
      return `Si, segun la ficha registrada de ${product.name}, maneja carga USB-C / Tipo C.`;
    }
    if (asksConnector) {
      return `En la ficha de ${product.name} no tengo registrado que sea USB-C / Tipo C. Te lo confirmo con un asesor antes de que compres para no darte un dato incorrecto.`;
    }
  }

  if (asksBluetooth && hasAny(knowledge, ['bluetooth', 'inalambrico', 'inalambricos', 'wireless'])) {
    return `Si, ${product.name} aparece como producto inalambrico/Bluetooth en la ficha registrada.`;
  }

  if (asksCompatibility) {
    const publicSpecs = product.publicCharacteristics?.length
      ? product.publicCharacteristics.map((item) => `${item.key}: ${item.value}`).join(', ')
      : product.description;
    return `De ${product.name} tengo registrado esto: ${publicSpecs}. Si buscas compatibilidad con un modelo exacto, dime cual y lo reviso contigo.`;
  }

  return null;
};

const buildProductRecommendationText = (products = []) => {
  if (!products.length) {
    return 'Por ahora no encontre un producto exacto con esa descripcion. Puedo pasarte con un asesor para revisar opciones o buscarlo por categoria.';
  }

  const lines = products.map((product, index) => {
    const stockText = product.countInStock > 0 ? `disponible (${product.countInStock} pza.)` : 'sin stock por ahora';
    const specs = product.publicCharacteristics?.length
      ? ` Caracteristicas: ${product.publicCharacteristics.map((item) => `${item.key}: ${item.value}`).join(', ')}.`
      : '';
    return `${index + 1}. ${product.name} (${product.sku}) - $${product.price.toFixed(2)} MXN, ${stockText}.${specs}`;
  });

  return `Claro. Con lo que me dices, estas opciones de Tecnotitlan te pueden servir:\n${lines.join('\n')}\n\nSi quieres, te ayudo a elegir segun uso, presupuesto o compatibilidad.`;
};

export {
  buildProductDetailAnswer,
  buildProductRecommendationText,
  findProductsBySkus,
  searchProductsForMessage,
};
