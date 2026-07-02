# Plan maestro de ejecucion

Fecha: 15 de junio de 2026

Este plan convierte el prompt rector del proyecto en una secuencia ejecutable.
La arquitectura objetivo es `ARQUITECTURA_PLATAFORMA_WHITE_LABEL_V2.md`.

## Conservar

- React storefront y componentes premium que pasen revision.
- Express, PostgreSQL y Prisma.
- Login, carrito, checkout y RBAC mientras se construye su reemplazo V2.
- Servicios de email, WhatsApp, n8n y Mercado Libre como referencias/adaptadores.

## Eliminar

- Mocks visibles en produccion.
- Estilos, componentes e imports muertos.
- Logica de negocio hardcodeada por tienda.
- Integraciones que escriban inventario sin movimientos auditables.

## Refactorizar

- Storefront para consumir secciones configurables.
- RBAC para membresias y permisos por tienda.
- Productos hacia variantes, costos y canales.
- Inventario hacia almacenes, reservas y movimientos.
- Pedidos hacia historial y eventos idempotentes.

## Crear

- Store, StoreTheme, PageSection y StoreMembership.
- Admin de storefront.
- Kits/bundles calculados desde componentes.
- Libro de inventario y margenes.
- Adaptadores omnicanal.
- Outbox de eventos para n8n.
- Soporte centralizado con tickets y escalamiento desde WhatsApp.

## Riesgos

- Migrar directamente la base actual puede romper checkout y permisos.
- Los webhooks duplicados pueden descontar inventario dos veces.
- Las credenciales por tienda requieren cifrado/vault.
- Cambiar modelos sin pruebas de staging puede afectar datos reales.

## Orden de ejecucion

1. Limpieza tecnica y pruebas base.
2. Home premium y contacto/soporte.
3. Storefront configurable.
4. Fundacion multi-tenant y RBAC V2.
5. Productos, variantes, costos y margenes.
6. Kits/bundles.
7. Inventario por movimientos y almacenes.
8. Pedidos, outbox y automatizaciones n8n.
9. Mercado Libre como primer adaptador.
10. Amazon y TikTok Shop.

## Regla operativa de soporte

Todos los canales terminan en un ticket:

```text
Web / email / WhatsApp
        |
        v
Asistente automatico
        |
        +-- resuelto --> registrar resultado
        |
        +-- no resuelto --> support.ticket.created --> agente humano
```

La API guarda el ticket primero. n8n notifica y coordina, pero no es la fuente de
verdad ni debe ser el unico lugar donde exista la solicitud.
