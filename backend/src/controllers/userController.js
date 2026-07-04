// backend/src/controllers/userController.js @userController.js
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import asyncHandler from 'express-async-handler';
import prisma from '../config/prisma.js'; // Importar la instancia única de Prisma
import { AppError, BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errorUtils.js';
import { verifyCaptcha } from '../services/captchaService.js';
import { sendVerificationEmail } from '../services/emailService.js';

// Función para generar un token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d', // El token expira en 30 días
  });
};

const generateVerificationToken = () => crypto.randomBytes(32).toString('hex');

const sendActivationResponse = async (res, email, verificationToken, successMessage, statusCode = 201) => {
  try {
    await sendVerificationEmail(email, verificationToken);
    return res.status(statusCode).json({
      status: 'success',
      message: successMessage,
      data: { emailSent: true },
    });
  } catch (error) {
    return res.status(202).json({
      status: 'success',
      message: 'La cuenta quedo registrada, pero no pudimos enviar el correo de activacion. Revisa la configuracion SMTP del backend o solicita reenviar activacion.',
      data: { emailSent: false },
    });
  }
};

// @desc    Registrar un nuevo usuario
// @route   POST /api/users/register
// @access  Public
const registerUser = asyncHandler(async (req, res, next) => {
  // Se extraen los campos del body. Se ignora 'role' por seguridad.
  let {
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
    postalCode,
    name, // Agregamos soporte para el campo 'name' unificado del frontend
    captchaToken // Token recibido del frontend
  } = req.body;

  // FIX: Compatibilidad con frontend que envía 'name' completo
  if (!firstName && name) {
    const parts = name.trim().split(/\s+/);
    firstName = parts[0];
    lastName = parts.slice(1).join(' ') || '.'; // Apellido por defecto si no existe
  }

  if (!email) {
    return next(new BadRequestError('El email es obligatorio.'));
  }

  if (process.env.NODE_ENV === 'production' && !process.env.RECAPTCHA_SECRET_KEY) {
    return next(new AppError('reCAPTCHA no esta configurado en el servidor.', 500));
  }

  if (process.env.RECAPTCHA_SECRET_KEY) {
    const captchaResult = await verifyCaptcha(captchaToken);
    if (!captchaResult.success) {
      return next(new BadRequestError('No pudimos validar el reCAPTCHA. Intentalo nuevamente.'));
    }
  }
  // VALIDACIÓN DE SEGURIDAD
  // 1. Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new BadRequestError('El formato del correo electrónico no es válido.'));
  }

  // 2. Validar seguridad de contraseña (mínimo 8 caracteres)
  if (!password || password.length < 8) {
    return next(new BadRequestError('La contraseña debe tener al menos 8 caracteres para ser segura.'));
  }

  // La validación de campos (name, email, password) ahora la hace el middleware.
  // 1. Verificar si el email ya existe.
  const userExists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (userExists) {
    if (!userExists.isVerified) {
      const verificationToken = generateVerificationToken();
      await prisma.user.update({
        where: { id: userExists.id },
        data: { verificationToken },
      });

      return sendActivationResponse(
        res,
        userExists.email,
        verificationToken,
        'Ya existia una cuenta pendiente de activar. Te reenviamos el correo de activacion.',
        200,
      );
    }

    return next(new BadRequestError('El usuario ya existe con ese email.'));
  }

  // 2. Hashear la contraseña antes de guardarla.
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 2.5 Generar token de verificación criptográfico
  const verificationToken = generateVerificationToken();

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
      verificationToken,
      isVerified: false, // El usuario nace inactivo
    },
  });

  if (user) {
    // Enviar correo con el Link Mágico
    return sendActivationResponse(
      res,
      user.email,
      verificationToken,
      'Registro exitoso. Por favor revisa tu correo para activar tu cuenta.',
      201,
    );
  } else {
    // Este caso es menos probable con asyncHandler, pero es bueno tenerlo
    return next(new BadRequestError('No se pudo crear el usuario.'));
  }
});

// @desc    Verificar correo electrónico del usuario
// @route   GET /api/users/confirm/:token
// @access  Public
const resendVerificationEmail = asyncHandler(async (req, res) => {
  const email = req.body.email?.toLowerCase();

  if (!email) {
    return res.status(400).json({
      status: 'error',
      message: 'El email es obligatorio.',
    });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.isVerified) {
    return res.status(200).json({
      status: 'success',
      message: 'Si la cuenta existe y esta pendiente, enviaremos un nuevo correo de activacion.',
    });
  }

  const verificationToken = generateVerificationToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { verificationToken },
  });

  return sendActivationResponse(
    res,
    user.email,
    verificationToken,
    'Te enviamos un nuevo correo de activacion.',
    200,
  );
});

const verifyEmail = asyncHandler(async (req, res, next) => {
  const { token } = req.params;

  const user = await prisma.user.findFirst({
    where: { verificationToken: token },
  });

  if (!user) {
    return next(new BadRequestError('Token de verificación inválido o expirado.'));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationToken: null, // Consumir el token
    },
  });

  res.status(200).json({
    status: 'success',
    message: 'Cuenta verificada exitosamente. Ya puedes iniciar sesión.',
  });
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

  // 1.5 Verificar si el usuario ha confirmado su correo
  if (user && !user.isVerified) {
    return next(new UnauthorizedError('Por favor verifica tu correo electrónico antes de iniciar sesión.'));
  }

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

// @desc    Cerrar sesión (Logout)
// @route   POST /api/users/logout
// @access  Public
const logoutUser = asyncHandler(async (req, res) => {
  // Al ser JWT en localStorage, el backend principalmente confirma la acción.
  // Si usáramos cookies HTTP-Only, aquí las limpiaríamos: res.clearCookie('jwt');
  res.status(200).json({ status: 'success', message: 'Sesión cerrada correctamente' });
});

export {
  registerUser,
  resendVerificationEmail,
  verifyEmail,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  logoutUser,
};
