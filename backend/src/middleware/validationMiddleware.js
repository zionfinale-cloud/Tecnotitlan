// backend/src/middleware/validationMiddleware.js
import { body, validationResult } from 'express-validator';
import { BadRequestError } from '../utils/errorUtils.js';

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => err.msg).join('. ');
    return next(new BadRequestError(errorMessages));
  }
  next();
};

const validateUserRegistration = [
  body('firstName')
    .trim()
    .notEmpty().withMessage('El nombre es requerido.'),
  body('lastName')
    .trim()
    .notEmpty().withMessage('El primer apellido es requerido.'),
  body('secondLastName')
    .optional({ checkFalsy: true })
    .trim(),
  body('email')
    .isEmail().withMessage('Debe ser un email válido.')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres.'),
  body('countryCode')
    .optional({ checkFalsy: true })
    .trim(),
  body('phone')
    .optional({ checkFalsy: true })
    .trim(),
  body('street')
    .notEmpty().withMessage('El domicilio es requerido.')
    .trim(),
  body('neighborhood')
    .optional({ checkFalsy: true })
    .trim(),
  body('city')
    .notEmpty().withMessage('El municipio/ciudad es requerido.')
    .trim(),
  body('state')
    .notEmpty().withMessage('El estado es requerido.')
    .trim(),
  body('postalCode')
    .notEmpty().withMessage('El código postal es requerido.')
    .isPostalCode('MX').withMessage('El código postal no es válido para México.'),
  handleValidationErrors,
];

const validateUserLogin = [
  body('email')
    .isEmail().withMessage('Debe ser un email válido.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('La contraseña es obligatoria.'),
  handleValidationErrors,
];

const validateProduct = [
  body('name')
    .trim()
    .notEmpty().withMessage('El nombre del producto es obligatorio.'),
  body('description')
    .trim()
    .notEmpty().withMessage('La descripcion es obligatoria.'),
  body('price')
    .isFloat({ gt: 0 }).withMessage('El precio debe ser un numero valido mayor que 0.'),
  body('costPrice')
    .optional({ checkFalsy: true })
    .isFloat({ gte: 0 }).withMessage('El precio de costo debe ser un numero no negativo.'),
  body('categoryId', 'La categoria es obligatoria.')
    .not()
    .isEmpty()
    .isString().withMessage('El ID de la categoria debe ser un string valido.'),
  body('countInStock', 'El stock debe ser un numero entero no negativo.')
    .optional({ nullable: true })
    .isInt({ min: 0 }),
  body('skuPrefix')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 3 }).withMessage('El prefijo SKU debe tener 2 o 3 caracteres.'),
  body('productType')
    .optional()
    .isIn(['IN_HOUSE', 'DROPSHIPPING']).withMessage('El tipo de producto no es valido.'),
  body('shippingPayer')
    .optional()
    .isIn(['CUSTOMER', 'SELLER', 'MARKETPLACE']).withMessage('La regla de envio no es valida.'),
  body('shippingCostEstimate')
    .optional({ checkFalsy: true })
    .isFloat({ gte: 0 }).withMessage('El costo estimado de envio debe ser no negativo.'),
  body('weightKg')
    .optional({ checkFalsy: true })
    .isFloat({ gte: 0 }).withMessage('El peso debe ser no negativo.'),
  body('lengthCm')
    .optional({ checkFalsy: true })
    .isFloat({ gte: 0 }).withMessage('El largo debe ser no negativo.'),
  body('widthCm')
    .optional({ checkFalsy: true })
    .isFloat({ gte: 0 }).withMessage('El ancho debe ser no negativo.'),
  body('heightCm')
    .optional({ checkFalsy: true })
    .isFloat({ gte: 0 }).withMessage('El alto debe ser no negativo.'),
  body('supplierInfo')
    .if(body('productType').equals('DROPSHIPPING'))
    .notEmpty().withMessage('La informacion del proveedor es obligatoria para productos de dropshipping.')
    .trim()
    .escape(),
  handleValidationErrors,
];

export {
  validateUserRegistration,
  validateUserLogin,
  validateProduct,
};
