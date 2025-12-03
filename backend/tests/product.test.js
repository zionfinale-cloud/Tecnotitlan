import request from 'supertest';
import http from 'http';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { app, ready } from '../src/index.js';

const prisma = new PrismaClient();

describe('Product API Endpoints', () => {
  let server;
  let adminToken, userToken, adminUser, regularUser, testCategory;

  // --- Configuración Inicial ---
  beforeAll(async () => {
    await ready;
    server = http.createServer(app);

    // Limpieza completa UNA VEZ antes de todas las pruebas de esta suite.
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.role.deleteMany({});
    await prisma.permission.deleteMany({});

    // Creación de datos base para TODAS las pruebas de esta suite.
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // 1. Crear permisos necesarios para las pruebas de productos.
    const permissions = await prisma.permission.createManyAndReturn({
      data: [
        { name: 'product:create', description: 'Permite crear productos' },
        { name: 'product:read', description: 'Permite leer productos' },
        { name: 'product:update', description: 'Permite actualizar productos' },
        { name: 'product:delete', description: 'Permite eliminar/archivar productos' },
      ],
      skipDuplicates: true,
    });

    // 2. Crear roles y asignar permisos.
    const adminRole = await prisma.role.create({
      data: {
        name: 'SUPER_ADMIN',
        description: 'Rol de Super Administrador',
        permissions: {
          connect: permissions.map(p => ({ id: p.id })),
        },
      },
    });
    const userRole = await prisma.role.create({
      data: { name: 'USER', description: 'Rol de usuario de prueba' },
    });

    // 3. Crear usuarios de prueba.
    adminUser = await prisma.user.create({ data: { name: 'Admin Product Test', email: 'admin.product@test.com', password: hashedPassword, roleId: adminRole.id } });
    regularUser = await prisma.user.create({ data: { name: 'User Product Test', email: 'user.product@test.com', password: hashedPassword, roleId: userRole.id } });

    // 4. Obtener tokens de autenticación.
    const adminLoginRes = await request(server).post('/api/users/login').send({ email: 'admin.product@test.com', password: 'password123' });
    adminToken = adminLoginRes.body.data.token;

    const userLoginRes = await request(server).post('/api/users/login').send({ email: 'user.product@test.com', password: 'password123' });
    userToken = userLoginRes.body.data.token;

    // 5. Crear datos comunes como categorías.
    testCategory = await prisma.category.create({ data: { name: 'Test Category', slug: 'test-category-prod' } });
  });

  // Limpiar datos transaccionales (productos, reseñas) antes de CADA prueba.
  // Esto asegura que cada `it` se ejecute en un estado limpio sin recrear usuarios/roles.
  beforeEach(async () => {
    await prisma.review.deleteMany({});
    await prisma.product.deleteMany({});
  });

  // --- Limpieza Final ---
  afterAll(async () => {
    await prisma.$disconnect();
    if (server) {
      server.close();
    }
  });

  // --- Pruebas para Rutas Públicas ---
  describe('Public Access', () => {
    it('should return a list of non-archived products to the public', async () => {
      // Arrange
      await prisma.product.createMany({
        data: [
          { name: 'Public Product 1', sku: 'PUB-PROD-1', price: 10, userId: adminUser.id, categoryId: testCategory.id, countInStock: 5, description: 'd1', brand: 'b1' },
          { name: 'Archived Product', sku: 'ARC-PROD-1', price: 20, userId: adminUser.id, categoryId: testCategory.id, countInStock: 10, description: 'd2', brand: 'b2', isArchived: true },
        ],
      });

      // Act
      const res = await request(server).get('/api/products');

      // Assert
      expect(res.statusCode).toEqual(200);
      expect(res.body.data.products).toBeInstanceOf(Array);
      expect(res.body.data.products.length).toBe(1);
      expect(res.body.data.products[0].name).toBe('Public Product 1');
    });
  });

  // --- Pruebas para Rutas de Administrador ---
  describe('Admin Access & RBAC', () => {
    const productPayload = {
      name: 'New Admin Product',
      price: 99.99,
      brand: 'Admin Brand',
      countInStock: 100,
      description: 'A new product created by an admin',
      // categoryId se añade en la prueba
    };

    it('POST /api/products - should allow an admin to create a product', async () => {
      // Act
      const res = await request(server)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...productPayload, categoryId: testCategory.id });

      // Assert
      expect(res.statusCode).toEqual(201);
      expect(res.body.data.product.name).toBe('New Admin Product');
      expect(res.body.data.product).toHaveProperty('sku');
    });

    it('POST /api/products - should NOT allow a regular user to create a product', async () => {
      // Act
      const res = await request(server)
        .post('/api/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...productPayload, categoryId: testCategory.id });

      // Assert
      expect(res.statusCode).toEqual(403); // Forbidden
      expect(res.body.message).toBe('No tienes permiso para realizar esta acción.');
    });

    it('POST /api/products - should return 401 if no token is provided', async () => {
      // Act
      const res = await request(server)
        .post('/api/products')
        .send({ ...productPayload, categoryId: testCategory.id });

      // Assert
      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toBe('No autorizado, no hay token.');
    });

    describe('Archiving and Restoration', () => {
      let product;

      beforeEach(async () => {
        // Arrange: Crear un producto para cada prueba de este bloque
        product = await prisma.product.create({
          data: { name: 'Archivable Product', sku: 'ARCH-PROD-1', price: 10, userId: adminUser.id, categoryId: testCategory.id, countInStock: 5, description: 'desc', brand: 'brand' },
        });
      });

      it('DELETE /api/products/:sku - should allow an admin to archive a product', async () => {
        // Act
        const res = await request(server)
          .delete(`/api/products/${product.sku}`)
          .set('Authorization', `Bearer ${adminToken}`);

        // Assert
        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toBe('Producto archivado correctamente.');

        const archivedProduct = await prisma.product.findUnique({ where: { id: product.id } });
        expect(archivedProduct).not.toBeNull();
        expect(archivedProduct.isArchived).toBe(true);
      });

      it('PUT /api/products/:sku/unarchive - should allow an admin to restore an archived product', async () => {
        // Arrange: Asegurarse de que el producto esté archivado primero
        await prisma.product.update({ where: { id: product.id }, data: { isArchived: true } });

        // Act
        const res = await request(server)
          .put(`/api/products/${product.sku}/unarchive`)
          .set('Authorization', `Bearer ${adminToken}`);

        // Assert
        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toBe('Producto restaurado correctamente.');

        const restoredProduct = await prisma.product.findUnique({ where: { id: product.id } });
        expect(restoredProduct).not.toBeNull();
        expect(restoredProduct.isArchived).toBe(false);
      });
    });
  });
});
