import prisma from '../config/prisma.js'; // Importar la instancia única de Prisma
import asyncHandler from 'express-async-handler';
import { NotFoundError, BadRequestError } from '../utils/errorUtils.js';

/**
 * @desc    Obtener todos los permisos disponibles
 * @route   GET /api/roles/permissions
 * @access  Private/Admin (requiere permiso 'role:read')
 */
const getAllPermissions = asyncHandler(async (req, res) => {
  const permissions = await prisma.permission.findMany({
    orderBy: { name: 'asc' },
  });
  // El interceptor de apiService espera un objeto, no un array directamente.
  res.status(200).json({ status: 'success', data: permissions });
});

/**
 * @desc    Obtener todos los roles
 * @route   GET /api/roles
 * @access  Private/Admin (requiere permiso 'role:read')
 */
const getAllRoles = asyncHandler(async (req, res) => {
  const roles = await prisma.role.findMany({
    include: {
      _count: {
        select: { users: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json({ status: 'success', data: { roles } });
});

/**
 * @desc    Obtener un rol por ID
 * @route   GET /api/roles/:id
 * @access  Private/Admin (requiere permiso 'role:read')
 */
const getRoleById = asyncHandler(async (req, res) => {
  const role = await prisma.role.findUnique({
    where: { id: req.params.id },
    include: {
      permissions: {
        select: { id: true }, // Solo necesitamos los IDs para el frontend
      },
    },
  });

  if (!role) {
    throw new NotFoundError('Rol no encontrado');
  }

  res.status(200).json({ status: 'success', data: role });
});

/**
 * @desc    Crear un nuevo rol
 * @route   POST /api/roles
 * @access  Private/Admin (requiere permiso 'role:create')
 */
const createRole = asyncHandler(async (req, res) => {
  const { name, description, permissionIds } = req.body;

  if (!name) {
    throw new BadRequestError('El nombre del rol es requerido.');
  }

  const roleExists = await prisma.role.findUnique({ where: { name } });
  if (roleExists) {
    throw new BadRequestError('Ya existe un rol con ese nombre.');
  }

  const newRole = await prisma.role.create({
    data: {
      name,
      description,
      permissions: {
        connect: permissionIds.map(id => ({ id })),
      },
    },
  });

  res.status(201).json({ status: 'success', data: { role: newRole } });
});

/**
 * @desc    Actualizar un rol
 * @route   PUT /api/roles/:id
 * @access  Private/Admin (requiere permiso 'role:update')
 */
const updateRole = asyncHandler(async (req, res) => {
  const { name, description, permissionIds } = req.body;
  const { id } = req.params;

  const role = await prisma.role.findUnique({ where: { id } });

  if (!role) {
    throw new NotFoundError('Rol no encontrado');
  }

  if (role.name === 'SUPER_ADMIN' || role.name === 'USER') {
    throw new BadRequestError('Los roles SUPER_ADMIN y USER no se pueden modificar.');
  }

  const updatedRole = await prisma.role.update({
    where: { id },
    data: {
      name,
      description,
      permissions: {
        set: permissionIds.map(id => ({ id })), // Sincroniza los permisos
      },
    },
  });

  res.status(200).json({ status: 'success', data: { role: updatedRole } });
});

/**
 * @desc    Eliminar un rol
 * @route   DELETE /api/roles/:id
 * @access  Private/Admin (requiere permiso 'role:delete')
 */
const deleteRole = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });

  if (!role) throw new NotFoundError('Rol no encontrado');
  if (role.name === 'SUPER_ADMIN' || role.name === 'USER') throw new BadRequestError('Los roles base no se pueden eliminar.');
  if (role._count.users > 0) throw new BadRequestError('No se puede eliminar un rol que tiene usuarios asignados.');

  await prisma.role.delete({ where: { id } });

  res.status(200).json({ status: 'success', message: 'Rol eliminado correctamente' });
});

export {
  getAllPermissions,
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
};