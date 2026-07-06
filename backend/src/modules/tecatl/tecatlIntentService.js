const normalizeText = (value = '') =>
  value
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const intentRules = [
  {
    intent: 'saludo',
    terms: ['hola', 'buen dia', 'buenas', 'hey', 'que tal'],
  },
  {
    intent: 'consultar_pedido',
    terms: ['pedido', 'orden', 'rastreo', 'guia', 'donde esta', 'seguimiento'],
  },
  {
    intent: 'garantia_devolucion',
    terms: ['garantia', 'devolucion', 'cambio', 'reembolso', 'fallo', 'defecto'],
  },
  {
    intent: 'envio_tiempo',
    terms: ['envio', 'envian', 'llega', 'tiempo de entrega', 'paqueteria'],
  },
  {
    intent: 'hablar_humano',
    terms: ['asesor', 'humano', 'persona', 'alguien', 'vendedor', 'atencion'],
  },
  {
    intent: 'comparar_productos',
    terms: ['comparar', 'diferencia', 'mejor que', 'versus', 'vs'],
  },
  {
    intent: 'recomendar_kit',
    terms: ['kit', 'paquete', 'combo', 'conjunto'],
  },
  {
    intent: 'recomendar_producto',
    terms: ['recomienda', 'recomendacion', 'conviene', 'cual compro', 'que compro', 'busco'],
  },
  {
    intent: 'buscar_producto',
    terms: ['precio', 'stock', 'tienes', 'venden', 'producto', 'auricular', 'audifono', 'powerbank', 'cable', 'drone', 'cargador', 'bocina', 'reloj'],
  },
];

const classifyIntent = (message = '') => {
  const normalized = normalizeText(message);

  const matched = intentRules.find((rule) =>
    rule.terms.some((term) => normalized.includes(normalizeText(term)))
  );

  return matched?.intent || 'pregunta_general';
};

export { classifyIntent, normalizeText };
