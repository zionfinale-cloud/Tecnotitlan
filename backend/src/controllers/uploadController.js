import path from 'path';
import multer from 'multer';
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

// Cloudinary recibe el archivo desde memoria mediante su SDK oficial. Esto evita
// depender de adaptadores desactualizados que fijan Cloudinary 1.x.
const cloudinaryStorage = multer.memoryStorage();

// --- Middleware de Multer Dinámico ---
export const upload = multer({
  storage: getConfig().UPLOAD_STRATEGY === 'cloudinary' ? cloudinaryStorage : localStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
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

  let cloudinaryUrl = null;
  if (getConfig().UPLOAD_STRATEGY === 'cloudinary') {
    configureCloudinary();
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        folder: 'tecnotitlan',
        format: 'webp',
        public_id: `product-${req.file.fieldname}-${Date.now()}`,
        resource_type: 'image',
      }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
      stream.end(req.file.buffer);
    });
    cloudinaryUrl = result.secure_url;
  }

  const publicPath = cloudinaryUrl
    ? cloudinaryUrl
    : req.file.path.includes(path.join('frontend', 'public'))
      ? req.file.path.split(path.join('frontend', 'public'))[1].replace(/\\/g, '/')
      : `/uploads/${req.file.filename}`;
  const filePath = publicPath.startsWith('/uploads/')
    ? `${req.protocol}://${req.get('host')}${publicPath}`
    : publicPath;

  res.status(201).json({
    status: 'success',
    message: 'Imagen subida con éxito',
    filePath: filePath,
  });
});
