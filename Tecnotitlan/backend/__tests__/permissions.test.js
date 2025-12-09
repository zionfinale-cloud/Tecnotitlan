const request = require('supertest');
const { app, ready } = require('../src/index'); // Importamos la app y la promesa 'ready'
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// --- Variables para almacenar datos de prueba ---
let superAdmin, productManager, basicUser;
let superAdminToken, productManagerToken, basicUserToken;
let testProduct;

// --- Función para generar tokens ---
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'tu_secreto_jwt_super_seguro_cambiame');
};

// --- Configuración antes de todas las pruebas ---
beforeAll(async () => {
  // Esperar a que el servidor esté completamente inicializado
  await ready;

  // Limpiar la base de datos para un estado limpio
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.permission.deleteMany({});

  // 1. Crear Permisos
  const permDelete = await prisma.permission.create({ data: { name: 'product:delete', description: 'Permite eliminar productos' } });
  const permRead = await prisma.permission.create({ data: { name: 'product:read', description: 'Permite leer productos' } });

  // 2. Crear Roles
  const roleAdmin = await prisma.role.create({
    data: {
      name: 'SUPER_ADMIN',
      description: 'Rol de Super Administrador',
      permissions: { connect: [{ id: permDelete.id }, { id: permRead.id }] }
    }
  });
  const roleManager = await prisma.role.create({
    data: {
      name: 'PRODUCT_MANAGER',
      description: 'Rol para gestionar productos',
      permissions: { connect: [{ id: permDelete.id }, { id: permRead.id }] }
    }
  });
  const roleUser = await prisma.role.create({
    data: {
      name: 'USER',
      description: 'Rol de usuario básico',
      permissions: { connect: [{ id: permRead.id }] } // Solo puede leer
    }
  });

  // 3. Crear Usuarios
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  superAdmin = await prisma.user.create({
    data: { name: 'Super Admin Test', email: 'superadmin@test.com', password: hashedPassword, roleId: roleAdmin.id }
  });
  productManager = await prisma.user.create({
    data: { name: 'Product Manager Test', email: 'manager@test.com', password: hashedPassword, roleId: roleManager.id }
  });
  basicUser = await prisma.user.create({
    data: { name: 'Basic User Test', email: 'user@test.com', password: hashedPassword, roleId: roleUser.id }
  });

  // 4. Generar Tokens
  superAdminToken = generateToken(superAdmin.id);
  productManagerToken = generateToken(productManager.id);
  basicUserToken = generateToken(basicUser.id);

  // 5. Crear un producto de prueba para eliminar
  const category = await prisma.category.create({ data: { name: 'Test Category', slug: 'test-cat' } });
  testProduct = await prisma.product.create({
    data: {
      name: 'Producto para Eliminar',
      sku: 'TEST-DELETE-001',
      description: '...',
      price: 100,
      userId: superAdmin.id,
      categoryId: category.id,
    }
  });
});

// --- Limpieza después de todas las pruebas ---
afterAll(async () => {
  await prisma.$disconnect();
});


// --- Suite de Pruebas para el Middleware de Permisos ---
describe('Middleware de Permisos (checkPermission)', () => {
  // La ruta que vamos a probar, protegida por checkPermission('product:delete')
  const deleteUrl = `/api/products/${testProduct.sku}/permanent`;

  it('debería denegar el acceso si no se proporciona un token (401 Unauthorized)', async () => {
    const res = await request(app).delete(deleteUrl);
    expect(res.statusCode).toEqual(401);
    expect(res.body.message).toContain('No autorizado, no hay token');
  });

  it('debería denegar el acceso a un usuario sin el permiso requerido (403 Forbidden)', async () => {
    const res = await request(app)
      .delete(deleteUrl)
      .set('Authorization', `Bearer ${basicUserToken}`); // El usuario básico no tiene 'product:delete'

    expect(res.statusCode).toEqual(403);
    expect(res.body.message).toContain('No tienes permiso para realizar esta acción');
  });

  it('debería permitir el acceso a un usuario con el permiso requerido (200 OK)', async () => {
    // Hacemos un mock de la implementación del controlador para que no elimine realmente el producto
    // y solo verifiquemos que el middleware dejó pasar la petición.
    jest.spyOn(prisma.product, 'delete').mockResolvedValueOnce(testProduct);

    const res = await request(app)
      .delete(deleteUrl)
      .set('Authorization', `Bearer ${productManagerToken}`); // El manager sí tiene 'product:delete'

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toContain('Producto eliminado permanentemente');
  });

  it('debería permitir el acceso a un SUPER_ADMIN incluso si no se consultan sus permisos (200 OK)', async () => {
    // Mock para asegurarnos de que el producto se "elimina" correctamente
    jest.spyOn(prisma.product, 'delete').mockResolvedValueOnce(testProduct);

    const res = await request(app)
      .delete(deleteUrl)
      .set('Authorization', `Bearer ${superAdminToken}`); // El SUPER_ADMIN tiene acceso por atajo

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toContain('Producto eliminado permanentemente');
  });
});
