import request from 'supertest';
import http from 'http';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { app, ready } from '../src/index.js';

const prisma = new PrismaClient();

describe('User API Endpoints', () => {
  let server;
  let userRole;

  beforeAll(async () => {
    await ready;
    server = http.createServer(app);

    // Limpieza completa y creación de rol base UNA VEZ.
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.role.deleteMany({});
    await prisma.permission.deleteMany({});

    userRole = await prisma.role.create({ data: { name: 'USER', description: 'Rol de usuario de prueba' } });
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({});
  });

  // --- Pruebas de Registro ---
  describe('POST /api/users/register', () => {
    it('should register a new user successfully and return a token', async () => {
      const res = await request(server)
        .post('/api/users/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.name).toBe('Test User');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('name', 'Test User');
      expect(res.body.data).toHaveProperty('email', 'test@example.com');
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('role', 'USER');
      expect(res.body.data.permissions).toEqual([]); // Un usuario nuevo no tiene permisos especiales
    });

    it('should return 400 if email already exists', async () => {
      // Arrange: Crear un usuario para la prueba.
      await prisma.user.create({
        data: {
          name: 'Existing User',
          email: 'exists@example.com',
          password: await bcrypt.hash('password123', 10),
          roleId: userRole.id,
        }
      });

      const res = await request(server)
        .post('/api/users/register')
        .send({
          name: 'Another User',
          email: 'exists@example.com',
          password: 'anotherpassword',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('El usuario ya existe con ese email.');
    });

    it('should return 400 for invalid data (missing password)', async () => {
      const res = await request(server)
        .post('/api/users/register')
        .send({
          name: 'Test User',
          email: 'test2@example.com',
        });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('La contraseña debe tener al menos 6 caracteres.');
    });
  });

  // --- Pruebas de Login ---
  describe('POST /api/users/login', () => {
    beforeEach(async () => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);

      await prisma.user.create({ data: { // Arrange
        name: 'Login User',
        email: 'login@example.com',
        password: hashedPassword,
        roleId: userRole.id,
      }});
    });

    it('should login an existing user and return a token', async () => {
      const res = await request(server)
        .post('/api/users/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('role', 'USER');
      expect(res.body.data.permissions).toEqual([]);
      expect(res.body.data.email).toBe('login@example.com');
    });

    it('should return 401 for invalid credentials (wrong password)', async () => {
      const res = await request(server)
        .post('/api/users/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toBe('Email o contraseña inválidos.');
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (server) {
      server.close();
    }
  });
});
