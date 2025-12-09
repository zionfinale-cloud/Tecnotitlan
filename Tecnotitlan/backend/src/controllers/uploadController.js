import path from 'path';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import asyncHandler from 'express-async-handler';
import fs from 'fs';
import { cloudinary, configureCloudinary } from '../config/cloudinary.js';
import { getConfig } from '../services/configService.js';

const __dirname = path.resolve();
// --- Definición de Rutas de Destino ---
const logoUploadDir = path.join(__dirname, 'frontend', 'public', 'images', 'logo');
const defaultUploadDir = path.join(__dirname, 'uploads');

// Asegurarse de que el directorio de subidas del logo exista.
if (!fs.existsSync(logoUploadDir)) {
  fs.mkdirSync(logoUploadDir, { recursive: true });
}
// Asegurarse de que el directorio de subidas por defecto exista.
if (!fs.existsSync(defaultUploadDir)) {
  fs.mkdirSync(defaultUploadDir, { recursive: true });
}

// --- Estrategias de Almacenamiento de Multer ---

// 1. Almacenamiento Local
const localStorage = multer.diskStorage({
  destination(req, file, cb) {
    // --- LÓGICA DE DESTINO MEJORADA ---
    // Si el campo del formulario es 'logo' O si el frontend envía una pista
    // en la URL (ej. /api/upload?type=logo), lo tratamos como el logo del sitio.
    const isLogoUpload = file.fieldname === 'logo' || req.query.type === 'logo';

    if (isLogoUpload) {
      cb(null, logoUploadDir);
    } else {
      // Cualquier otra imagen va a la carpeta 'uploads' del backend.
      cb(null, defaultUploadDir);
    }
  },
  filename(req, file, cb) {
    // --- LÓGICA DE RENOMBRADO MEJORADA ---
    const isLogoUpload = file.fieldname === 'logo' || req.query.type === 'logo';

    if (isLogoUpload) {
      cb(null, 'logo.png');
    } else {
      // Para otras imágenes, se genera un nombre único.
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  },
});

// 2. Almacenamiento en Cloudinary
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'tecnotitlan',
    format: async (req, file) => 'webp', // Usar un formato moderno
    public_id: (req, file) => `product-${file.fieldname}-${Date.now()}`,
  },
});

// --- Middleware de Multer Dinámico ---
export const upload = multer({
  storage: getConfig().UPLOAD_STRATEGY === 'cloudinary' ? cloudinaryStorage : localStorage,
  fileFilter: function (req, file, cb) {
    if (getConfig().UPLOAD_STRATEGY === 'cloudinary') {
      configureCloudinary(); // Solo configurar si la estrategia es cloudinary
    }
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp).'), false);
  },
});

/**
 * @desc    Manejar la subida de imagen y devolver la ruta
 * @route   POST /api/upload
 * @access  Private/Admin
 */
export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No se ha subido ningún archivo.');
  }

  // Devolvemos la ruta pública para que el frontend pueda usarla.
  // Si es Cloudinary, req.file.path es la URL completa.
  // Si es local, construimos la ruta relativa.
  const filePath = getConfig().UPLOAD_STRATEGY === 'cloudinary'
    ? req.file.path
    : req.file.path.includes(path.join('frontend', 'public'))
      ? req.file.path.split(path.join('frontend', 'public'))[1].replace(/\\/g, '/')
      : `/uploads/${req.file.filename}`;

  res.status(201).json({
    status: 'success',
    message: 'Imagen subida con éxito',
    filePath: filePath,
  });
});