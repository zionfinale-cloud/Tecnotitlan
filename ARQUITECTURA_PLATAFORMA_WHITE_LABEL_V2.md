# Arquitectura objetivo: plataforma white-label V2

Fecha: 15 de junio de 2026

## Decision

Construir una V2 limpia del nucleo de negocio, conservando como referencia los
componentes visuales, flujos y conocimiento funcional de Tecnotitlan.

No conviene seguir agregando parches al esquema actual para convertirlo en
multi-tienda. Tampoco conviene borrar todo y comenzar sin aprovechar lo aprendido.

## Objetivo real

La plataforma debe permitir operar varias tiendas independientes desde el mismo
sistema:

- Tecnotitlan.
- Tienda del padre del propietario.
- Futuras tiendas y nichos.

Cada tienda debe tener dominio, identidad, productos, inventario, usuarios,
permisos, pedidos, integraciones y automatizaciones aislados.

## Modelo multi-tenant

Toda entidad de negocio debe pertenecer a una tienda mediante `storeId`.

Modelos principales:

- `Store`: nombre, slug, dominios, moneda, zona horaria y estado.
- `StoreTheme`: logo, favicon, colores, tipografias y configuracion visual.
- `PageSection`: hero, banners, colecciones y contenido configurable.
- `User`: identidad global de una persona.
- `StoreMembership`: relacion usuario-tienda y rol dentro de esa tienda.
- `Role`, `Permission`, `RolePermission`: permisos definidos por tienda.
- `Product`, `Variant`, `Category`, `Media`.
- `Warehouse`: almacen propio, proveedor o fulfillment externo.
- `InventoryItem`: existencias por variante y almacen.
- `InventoryMovement`: entradas, ventas, ajustes, devoluciones y reservas.
- `SalesChannel`: web, Mercado Libre, Amazon o TikTok Shop.
- `ChannelListing`: publicacion de una variante en un canal.
- `Order`, `OrderItem`, `OrderStatusHistory`.
- `IntegrationConnection`: conexion por tienda y canal.
- `OutboxEvent`: eventos confiables para automatizaciones.

## White-label

Los componentes del storefront no deben conocer a Tecnotitlan. Deben consumir un
objeto de configuracion de tienda:

```json
{
  "brand": {
    "name": "Tecnotitlan",
    "logoUrl": "...",
    "colors": {},
    "fonts": {}
  },
  "home": {
    "sections": [
      { "type": "hero", "props": {} },
      { "type": "featuredProducts", "props": {} }
    ]
  }
}
```

El panel administrativo debe permitir editar y previsualizar esta configuracion.

## Permisos

Los permisos deben tener formato `recurso:accion`, aplicados dentro de una tienda.

Ejemplos:

- `orders:read`, `orders:update_status`, `orders:refund`
- `customers:read`, `customers:update`
- `products:read`, `products:create`, `products:update`
- `inventory:read`, `inventory:adjust`, `inventory:transfer`
- `reports:sales`, `reports:profit`
- `integrations:read`, `integrations:manage`
- `staff:read`, `staff:manage`
- `storefront:manage`

Roles iniciales recomendados:

- Propietario: acceso total.
- Administrador: operacion completa sin propiedad/facturacion.
- Ventas: clientes, pedidos y seguimiento.
- Almacen: inventario, surtido y envio.
- Catalogo: productos, categorias y publicaciones.
- Soporte: lectura de pedidos y comunicacion, sin costos ni configuracion.

El backend siempre aplica permisos. El frontend solo oculta opciones para mejorar
la experiencia; nunca es la barrera de seguridad.

## Inventario omnicanal

`countInStock` no es suficiente. Se necesita un libro de movimientos:

- Existencia fisica.
- Cantidad reservada por pedidos pendientes.
- Cantidad disponible para vender.
- Stock de seguridad.
- Punto de reorden por variante/almacen.
- Cantidad publicada por canal.

Cuando Amazon reporte que quedan 3 unidades, la integracion registra el movimiento
y publica un evento `inventory.low_stock`. n8n recibe el evento y envia avisos,
crea tareas o solicita reabasto. n8n automatiza; la API sigue siendo la fuente de
verdad.

## Seguimiento de pedidos

Cada cambio genera un evento y un historial:

```text
order.created
payment.confirmed
order.ready_to_fulfill
order.shipped
shipment.delayed
order.delivered
customer.follow_up_due
```

n8n consume estos eventos para WhatsApp, correo, alertas y tareas. Los eventos
deben salir mediante un patron outbox para evitar perder avisos si n8n esta caido.

## Secretos y archivos `.env`

Mover secretos a `env.js` no los hace seguros.

- Un `env.js` versionado expone los secretos en Git.
- Toda variable incluida en React termina visible en el navegador.
- `.env` solo es apropiado para desarrollo local y nunca debe versionarse.
- En produccion, usar el gestor de secretos del proveedor de hosting.
- Las credenciales de cada tienda deben guardarse cifradas o en un vault; nunca
  deben devolverse al frontend.
- La base de datos puede guardar configuracion no sensible y referencias a secretos.

## Estrategia de construccion

1. Congelar nuevas integraciones en la version actual.
2. Diseñar esquema multi-tenant V2 y contratos de API.
3. Construir autenticacion, membresias y RBAC con pruebas.
4. Construir catalogo e inventario por almacenes/movimientos.
5. Construir pedidos, pagos e historial de eventos.
6. Adaptar el storefront actual al tema configurable.
7. Migrar Tecnotitlan como primera tienda.
8. Integrar Mercado Libre y validar el patron.
9. Agregar Amazon y TikTok Shop.
10. Crear la tienda del segundo negocio solo mediante configuracion.

## Que conservar

- Identidad visual y componentes frontend que pasen revision.
- Flujos conceptuales de catalogo, carrito, checkout y panel.
- Prisma/PostgreSQL.
- Nombres de permisos y experiencia obtenida.
- Integracion Mercado Libre como referencia.

## Que reescribir

- Esquema de datos y migraciones.
- Autenticacion y RBAC orientados a membresias por tienda.
- Inventario, sincronizacion de canales y procesamiento de webhooks.
- Pedidos/pagos con idempotencia y eventos.
- Panel de roles, temas e integraciones.
- Pruebas automatizadas y pipeline de despliegue.
