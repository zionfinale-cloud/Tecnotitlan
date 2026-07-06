INSERT INTO "permissions" ("id", "name", "description", "createdAt", "updatedAt")
VALUES
  ('perm_access_admin_panel', 'access:admin_panel', 'Permite el acceso al panel de administracion', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_user_read', 'user:read', 'Ver lista de usuarios', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_user_update', 'user:update', 'Editar usuarios', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_user_delete', 'user:delete', 'Eliminar usuarios', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_role_create', 'role:create', 'Crear nuevos roles', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_role_read', 'role:read', 'Ver roles y permisos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_role_update', 'role:update', 'Editar roles y asignar permisos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_role_delete', 'role:delete', 'Eliminar roles', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_product_create', 'product:create', 'Crear productos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_product_read', 'product:read', 'Ver productos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_product_update', 'product:update', 'Editar productos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_product_delete', 'product:delete', 'Eliminar productos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_category_create', 'category:create', 'Crear categorias', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_category_read', 'category:read', 'Ver categorias', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_category_update', 'category:update', 'Editar categorias', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_category_delete', 'category:delete', 'Eliminar categorias', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_order_read', 'order:read', 'Ver todos los pedidos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_order_update', 'order:update', 'Actualizar estado de pedidos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_report_read', 'report:read', 'Ver reportes de ventas y ganancias', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_finance_read_costs', 'finance:read_costs', 'Ver costos, inversiones, margenes y utilidad', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_setting_read', 'setting:read', 'Ver configuraciones del sitio', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_setting_update', 'setting:update', 'Actualizar configuraciones del sitio', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_integration_read', 'integration:read', 'Ver estado de integraciones', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_integration_update', 'integration:update', 'Conectar/desconectar integraciones', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_integration_delete', 'integration:delete', 'Desconectar integraciones', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_support_read', 'support:read', 'Ver tickets de soporte', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_support_update', 'support:update', 'Atender y actualizar tickets de soporte', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_mail_read', 'mail:read', 'Leer correo corporativo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_mail_send', 'mail:send', 'Enviar y responder correos corporativos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_whatsapp_chat', 'whatsapp:chat', 'Atender conversaciones de WhatsApp desde el panel', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_system_configure', 'system:configure', 'Ver y modificar configuracion sensible del sistema', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "roles" ("id", "name", "description", "createdAt", "updatedAt")
VALUES
  ('role_admin', 'ADMIN', 'Administra operacion, catalogo, pedidos, inventario y costos sin acceso a configuracion sensible.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_supervisor', 'SUPERVISOR', 'Supervisa ventas, pedidos, inventario operativo y atencion sin ver costos por defecto.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_vendedor', 'VENDEDOR', 'Atiende clientes, pedidos, correo, WhatsApp y consulta inventario sin ver costos.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "updatedAt" = CURRENT_TIMESTAMP;

WITH role_permission_map(role_name, permission_name) AS (
  VALUES
    ('ADMIN', 'access:admin_panel'),
    ('ADMIN', 'user:read'),
    ('ADMIN', 'user:update'),
    ('ADMIN', 'role:create'),
    ('ADMIN', 'role:read'),
    ('ADMIN', 'role:update'),
    ('ADMIN', 'product:create'),
    ('ADMIN', 'product:read'),
    ('ADMIN', 'product:update'),
    ('ADMIN', 'product:delete'),
    ('ADMIN', 'category:create'),
    ('ADMIN', 'category:read'),
    ('ADMIN', 'category:update'),
    ('ADMIN', 'category:delete'),
    ('ADMIN', 'order:read'),
    ('ADMIN', 'order:update'),
    ('ADMIN', 'report:read'),
    ('ADMIN', 'finance:read_costs'),
    ('ADMIN', 'setting:read'),
    ('ADMIN', 'setting:update'),
    ('ADMIN', 'integration:read'),
    ('ADMIN', 'integration:update'),
    ('ADMIN', 'support:read'),
    ('ADMIN', 'support:update'),
    ('ADMIN', 'mail:read'),
    ('ADMIN', 'mail:send'),
    ('ADMIN', 'whatsapp:chat'),
    ('SUPERVISOR', 'access:admin_panel'),
    ('SUPERVISOR', 'product:read'),
    ('SUPERVISOR', 'product:update'),
    ('SUPERVISOR', 'category:read'),
    ('SUPERVISOR', 'order:read'),
    ('SUPERVISOR', 'order:update'),
    ('SUPERVISOR', 'support:read'),
    ('SUPERVISOR', 'support:update'),
    ('SUPERVISOR', 'mail:read'),
    ('SUPERVISOR', 'mail:send'),
    ('SUPERVISOR', 'whatsapp:chat'),
    ('VENDEDOR', 'access:admin_panel'),
    ('VENDEDOR', 'product:read'),
    ('VENDEDOR', 'category:read'),
    ('VENDEDOR', 'order:read'),
    ('VENDEDOR', 'order:update'),
    ('VENDEDOR', 'support:read'),
    ('VENDEDOR', 'support:update'),
    ('VENDEDOR', 'mail:read'),
    ('VENDEDOR', 'mail:send'),
    ('VENDEDOR', 'whatsapp:chat')
)
INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p."id", r."id"
FROM role_permission_map rpm
JOIN "roles" r ON r."name" = rpm.role_name
JOIN "permissions" p ON p."name" = rpm.permission_name
ON CONFLICT DO NOTHING;
