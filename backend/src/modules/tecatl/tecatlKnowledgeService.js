import prisma from '../../config/prisma.js';
import { normalizeText } from './tecatlIntentService.js';

const getRelevantKnowledge = async (intent, message) => {
  const normalized = normalizeText(message);
  const categoryByIntent = {
    garantia_devolucion: 'garantias',
    envio_tiempo: 'envios',
    metodo_pago: 'pagos',
    informacion_tienda: 'tienda',
    facturacion: 'facturacion',
  };

  const where = {
    isActive: true,
    OR: [],
  };

  if (categoryByIntent[intent]) {
    where.OR.push({ category: categoryByIntent[intent] });
  }

  const possibleTags = [
    'garantia', 'devolucion', 'envio', 'guia', 'rastreo', 
    'compatibilidad', 'pago', 'pagar', 'tienda', 'factura', 'facturacion'
  ];
  const tags = possibleTags.filter((tag) => normalized.includes(tag));
  if (tags.length) {
    where.OR.push({ tags: { hasSome: tags } });
  }

  if (!where.OR.length) {
    delete where.OR;
  }

  return prisma.knowledgeArticle.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 3,
  });
};

export { getRelevantKnowledge };
