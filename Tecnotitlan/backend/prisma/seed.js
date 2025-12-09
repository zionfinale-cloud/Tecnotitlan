import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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
  // Configuraciones
  { name: 'setting:read', description: 'Ver configuraciones del sitio' },
  { name: 'setting:update', description: 'Actualizar configuraciones del sitio' },
  // Integraciones
  { name: 'integration:read', description: 'Ver estado de integraciones' },
  { name: 'integration:update', description: 'Conectar/desconectar integraciones' },
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
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || '123456';

  if (adminPassword.length < 6) {
    console.error('Error: La contraseña de administrador debe tener al menos 6 caracteres.');
    return;
  }

  console.log(`Upserting SUPER_ADMIN user (${adminEmail})...`);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      firstName: 'Super',
      lastName: 'Administrador',
      password: await bcrypt.hash(adminPassword, 10),
      roleId: superAdminRole.id,
    },
  });
  console.log('SUPER_ADMIN user is set up.');

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