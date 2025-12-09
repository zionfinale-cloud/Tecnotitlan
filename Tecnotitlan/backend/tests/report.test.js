import request from 'supertest';
import http from 'http';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { app, ready } from '../src/index.js';

const prisma = new PrismaClient();

describe('Report API Endpoints', () => {
  let server;
  let adminToken, userToken, regularUser, adminUser, testCategory;

  beforeAll(async () => {
    await ready;
    server = http.createServer(app);

    // Limpiamos la base de datos una vez al inicio de la suite.
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.role.deleteMany({});
    await prisma.permission.deleteMany({});

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // 1. Crear permisos necesarios para las pruebas de reportes.
    const permReadReport = await prisma.permission.create({
      data: { name: 'report:read', description: 'Permite leer reportes' },
    });

    // 2. Crear roles y asignar permisos.
    const adminRole = await prisma.role.create({
      data: {
        name: 'SUPER_ADMIN',
        description: 'Rol de Super Administrador de Reportes',
        permissions: { connect: { id: permReadReport.id } },
      },
    });
    const userRole = await prisma.role.create({
      data: { name: 'USER', description: 'Rol de usuario de prueba' },
    });

    // 3. Crear usuarios de prueba.
    adminUser = await prisma.user.create({ data: { name: 'Admin Report Test', email: 'admin.report@test.com', password: hashedPassword, roleId: adminRole.id } });
    regularUser = await prisma.user.create({ data: { name: 'User Report Test', email: 'user.report@test.com', password: hashedPassword, roleId: userRole.id } });

    // 4. Obtener tokens de autenticación.
    const adminLoginRes = await request(server).post('/api/users/login').send({ email: 'admin.report@test.com', password: 'password123' });
    adminToken = adminLoginRes.body.data.token;

    const userLoginRes = await request(server).post('/api/users/login').send({ email: 'user.report@test.com', password: 'password123' });
    userToken = userLoginRes.body.data.token;

    testCategory = await prisma.category.create({ data: { name: 'Report Category', slug: 'report-category' } });

    // 5. Crear datos de prueba (productos y pedidos).
    const productA = await prisma.product.create({ data: { name: 'Product A', sku: 'P-A-REP', price: 100, costPrice: 50, countInStock: 10, userId: adminUser.id, categoryId: testCategory.id, brand: 'TestBrand', description: 'Desc A' } });
    const productB = await prisma.product.create({ data: { name: 'Product B', sku: 'P-B-REP', price: 200, costPrice: 120, countInStock: 5, userId: adminUser.id, categoryId: testCategory.id, brand: 'TestBrand', description: 'Desc B' } });
    const productC = await prisma.product.create({ data: { name: 'Product C', sku: 'P-C-REP', price: 50, costPrice: 20, countInStock: 2, userId: adminUser.id, categoryId: testCategory.id, brand: 'TestBrand', description: 'Desc C' } });
    const sampleProducts = [productA, productB, productC];

    // Pedido 1
    await prisma.order.create({
      data: {
        userId: regularUser.id,
        orderItems: { create: [{ productId: sampleProducts[0].id, name: 'Product A', qty: 2, price: 100 }] },
        shippingAddress: { address: '123 St', city: 'City', postalCode: '12345', country: 'Country' },
        paymentMethod: 'PayPal',
        itemsPrice: 200, taxPrice: 32, shippingPrice: 10, totalPrice: 242, paymentFee: 0,
        isPaid: true, paidAt: new Date(), status: 'DELIVERED', orderNumber: 'PUM-TEST-REP-001',
      }
    });

    // Pedido 2
    await prisma.order.create({
      data: {
        userId: regularUser.id,
        orderItems: {
          create: [
            { productId: sampleProducts[1].id, name: 'Product B', qty: 1, price: 200 },
            { productId: sampleProducts[2].id, name: 'Product C', qty: 3, price: 50 }
          ]
        },
        shippingAddress: { address: '456 Ave', city: 'City', postalCode: '12345', country: 'Country' },
        paymentMethod: 'PayPal',
        itemsPrice: 350, taxPrice: 56, shippingPrice: 15, totalPrice: 421, paymentFee: 0,
        isPaid: true, paidAt: new Date(), status: 'SHIPPED', orderNumber: 'PUM-TEST-REP-002',
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (server) {
      server.close();
    }
  });

  describe('GET /api/reports', () => {

    // Test de seguridad para los endpoints de reportes que existen
    const existingReportEndpoints = [
      '/api/reports/sales-summary',
      '/api/reports/profit-summary',
    ];

    existingReportEndpoints.forEach(endpoint => {
      it(`should return 401 for ${endpoint} if no token is provided`, async () => {
        const res = await request(server).get(endpoint);
        expect(res.statusCode).toEqual(401);
      });

      it(`should return 403 for ${endpoint} if user is not an admin`, async () => {
        const res = await request(server).get(endpoint).set('Authorization', `Bearer ${userToken}`);
        expect(res.statusCode).toEqual(403);
      });
    });

    // Pruebas específicas para cada reporte
    describe('GET /api/reports/sales-summary', () => {
      it('should return sales summary for admin', async () => {
        const res = await request(server).get('/api/reports/sales-summary').set('Authorization', `Bearer ${adminToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toHaveProperty('totalSales', 663);
        expect(res.body.data).toHaveProperty('numberOfOrders', 2);
        // El cálculo de la API es correcto: 242 + 421 = 663
        expect(res.body.data.totalSales).toBe(663);
        expect(res.body.data.numberOfOrders).toBe(2);
      });
    });

    describe('GET /api/reports/profit-summary', () => {
      it('should return profit summary for admin', async () => {
        const res = await request(server).get('/api/reports/profit-summary').set('Authorization', `Bearer ${adminToken}`);

        // El cálculo de la API es sobre itemsPrice, no totalPrice.
        // Venta: (2*100) + (1*200) + (3*50) = 200 + 200 + 150 = 550
        // Costo: (2*50) + (1*120) + (3*20) = 100 + 120 + 60 = 280
        // Ganancia: 550 - 280 = 270
        expect(res.statusCode).toEqual(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.totalProfit).toBeCloseTo(270);
      });
    });

    describe('GET /api/reports/top-selling-products', () => {
      it('should return top selling products for admin', async () => {
        const res = await request(server).get('/api/reports/top-selling-products').set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toBeInstanceOf(Array);
        expect(res.body.data.length).toBe(3);
        // El orden debe ser C, A, B
        expect(res.body.data[0]).toHaveProperty('productName', 'Product C');
        expect(res.body.data[0]).toHaveProperty('totalQuantitySold', 3);
      });
    });

    describe('GET /api/reports/stock-levels', () => {
      it('should return stock levels for admin', async () => {
        const res = await request(server).get('/api/reports/stock-levels').set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toBeInstanceOf(Array);
        // Tenemos 3 productos creados en el beforeAll
        expect(res.body.data.length).toBe(3);
      });
    });
    
    describe('GET /api/reports/low-stock', () => {
      it('should return low stock products for admin with a threshold', async () => {
        const res = await request(server).get('/api/reports/low-stock?threshold=6').set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data).toBeInstanceOf(Array);
        // Product B (stock 5) y Product C (stock 2) están por debajo del umbral de 6
        expect(res.body.data.length).toBe(2); 
      });
    });
  });
});
