import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const prisma = new PrismaClient();

const permissions = [
  // Acceso general
  { name: 'access:admin_panel', description: 'Permite el acceso al panel de administración' },
  // Usuarios
  { name: 'user:read', description: 'Ver lista de usuarios' },
  { name: 'user:update', description: 'Editar usuarios' },
  { name: 'user:delete', description: 'Eliminar usuarios' },
  // Roles y Permisos
  { name: 'role:create', description: 'Crear nuevos roles' },
  { name: 'role:read', description: 'Ver roles y permisos' },
  { name: 'role:update', description: 'Editar roles y asignar permisos' },
  { name: 'role:delete', description: 'Eliminar roles' },
  // Productos
  { name: 'product:create', description: 'Crear productos' },
  { name: 'product:read', description: 'Ver productos' },
  { name: 'product:update', description: 'Editar productos' },
  { name: 'product:delete', description: 'Eliminar productos' },
  // Categorías
  { name: 'category:create', description: 'Crear categorías' },
  { name: 'category:read', description: 'Ver categorías' },
  { name: 'category:update', description: 'Editar categorías' },
  { name: 'category:delete', description: 'Eliminar categorías' },
  // Pedidos
  { name: 'order:read', description: 'Ver todos los pedidos' },
  { name: 'order:update', description: 'Actualizar estado de pedidos' },
  // Reportes
  { name: 'report:read', description: 'Ver reportes de ventas y ganancias' },
  // Finanzas y costos
  { name: 'finance:read_costs', description: 'Ver costos, inversiones, margenes y utilidad' },
  // Configuraciones
  { name: 'setting:read', description: 'Ver configuraciones del sitio' },
  { name: 'setting:update', description: 'Actualizar configuraciones del sitio' },
  // Integraciones
  { name: 'integration:read', description: 'Ver estado de integraciones' },
  { name: 'integration:update', description: 'Conectar/desconectar integraciones' },
  { name: 'integration:delete', description: 'Desconectar integraciones' },
  { name: 'support:read', description: 'Ver tickets de soporte' },
  { name: 'support:update', description: 'Atender y actualizar tickets de soporte' },
  { name: 'mail:read', description: 'Leer correo corporativo del equipo' },
  { name: 'mail:send', description: 'Enviar respuestas desde correo corporativo' },
  { name: 'whatsapp:chat', description: 'Atender conversaciones de WhatsApp desde el panel' },
  { name: 'system:configure', description: 'Ver y modificar configuracion sensible del sistema' },
];

async function main() {
  console.log('Start seeding...');

  // 1. Crear todos los permisos
  console.log('Upserting permissions...');
  const createdPermissions = await Promise.all(
    permissions.map(permission =>
      prisma.permission.upsert({
        where: { name: permission.name },
        update: {},
        create: permission,
      })
    )
  );
  console.log(`${createdPermissions.length} permissions are set up.`);

  // 2. Crear el rol de SUPER_ADMIN y asignarle TODOS los permisos
  console.log('Upserting SUPER_ADMIN role...');
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {
      permissions: {
        set: createdPermissions.map(p => ({ id: p.id })),
      },
    },
    create: {
      name: 'SUPER_ADMIN',
      description: 'Tiene acceso total a todas las funcionalidades del sistema.',
      permissions: {
        connect: createdPermissions.map(p => ({ id: p.id })),
      },
    },
  });
  console.log('SUPER_ADMIN role is set up with all permissions.');

  // 3. Crear el rol de USER (sin permisos especiales)
  console.log('Upserting USER role...');
  await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: {
      name: 'USER',
      description: 'Rol por defecto para nuevos usuarios registrados.',
    },
  });
  console.log('USER role is set up.');

  // 4. Crear el usuario SUPER_ADMIN
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error('Configura ADMIN_EMAIL y ADMIN_PASSWORD (minimo 12 caracteres) antes de ejecutar el seed.');
  }

  console.log(`Upserting SUPER_ADMIN user (${adminEmail})...`);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      roleId: superAdminRole.id,
      isVerified: true,
    },
    // Si no existe, lo crea
    create: {
      email: adminEmail,
      firstName: 'Super',
      lastName: 'Administrador',
      // Encripta la contraseña antes de guardarla
      // ¡Asegúrate de que bcrypt esté instalado!
      password: await bcrypt.hash(adminPassword, 10),
      roleId: superAdminRole.id,
      isVerified: true,
    },
  });
  console.log('SUPER_ADMIN user is set up.');

  // 5. Crear configuraciones iniciales del sitio
  const initialSettings = [
    { key: 'site_name', value: 'Tecnotitlan', type: 'string' },
    { key: 'site_slogan', value: 'Tecnología con Raíces, Poder sin Límites.', type: 'string' },
    { key: 'contact_email', value: 'hola@tecnotitlan.com.mx', type: 'string' },
    { key: 'social_facebook', value: 'https://www.facebook.com/tecnotitlan', type: 'string' },
    { key: 'social_instagram', value: 'https://www.instagram.com/tecnotitlan', type: 'string' },
    { key: 'social_tiktok', value: 'https://www.tiktok.com/@tecnotitlan', type: 'string' },
    { key: 'social_youtube', value: 'https://www.youtube.com/@tecnotitlan', type: 'string' },
    { key: 'social_whatsapp', value: 'https://wa.me/5215512345678', type: 'string' },
    { key: 'accent_color', value: '#00DCA2', type: 'color' },
    { key: 'primary_color', value: '#0F172A', type: 'color' },
    { key: 'page_privacy_policy', value: '<h1>Política de Privacidad</h1><p>Contenido inicial de la política de privacidad. Edite este texto desde el panel de administración.</p>', type: 'html' },
    { key: 'page_terms_of_service', value: '<h1>Términos de Servicio</h1><p>Contenido inicial de los términos de servicio. Edite este texto desde el panel de administración.</p>', type: 'html' },
  ];

  console.log('Upserting initial settings...');
  for (const setting of initialSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
        type: setting.type,
      },
      // Opcional: Puedes añadir un log aquí para verificar que cada configuración se está creando/actualizando
    });
  }
  console.log(`${initialSettings.length} settings are set up.`);

  console.log('Seeding finished.');

}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
