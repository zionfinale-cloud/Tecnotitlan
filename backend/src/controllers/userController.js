// backend/src/controllers/userController.js @userController.js
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js'; // Importar la instancia única de Prisma
import { AppError, BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errorUtils.js';
import { getConfig } from '../services/configService.js';

// Función para generar un token JWT
const generateToken = (id) => {
  // Obtiene la configuración centralizada para el secreto y la expiración del token.
  const config = getConfig();
  return jwt.sign({ id }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
};

// @desc    Registrar un nuevo usuario
// @route   POST /api/users/register
// @access  Public
const registerUser = asyncHandler(async (req, res, next) => {
  // Se extraen los campos del body. Se ignora 'role' por seguridad.
  const {
    firstName,
    lastName,
    secondLastName,
    email,
    password,
    countryCode,
    phone,
    street,
    neighborhood,
    city,
    state,
    postalCode
  } = req.body;

  // La validación de campos (name, email, password) ahora la hace el middleware.
  // 1. Verificar si el email ya existe.
  const userExists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (userExists) {
    return next(new BadRequestError('El usuario ya existe con ese email.'));
  }

  // 2. Hashear la contraseña antes de guardarla.
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 3. Buscar el rol 'USER' por defecto, incluyendo sus permisos (aunque esté vacío).
  const defaultRole = await prisma.role.findUnique({ where: { name: 'USER' }, include: { permissions: { select: { name: true } } } });
  if (!defaultRole) {
    // Esto es un error de configuración del servidor.
    return next(new AppError('El rol de usuario por defecto no está configurado en el sistema.', 500));
  }

  // 3. Crear el nuevo usuario con Prisma.
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      secondLastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      countryCode,
      phone,
      street,
      neighborhood,
      city,
      state,
      postalCode,
      // Asignar el ID del rol encontrado. Ignoramos cualquier 'role' que venga del body por seguridad.
      roleId: defaultRole.id,
    },
  });

  if (user) {
    res.status(201).json({
      status: 'success',
      data: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`, // Devolvemos un nombre completo
        email: user.email,
        countryCode: user.countryCode,
        phone: user.phone,
        // No devolvemos la dirección completa en la respuesta del login/registro por brevedad
        role: defaultRole.name,
        permissions: defaultRole.permissions.map(p => p.name), // Devolver permisos para consistencia
        token: generateToken(user.id), // Generar y enviar token
      },
    });
  } else {
    // Este caso es menos probable con asyncHandler, pero es bueno tenerlo
    return next(new BadRequestError('No se pudo crear el usuario.'));
  }
});

// @desc    Autenticar (iniciar sesión) un usuario
// @route   POST /api/users/login
// @access  Public
const loginUser = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // La validación de campos (email, password) ahora la hace el middleware.
  // 1. Buscar usuario por email.
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    // Incluir el rol y los permisos asociados a ese rol
    include: {
      role: {
        include: { permissions: { select: { name: true } } },
      },
    },
  });

  // 2. Si el usuario no existe o la contraseña no coincide, lanzar error.
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return next(new UnauthorizedError('Email o contraseña inválidos.'));
  }

  res.status(200).json({
    status: 'success',
    data: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone,
      role: user.role.name, // Devolver el nombre del rol
      permissions: user.role.permissions.map(p => p.name), // Devolver la lista de nombres de permisos
      token: generateToken(user.id),
    },
  });
});

// @desc    Obtener el perfil del usuario logueado
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res, next) => {
  // req.user es añadido por el middleware 'protect'
  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
    // No se necesita `select` o `include` si queremos todos los campos escalares.
    // La contraseña se excluye automáticamente si no se solicita explícitamente.
  });

  if (user) {
    res.status(200).json({
      status: 'success',
      data: {
        // Devolvemos todos los campos necesarios para poblar el formulario de perfil
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        secondLastName: user.secondLastName,
        email: user.email,
        countryCode: user.countryCode,
        phone: user.phone,
        street: user.street,
        neighborhood: user.neighborhood,
        city: user.city,
        state: user.state,
        postalCode: user.postalCode,
      },
    });
  } else {
    return next(new NotFoundError('Usuario no encontrado'));
  }
});

// @desc    Actualizar el perfil del usuario
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: true },
  });

  if (!user) {
    return next(new NotFoundError('Usuario no encontrado'));
  }

  const dataToUpdate = {
    firstName: req.body.firstName || user.firstName,
    lastName: req.body.lastName || user.lastName,
    secondLastName: req.body.secondLastName || user.secondLastName,
    email: req.body.email ? req.body.email.toLowerCase() : user.email,
    countryCode: req.body.countryCode || user.countryCode,
    street: req.body.street || user.street,
    neighborhood: req.body.neighborhood || user.neighborhood,
    city: req.body.city || user.city,
    state: req.body.state || user.state,
    postalCode: req.body.postalCode || user.postalCode,
  };

  if (req.body.phone !== undefined) {
    dataToUpdate.phone = req.body.phone;
  }

  if (req.body.password) {
    const salt = await bcrypt.genSalt(10);
    dataToUpdate.password = await bcrypt.hash(req.body.password, salt);
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: dataToUpdate,
    // Incluir el rol y los permisos para devolver un objeto userInfo completo
    include: {
      role: { include: { permissions: { select: { name: true } } } },
    },
  });

    res.status(200).json({
      status: 'success',
      data: {
        id: updatedUser.id,
        name: `${updatedUser.firstName} ${updatedUser.lastName}`,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role.name,
        permissions: updatedUser.role.permissions.map(p => p.name), // Devolver la lista de permisos
        token: generateToken(updatedUser.id), // Re-generar token
      },
    });
});

// --- FUNCIONES DE ADMINISTRADOR ---

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    include: {
      role: { select: { name: true } }
    },
  });
  res.status(200).json({ status: 'success', data: { users } });
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = asyncHandler(async (req, res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      role: { select: { name: true } }
    },
  });
  if (user) {
    res.status(200).json({ status: 'success', data: { user } });
  } else {
    return next(new NotFoundError('Usuario no encontrado'));
  }
});

// @desc    Update user by admin
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = asyncHandler(async (req, res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { role: true },
  });

  if (user) {
    const dataToUpdate = {
      firstName: req.body.firstName || user.firstName,
      lastName: req.body.lastName || user.lastName,
      secondLastName: req.body.secondLastName || user.secondLastName,
      email: req.body.email ? req.body.email.toLowerCase() : user.email,
    };

    if (req.body.roleId) {
      dataToUpdate.roleId = req.body.roleId;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: dataToUpdate,
      include: { role: true },
    });

    res.status(200).json({
      status: 'success',
      data: {
        id: updatedUser.id,
        name: `${updatedUser.firstName} ${updatedUser.lastName}`,
        email: updatedUser.email,
        role: updatedUser.role.name,
      },
    });
  } else {
    return next(new NotFoundError('Usuario no encontrado'));
  }
});

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { role: true },
  });

  if (user) {
    if (user.role.name === 'SUPER_ADMIN') {
      return next(new BadRequestError('No se puede eliminar a un usuario administrador'));
    }
    // En Prisma, si un usuario tiene pedidos, la eliminación fallará por defecto
    // debido a las restricciones de clave foránea. Deberías decidir qué hacer:
    // 1. Eliminar en cascada (peligroso).
    // 2. Impedir la eliminación si tiene pedidos.
    // 3. Anonimizar los pedidos del usuario.
    // Por ahora, la restricción por defecto es la más segura.
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(200).json({ status: 'success', message: 'Usuario eliminado' });
  } else {
    return next(new NotFoundError('Usuario no encontrado'));
  }
});

export {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
};