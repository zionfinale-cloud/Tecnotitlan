const normalizeText = (value = '') =>
  value
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const intentRules = [
  {
    intent: 'saludo',
    terms: [
      'hola', 'buen dia', 'buenas', 'hey', 'que tal', 'saludos', 
      'buenos dias', 'buenas tardes', 'buenas noches', 'onda', 'que transa'
    ],
    priority: 1, // El saludo tiene la prioridad más baja para que no eclipse otras intenciones en la misma frase
  },
  {
    intent: 'consultar_pedido',
    terms: [
      'pedido', 'orden', 'rastreo', 'guia', 'donde esta', 'seguimiento', 
      'mi compra', 'mi paquete', 'estatus', 'status', 'mi pedido'
    ],
    priority: 5,
  },
  {
    intent: 'garantia_devolucion',
    terms: [
      'garantia', 'devolucion', 'cambio', 'reembolso', 'fallo', 'defecto', 
      'roto', 'danado', 'no sirve', 'descompuesto', 'reparacion', 'defectuoso'
    ],
    priority: 5,
  },
  {
    intent: 'envio_tiempo',
    terms: [
      'envio', 'envian', 'llega', 'tiempo de entrega', 'paqueteria', 
      'cobertura', 'costo de envio', 'paquete', 'flete', 'correo', 
      'estafeta', 'dhl', 'fedex', 'mexpost', 'paquetexpress'
    ],
    priority: 5,
  },
  {
    intent: 'hablar_humano',
    terms: [
      'asesor', 'humano', 'persona', 'alguien', 'vendedor', 'atencion', 
      'soporte', 'ayuda humana', 'hablar con un humano', 'asistencia', 
      'contacto', 'hablar con alguien', 'chat con humano'
    ],
    priority: 10, // Prioridad alta: si el usuario pide explícitamente un humano, transferir de inmediato
  },
  {
    intent: 'comparar_productos',
    terms: ['comparar', 'diferencia', 'mejor que', 'versus', 'vs', 'comparativa'],
    priority: 5,
  },
  {
    intent: 'recomendar_kit',
    terms: ['kit', 'paquete', 'combo', 'conjunto', 'bundles', 'paquetes'],
    priority: 5,
  },
  {
    intent: 'recomendar_producto',
    terms: [
      'recomienda', 'recomendacion', 'conviene', 'cual compro', 
      'que compro', 'busco', 'sugerencia', 'cual me recomiendas'
    ],
    priority: 5,
  },
  {
    intent: 'buscar_producto',
    terms: [
      'precio', 'stock', 'tienes', 'venden', 'producto', 'auricular', 
      'audifono', 'powerbank', 'cable', 'drone', 'cargador', 'bocina', 
      'reloj', 'audifonos', 'bocinas', 'cargadores', 'cables', 'drones', 
      'relojes', 'costo', 'en cuanto', 'cuanto cuesta', 'cuanto sale', 'comprar'
    ],
    priority: 3,
  },
  {
    intent: 'metodo_pago',
    terms: [
      'pago', 'pagar', 'metodos de pago', 'tarjeta', 'paypal', 'stripe', 
      'spei', 'transferencia', 'oxxo', 'efectivo', 'credito', 'debito', 
      'deposito', 'como pago', 'puedo pagar'
    ],
    priority: 5,
  },
  {
    intent: 'informacion_tienda',
    terms: [
      'tienda', 'ubicacion', 'donde estan', 'donde quedan', 'sucursal', 
      'fisica', 'direccion', 'donde se ubican', 'donde comprar', 'visitar', 
      'local', 'donde estan ubicados'
    ],
    priority: 5,
  },
  {
    intent: 'facturacion',
    terms: [
      'factura', 'facturan', 'facturacion', 'cfdi', 'datos fiscales', 
      'xml', 'pdf de factura', 'mi factura', 'requiero factura'
    ],
    priority: 5,
  }
];

const classifyIntent = (message = '') => {
  const normalized = normalizeText(message);
  
  let bestIntent = 'pregunta_general';
  let highestScore = 0;

  for (const rule of intentRules) {
    let matchesCount = 0;
    
    for (const term of rule.terms) {
      const normalizedTerm = normalizeText(term);
      if (normalized.includes(normalizedTerm)) {
        // Asigna mayor puntuación si es una palabra completa o frase exacta para evitar falsos positivos
        const isWordMatch = new RegExp(`\\b${normalizedTerm}\\b`, 'i').test(normalized);
        matchesCount += isWordMatch ? 2 : 1;
      }
    }

    if (matchesCount > 0) {
      const score = matchesCount * (rule.priority || 1);
      if (score > highestScore) {
        highestScore = score;
        bestIntent = rule.intent;
      }
    }
  }

  return bestIntent;
};

export { classifyIntent, normalizeText };
