import { AppError } from '../utils/errorUtils.js';
import { Prisma } from '@prisma/client';

// Middleware para manejar rutas no encontradas (404)
const notFound = (req, res, next) => {
  const error = new Error(`No encontrado - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Middleware para manejar todos los demás errores
const errorHandler = (err, req, res, next) => {
  // Establecer valores por defecto
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;
  let status = 'error';

  // Si es un error operacional que hemos creado (AppError o sus hijos), usamos sus propiedades
  if (err.isOperational) {
    statusCode = err.statusCode;
    status = err.status;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Manejar errores conocidos de Prisma
    switch (err.code) {
      case 'P2002': // Violación de restricción única
        statusCode = 400;
        // err.meta.target es un array de los campos que causaron el error
        message = `Ya existe un registro con este valor en el campo: ${err.meta.target.join(', ')}.`;
        status = 'fail';
        break;
      case 'P2025': // Registro no encontrado
        statusCode = 404;
        message = 'El recurso que intentas modificar o eliminar no fue encontrado.';
        status = 'fail';
        break;
      default:
        // Para otros errores de Prisma, mantenemos un mensaje genérico
        message = 'Ocurrió un error en la base de datos.';
        break;
    }
  }

  res.status(statusCode).json({
    status: status,
    message,
    // Solo mostrar el stack de error en modo de desarrollo
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

export { notFound, errorHandler };
