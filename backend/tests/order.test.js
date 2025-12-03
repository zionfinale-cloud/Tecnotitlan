import request from 'supertest';
import http from 'http';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { app, ready } from '../src/index.js';

const prisma = new PrismaClient();

describe('Order API Endpoints', () => {
  let server;
  let adminToken, userToken, userId, adminId, product1, product2, adminRole, userRole;

  // Solo inicializamos el servidor una vez para toda la suite de pruebas.
  beforeAll(async () => {
    await ready;
    server = http.createServer(app);
  });

  // Antes de CADA prueba, limpiamos la DB y creamos datos frescos.
  // Esto garantiza un aislamiento total y previene que los tests se afecten entre sí.
  beforeEach(async () => {
    // Limpiar tablas en el orden correcto para evitar errores de clave foránea
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.permission.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.role.deleteMany({});

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // Crear permiso y rol de admin con ese permiso
    const permUpdateOrder = await prisma.permission.create({ data: { name: 'order:update' } });
    adminRole = await prisma.role.create({
      data: { name: 'ADMIN', permissions: { connect: { id: permUpdateOrder.id } } }
    });
    userRole = await prisma.role.create({ data: { name: 'USER' } });

    const adminUser = await prisma.user.create({
      data: {
        name: 'Admin Test', email: 'admin.order@test.com', password: hashedPassword, roleId: adminRole.id,
      }
    });
    adminId = adminUser.id;

    const regularUser = await prisma.user.create({
      data: {
        name: 'User Test', email: 'user.order@test.com', password: hashedPassword, roleId: userRole.id,
      }
    });
    userId = regularUser.id;

    const adminLoginRes = await request(server).post('/api/users/login').send({ email: 'admin.order@test.com', password: 'password123' });
    adminToken = adminLoginRes.body.data.token;
    const userLoginRes = await request(server).post('/api/users/login').send({ email: 'user.order@test.com', password: 'password123' });
    userToken = userLoginRes.body.data.token;

    const category = await prisma.category.create({ data: { name: 'Test Category', slug: 'test-category' } });
    product1 = await prisma.product.create({
      data: {
      userId: adminId, name: 'Test Watch X1', sku: 'TEST-WATCH-X1', price: 150, countInStock: 20, productType: 'IN_HOUSE', brand: 'TestBrand', categoryId: category.id, description: 'A test watch',
      }
    });
    product2 = await prisma.product.create({
      data: {
      userId: adminId, name: 'Test Strap B2', sku: 'TEST-STRAP-B2', price: 25, countInStock: 50, productType: 'IN_HOUSE', brand: 'TestBrand', categoryId: category.id, description: 'A test strap',
      }
    });
  });

  // Al final de todo, cerramos el servidor.
  afterAll(async () => {
    await prisma.$disconnect();
    if (server) {
      server.close();
    }
  });

  it('should create a new order successfully and update stock', async () => {
    const orderData = {
      orderItems: [
        { product: product1.id, qty: 2 },
        { product: product2.id, qty: 1 },
      ],
      shippingAddress: { address: '123 Test St', city: 'Testville', postalCode: '12345', country: 'Testland' },
      paymentMethod: 'PayPal',
    };

    const res = await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send(orderData);

    expect(res.statusCode).toEqual(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.order.userId).toEqual(userId);
    const updatedProduct1 = await prisma.product.findUnique({ where: { id: product1.id } });
    expect(updatedProduct1.countInStock).toBe(18);
  });

  it('should get a specific order for the correct user', async () => {
    // Arrange: Primero, creamos un pedido en esta prueba
    const orderRes = await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        orderItems: [{ product: product1.id, qty: 1 }],
        shippingAddress: { address: '456 Test Ave', city: 'Testville', postalCode: '54321', country: 'Testland' },
        paymentMethod: 'PayPal',
      });
    const orderId = orderRes.body.data.order.id;

    // Act: Luego, lo buscamos
    const res = await request(server)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${userToken}`);

    // Assert
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.order.id).toBe(orderId);
  });
  
  it('should allow an admin to mark an order as shipped', async () => {
    // Arrange: Primero, creamos un pedido en esta prueba
    const orderRes = await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        orderItems: [{ product: product1.id, qty: 1 }],
        shippingAddress: { address: '456 Test Ave', city: 'Testville', postalCode: '54321', country: 'Testland' },
        paymentMethod: 'PayPal',
      });
    const orderId = orderRes.body.data.order.id;

    // Act: Luego, el admin lo marca como enviado
    const res = await request(server)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trackingNumber: 'TRACK12345' });

    // Assert
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.order.status).toBe('SHIPPED');
    expect(res.body.data.order.shippingInfo.trackingNumber).toBe('TRACK12345');
  });
});
